import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function toBool(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export const config = {
  port: toInt(process.env.PORT, 8787),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  modelPlanner: process.env.MODEL_PLANNER || process.env.GEMINI_MODEL || "gemini-2.5-flash",
  modelResponder: process.env.MODEL_RESPONDER || process.env.GEMINI_MODEL || "gemini-2.5-flash",
  systemPrompt:
    process.env.SYSTEM_PROMPT ||
    "You are Aivon, a practical AI assistant. Be accurate, concise, and cite sources for external claims.",
  appAccessPassword: process.env.APP_ACCESS_PASSWORD || "beta-access",
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET || "replace-this-secret",
  authTokenTtlMin: toInt(process.env.AUTH_TOKEN_TTL_MIN, 1440),
  defaultToolsEnabled: toBool(process.env.DEFAULT_TOOLS_ENABLED, true),
  defaultMemoryEnabled: toBool(process.env.DEFAULT_MEMORY_ENABLED, false),
  defaultStreamingEnabled: toBool(process.env.STREAMING_ENABLED, true),
  toolsEnabled: toBool(process.env.TOOLS_ENABLED, true),
  memoryEnabled: toBool(process.env.MEMORY_ENABLED, true),
  streamingEnabled: toBool(process.env.STREAMING_ENABLED, true),
  toolMaxCallsPerRun: toInt(process.env.TOOL_MAX_CALLS_PER_RUN, 3),
  toolMaxParallel: toInt(process.env.TOOL_MAX_PARALLEL, 2),
  toolTimeoutMs: toInt(process.env.TOOL_TIMEOUT_MS, 8000),
  searchCacheTtl: toInt(process.env.SEARCH_CACHE_TTL, 300),
  fetchCacheTtl: toInt(process.env.FETCH_CACHE_TTL, 300),
  maxRequestPerMinute: toInt(process.env.RATE_LIMIT_PER_MIN, 30),
  blockedDomains: toList(process.env.BLOCKED_DOMAINS)
};
