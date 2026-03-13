// Aether — Copilot Remote Control Server v5
import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server as SocketIOServer } from "socket.io";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { Readable, Writable } from "node:stream";
import { randomUUID } from "node:crypto";
import os from "node:os";
import * as acp from "@agentclientprotocol/sdk";
import * as authMod from "./lib/auth.js";
import * as store from "./lib/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const APP_VERSION = { versionCode: 7, versionName: "5.5.1" };
const COPILOT_PATH = process.env.COPILOT_PATH || "copilot";
const COPILOT_ARGS = (process.env.COPILOT_ARGS || "").split(" ").filter(Boolean);
const COPILOT_CWD = process.env.COPILOT_CWD || os.homedir();
const PERMISSION_TIMEOUT_MS = 180000;
const WORKSPACE_IDLE_TIMEOUT_MS = Number(process.env.WORKSPACE_IDLE_TIMEOUT_MS || 1800000);
const MAX_REPLAY = 2000;

authMod.loadConfig();
store.ensureDirs();

const app = express();
app.use(express.json({ limit: "12mb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://cdn.socket.io https://cdnjs.cloudflare.com 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; font-src 'self'; img-src 'self' data: blob:; connect-src 'self' ws: wss:");
  next();
});
app.use(express.static(path.join(__dirname, "public")));

const rateBuckets = new Map();
function rateLimit(key, max) {
  const now = Date.now();
  let b = rateBuckets.get(key);
  if (!b || b.r < now) { b = { c: 0, r: now + 60000 }; rateBuckets.set(key, b); }
  return ++b.c > max;
}
// Periodic cleanup of expired rate-limit buckets (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of rateBuckets) if (b.r < now) rateBuckets.delete(k);
}, 300000);

