import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import { config } from "./config.js";
import { buildGeminiClient } from "./gemini.js";
import {
  createChat,
  listChats,
  getChatById,
  addMessage,
  updateChatTitle,
  updateChatFlags,
  createToolRun,
  insertToolEvent,
  listRunEvents,
  getToolRun,
  addMemory,
  listMemories,
  updateMemory,
  deleteMemory,
  searchMemories,
  recordError
} from "./db.js";
import { authMiddleware, rateLimit } from "./core/auth/middleware.js";
import { signToken } from "./core/auth/jwt.js";
import { toolRegistry } from "./tools/index.js";
import { planTools } from "./core/agent/planner.js";
import { executeTools } from "./core/agent/executor.js";
import { streamResponse, suggestMemories } from "./core/agent/responder.js";

const app = express();
const gemini = buildGeminiClient({ apiKey: config.geminiApiKey });

const allowedOrigins = new Set([
  config.clientUrl,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://0.0.0.0:5173"
]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    }
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, modelPlanner: config.modelPlanner, modelResponder: config.modelResponder });
});

app.post("/api/auth/unlock", (req, res) => {
  const password = (req.body?.password || "").toString();
  if (!password || password !== config.appAccessPassword) {
    return res.status(401).json({ error: "Invalid access password" });
  }

  const payload = {
    sub: nanoid(),
    role: "beta_user"
  };
  const token = signToken(payload);
  const expiresAt = new Date(Date.now() + config.authTokenTtlMin * 60_000).toISOString();
  return res.json({ token, role: payload.role, expiresAt });
});

app.use(authMiddleware);
app.use(rateLimit);

app.get("/api/chats", (_req, res) => {
  res.json({ chats: listChats() });
});

app.post("/api/chats", (req, res) => {
  const title = (req.body?.title || "New chat").toString().slice(0, 120);
  const chat = createChat({ title });
  res.status(201).json({ chat });
});

