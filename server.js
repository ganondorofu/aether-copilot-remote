import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { randomUUID } from "node:crypto";
import * as acp from "@agentclientprotocol/sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8787);
const COPILOT_PATH = process.env.COPILOT_PATH || "copilot";
const COPILOT_ARGS = (process.env.COPILOT_ARGS || "").split(" ").filter(Boolean);
const COPILOT_CWD = process.env.COPILOT_CWD || process.cwd();
const PERMISSION_TIMEOUT_MS = Number(process.env.PERMISSION_TIMEOUT_MS || 180000);

const app = express();
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ── ACP Client that bridges WebSocket ↔ Copilot ACP ──

class RemoteClient {
  constructor(ws) {
    this.ws = ws;
    this.pendingPermissions = new Map();
  }

  send(msg) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  resolvePermission(requestId, optionId) {
    const entry = this.pendingPermissions.get(requestId);
    if (!entry) return false;
    this.pendingPermissions.delete(requestId);
    entry.resolve({ outcome: { outcome: "selected", optionId } });
    return true;
  }

  cancelPermission(requestId) {
    const entry = this.pendingPermissions.get(requestId);
    if (!entry) return false;
    this.pendingPermissions.delete(requestId);
    entry.resolve({ outcome: { outcome: "cancelled" } });
    return true;
  }

  cancelAllPermissions() {
    for (const [id, entry] of this.pendingPermissions) {
      entry.resolve({ outcome: { outcome: "cancelled" } });
    }
    this.pendingPermissions.clear();
  }

  async requestPermission(params) {
    const requestId = randomUUID();

    const options = (params.options || []).map((opt) => ({
      optionId: opt.optionId,
      name: opt.name,
      kind: opt.kind,
    }));

    // Forward full toolCall details
    const toolCall = params.toolCall
      ? {
          toolCallId: params.toolCall.toolCallId,
          title: params.toolCall.title,
          kind: params.toolCall.kind,
          status: params.toolCall.status,
          content: params.toolCall.content || [],
          locations: params.toolCall.locations || [],
          rawInput: params.toolCall.rawInput || null,
        }
      : null;

    this.send({
      type: "permission",
      requestId,
      title: toolCall?.title || "Permission request",
      toolCall,
      options,
    });

    return await new Promise((resolve) => {
      let timer;
      const wrappedResolve = (value) => {
        if (timer) clearTimeout(timer);
        resolve(value);
      };
      this.pendingPermissions.set(requestId, { resolve: wrappedResolve });
      timer = setTimeout(() => {
        if (this.pendingPermissions.delete(requestId)) {
          wrappedResolve({ outcome: { outcome: "cancelled" } });
        }
      }, PERMISSION_TIMEOUT_MS);
    });
  }

  async sessionUpdate(params) {
    const update = params.update;
    if (!update || !update.sessionUpdate) return;

    switch (update.sessionUpdate) {
      case "agent_message_chunk": {
        this.send({
          type: "chunk",
          role: "agent",
          contentType: update.content?.type || "text",
          text: update.content?.type === "text" ? update.content.text : `[${update.content?.type || "unknown"}]`,
        });
        break;
      }

      case "agent_thought_chunk": {
        this.send({
          type: "chunk",
          role: "thought",
          contentType: update.content?.type || "text",
          text: update.content?.type === "text" ? update.content.text : "",
        });
        break;
      }

      case "user_message_chunk": {
        this.send({
          type: "chunk",
          role: "user",
          contentType: update.content?.type || "text",
          text: update.content?.type === "text" ? update.content.text : "",
        });
        break;
      }

      case "tool_call": {
        this.send({
          type: "tool",
          toolCallId: update.toolCallId,
          title: update.title,
          kind: update.kind || "other",
          status: update.status || "pending",
          content: update.content || [],
          locations: update.locations || [],
        });
        break;
      }

      case "tool_call_update": {
        this.send({
          type: "tool_update",
          toolCallId: update.toolCallId,
          title: update.title,
          status: update.status,
          content: update.content || [],
          locations: update.locations || [],
        });
        break;
      }

      case "plan": {
        this.send({
          type: "plan",
          entries: (update.entries || []).map((e) => ({
            content: e.content,
            priority: e.priority,
            status: e.status,
          })),
        });
        break;
      }

      case "available_commands_update": {
        this.send({
          type: "commands",
          commands: (update.availableCommands || []).map((c) => ({
            name: c.name,
            description: c.description,
            hasInput: !!c.input,
          })),
        });
        break;
      }

      case "current_mode_update": {
        const modeId = update.modeId ?? update.currentModeId ?? "";
        this.send({ type: "mode_update", modeId });
        break;
      }

      case "config_option_update": {
        this.send({
          type: "config_update",
          configOptions: update.configOptions || [],
        });
        break;
      }

      case "session_info_update": {
        this.send({
          type: "session_info",
          info: update,
        });
        break;
      }

      case "usage_update": {
        this.send({
          type: "usage",
          usage: update,
        });
        break;
      }

      default:
        this.send({ type: "session_event", event: update.sessionUpdate, data: update });
        break;
    }
  }
}

// ── Copilot process management ──

function buildCopilotProcess() {
  const args = ["--acp", "--stdio", ...COPILOT_ARGS];
  console.log(`[copilot] spawning: ${COPILOT_PATH} ${args.join(" ")}`);
  return spawn(COPILOT_PATH, args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });
}

// ── WebSocket connection handler ──