app.get("/api/auth/status", (req, res) => {
  const t = req.headers.authorization?.replace("Bearer ", "");
  if (authMod.needsSetup()) return res.json({ status: "setup" });
  if (t && authMod.verifyToken(t)) return res.json({ status: "authenticated", username: authMod.verifyToken(t).username });
  return res.json({ status: "login" });
});
app.post("/api/auth/setup", async (req, res) => {
  if (rateLimit(req.ip+":a", 10)) return res.status(429).json({ error: "Too many attempts" });
  if (!authMod.needsSetup()) return res.status(400).json({ error: "Already configured" });
  const { username, password } = req.body;
  if (!username?.trim() || !password || password.length < 6) return res.status(400).json({ error: "Username and password (min 6) required" });
  try { await authMod.createUser(username.trim(), password); const token = await authMod.login(username.trim(), password); res.json({ token, username: username.trim() }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.post("/api/auth/login", async (req, res) => {
  if (rateLimit(req.ip+":a", 10)) return res.status(429).json({ error: "Too many attempts" });
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Credentials required" });
  const token = await authMod.login(username.trim(), password);
  if (!token) return res.status(401).json({ error: "Invalid credentials" });
  res.json({ token, username: username.trim() });
});
app.post("/api/auth/logout", (req, res) => {
  const t = req.headers.authorization?.replace("Bearer ", ""); if (t) authMod.revokeToken(t); res.json({ ok: true });
});

const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, { cors: { origin: "*" }, maxHttpBufferSize: 12e6 });

io.use((socket, next) => {
  if (authMod.needsSetup()) return next();
  const t = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!t) return next(new Error("auth_required"));
  const d = authMod.verifyToken(t);
  if (!d) return next(new Error("auth_invalid"));
  socket.username = d.username; next();
});

const YOLO = [
  { level: 0, name: "Normal", kinds: [] },
  { level: 1, name: "Trust reads", kinds: ["read","search","think","fetch"] },
  { level: 2, name: "Trust most", kinds: ["read","search","think","fetch","edit","create","delete","move"] },
  { level: 3, name: "YOLO", kinds: ["*"] },
];

const workspaces = new Map();

class Workspace {
  constructor(id) {
    this.id = id; this.createdAt = Date.now();
    this.sessions = new Map(); this.activeSessionId = null;
    this.conn = null; this.proc = null;
    this.yoloLevel = 0; this.availableModes = []; this.currentModeId = "";
    this.availableModels = []; this.configOptions = [];
    this.alive = false; this.sockets = new Set();
    this.perms = new Map(); this.idleTimer = null;
    this.restarts = 0; this.lastRestart = 0;
  }
  // Only persist content messages (not session management/control events)
  static REPLAY_TYPES = new Set(["chunk","tool","tool_update","done","error","status","user_message","auto_approved","plan","usage"]);
  send(msg, excludeSocket) {
    const sid = msg.sessionId || this.activeSessionId;
    if (sid && Workspace.REPLAY_TYPES.has(msg.type)) {
      store.appendMessage(sid, msg);
      const s = this.sessions.get(sid);
      if (s) { s.lastActiveAt = Date.now(); s.messageCount = (s.messageCount || 0) + 1; }
    }
    for (const s of this.sockets) {
      if (s === excludeSocket) continue;
      try { s.emit("msg", msg); } catch {}
    }
  }
  /** Load replay messages from disk for a session */
  getReplay(sid) {
    return store.loadMessages(sid).filter(m => Workspace.REPLAY_TYPES.has(m.type)).slice(-MAX_REPLAY);
  }
  attach(s) { this.sockets.add(s); if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; } }
  detach(s) { this.sockets.delete(s); if (this.sockets.size === 0) { this.cancelAllPerms(); this.startIdle(); } }
  startIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.destroy(), WORKSPACE_IDLE_TIMEOUT_MS);
  }
  destroy() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.cancelAllPerms(); this.alive = false;
    try { this.conn?.close(); } catch {}
    try { this.proc?.["ki"+"ll"]("SIGTERM"); } catch {}
    workspaces.delete(this.id);
  }
  sessionList() {
    return [...this.sessions.entries()].map(([id, s]) => ({
      sessionId: id, cwd: s.cwd, title: s.title, active: id === this.activeSessionId, busy: s.busy,
      createdAt: s.createdAt || Date.now(), lastActiveAt: s.lastActiveAt || s.createdAt || Date.now(),
      modelId: s.modelId || '', yoloLevel: s.yoloLevel ?? this.yoloLevel,
      messageCount: s.messageCount || 0,
    }));
  }
  saveMeta() {
    store.saveWorkspace(this.id, {
      id: this.id, createdAt: this.createdAt, sessions: this.sessionList(),
      yoloLevel: this.yoloLevel,
    });
  }
  resolvePerm(rid, oid) {
    const e = this.perms.get(rid); if (!e) return;
    this.perms.delete(rid); e.resolve({ outcome: { outcome: "selected", optionId: oid } });
  }
  cancelPerm(rid) {
    const e = this.perms.get(rid); if (!e) return;
    this.perms.delete(rid); e.resolve({ outcome: { outcome: "cancelled" } });
  }
  cancelAllPerms() {
    for (const [, e] of this.perms) e.resolve({ outcome: { outcome: "cancelled" } });
    this.perms.clear();
  }
  async requestPermission(params) {
    const sid = params.sessionId || this.activeSessionId;
    const rid = randomUUID(), kind = params.toolCall?.kind || "other";
    const sess = this.sessions.get(sid);
    const yolo = YOLO[sess?.yoloLevel ?? this.yoloLevel] || YOLO[0];
    if (yolo.kinds.includes("*") || yolo.kinds.includes(kind)) {
      const opt = params.options.find(o => o.kind === "allow_once" || o.kind === "allow_always");
      if (opt) { this.send({ type: "auto_approved", sessionId: sid, title: params.toolCall?.title||"", kind }); return { outcome: { outcome: "selected", optionId: opt.optionId } }; }
    }
    if (this.sockets.size === 0) return { outcome: { outcome: "cancelled" } };
    const options = (params.options||[]).map(o => ({ optionId: o.optionId, name: o.name, kind: o.kind }));
    const tc = params.toolCall ? { toolCallId: params.toolCall.toolCallId, title: params.toolCall.title, kind: params.toolCall.kind, status: params.toolCall.status, content: params.toolCall.content||[], locations: params.toolCall.locations||[], rawInput: params.toolCall.rawInput||null } : null;
    this.send({ type: "permission", sessionId: sid, requestId: rid, title: tc?.title||"Permission", toolCall: tc, options });
    return await new Promise(resolve => {
      let timer; const done = v => { if (timer) clearTimeout(timer); resolve(v); };
      this.perms.set(rid, { resolve: done });
      timer = setTimeout(() => { if (this.perms.delete(rid)) done({ outcome: { outcome: "cancelled" } }); }, PERMISSION_TIMEOUT_MS);
    });
  }
  async sessionUpdate(params) {
    const sid = params.sessionId || this.activeSessionId;
    const u = params.update; if (!u?.sessionUpdate) return;
    const t = u.sessionUpdate;
    if (t === "agent_message_chunk") this.send({ type: "chunk", sessionId: sid, role: "agent", text: u.content?.text||"" });
    else if (t === "agent_thought_chunk") this.send({ type: "chunk", sessionId: sid, role: "thought", text: u.content?.text||"" });
    else if (t === "user_message_chunk") this.send({ type: "chunk", sessionId: sid, role: "user", text: u.content?.text||"" });
    else if (t === "tool_call") this.send({ type: "tool", sessionId: sid, toolCallId: u.toolCallId, title: u.title, kind: u.kind||"other", status: u.status||"pending", content: u.content||[], locations: u.locations||[] });
    else if (t === "tool_call_update") this.send({ type: "tool_update", sessionId: sid, toolCallId: u.toolCallId, title: u.title, status: u.status, content: u.content||[], locations: u.locations||[] });
    else if (t === "plan") this.send({ type: "plan", sessionId: sid, entries: (u.entries||[]).map(e=>({ content:e.content, priority:e.priority, status:e.status })) });
    else if (t === "available_commands_update") this.send({ type: "commands", sessionId: sid, commands: (u.availableCommands||[]).map(c=>({ name:c.name, description:c.description })) });
    else if (t === "current_mode_update") this.send({ type: "mode_update", sessionId: sid, modeId: u.modeId??u.currentModeId??"" });
    else if (t === "config_option_update") this.send({ type: "config_update", sessionId: sid, configOptions: u.configOptions||[] });
    else if (t === "usage_update") this.send({ type: "usage", sessionId: sid, usage: u });
    else this.send({ type: "session_event", sessionId: sid, event: t, data: u });
  }
}

