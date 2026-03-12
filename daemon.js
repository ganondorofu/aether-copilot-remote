#!/usr/bin/env node
// ── Copilot Remote Daemon ──
// Runs locally alongside Copilot CLI.
// Manages the ACP connection and relays events to/from the relay server.

import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { io as SocketIOClient } from "socket.io-client";
import * as acp from "@agentclientprotocol/sdk";
import { RELAY_EVENTS } from "./lib/protocol.js";
import { encrypt, decrypt, importKey, generateKey, exportKey } from "./lib/crypto.js";

// ── Config ──
const RELAY_URL = process.env.RELAY_URL || "http://localhost:8787";
const DAEMON_TOKEN = process.env.DAEMON_TOKEN || process.argv[2];
const ENCRYPTION_KEY_B64 = process.env.ENCRYPTION_KEY || process.argv[3];
const MACHINE_ID = process.env.MACHINE_ID || hostname();
const COPILOT_PATH = process.env.COPILOT_PATH || "copilot";
const COPILOT_CWD = process.env.COPILOT_CWD || process.cwd();

if (!DAEMON_TOKEN) {
  console.error("Usage: node daemon.js <DAEMON_TOKEN> [ENCRYPTION_KEY]");
  console.error("  Or set RELAY_URL, DAEMON_TOKEN, ENCRYPTION_KEY env vars");
  process.exit(1);
}

let encryptionKey = null;
if (ENCRYPTION_KEY_B64) {
  encryptionKey = importKey(ENCRYPTION_KEY_B64);
} else {
  encryptionKey = generateKey();
  console.log(`[daemon] Generated encryption key: ${exportKey(encryptionKey)}`);
  console.log(`[daemon] Share this key with clients for E2E encryption`);
}

// ── State ──
let connection = null; // ACP ClientSideConnection
let copilotProcess = null;
let sessionId = null; // relay session
let acpSessionId = null; // ACP session
let currentState = {
  modes: null,
  models: null,
  configOptions: [],
  commands: [],
  connected: false,
};
let promptQueue = [];
let isPrompting = false;

// ── Socket.IO Client → Relay ──
const socket = SocketIOClient(RELAY_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
  timeout: 20000,
});

// ── ACP Client implementation (bridges relay ↔ ACP) ──
class DaemonClient {
  constructor() {
    this.pendingPermissions = new Map(); // requestId → { resolve, timer }
  }

  requestPermission(request) {
    return new Promise((resolve) => {
      const requestId = randomUUID();

      // Store the resolver
      this.pendingPermissions.set(requestId, { resolve });

      // Send to relay
      sendToRelay({
        ev: {
          t: "permission",
          requestId,
          title: request.title || "Permission Required",
          toolCall: request.toolCall || null,
          options: request.options || [],
          content: request.content || null,
        },
      });
    });
  }

  sessionUpdate(update) {
    handleSessionUpdate(update);
  }
}

const daemonClient = new DaemonClient();

// ── ACP: spawn copilot and initialize ──
async function initAcp() {
  console.log(`[daemon] spawning ${COPILOT_PATH} --acp --stdio ...`);

  copilotProcess = spawn(COPILOT_PATH, ["--acp", "--stdio"], {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: COPILOT_CWD,
    env: { ...process.env },
  });

  copilotProcess.stderr.on("data", (d) => {
    const msg = d.toString().trim();
    if (msg) {
      console.error(`[copilot stderr] ${msg}`);
      sendToRelay({ ev: { t: "status", message: `[stderr] ${msg}`, level: "debug" } });
    }
  });

  copilotProcess.on("error", (err) => {
    console.error("[daemon] copilot spawn error:", err.message);
    sendToRelay({ ev: { t: "error", message: `Copilot spawn failed: ${err.message}` } });
  });

  copilotProcess.on("exit", (code, signal) => {
    console.log(`[daemon] copilot exited (code=${code}, signal=${signal})`);
    sendToRelay({ ev: { t: "status", message: `Copilot exited (code=${code})`, level: "error" } });
  });

  // Create ACP transport and connection
  const output = Writable.toWeb(copilotProcess.stdin);
  const input = Readable.toWeb(copilotProcess.stdout);
  const stream = acp.ndJsonStream(output, input);

  connection = new acp.ClientSideConnection(() => daemonClient, stream);

  // Initialize
  const initResult = await connection.initialize({
    protocolVersion: acp.PROTOCOL_VERSION,
    clientCapabilities: {},
  });
  console.log("[daemon] ACP initialized:", initResult?.serverInfo?.name);

  // Create session
  const sessionResult = await connection.newSession({
    cwd: COPILOT_CWD,
    mcpServers: [],
  });
  acpSessionId = sessionResult.sessionId;

  // Extract state
  if (sessionResult.modes) {
    currentState.modes = sessionResult.modes;
  }
  if (sessionResult.models) {
    currentState.models = sessionResult.models;
  }
  if (sessionResult.configOptions) {
    currentState.configOptions = sessionResult.configOptions;
  }
  currentState.connected = true;

  console.log("[daemon] session created:", acpSessionId);
  console.log("[daemon] modes:", currentState.modes?.availableModes?.map((m) => m.id));
  console.log("[daemon] models:", currentState.models?.availableModels?.map((m) => m.modelId));

  return connection;
}