wss.on("connection", async (ws) => {
  const client = new RemoteClient(ws);
  let connection;
  let sessionId;
  let copilotProcess;
  let promptInFlight = false;

  // Prompt queue for serialized execution (prevents race conditions)
  const promptQueue = [];
  async function drainPromptQueue() {
    if (promptInFlight || !promptQueue.length) return;
    promptInFlight = true;
    client.send({ type: "prompt_start" });
    const text = promptQueue.shift();
    try {
      const result = await connection.prompt({
        sessionId,
        prompt: [{ type: "text", text }],
      });
      client.send({ type: "done", stopReason: result.stopReason });
    } catch (err) {
      client.send({ type: "error", message: String(err) });
    } finally {
      promptInFlight = false;
      client.send({ type: "prompt_end" });
      // Drain next if queued
      if (promptQueue.length) drainPromptQueue();
    }
  }

  // State
  let availableModes = [];
  let currentModeId = "";
  let availableModels = [];
  let currentModelId = "";
  let configOptions = [];
  let availableCommands = [];

  try {
    copilotProcess = buildCopilotProcess();
    copilotProcess.stderr.on("data", (data) => {
      const msg = data.toString().trim();
      if (msg) client.send({ type: "stderr", message: msg });
    });
    copilotProcess.on("error", (err) => {
      client.send({ type: "error", message: `failed to start copilot: ${err.message}` });
    });
    copilotProcess.on("exit", (code, signal) => {
      client.send({ type: "status", message: `copilot exited (code=${code}, signal=${signal})`, level: "process" });
    });

    const output = Writable.toWeb(copilotProcess.stdin);
    const input = Readable.toWeb(copilotProcess.stdout);
    const stream = acp.ndJsonStream(output, input);

    connection = new acp.ClientSideConnection(() => client, stream);
    const initResult = await connection.initialize({
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: {},
    });

    const sessionResult = await connection.newSession({
      cwd: COPILOT_CWD,
      mcpServers: [],
    });
    sessionId = sessionResult.sessionId;

    // Extract modes
    if (sessionResult.modes) {
      availableModes = sessionResult.modes.availableModes || [];
      currentModeId = sessionResult.modes.currentModeId || "";
    }

    // Extract models
    if (sessionResult.models) {
      availableModels = sessionResult.models.availableModels || [];
      currentModelId = sessionResult.models.currentModelId || "";
    }

    // Extract config options
    if (sessionResult.configOptions) {
      configOptions = sessionResult.configOptions;
    }

    // Send initial state to client
    client.send({
      type: "init",
      sessionId,
      protocolVersion: initResult.protocolVersion,
      modes: { availableModes, currentModeId },
      models: { availableModels, currentModelId },
      configOptions,
    });
  } catch (err) {
    client.send({ type: "error", message: String(err) });
    ws.close();
    if (copilotProcess) copilotProcess.kill();
    return;
  }

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case "prompt": {
        if (promptInFlight) {
          client.send({ type: "status", level: "warn", message: "prompt already running" });
          return;
        }
        promptQueue.push(msg.text || "");
        drainPromptQueue();
        break;
      }

      case "permission_response": {
        if (msg.optionId) {
          const ok = client.resolvePermission(msg.requestId, msg.optionId);
          if (!ok) {
            client.send({ type: "status", level: "warn", message: "permission request not found" });
          }
          // If feedback text is provided after reject, queue as follow-up prompt
          if (msg.feedback && msg.feedback.trim()) {
            promptQueue.push(msg.feedback.trim());
            drainPromptQueue();
          }
        } else {
          // Cancel
          client.cancelPermission(msg.requestId);
        }
        break;
      }

      case "set_mode": {
        try {
          await connection.setSessionMode({ sessionId, modeId: msg.modeId });
          currentModeId = msg.modeId;
          client.send({ type: "mode_update", modeId: msg.modeId });
        } catch (err) {
          client.send({ type: "error", message: `mode change failed: ${err}` });
        }
        break;
      }

      case "set_model": {
        try {
          const result = await connection.unstable_setSessionModel({
            sessionId,
            modelId: msg.modelId,
          });
          currentModelId = msg.modelId;
          // Result may contain updated model state
          if (result?.models) {
            availableModels = result.models.availableModels || availableModels;
            currentModelId = result.models.currentModelId || currentModelId;
          }
          client.send({
            type: "model_update",
            modelId: currentModelId,
            availableModels,
          });
        } catch (err) {
          client.send({ type: "error", message: `model change failed: ${err}` });
        }
        break;
      }

      case "cancel": {
        try {
          client.cancelAllPermissions();
          await connection.cancel({ sessionId });
          client.send({ type: "status", message: "cancelled" });
        } catch (err) {
          client.send({ type: "error", message: `cancel failed: ${err}` });
        }
        break;
      }

      case "set_config_option": {
        try {
          const params = { sessionId, configId: msg.configId };
          if (msg.valueType === "boolean") {
            params.type = "boolean";
            params.value = msg.value;
          } else {
            params.value = msg.value;
          }
          const result = await connection.setSessionConfigOption(params);
          if (result?.configOptions) {
            configOptions = result.configOptions;
            client.send({ type: "config_update", configOptions });
          }
        } catch (err) {
          client.send({ type: "error", message: `config change failed: ${err}` });
        }
        break;
      }

      default:
        break;
    }
  });

  ws.on("close", async () => {
    client.cancelAllPermissions();
    try {
      if (connection) await connection.close();
    } catch {
      // ignore
    }
    if (copilotProcess) copilotProcess.kill();
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Copilot Remote UI listening on http://0.0.0.0:${PORT}`);
});