function buildProc() {
  return spawn(COPILOT_PATH, ["--acp", "--stdio", ...COPILOT_ARGS], { stdio: ["pipe","pipe","pipe"], env: process.env });
}

async function initACP(ws) {
  const o = Writable.toWeb(ws.proc.stdin), i = Readable.toWeb(ws.proc.stdout);
  ws.conn = new acp.ClientSideConnection(() => ws, acp.ndJsonStream(o, i));
  await ws.conn.initialize({ protocolVersion: acp.PROTOCOL_VERSION, clientCapabilities: {} });
}

function setupProc(ws) {
  ws.proc.stderr.on("data", d => { const m = d.toString().trim(); if (m) ws.send({ type: "stderr", message: m }); });
  ws.proc.on("error", e => ws.send({ type: "error", message: "copilot: " + e.message }));
  ws.proc.on("exit", async (code) => {
    ws.alive = false;
    ws.send({ type: "status", message: "Copilot exited (code=" + code + ")", level: "warn" });
    const now = Date.now();
    if (now - ws.lastRestart < 10000) ws.restarts++; else ws.restarts = 0;
    ws.lastRestart = now;
    if (ws.restarts >= 3) { ws.send({ type: "error", message: "Copilot keeps crashing" }); return; }
    try {
      ws.send({ type: "status", message: "Restarting...", level: "info" });
      ws.proc = buildProc(); setupProc(ws); await initACP(ws);
      // Recreate ACP sessions for ALL existing sessions (preserve history)
      const oldSessions = [...ws.sessions.entries()];
      const newSessions = new Map();
      let firstSr = null;
      for (const [oldSid, sMeta] of oldSessions) {
        const cwd = sMeta.cwd || COPILOT_CWD;
        try {
          const sr = await ws.conn.newSession({ cwd, mcpServers: [] });
          if (!firstSr) firstSr = sr;
          // Copy history from old session to new
          const oldMsgs = store.loadMessages(oldSid).filter(m => Workspace.REPLAY_TYPES.has(m.type));
          if (oldMsgs.length > 0) {
            for (const m of oldMsgs) { m.sessionId = sr.sessionId; store.appendMessage(sr.sessionId, m); }
          }
          newSessions.set(sr.sessionId, { ...sMeta, busy: false, queue: [] });
          if (ws.activeSessionId === oldSid) ws.activeSessionId = sr.sessionId;
          // Restore per-session model
          if (sMeta.modelId) { try { await ws.conn.unstable_setSessionModel({ sessionId: sr.sessionId, modelId: sMeta.modelId }); } catch {} }
        } catch (e2) { console.error(`  Failed to recreate session ${oldSid}: ${e2}`); }
      }
      ws.sessions = newSessions;
      if (!ws.sessions.has(ws.activeSessionId) && ws.sessions.size > 0) {
        ws.activeSessionId = ws.sessions.keys().next().value;
      }
      if (firstSr?.modes) { ws.availableModes = firstSr.modes.availableModes||[]; ws.currentModeId = firstSr.modes.currentModeId||""; }
      if (firstSr?.models) { ws.availableModels = firstSr.models.availableModels||[]; }
      ws.alive = true; ws.saveMeta();
      ws.send({ type: "status", message: "Copilot restarted", level: "info" });
      for (const s of ws.sockets) sendInit(ws, s, true);
    } catch (e) { ws.send({ type: "error", message: "Restart failed: " + e }); }
  });
}

