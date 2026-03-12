// ── Wire Protocol: shared message types between daemon, relay, and clients ──
// Inspired by Happy Coder's session protocol

import { randomUUID } from "node:crypto";

// ── Session Envelope ──
// Every message is wrapped in an envelope
export function createEnvelope(role, event, turn, subagent) {
  return {
    id: randomUUID(),
    time: Date.now(),
    role, // "user" | "agent" | "system"
    turn: turn || null,
    subagent: subagent || null,
    ev: event,
  };
}

// ── Event Types ──
// t = discriminator field

// Text content from agent or user
// { t: "text", text: string, thinking?: boolean }

// Tool call started
// { t: "tool-call-start", callId: string, name: string, title: string, kind: string, args?: object }

// Tool call ended
// { t: "tool-call-end", callId: string, status: string, content?: string, diff?: object, locations?: array }

// Permission request from agent
// { t: "permission", requestId: string, title: string, toolCall?: object, options: array }

// Permission response from user
// { t: "permission-response", requestId: string, optionId?: string, feedback?: string }

// Plan update
// { t: "plan", entries: array }

// Mode/model/config state
// { t: "state", modes?: object, models?: object, configOptions?: array, commands?: array }

// Mode change request/notification
// { t: "mode-change", modeId: string }

// Model change request/notification
// { t: "model-change", modelId: string }

// Turn lifecycle
// { t: "turn-start" }
// { t: "turn-end", status: "completed" | "failed" | "cancelled", stopReason?: string }

// Session lifecycle
// { t: "session-start", sessionId: string }
// { t: "session-end" }

// Cancel request
// { t: "cancel" }

// Config change
// { t: "config-change", configId: string, value: any, valueType?: string }

// Error
// { t: "error", message: string }

// Status
// { t: "status", message: string, level?: string }

// Usage
// { t: "usage", data: object }

// ── Relay Protocol ──
// Messages between relay server and clients/daemons

// Socket.IO events:
//  "auth"          — authenticate with token
//  "join-session"  — join a session room (client)
//  "register"      — register a daemon with a session
//  "message"       — encrypted session envelope
//  "permission-response" — user permission decision (routed to daemon)
//  "session-list"  — request list of sessions
//  "session-create" — request new session
//  "session-state" — full state snapshot

export const RELAY_EVENTS = {
  AUTH: "auth",
  JOIN_SESSION: "join-session",
  REGISTER_DAEMON: "register",
  MESSAGE: "message",
  PERMISSION_RESPONSE: "permission-response",
  SESSION_LIST: "session-list",
  SESSION_STATE: "session-state",
  SESSION_CREATE: "session-create",
  USER_PROMPT: "user-prompt",
  USER_CANCEL: "user-cancel",
  USER_MODE_CHANGE: "user-mode-change",
  USER_MODEL_CHANGE: "user-model-change",
  USER_CONFIG_CHANGE: "user-config-change",
  DAEMON_ALIVE: "daemon-alive",
  ERROR: "error",
};