app.get("/api/chats/:chatId", (req, res) => {
  const chat = getChatById(req.params.chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  res.json({ chat });
});

app.patch("/api/chats/:chatId/flags", (req, res) => {
  const chatId = req.params.chatId;
  const chat = getChatById(chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  updateChatFlags(chatId, {
    toolsEnabled: req.body?.toolsEnabled,
    memoryEnabled: req.body?.memoryEnabled,
    citationsEnabled: req.body?.citationsEnabled,
    debugMode: req.body?.debugMode
  });

  res.json({ ok: true });
});

app.get("/api/runs/:runId/events", (req, res) => {
  const runId = req.params.runId;
  res.json({ events: listRunEvents(runId) });
});

app.get("/api/memories", (_req, res) => {
  res.json({ memories: listMemories() });
});

app.post("/api/memories", (req, res) => {
  const content = (req.body?.content || "").toString().trim();
  const type = (req.body?.type || "note").toString().trim();
  const confidence = Number(req.body?.confidence ?? 0.5);
  if (!content) return res.status(400).json({ error: "Content required" });
  const memory = addMemory({ content, type, confidence });
  res.status(201).json({ memory });
});

app.patch("/api/memories/:id", (req, res) => {
  const updated = updateMemory(req.params.id, {
    content: req.body?.content,
    type: req.body?.type,
    confidence: req.body?.confidence
  });
  if (!updated) return res.status(404).json({ error: "Memory not found" });
  res.json({ memory: updated });
});

app.delete("/api/memories/:id", (req, res) => {
  deleteMemory(req.params.id);
  res.json({ ok: true });
});

app.post("/api/chats/:chatId/messages/plan", async (req, res) => {
  const chatId = req.params.chatId;
  const userMessage = (req.body?.message || "").toString().trim();
  if (!userMessage) return res.status(400).json({ error: "Message is required" });

  const chat = getChatById(chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  const userMsg = addMessage({ chatId, role: "user", content: userMessage });
  if (chat.messages.length === 0) {
    updateChatTitle(chatId, userMessage.slice(0, 40) || chat.title);
  }

  const toolsEnabled = config.toolsEnabled && (chat.flags?.toolsEnabled ?? 1);
  const memoryEnabled = config.memoryEnabled && (chat.flags?.memoryEnabled ?? 0);

  const memories = memoryEnabled ? searchMemories(userMessage, 5) : [];
  const history = chat.messages.map((m) => ({ role: m.role, content: m.content }));

  const plan = toolsEnabled
    ? await planTools({ gemini, userMessage, history, memories, tools: toolRegistry })
    : { reasoningSummary: "", proposals: [], requiresApproval: false };

  const run = createToolRun({
    chatId,
    requiresApproval: plan.requiresApproval,
    reasoningSummary: plan.reasoningSummary
  });

  insertToolEvent({ runId: run.id, type: "plan", payload: { proposals: plan.proposals } });

  res.json({
    runId: run.id,
    reasoningSummary: plan.reasoningSummary,
    proposals: plan.proposals,
    requiresApproval: plan.requiresApproval,
    userMessage: userMsg
  });
});

app.post("/api/chats/:chatId/messages/execute", async (req, res) => {
  const chatId = req.params.chatId;
  const runId = (req.body?.runId || "").toString();
  const approvedToolIds = Array.isArray(req.body?.approvedToolIds) ? req.body.approvedToolIds : [];

  const run = getToolRun(runId);
  if (!run || run.chatId !== chatId) {
    return res.status(404).json({ error: "Run not found" });
  }

  const chat = getChatById(chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  const events = listRunEvents(runId);
  const planEvent = events.find((event) => event.type === "plan");
  const proposals = planEvent?.payload?.proposals || [];

  const toolsEnabled = config.toolsEnabled && (chat.flags?.toolsEnabled ?? 1);
  const memoryEnabled = config.memoryEnabled && (chat.flags?.memoryEnabled ?? 0);
  const citationsEnabled = chat.flags?.citationsEnabled ?? 1;

  if (!config.streamingEnabled) {
    return res.status(400).json({ error: "Streaming disabled" });
  }

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (event) => {
    res.write(`${JSON.stringify(event)}\n`);
  };

  sendEvent({ type: "plan", runId, proposals });

  let toolOutputs = [];
  try {
    if (toolsEnabled && proposals.length) {
      toolOutputs = await executeTools({
        runId,
        proposals,
        approvedToolIds,
        gemini,
        onEvent: (evt) => sendEvent({ type: evt.type, ...evt })
      });
    }

    const citations = [];
    if (citationsEnabled) {
      for (const output of toolOutputs) {
        if (output.tool === "web_search" && Array.isArray(output.output)) {
          output.output.forEach((item) => citations.push({ title: item.title, url: item.url }));
        }
        if (output.tool === "fetch_url" && output.output?.url) {
          citations.push({ title: output.output.url, url: output.output.url });
        }
      }
    }

    const history = chat.messages.map((m) => ({ role: m.role, content: m.content }));
    const lastMessage = history.at(-1);
    const priorHistory = history.slice(0, -1);
    const memories = memoryEnabled ? searchMemories(lastMessage?.content || "", 5) : [];

    let fullText = "";
    fullText = await streamResponse({
      gemini,
      history: priorHistory,
      memories,
      toolOutputs,
      userMessage: lastMessage?.content || "",
      citations,
      onToken: (token) => {
        sendEvent({ type: "delta", text: token });
      }
    });

    if (citationsEnabled && citations.length) {
      sendEvent({ type: "citation", sources: citations });
    }

    const assistantMsg = addMessage({
      chatId,
      role: "assistant",
      content: fullText || "I could not generate a response."
    });

    const suggestions = memoryEnabled
      ? await suggestMemories({
          gemini,
          userMessage: history.at(-1)?.content || "",
          assistantResponse: fullText
        })
      : [];

    if (suggestions.length) {
      sendEvent({ type: "memory_suggestions", items: suggestions });
    }

    sendEvent({ type: "done", message: assistantMsg });
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    recordError({ runId, message, detail: message });
    sendEvent({ type: "error", error: message });
    res.end();
  }
});

app.listen(config.port, () => {
  console.log(`Aivon server running on http://localhost:${config.port}`);
});
