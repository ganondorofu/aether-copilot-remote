import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const scryptAsync = promisify(scrypt);
const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

let config = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadConfig() {
  ensureDir();
  if (fs.existsSync(CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } else {
    config = { users: [], tokens: {}, secretKey: randomBytes(32).toString("hex") };
    saveConfig();
  }
  const now = Date.now();
  for (const [t, d] of Object.entries(config.tokens)) {
    if (d.expiresAt < now) delete config.tokens[t];
  }
  saveConfig();
  return config;
}

function saveConfig() {
  ensureDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

async function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(pw, salt, 64)).toString("hex");
  return salt + ":" + hash;
}

async function verifyPassword(pw, stored) {
  const [salt, hash] = stored.split(":");
  const hashBuf = Buffer.from(hash, "hex");
  const derived = await scryptAsync(pw, salt, 64);
  return timingSafeEqual(hashBuf, derived);
}

function needsSetup() { return !config || config.users.length === 0; }

async function createUser(username, password) {
  if (config.users.find(u => u.username === username)) throw new Error("User exists");
  config.users.push({ username, password: await hashPassword(password), createdAt: Date.now() });
  saveConfig();
}

async function login(username, password) {
  const user = config.users.find(u => u.username === username);
  if (!user) return null;
  if (!(await verifyPassword(password, user.password))) return null;
  const token = randomBytes(32).toString("hex");
  config.tokens[token] = { username, createdAt: Date.now(), expiresAt: Date.now() + TOKEN_EXPIRY_MS };
  saveConfig();
  return token;
}

function verifyToken(token) {
  if (!token || !config?.tokens[token]) return null;
  const d = config.tokens[token];
  if (d.expiresAt < Date.now()) { delete config.tokens[token]; saveConfig(); return null; }
  return d;
}

function revokeToken(token) {
  if (config?.tokens[token]) { delete config.tokens[token]; saveConfig(); }
}

export { loadConfig, needsSetup, createUser, login, verifyToken, revokeToken };