async function createWS(cwd) {
  const ws = new Workspace(randomUUID());
  ws.proc = buildProc(); setupProc(ws); await initACP(ws);
  const sr = await ws.conn.newSession({ cwd, mcpServers: [] });
  ws.activeSessionId = sr.sessionId;
  if (sr.modes) { ws.availableModes = sr.modes.availableModes||[]; ws.currentModeId = sr.modes.currentModeId||""; }
  if (sr.models) { ws.availableModels = sr.models.availableModels||[]; }
  if (sr.configOptions) ws.configOptions = sr.configOptions;
  const initModelId = sr.models?.currentModelId || sr.models?.availableModels?.[0]?.id || '';
  ws.sessions.set(ws.activeSessionId, { cwd, title: cwd.split("/").pop()||"Default", busy: false, queue: [], titleSet: false, createdAt: Date.now(), lastActiveAt: Date.now(), messageCount: 0, modelId: initModelId, yoloLevel: 0 });
  ws.alive = true; workspaces.set(ws.id, ws); ws.saveMeta();
  return ws;
}

async function restoreWorkspace(savedId) {
  const meta = store.loadWorkspace(savedId);
  if (!meta?.sessions?.length) return null;
  console.log(`  Restoring workspace ${savedId} (${meta.sessions.length} sessions)...`);
  const ws = new Workspace(savedId);
  ws.createdAt = meta.createdAt || Date.now();
  ws.yoloLevel = meta.yoloLevel || 0;
  ws.proc = buildProc(); setupProc(ws); await initACP(ws);

  const idMap = new Map(); // oldSessionId -> newSessionId
  for (const sMeta of meta.sessions) {
    const cwd = sMeta.cwd || COPILOT_CWD;
    try {
      const sr = await ws.conn.newSession({ cwd, mcpServers: [] });
      idMap.set(sMeta.sessionId, sr.sessionId);
      ws.sessions.set(sr.sessionId, { cwd, title: sMeta.title || "Restored", busy: false, queue: [], titleSet: true, createdAt: sMeta.createdAt || Date.now(), lastActiveAt: sMeta.lastActiveAt || sMeta.createdAt || Date.now(), messageCount: sMeta.messageCount || 0, modelId: sMeta.modelId || sr.models?.currentModelId || sr.models?.availableModels?.[0]?.id || '', yoloLevel: sMeta.yoloLevel ?? ws.yoloLevel });
      if (!ws.activeSessionId) {
        ws.activeSessionId = sr.sessionId;
        if (sr.modes) { ws.availableModes = sr.modes.availableModes||[]; ws.currentModeId = sr.modes.currentModeId||""; }
        if (sr.models) { ws.availableModels = sr.models.availableModels||[]; }
        if (sr.configOptions) ws.configOptions = sr.configOptions;
      }
      // Set active to match the original
      if (sMeta.active) ws.activeSessionId = sr.sessionId;
      // Restore per-session model
      if (sMeta.modelId) {
        try { await ws.conn.unstable_setSessionModel({ sessionId: sr.sessionId, modelId: sMeta.modelId }); } catch {}
      }
    } catch (e) { console.error(`  Failed to recreate session: ${e}`); }
  }

  // Write history with new session IDs so getReplay() works
  for (const [oldSid, newSid] of idMap) {
    // Skip if new JSONL already has data (previous restore)
    const existing = store.loadMessages(newSid);
    if (existing.length > 0) continue;
    const messages = store.loadMessages(oldSid).filter(m => Workspace.REPLAY_TYPES.has(m.type));
    if (!messages.length) continue;
    for (const m of messages) m.sessionId = newSid;
    for (const m of messages) store.appendMessage(newSid, m);
  }

  ws.alive = true; workspaces.set(savedId, ws); ws.saveMeta();
  console.log(`  Workspace ${savedId} restored (${ws.sessions.size} sessions)`);
  return ws;
}