// ── Send envelope to relay (encrypted) ──
function sendToRelay(envelope, stateSnapshot) {
  if (!socket.connected || !sessionId) return;

  const payload = {
    sessionId,
    envelope: encryptionKey ? encrypt(envelope, encryptionKey) : envelope,
    encrypted: !!encryptionKey,
  };
  if (stateSnapshot) {
    payload.stateSnapshot = encryptionKey ? encrypt(stateSnapshot, encryptionKey) : stateSnapshot;
  }
  socket.emit(RELAY_EVENTS.MESSAGE, payload);
}

// ── Decrypt incoming message ──
function decryptFromRelay(data) {
  if (data?.encrypted && encryptionKey) {
    try {
      return decrypt(data, encryptionKey);
    } catch (e) {
      console.error("[daemon] decrypt error:", e.message);
      return null;
    }
  }
  return data;
}

// ── ACP: handle prompt lifecycle ──
async function executePrompt(text) {
  if (!connection) return;
  isPrompting = true;

  sendToRelay({ ev: { t: "turn-start" } });

  try {
    const result = await connection.prompt({
      sessionId: acpSessionId,
      message: text,
    });

    sendToRelay({
      ev: {
        t: "turn-end",
        status: "completed",
        stopReason: result?.stopReason || "end_turn",
      },
    });
  } catch (err) {
    console.error("[daemon] prompt error:", err.message);
    sendToRelay({
      ev: {
        t: "turn-end",
        status: "failed",
        stopReason: err.message,
      },
    });
  } finally {
    isPrompting = false;
    drainPromptQueue();
  }
}

function drainPromptQueue() {
  if (isPrompting) return;
  if (promptQueue.length === 0) return;
  const next = promptQueue.shift();
  executePrompt(next);
}

// ── ACP: handle session updates (called by DaemonClient.sessionUpdate) ──
function handleSessionUpdate(update) {
  const kind = update?.kind;
  if (!kind) return;

  switch (kind) {
    case "agent_message_chunk":
      sendToRelay({
        ev: { t: "text", text: update.textDelta || "", thinking: false },
      });
      break;

    case "agent_thought_chunk":
      sendToRelay({
        ev: { t: "text", text: update.textDelta || "", thinking: true },
      });
      break;

    case "tool_call":
      sendToRelay({
        ev: {
          t: "tool-call-start",
          callId: update.toolCallId,
          name: update.title || update.toolName || "",
          title: update.title || "",
          kind: update.kind || "",
        },
      });
      break;

    case "tool_call_update":
      sendToRelay({
        ev: {
          t: "tool-call-end",
          callId: update.toolCallId,
          status: update.status || "completed",
          content: update.content,
          diff: update.diff,
          locations: update.locations,
        },
      });
      break;

    case "plan":
      sendToRelay({
        ev: { t: "plan", entries: update.entries || [] },
      });
      break;

    case "available_commands_update":
      currentState.commands = update.commands || [];
      sendToRelay(
        { ev: { t: "state", commands: currentState.commands } },
        currentState
      );
      break;

    case "current_mode_update":
      if (currentState.modes) {
        currentState.modes.currentModeId = update.modeId;
      }
      sendToRelay(
        { ev: { t: "mode-change", modeId: update.modeId } },
        currentState
      );
      break;

    case "config_option_update":
      if (update.configOption) {
        const idx = currentState.configOptions.findIndex(
          (c) => c.id === update.configOption.id
        );
        if (idx >= 0) currentState.configOptions[idx] = update.configOption;
        else currentState.configOptions.push(update.configOption);
      }
      sendToRelay(
        { ev: { t: "state", configOptions: currentState.configOptions } },
        currentState
      );
      break;

    case "usage_update":
      sendToRelay({ ev: { t: "usage", data: update } });
      break;

    case "session_info_update":
      sendToRelay({
        ev: { t: "status", message: `Session: ${update.title || ""}`, level: "info" },
      });
      break;

    default:
      break;
  }
}

// ── Socket.IO: connect to relay ──
socket.on("connect", () => {
  console.log("[daemon] connected to relay");

  socket.emit(RELAY_EVENTS.AUTH, { token: DAEMON_TOKEN }, (res) => {
    if (!res?.ok) {
      console.error("[daemon] auth failed:", res?.error);
      process.exit(1);
    }
    console.log("[daemon] authenticated as daemon");

    socket.emit(RELAY_EVENTS.REGISTER_DAEMON, { machineId: MACHINE_ID }, (res2) => {
      if (!res2?.ok) {
        console.error("[daemon] register failed:", res2?.error);
        return;
      }
      sessionId = res2.sessionId;
      console.log(`[daemon] session registered: ${sessionId}`);

      // Send initial state
      sendToRelay(
        { ev: { t: "session-start", sessionId } },
        currentState
      );
    });
  });
});

