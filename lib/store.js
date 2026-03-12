import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const HISTORY_DIR = path.join(DATA_DIR, "history");
const WORKSPACES_DIR = path.join(DATA_DIR, "workspaces");

function ensureDirs() {
  for (const d of [DATA_DIR, HISTORY_DIR, WORKSPACES_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

function appendMessage(sessionId, msg) {
  ensureDirs();
  fs.appendFileSync(path.join(HISTORY_DIR, sessionId + ".jsonl"), JSON.stringify(msg) + "\n");
}

function loadMessages(sessionId) {
  const f = path.join(HISTORY_DIR, sessionId + ".jsonl");
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

function saveWorkspace(id, meta) {
  ensureDirs();
  fs.writeFileSync(path.join(WORKSPACES_DIR, id + ".json"), JSON.stringify(meta, null, 2));
}

function loadWorkspace(id) {
  const f = path.join(WORKSPACES_DIR, id + ".json");
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; }
}

function listSavedWorkspaces() {
  ensureDirs();
  return fs.readdirSync(WORKSPACES_DIR).filter(f => f.endsWith(".json")).map(f => {
    try { return JSON.parse(fs.readFileSync(path.join(WORKSPACES_DIR, f), "utf8")); } catch { return null; }
  }).filter(Boolean);
}

function deleteWorkspaceData(id) {
  const f = path.join(WORKSPACES_DIR, id + ".json");
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

function deleteSessionHistory(sessionId) {
  const f = path.join(HISTORY_DIR, sessionId + ".jsonl");
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

function listDirectory(dirPath) {
  try {
    const resolved = path.resolve(dirPath);
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    return {
      path: resolved,
      entries: entries.filter(e => !e.name.startsWith(".")).map(e => ({
        name: e.name,
        type: e.isDirectory() ? "directory" : "file",
        size: e.isFile() ? (function() { try { return fs.statSync(path.join(resolved, e.name)).size; } catch { return 0; } })() : undefined,
      })).sort((a, b) => a.type !== b.type ? (a.type === "directory" ? -1 : 1) : a.name.localeCompare(b.name)),
    };
  } catch (e) {
    return { path: dirPath, entries: [], error: e.message };
  }
}

export { ensureDirs, appendMessage, loadMessages, saveWorkspace, loadWorkspace, listSavedWorkspaces, deleteWorkspaceData, deleteSessionHistory, listDirectory };
