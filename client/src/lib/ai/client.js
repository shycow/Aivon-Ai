const API_BASE = import.meta.env.VITE_AI_API_BASE || "http://localhost:8787/api";
let cachedToken = null;

async function getAiToken() {
  const mode = import.meta.env.VITE_AI_AUTH_MODE || "none";
  if (mode === "none") return null;
  if (cachedToken) return cachedToken;

  if (mode === "beta_password") {
    const password = import.meta.env.VITE_AI_PASSWORD;
    if (!password) throw new Error("Missing VITE_AI_PASSWORD for AI auth.");
    const res = await fetch(`${API_BASE}/auth/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    if (!res.ok) throw new Error("AI auth failed");
    const data = await res.json();
    cachedToken = data.token;
    return cachedToken;
  }

  return null;
}

export async function planMessage({ chatId, message }) {
  const token = await getAiToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/chats/${chatId}/messages/plan`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Plan failed");
  }
  return res.json();
}

export async function executeRun({ chatId, runId, approvedToolIds, onEvent }) {
  const token = await getAiToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/chats/${chatId}/messages/execute`, {
    method: "POST",
    headers,
    body: JSON.stringify({ runId, approvedToolIds })
  });

  if (!res.ok || !res.body) {
    throw new Error("Execution failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line));
    }
  }

  if (buffer.trim()) {
    onEvent(JSON.parse(buffer));
  }
}

export async function mockStreamResponse({ message, onToken }) {
  const tokens = message.split(" ");
  for (const token of tokens) {
    await new Promise((resolve) => setTimeout(resolve, 60));
    onToken(`${token} `);
  }
}