socket.on("disconnect", (reason) => {
  console.log(`[daemon] disconnected from relay: ${reason}`);
});

socket.on("connect_error", (err) => {
  console.error(`[daemon] relay connection error: ${err.message}`);
});

// ── Client commands via relay ──
socket.on(RELAY_EVENTS.USER_PROMPT, (data) => {
  const text = data?.text;
  if (!text) return;

  console.log(`[daemon] prompt: ${text.slice(0, 80)}...`);
  promptQueue.push(text);
  drainPromptQueue();
});

socket.on(RELAY_EVENTS.PERMISSION_RESPONSE, (data) => {
  const requestId = data?.requestId;
  const entry = daemonClient.pendingPermissions.get(requestId);
  if (!entry) {
    console.warn(`[daemon] no pending permission for ${requestId}`);
    return;
  }
  daemonClient.pendingPermissions.delete(requestId);

  const optionId = data?.optionId;
  const feedback = data?.feedback;

  if (optionId) {
    entry.resolve({ outcome: { outcome: "selected", optionId } });
  } else {
    entry.resolve({ outcome: { outcome: "cancelled" } });
  }

  // Queue feedback as next prompt
  if (feedback) {
    promptQueue.push(feedback);
    drainPromptQueue();
  }
});

socket.on(RELAY_EVENTS.USER_CANCEL, async () => {
  if (!connection) return;
  console.log("[daemon] cancel requested");
  try {
    await connection.cancel({ sessionId: acpSessionId });
  } catch (err) {
    console.error("[daemon] cancel error:", err.message);
  }
});

socket.on(RELAY_EVENTS.USER_MODE_CHANGE, async (data) => {
  if (!connection) return;
  const modeId = data?.modeId;
  if (!modeId) return;

  console.log(`[daemon] mode change: ${modeId}`);
  try {
    await connection.setSessionMode({ sessionId: acpSessionId, modeId });
    if (currentState.modes) currentState.modes.currentModeId = modeId;
    sendToRelay({ ev: { t: "mode-change", modeId } }, currentState);
  } catch (err) {
    sendToRelay({ ev: { t: "error", message: `Mode change failed: ${err.message}` } });
  }
});

socket.on(RELAY_EVENTS.USER_MODEL_CHANGE, async (data) => {
  if (!connection) return;
  const modelId = data?.modelId;
  if (!modelId) return;

  console.log(`[daemon] model change: ${modelId}`);
  try {
    await connection.unstable_setSessionModel({ sessionId: acpSessionId, modelId });
    if (currentState.models) currentState.models.currentModelId = modelId;
    sendToRelay({ ev: { t: "model-change", modelId } }, currentState);
  } catch (err) {
    sendToRelay({ ev: { t: "error", message: `Model change failed: ${err.message}` } });
  }
});

socket.on(RELAY_EVENTS.USER_CONFIG_CHANGE, async (data) => {
  if (!connection) return;
  const configId = data?.configId;
  const value = data?.value;
  if (!configId) return;

  console.log(`[daemon] config change: ${configId} = ${value}`);
  try {
    await connection.setSessionConfigOption({
      sessionId: acpSessionId,
      configId,
      value,
    });
  } catch (err) {
    sendToRelay({ ev: { t: "error", message: `Config change failed: ${err.message}` } });
  }
});

// ── Heartbeat ──
setInterval(() => {
  if (socket.connected) socket.emit(RELAY_EVENTS.DAEMON_ALIVE);
}, 30000);

// ── Main ──
async function main() {
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  Copilot Remote Daemon                           ║`);
  console.log(`╠══════════════════════════════════════════════════╣`);
  console.log(`║  Relay:    ${RELAY_URL.padEnd(38)}║`);
  console.log(`║  Machine:  ${MACHINE_ID.padEnd(38)}║`);
  console.log(`║  E2E Key:  ${exportKey(encryptionKey).slice(0, 12)}...                          ║`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);

  try {
    await initAcp();
    console.log("[daemon] ACP ready, connecting to relay...");
    socket.connect();
  } catch (err) {
    console.error("[daemon] Failed to initialize ACP:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[daemon] Fatal:", err);
  process.exit(1);
});

// ── Graceful shutdown ──
async function shutdown() {
  console.log("\n[daemon] shutting down...");
  if (connection) {
    try { await connection.close(); } catch {}
  }
  if (copilotProcess) {
    try { copilotProcess.kill(); } catch {}
  }
  socket.disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
