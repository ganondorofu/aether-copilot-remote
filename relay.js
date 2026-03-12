#!/usr/bin/env node
// ── Copilot Remote Relay Server ──
// Socket.IO relay that connects daemons and clients.
// The relay is zero-knowledge: all payloads are E2E encrypted.
// It routes messages between daemons and clients by session ID.

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import express from "express";
import { Server as SocketIO } from "socket.io";
import { RELAY_EVENTS } from "./lib/protocol.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "8787", 10);

// ── Simple token store (in production, use a proper DB) ──
const TOKENS = new Map(); // token → { role, machineId?, userId? }
const SESSIONS = new Map(); // sessionId → { daemonSocketId, machineId, createdAt, state? }

// Generate initial access tokens from env or random
const DAEMON_TOKEN = process.env.DAEMON_TOKEN || randomUUID();
const CLIENT_TOKEN = process.env.CLIENT_TOKEN || randomUUID();

TOKENS.set(DAEMON_TOKEN, { role: "daemon" });
TOKENS.set(CLIENT_TOKEN, { role: "client" });

// ── Express app ──
const app = express();
app.use(express.json());

// Serve static web client files
app.use(express.static(join(__dirname, "public")));

// REST: health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, sessions: SESSIONS.size });
});

// REST: get connection info (for QR code generation)
app.get("/api/info", (_req, res) => {
  const host = _req.headers.host || `localhost:${PORT}`;
  const protocol = _req.secure ? "https" : "http";
  res.json({
    relay: `${protocol}://${host}`,
    clientToken: CLIENT_TOKEN,
    daemonToken: DAEMON_TOKEN,
  });
});

const httpServer = createServer(app);

