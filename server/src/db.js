import fs from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";
import { nanoid } from "nanoid";
import { config } from "./config.js";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "app.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const SQL = await initSqlJs({
  locateFile: (file) => path.join(process.cwd(), "node_modules", "sql.js", "dist", file)
});

let db;
let ftsEnabled = true;
if (fs.existsSync(DB_FILE)) {
  const fileBuffer = fs.readFileSync(DB_FILE);
  db = new SQL.Database(fileBuffer);
} else {
  db = new SQL.Database();
}

function persist() {
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  while (stmt.step()) {
    // drain
  }
  stmt.free();
  persist();
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const rows = all(sql, params);
  return rows[0] || null;
}

function ensureSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      role TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      title TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chatId TEXT,
      role TEXT,
      content TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS chat_flags (
      chatId TEXT PRIMARY KEY,
      toolsEnabled INTEGER,
      memoryEnabled INTEGER,
      citationsEnabled INTEGER,
      debugMode INTEGER
    );

    CREATE TABLE IF NOT EXISTS tool_runs (
      id TEXT PRIMARY KEY,
      chatId TEXT,
      status TEXT,
      requiresApproval INTEGER,
      reasoningSummary TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS tool_events (
      id TEXT PRIMARY KEY,
      runId TEXT,
      type TEXT,
      payload TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT,
      type TEXT,
      confidence REAL,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS model_usage (
      id TEXT PRIMARY KEY,
      runId TEXT,
      model TEXT,
      inputTokens INTEGER,
      outputTokens INTEGER,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS errors (
      id TEXT PRIMARY KEY,
      runId TEXT,
      message TEXT,
      detail TEXT,
      createdAt TEXT
    );

  `);
  try {
    db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(content);`);
    db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(content, chatId UNINDEXED);`);
  } catch {
    ftsEnabled = false;
  }
  persist();
}

ensureSchema();

function now() {
  return new Date().toISOString();
}

export function listChats() {
  const rows = all(
    `
      SELECT chats.id, chats.title, chats.createdAt, chats.updatedAt,
             COUNT(messages.id) AS messageCount
      FROM chats
      LEFT JOIN messages ON messages.chatId = chats.id
      GROUP BY chats.id
      ORDER BY datetime(chats.updatedAt) DESC
    `
  );
  return rows;
}

export function createChat({ title }) {
  const id = nanoid();
  const ts = now();
  run("INSERT INTO chats (id, title, createdAt, updatedAt) VALUES (?, ?, ?, ?)", [id, title, ts, ts]);

  run(
    "INSERT INTO chat_flags (chatId, toolsEnabled, memoryEnabled, citationsEnabled, debugMode) VALUES (?, ?, ?, ?, ?)",
    [id, config.defaultToolsEnabled ? 1 : 0, config.defaultMemoryEnabled ? 1 : 0, 1, 0]
  );

  return { id, title, createdAt: ts, updatedAt: ts, messages: [] };
}

export function getChatById(chatId) {
  const chat = get("SELECT * FROM chats WHERE id = ?", [chatId]);
  if (!chat) return null;

  const messages = all(
    "SELECT id, role, content, createdAt FROM messages WHERE chatId = ? ORDER BY createdAt ASC",
    [chatId]
  );

  const flags = get(
    "SELECT toolsEnabled, memoryEnabled, citationsEnabled, debugMode FROM chat_flags WHERE chatId = ?",
    [chatId]
  );

  return { ...chat, messages, flags: flags || null };
}

export function addMessage({ chatId, role, content }) {
  const id = nanoid();
  const ts = now();
  run("INSERT INTO messages (id, chatId, role, content, createdAt) VALUES (?, ?, ?, ?, ?)", [
    id,
    chatId,
    role,
    content,
    ts
  ]);
  if (ftsEnabled) {
    run(
      "INSERT INTO messages_fts (rowid, content, chatId) VALUES ((SELECT rowid FROM messages WHERE id = ?), ?, ?)",
      [id, content, chatId]
    );
  }
  run("UPDATE chats SET updatedAt = ? WHERE id = ?", [ts, chatId]);
  return { id, chatId, role, content, createdAt: ts };
}

export function updateChatTitle(chatId, title) {
  run("UPDATE chats SET title = ?, updatedAt = ? WHERE id = ?", [title, now(), chatId]);
}

export function updateChatFlags(chatId, flags) {
  const current = get("SELECT * FROM chat_flags WHERE chatId = ?", [chatId]);
  if (!current) {
    run(
      "INSERT INTO chat_flags (chatId, toolsEnabled, memoryEnabled, citationsEnabled, debugMode) VALUES (?, ?, ?, ?, ?)",
      [
        chatId,
        flags.toolsEnabled ? 1 : 0,
        flags.memoryEnabled ? 1 : 0,
        flags.citationsEnabled ? 1 : 0,
        flags.debugMode ? 1 : 0
      ]
    );
    return;
  }

  const next = {
    toolsEnabled: flags.toolsEnabled ?? current.toolsEnabled,
    memoryEnabled: flags.memoryEnabled ?? current.memoryEnabled,
    citationsEnabled: flags.citationsEnabled ?? current.citationsEnabled,
    debugMode: flags.debugMode ?? current.debugMode
  };

  run(
    "UPDATE chat_flags SET toolsEnabled = ?, memoryEnabled = ?, citationsEnabled = ?, debugMode = ? WHERE chatId = ?",
    [next.toolsEnabled ? 1 : 0, next.memoryEnabled ? 1 : 0, next.citationsEnabled ? 1 : 0, next.debugMode ? 1 : 0, chatId]
  );
}

export function createToolRun({ chatId, requiresApproval, reasoningSummary }) {
  const id = nanoid();
  const ts = now();
  run(
    "INSERT INTO tool_runs (id, chatId, status, requiresApproval, reasoningSummary, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, chatId, "planned", requiresApproval ? 1 : 0, reasoningSummary || "", ts, ts]
  );
  return { id, chatId, status: "planned", requiresApproval: !!requiresApproval, reasoningSummary, createdAt: ts };
}

export function updateToolRunStatus(runId, status) {
  run("UPDATE tool_runs SET status = ?, updatedAt = ? WHERE id = ?", [status, now(), runId]);
}

export function getToolRun(runId) {
  return get("SELECT * FROM tool_runs WHERE id = ?", [runId]);
}

export function insertToolEvent({ runId, type, payload }) {
  const id = nanoid();
  const ts = now();
  run("INSERT INTO tool_events (id, runId, type, payload, createdAt) VALUES (?, ?, ?, ?, ?)", [
    id,
    runId,
    type,
    JSON.stringify(payload ?? {}),
    ts
  ]);
  return { id, runId, type, payload, createdAt: ts };
}

export function listRunEvents(runId) {
  const rows = all(
    "SELECT id, runId, type, payload, createdAt FROM tool_events WHERE runId = ? ORDER BY createdAt ASC",
    [runId]
  );
  return rows.map((row) => ({
    ...row,
    payload: row.payload ? JSON.parse(row.payload) : {}
  }));
}

export function addMemory({ content, type, confidence }) {
  const id = nanoid();
  const ts = now();
  run("INSERT INTO memories (id, content, type, confidence, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)", [
    id,
    content,
    type,
    confidence,
    ts,
    ts
  ]);
  if (ftsEnabled) {
    run("INSERT INTO memories_fts (rowid, content) VALUES ((SELECT rowid FROM memories WHERE id = ?), ?)", [
      id,
      content
    ]);
  }
  return { id, content, type, confidence, createdAt: ts, updatedAt: ts };
}

export function listMemories() {
  return all("SELECT id, content, type, confidence, createdAt, updatedAt FROM memories ORDER BY updatedAt DESC");
}

export function updateMemory(id, { content, type, confidence }) {
  const current = get("SELECT * FROM memories WHERE id = ?", [id]);
  if (!current) return null;
  const next = {
    content: content ?? current.content,
    type: type ?? current.type,
    confidence: confidence ?? current.confidence
  };
  run("UPDATE memories SET content = ?, type = ?, confidence = ?, updatedAt = ? WHERE id = ?", [
    next.content,
    next.type,
    next.confidence,
    now(),
    id
  ]);
  if (ftsEnabled) {
    run("DELETE FROM memories_fts WHERE rowid = (SELECT rowid FROM memories WHERE id = ?)", [id]);
    run("INSERT INTO memories_fts (rowid, content) VALUES ((SELECT rowid FROM memories WHERE id = ?), ?)", [
      id,
      next.content
    ]);
  }
  return { id, ...next };
}

export function deleteMemory(id) {
  if (ftsEnabled) {
    run("DELETE FROM memories_fts WHERE rowid = (SELECT rowid FROM memories WHERE id = ?)", [id]);
  }
  run("DELETE FROM memories WHERE id = ?", [id]);
}

export function searchMemories(query, limit = 5) {
  if (!query) return [];
  if (ftsEnabled) {
    return all(
      "SELECT memories.id, memories.content, memories.type, memories.confidence FROM memories_fts JOIN memories ON memories_fts.rowid = memories.rowid WHERE memories_fts MATCH ? LIMIT ?",
      [query.replace(/\s+/g, " "), limit]
    );
  }

  return all(
    "SELECT id, content, type, confidence FROM memories WHERE content LIKE ? ORDER BY updatedAt DESC LIMIT ?",
    [`%${query}%`, limit]
  );
}

export function recordModelUsage({ runId, model, inputTokens, outputTokens }) {
  const id = nanoid();
  run("INSERT INTO model_usage (id, runId, model, inputTokens, outputTokens, createdAt) VALUES (?, ?, ?, ?, ?, ?)", [
    id,
    runId,
    model,
    inputTokens || 0,
    outputTokens || 0,
    now()
  ]);
}

export function recordError({ runId, message, detail }) {
  const id = nanoid();
  run("INSERT INTO errors (id, runId, message, detail, createdAt) VALUES (?, ?, ?, ?, ?)", [
    id,
    runId,
    message,
    detail,
    now()
  ]);
}

export function getDb() {
  return db;
}
