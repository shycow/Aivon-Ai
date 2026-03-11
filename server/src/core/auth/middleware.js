import { config } from "../../config.js";
import { verifyToken } from "./jwt.js";

export function authMiddleware(req, res, next) {
  if (req.path === "/api/health" || req.path === "/api/auth/unlock") {
    return next();
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).json({ error: "Missing access token" });
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

const buckets = new Map();

export function rateLimit(req, res, next) {
  const key = req.user?.sub || req.ip || "unknown";
  const now = Date.now();
  const windowMs = 60_000;
  const record = buckets.get(key) || { count: 0, start: now };

  if (now - record.start > windowMs) {
    record.count = 0;
    record.start = now;
  }

  record.count += 1;
  buckets.set(key, record);

  if (record.count > config.maxRequestPerMinute) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  return next();
}