// ── Socket.IO ──
const io = new SocketIO(httpServer, {
  cors: { origin: "*" },
  maxHttpBufferSize: 10 * 1024 * 1024, // 10MB for large diffs
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on("connection", (socket) => {
  let authed = false;
  let role = null;
  let sessionIds = new Set();

  console.log(`[relay] new connection: ${socket.id}`);

  // ── Auth ──
  socket.on(RELAY_EVENTS.AUTH, (data, ack) => {
    const tokenInfo = TOKENS.get(data?.token);
    if (!tokenInfo) {
      ack?.({ ok: false, error: "Invalid token" });
      socket.disconnect(true);
      return;
    }
    authed = true;
    role = tokenInfo.role;
    ack?.({ ok: true, role });
    console.log(`[relay] authenticated: ${socket.id} as ${role}`);
  });

  // ── Daemon: register session ──
  socket.on(RELAY_EVENTS.REGISTER_DAEMON, (data, ack) => {
    if (!authed || role !== "daemon") return ack?.({ ok: false, error: "Unauthorized" });

    const sessionId = data?.sessionId || randomUUID();
    SESSIONS.set(sessionId, {
      daemonSocketId: socket.id,
      machineId: data?.machineId || "unknown",
      createdAt: Date.now(),
      state: null,
    });
    socket.join(`session:${sessionId}`);
    sessionIds.add(sessionId);

    ack?.({ ok: true, sessionId });
    console.log(`[relay] daemon registered session: ${sessionId}`);

    // Notify connected clients about new session
    io.to("clients").emit(RELAY_EVENTS.SESSION_LIST, getSessionList());
  });

  // ── Client: join session ──
  socket.on(RELAY_EVENTS.JOIN_SESSION, (data, ack) => {
    if (!authed || role !== "client") return ack?.({ ok: false, error: "Unauthorized" });

    const session = SESSIONS.get(data?.sessionId);
    if (!session) return ack?.({ ok: false, error: "Session not found" });

    socket.join(`session:${data.sessionId}`);
    sessionIds.add(data.sessionId);
    socket.join("clients");

    ack?.({ ok: true, sessionId: data.sessionId });
    console.log(`[relay] client joined session: ${data.sessionId}`);

    // Send cached state if available
    if (session.state) {
      socket.emit(RELAY_EVENTS.SESSION_STATE, {
        sessionId: data.sessionId,
        state: session.state,
      });
    }
  });

  // ── Client: list sessions ──
  socket.on(RELAY_EVENTS.SESSION_LIST, (_data, ack) => {
    if (!authed) return ack?.({ ok: false, error: "Unauthorized" });
    ack?.(getSessionList());
  });

  // ── Daemon → Clients: message relay ──
  socket.on(RELAY_EVENTS.MESSAGE, (data) => {
    if (!authed || role !== "daemon") return;
    const sessionId = data?.sessionId;
    if (!sessionId || !SESSIONS.has(sessionId)) return;

    // Cache state updates
    const session = SESSIONS.get(sessionId);
    if (data.stateSnapshot) {
      session.state = data.stateSnapshot;
    }

    // Broadcast to all clients in this session (except daemon itself)
    socket.to(`session:${sessionId}`).emit(RELAY_EVENTS.MESSAGE, data);
  });

  // ── Client → Daemon: user prompt ──
  socket.on(RELAY_EVENTS.USER_PROMPT, (data) => {
    if (!authed || role !== "client") return;
    routeToDaemon(data?.sessionId, RELAY_EVENTS.USER_PROMPT, data);
  });

  // ── Client → Daemon: permission response ──
  socket.on(RELAY_EVENTS.PERMISSION_RESPONSE, (data) => {
    if (!authed || role !== "client") return;
    routeToDaemon(data?.sessionId, RELAY_EVENTS.PERMISSION_RESPONSE, data);
  });

  // ── Client → Daemon: cancel ──
  socket.on(RELAY_EVENTS.USER_CANCEL, (data) => {
    if (!authed || role !== "client") return;
    routeToDaemon(data?.sessionId, RELAY_EVENTS.USER_CANCEL, data);
  });

  // ── Client → Daemon: mode change ──
  socket.on(RELAY_EVENTS.USER_MODE_CHANGE, (data) => {
    if (!authed || role !== "client") return;
    routeToDaemon(data?.sessionId, RELAY_EVENTS.USER_MODE_CHANGE, data);
  });

  // ── Client → Daemon: model change ──
  socket.on(RELAY_EVENTS.USER_MODEL_CHANGE, (data) => {
    if (!authed || role !== "client") return;
    routeToDaemon(data?.sessionId, RELAY_EVENTS.USER_MODEL_CHANGE, data);
  });

  // ── Client → Daemon: config change ──
  socket.on(RELAY_EVENTS.USER_CONFIG_CHANGE, (data) => {
    if (!authed || role !== "client") return;
    routeToDaemon(data?.sessionId, RELAY_EVENTS.USER_CONFIG_CHANGE, data);
  });

  // ── Daemon: heartbeat ──
  socket.on(RELAY_EVENTS.DAEMON_ALIVE, () => {
    if (!authed || role !== "daemon") return;
    for (const sid of sessionIds) {
      const s = SESSIONS.get(sid);
      if (s) s.lastAlive = Date.now();
    }
  });

  // ── Disconnect ──
  socket.on("disconnect", (reason) => {
    console.log(`[relay] disconnected: ${socket.id} (${role}) reason=${reason}`);
    if (role === "daemon") {
      for (const sid of sessionIds) {
        const s = SESSIONS.get(sid);
        if (s && s.daemonSocketId === socket.id) {
          // Notify clients that daemon disconnected
          io.to(`session:${sid}`).emit(RELAY_EVENTS.MESSAGE, {
            sessionId: sid,
            envelope: { ev: { t: "status", message: "Daemon disconnected", level: "error" } },
          });
        }
      }
    }
  });

  function routeToDaemon(sessionId, event, data) {
    const session = SESSIONS.get(sessionId);
    if (!session) return;
    io.to(session.daemonSocketId).emit(event, data);
  }
});

function getSessionList() {
  const list = [];
  for (const [id, s] of SESSIONS) {
    list.push({
      sessionId: id,
      machineId: s.machineId,
      createdAt: s.createdAt,
      hasDaemon: io.sockets.sockets.has(s.daemonSocketId),
    });
  }
  return { sessions: list };
}

// ── Start ──
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  Copilot Remote Relay Server                     ║`);
  console.log(`╠══════════════════════════════════════════════════╣`);
  console.log(`║  Web UI:  http://localhost:${PORT}                  ║`);
  console.log(`║  Relay:   ws://localhost:${PORT}                    ║`);
  console.log(`╠══════════════════════════════════════════════════╣`);
  console.log(`║  Daemon Token: ${DAEMON_TOKEN.slice(0, 8)}...                       ║`);
  console.log(`║  Client Token: ${CLIENT_TOKEN.slice(0, 8)}...                       ║`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);
});