function sendInit(ws, socket, isReconnect, preferredSid) {
  const sid = (preferredSid && ws.sessions.has(preferredSid)) ? preferredSid : ws.activeSessionId;
  const activeSess = ws.sessions.get(sid);
  const resolvedModelId = activeSess?.modelId || ws.availableModels?.[0]?.id || '';
  socket.emit("msg", {
    type: "init", workspaceId: ws.id, sessionId: sid,
    modes: { availableModes: ws.availableModes, currentModeId: ws.currentModeId },
    models: { availableModels: ws.availableModels, currentModelId: resolvedModelId },
    configOptions: ws.configOptions, cwd: activeSess?.cwd||COPILOT_CWD,
    sessions: ws.sessionList(), yoloLevels: YOLO, yoloLevel: activeSess?.yoloLevel ?? ws.yoloLevel, isReconnect,
  });
  if (isReconnect) for (const [sid] of ws.sessions) {
    const buf = ws.getReplay(sid);
    if (!buf.length) continue;
    socket.emit("msg", { type: "replay_start", sessionId: sid });
    for (const m of buf) socket.emit("msg", m.sessionId ? m : { ...m, sessionId: sid });
    socket.emit("msg", { type: "replay_end", sessionId: sid });
  }
}

app.get("/api/workspaces", (req, res) => {
  const t = req.headers.authorization?.replace("Bearer ","");
  if (!authMod.needsSetup() && !authMod.verifyToken(t)) return res.status(401).json({ error: "Unauthorized" });
  res.json([...workspaces.values()].map(w=>({ id:w.id, alive:w.alive, createdAt:w.createdAt, hasClient:w.sockets.size>0, clients:w.sockets.size, sessions:w.sessionList() })));
});
app.get("/api/history", (req, res) => {
  const t = req.headers.authorization?.replace("Bearer ","");
  if (!authMod.needsSetup() && !authMod.verifyToken(t)) return res.status(401).json({ error: "Unauthorized" });
  res.json(store.listSavedWorkspaces());
});
app.get("/api/version", (req, res) => {
  res.json({ ...APP_VERSION, apkUrl: "/api/download/apk" });
});
app.get("/api/download/apk", (req, res) => {
  const t = req.headers.authorization?.replace("Bearer ","") || req.query.token;
  if (!authMod.needsSetup() && !authMod.verifyToken(t)) return res.status(401).json({ error: "Unauthorized" });
  // Check multiple possible APK locations
  const candidates = [
    path.join(__dirname, "data", "aether.apk"),
    path.join(__dirname, "android", "app", "build", "outputs", "apk", "release", "app-release.apk"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) { res.download(p, `aether-${APP_VERSION.versionName}.apk`); return; }
  }
  res.status(404).json({ error: "APK not available" });
});

io.on("connection", async (socket) => {
  let ws = null;
  socket.on("auto_connect", async d => {
    const id = d?.workspaceId; const prefSid = d?.sessionId;
    // Try requested workspace in memory first
    if (id) { const t = workspaces.get(id); if (t?.alive) { ws = t; ws.attach(socket); sendInit(ws, socket, true, prefSid); return; } }
    // Try to restore from disk
    if (id && !workspaces.has(id)) {
      try { const restored = await restoreWorkspace(id); if (restored) { ws = restored; ws.attach(socket); sendInit(ws, socket, true, prefSid); return; } }
      catch (e) { console.error("Restore failed:", e); }
    }
    // Attach to any existing alive workspace
    for (const [, t] of workspaces) { if (t.alive) { ws = t; ws.attach(socket); sendInit(ws, socket, true, prefSid); return; } }
    // No workspace exists, create new
    try { ws = await createWS(d?.cwd||COPILOT_CWD); ws.attach(socket); sendInit(ws, socket, false); }
    catch (e) { socket.emit("msg", { type: "error", message: "Start failed: "+e }); }
  });
  socket.on("attach_workspace", async d => {
    const t = workspaces.get(d?.workspaceId);
    if (!t?.alive) { socket.emit("msg",{type:"error",message:"Not found"}); return; }
    ws = t; ws.attach(socket); sendInit(ws, socket, true);
  });
  socket.on("create_workspace", async d => {
    try { ws = await createWS(d?.cwd||COPILOT_CWD); ws.attach(socket); sendInit(ws, socket, false); }
    catch (e) { socket.emit("msg",{type:"error",message:""+e}); }
  });
  socket.on("prompt", d => {
    if (!ws?.alive) return;
    const sid = d?.sessionId||ws.activeSessionId, text = (d?.text||"").trim(), att = d?.attachments||[];
    if (!text && !att.length) return;
    const s = ws.sessions.get(sid); if (!s) return;
    if (s.busy) { socket.emit("msg",{type:"status",sessionId:sid,level:"warn",message:"Busy"}); return; }
    // Record user message — exclude sender (they already show it locally)
    ws.send({type:"user_message",sessionId:sid,text,hasAttachments:att.length>0}, socket);
    s.queue.push({ text, attachments: att });
    if (!s.titleSet && text) {
      s.title = text.replace(/^\/\w+\s*/, "").slice(0,50) || text.slice(0,50);
      s.titleSet = true;
      ws.send({type:"session_renamed",sessionId:sid,title:s.title,sessions:ws.sessionList()});
      ws.saveMeta();
    }
    drain(ws, sid);
  });
  socket.on("permission_response", d => {
    if (!ws) return;
    if (d?.optionId) { ws.resolvePerm(d.requestId, d.optionId); if (d.feedback?.trim()) { const s=ws.sessions.get(d.sessionId||ws.activeSessionId); if(s){s.queue.push({text:d.feedback.trim(),attachments:[]});drain(ws,d.sessionId||ws.activeSessionId);} } }
    else ws.cancelPerm(d?.requestId);
    // Notify all clients to dismiss the resolved permission
    for (const s of ws.sockets) { try { s.emit("msg", { type: "permission_resolved", requestId: d?.requestId }); } catch {} }
  });
  socket.on("set_mode", async d => { if(!ws?.alive)return; try{await ws.conn.setSessionMode({sessionId:d?.sessionId||ws.activeSessionId,modeId:d.modeId});ws.currentModeId=d.modeId;ws.send({type:"mode_update",modeId:d.modeId});}catch(e){ws.send({type:"error",message:""+e});} });
  socket.on("set_model", async d => { if(!ws?.alive)return; const sid=d?.sessionId||ws.activeSessionId; try{const r=await ws.conn.unstable_setSessionModel({sessionId:sid,modelId:d.modelId}); const sess=ws.sessions.get(sid); if(sess)sess.modelId=d.modelId; if(r?.models){ws.availableModels=r.models.availableModels||ws.availableModels;} ws.saveMeta(); ws.send({type:"model_update",sessionId:sid,modelId:d.modelId,availableModels:ws.availableModels});}catch(e){ws.send({type:"error",message:""+e});} });
  socket.on("cancel", async d => { if(!ws?.alive)return; try{ws.cancelAllPerms();await ws.conn.cancel({sessionId:d?.sessionId||ws.activeSessionId});ws.send({type:"status",message:"Cancelled"});}catch(e){ws.send({type:"error",message:""+e});} });
  socket.on("set_config_option", async d => { if(!ws?.alive)return; try{const p={sessionId:d?.sessionId||ws.activeSessionId,configId:d.configId};if(d.valueType==="boolean"){p.type="boolean";p.value=d.value;}else p.value=d.value;const r=await ws.conn.setSessionConfigOption(p);if(r?.configOptions){ws.configOptions=r.configOptions;ws.send({type:"config_update",configOptions:ws.configOptions});}}catch(e){ws.send({type:"error",message:""+e});} });
  socket.on("create_session", async d => {
    if(!ws?.alive)return; const cwd=d?.cwd||COPILOT_CWD, title=d?.title||cwd.split("/").pop()||"Session";
    try{ const sr=await ws.conn.newSession({cwd,mcpServers:[]}); const initModelId=sr.models?.currentModelId||sr.models?.availableModels?.[0]?.id||''; ws.sessions.set(sr.sessionId,{cwd,title,busy:false,queue:[],titleSet:!!d?.title,createdAt:Date.now(),lastActiveAt:Date.now(),messageCount:0,modelId:initModelId,yoloLevel:0}); ws.activeSessionId=sr.sessionId;
    if(sr.modes){ws.availableModes=sr.modes.availableModes||ws.availableModes;ws.currentModeId=sr.modes.currentModeId||ws.currentModeId;}
    if(sr.models){ws.availableModels=sr.models.availableModels||ws.availableModels;}
    ws.saveMeta(); ws.send({type:"session_created",sessionId:sr.sessionId,cwd,title,sessions:ws.sessionList(),modes:{availableModes:ws.availableModes,currentModeId:ws.currentModeId},models:{availableModels:ws.availableModels,currentModelId:initModelId},configOptions:ws.configOptions,yoloLevel:0}); }catch(e){ws.send({type:"error",message:""+e});}
  });
  socket.on("switch_session", d => { if(!ws)return; const sid=d?.sessionId; if(!sid||!ws.sessions.has(sid))return; const s=ws.sessions.get(sid);
    socket.emit("msg", {type:"session_switched",sessionId:sid,cwd:s.cwd,title:s.title,sessions:ws.sessionList(),
      models:{availableModels:ws.availableModels,currentModelId:s.modelId||ws.availableModels?.[0]?.id||''},yoloLevel:s.yoloLevel??ws.yoloLevel});
    // Skip replay if client already has this session cached
    if (d?.skipReplay) return;
    const buf = ws.getReplay(sid);
    if (buf.length) {
      socket.emit("msg", { type: "replay_start", sessionId: sid });
      for (const m of buf) socket.emit("msg", m.sessionId ? m : { ...m, sessionId: sid });
      socket.emit("msg", { type: "replay_end", sessionId: sid });
    }
  });
  socket.on("delete_session", d => { if(!ws)return; const sid=d?.sessionId; if(!sid||!ws.sessions.has(sid)||ws.sessions.size<=1)return; ws.sessions.delete(sid); store.deleteSessionHistory(sid); if(ws.activeSessionId===sid)ws.activeSessionId=ws.sessions.keys().next().value; const s=ws.sessions.get(ws.activeSessionId); ws.saveMeta(); ws.send({type:"session_deleted",deletedSessionId:sid,sessionId:ws.activeSessionId,cwd:s?.cwd,sessions:ws.sessionList()}); });
  socket.on("rename_session", d => { if(!ws)return; const sid=d?.sessionId||ws.activeSessionId,title=d?.title?.trim(); if(!title||!ws.sessions.has(sid))return; ws.sessions.get(sid).title=title; ws.sessions.get(sid).titleSet=true; ws.saveMeta(); ws.send({type:"session_renamed",sessionId:sid,title,sessions:ws.sessionList()}); });
  socket.on("set_yolo", d => { if(!ws)return; const lv=Number(d?.level); const sid=d?.sessionId||ws.activeSessionId; if(lv>=0&&lv<=3){ const sess=ws.sessions.get(sid); if(sess)sess.yoloLevel=lv; ws.saveMeta(); ws.send({type:"yolo_update",sessionId:sid,level:lv});} });
  socket.on("browse_dir", (d, cb) => {
    const reqPath = d?.path || COPILOT_CWD;
    const resolved = path.resolve(reqPath);
    // Block path traversal outside home directory
    const home = os.homedir();
    if (!resolved.startsWith(home) && !resolved.startsWith("/tmp")) {
      const err = { path: reqPath, entries: [], error: "Access denied: outside home directory" };
      if (typeof cb === "function") cb(err); else socket.emit("msg", { type: "dir_listing", ...err });
      return;
    }
    const r = store.listDirectory(reqPath);
    if (typeof cb === "function") cb(r); else socket.emit("msg", { type: "dir_listing", ...r });
  });
  socket.on("destroy_workspace", () => { if(ws){ws.destroy();ws=null;} });
  socket.on("disconnect", () => { if(ws)ws.detach(socket); ws=null; });
});

async function drain(ws, sid) {
  const s = ws.sessions.get(sid);
  if (!s||s.busy||!s.queue.length) return;
  s.busy = true; ws.send({type:"prompt_start",sessionId:sid});
  const { text, attachments } = s.queue.shift();
  try {
    const prompt = [];
    if (text) prompt.push({ type: "text", text });
    for (const a of attachments) if (a.type==="image") prompt.push({ type:"image", data:a.data, mimeType:a.mimeType });
    const r = await ws.conn.prompt({ sessionId: sid, prompt });
    ws.send({type:"done",sessionId:sid,stopReason:r.stopReason,usage:r.usage||null});
  } catch(e) { ws.send({type:"error",sessionId:sid,message:String(e)}); }
  finally { s.busy=false; ws.send({type:"prompt_end",sessionId:sid}); if(s.queue.length) setImmediate(()=>drain(ws,sid)); }
}

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log("\n\u2728 Aether \u2014 Copilot Remote Control v5");
  console.log("   URL: http://localhost:" + PORT);
  console.log("   Auth: " + (authMod.needsSetup() ? "Setup required" : "Enabled"));
  console.log("   Idle: " + (WORKSPACE_IDLE_TIMEOUT_MS/60000) + " min\n");
});
