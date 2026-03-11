import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  Menu,
  Plus,
  SendHorizontal,
  Sparkles,
  Shield,
  Wrench,
  Brain,
  Database,
  Bug
} from "lucide-react";

const API_BASE =
  typeof window === "undefined"
    ? "http://localhost:8787/api"
    : `${window.location.protocol}//${window.location.hostname}:8787/api`;

async function readNdjson(response, onEvent) {
  if (!response.ok || !response.body) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const reader = response.body.getReader();
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

function TypingDots() {
  return (
    <div className="typing-dots" aria-label="Assistant is typing">
      <span />
      <span />
      <span />
    </div>
  );
}

function Message({ msg }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`message ${msg.role}`}
    >
      <div className="avatar">{msg.role === "assistant" ? "AI" : "YOU"}</div>
      <div className="bubble">
        <ReactMarkdown>{msg.content}</ReactMarkdown>
        {msg.sources?.length ? (
          <div className="sources">
            <strong>Sources:</strong>
            <ul>
              {msg.sources.map((source, idx) => (
                <li key={`${source.url}-${idx}`}>
                  [{idx + 1}] {source.url}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function ProposalCard({ proposal, approved, onToggle }) {
  return (
    <div className="proposal-card">
      <div className="proposal-header">
        <span>{proposal.tool}</span>
        <label className="switch">
          <input type="checkbox" checked={approved} onChange={() => onToggle(proposal.id)} />
          <span className="slider" />
        </label>
      </div>
      <div className="proposal-body">
        <p>{proposal.reason}</p>
        <code>{JSON.stringify(proposal.args)}</code>
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("aivon_token") || "");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState("");

  const [plannerSummary, setPlannerSummary] = useState("");
  const [proposals, setProposals] = useState([]);
  const [approvedMap, setApprovedMap] = useState({});
  const [runId, setRunId] = useState(null);
  const [runEvents, setRunEvents] = useState([]);
  const [pendingSources, setPendingSources] = useState([]);
  const [memorySuggestions, setMemorySuggestions] = useState([]);
  const [memories, setMemories] = useState([]);

  const [flags, setFlags] = useState({
    toolsEnabled: true,
    memoryEnabled: false,
    citationsEnabled: true,
    debugMode: false
  });

  const listRef = useRef(null);
  const textAreaRef = useRef(null);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) || null,
    [chats, activeChatId]
  );

  async function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (!headers.has("Content-Type") && options.body) {
      headers.set("Content-Type", "application/json");
    }

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (res.status === 401) {
      setToken("");
      localStorage.removeItem("aivon_token");
      throw new Error("Unauthorized");
    }
    return res;
  }

  useEffect(() => {
    if (token) {
      void loadChats();
      void loadMemories();
    }
  }, [token]);

  useEffect(() => {
    if (!activeChatId && chats[0]?.id) {
      setActiveChatId(chats[0].id);
    }
  }, [activeChatId, chats]);

  useEffect(() => {
    if (!activeChatId) return;
    void loadMessages(activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, runEvents]);

  useEffect(() => {
    if (!textAreaRef.current) return;
    textAreaRef.current.style.height = "0px";
    textAreaRef.current.style.height = `${Math.min(textAreaRef.current.scrollHeight, 200)}px`;
  }, [input]);

  async function unlock() {
    setAuthError("");
    try {
      const res = await fetch(`${API_BASE}/auth/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unlock failed");
      setToken(data.token);
      localStorage.setItem("aivon_token", data.token);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Unlock failed");
    }
  }

  async function loadChats() {
    const res = await apiFetch(`/chats`);
    const data = await res.json();
    const nextChats = data.chats || [];
    setChats(nextChats);
    if (!nextChats.length) {
      await createChat();
    }
  }

  async function loadMessages(chatId) {
    const res = await apiFetch(`/chats/${chatId}`);
    const data = await res.json();
    setMessages(data.chat?.messages || []);
    setFlags(data.chat?.flags || flags);
  }

  async function loadMemories() {
    const res = await apiFetch(`/memories`);
    const data = await res.json();
    setMemories(data.memories || []);
  }

  async function createChat() {
    const res = await apiFetch(`/chats`, {
      method: "POST",
      body: JSON.stringify({ title: "New chat" })
    });
    const data = await res.json();
    if (data.chat?.id) {
      setChats((prev) => [data.chat, ...prev]);
      setActiveChatId(data.chat.id);
      setMessages([]);
      setRunEvents([]);
    }
  }

  async function updateFlags(next) {
    if (!activeChatId) return;
    setFlags(next);
    await apiFetch(`/chats/${activeChatId}/flags`, {
      method: "PATCH",
      body: JSON.stringify(next)
    });
  }

  async function handlePlan() {
    const trimmed = input.trim();
    if (!trimmed || loading || !activeChatId) return;

    setError("");
    setLoading(true);
    setInput("");
    setPlannerSummary("");
    setProposals([]);
    setApprovedMap({});
    setRunEvents([]);
    setPendingSources([]);
    setMemorySuggestions([]);

    const optimisticUser = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed
    };

    setMessages((prev) => [...prev, optimisticUser]);

    try {
      const response = await apiFetch(`/chats/${activeChatId}/messages/plan`, {
        method: "POST",
        body: JSON.stringify({ message: trimmed })
      });

      const data = await response.json();
      setRunId(data.runId);
      setPlannerSummary(data.reasoningSummary || "");
      setProposals(data.proposals || []);

      const approvalMap = {};
      (data.proposals || []).forEach((proposal) => {
        approvalMap[proposal.id] = true;
      });
      setApprovedMap(approvalMap);

      if (!data.proposals?.length) {
        await executeRun(data.runId, []);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Planning failed");
      setLoading(false);
    }
  }

  async function executeRun(runIdValue, approvedToolIds) {
    if (!runIdValue || !activeChatId) return;

    setProposals([]);
    setApprovedMap({});

    const streamingAssistant = {
      id: `a-${Date.now()}`,
      role: "assistant",
      content: "",
      sources: []
    };

    setMessages((prev) => [...prev, streamingAssistant]);
    setLoading(true);

    let localSources = [];

    try {
      const response = await apiFetch(`/chats/${activeChatId}/messages/execute`, {
        method: "POST",
        body: JSON.stringify({ runId: runIdValue, approvedToolIds })
      });

      await readNdjson(response, (event) => {
        if (event.type === "tool_start" || event.type === "tool_result" || event.type === "tool_error") {
          setRunEvents((prev) => [...prev, event]);
        }

        if (event.type === "delta") {
          setMessages((prev) => {
            const next = [...prev];
            const idx = next.findIndex((m) => m.id === streamingAssistant.id);
            if (idx >= 0) {
              next[idx] = { ...next[idx], content: (next[idx].content || "") + event.text };
            }
            return next;
          });
        }

        if (event.type === "citation") {
          localSources = event.sources || [];
          setPendingSources(localSources);
        }

        if (event.type === "memory_suggestions") {
          setMemorySuggestions(event.items || []);
        }

        if (event.type === "done" && event.message) {
          setMessages((prev) => {
            const next = [...prev];
            const idx = next.findIndex((m) => m.id === streamingAssistant.id);
            if (idx >= 0) next[idx] = { ...event.message, sources: localSources };
            return next;
          });
          void loadChats();
        }

        if (event.type === "error") {
          setError(event.error || "Execution failed");
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setLoading(false);
    }
  }

  async function acceptMemory(item) {
    try {
      await apiFetch(`/memories`, {
        method: "POST",
        body: JSON.stringify(item)
      });
      await loadMemories();
      setMemorySuggestions((prev) => prev.filter((m) => m.content !== item.content));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Memory save failed");
    }
  }

  async function deleteMemoryItem(id) {
    await apiFetch(`/memories/${id}`, { method: "DELETE" });
    await loadMemories();
  }

  if (!token) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <Shield size={20} />
          <h2>Private Beta Access</h2>
          <p>Enter the shared password to unlock.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Access password"
          />
          {authError ? <div className="error-banner">{authError}</div> : null}
          <button onClick={unlock}>Unlock</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 290 : 72 }}
        className="sidebar"
      >
        <button className="icon-btn" onClick={() => setSidebarOpen((s) => !s)}>
          <Menu size={18} />
        </button>
        <button className="new-chat" onClick={createChat}>
          <Plus size={16} /> {sidebarOpen ? "New chat" : ""}
        </button>
        <div className="chat-list">
          {chats.map((chat) => (
            <button
              key={chat.id}
              className={`chat-item ${activeChatId === chat.id ? "active" : ""}`}
              onClick={() => setActiveChatId(chat.id)}
              title={chat.title}
            >
              <Sparkles size={14} /> {sidebarOpen ? chat.title : ""}
            </button>
          ))}
        </div>
      </motion.aside>

      <main className="chat-main">
        <header className="chat-header">
          <div>
            <h1>{activeChat?.title || "Aivon"}</h1>
            <p>Agent runtime with tool approval and memory.</p>
          </div>
          <div className="flag-row">
            <button className={flags.toolsEnabled ? "flag active" : "flag"} onClick={() => updateFlags({ ...flags, toolsEnabled: !flags.toolsEnabled })}>
              <Wrench size={14} /> Tools
            </button>
            <button className={flags.memoryEnabled ? "flag active" : "flag"} onClick={() => updateFlags({ ...flags, memoryEnabled: !flags.memoryEnabled })}>
              <Brain size={14} /> Memory
            </button>
            <button className={flags.citationsEnabled ? "flag active" : "flag"} onClick={() => updateFlags({ ...flags, citationsEnabled: !flags.citationsEnabled })}>
              <Database size={14} /> Citations
            </button>
            <button className={flags.debugMode ? "flag active" : "flag"} onClick={() => updateFlags({ ...flags, debugMode: !flags.debugMode })}>
              <Bug size={14} /> Debug
            </button>
          </div>
        </header>

        <section ref={listRef} className="message-list">
          <AnimatePresence>
            {messages.length === 0 ? (
              <motion.div
                className="empty-state"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2>Start a conversation</h2>
                <p>Ask for help, then approve tools when needed.</p>
              </motion.div>
            ) : (
              messages.map((msg) => <Message key={msg.id} msg={msg} />)
            )}
          </AnimatePresence>
          {loading && <TypingDots />}
        </section>

        {proposals.length > 0 ? (
          <section className="proposal-panel">
            <h3>Tool Proposals</h3>
            <div className="proposal-grid">
              {proposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  approved={approvedMap[proposal.id]}
                  onToggle={(id) =>
                    setApprovedMap((prev) => ({
                      ...prev,
                      [id]: !prev[id]
                    }))
                  }
                />
              ))}
            </div>
            <button
              className="primary"
              onClick={() =>
                executeRun(
                  runId,
                  Object.entries(approvedMap)
                    .filter(([, value]) => value)
                    .map(([id]) => id)
                )
              }
              disabled={loading}
            >
              Run approved tools
            </button>
          </section>
        ) : null}

        {flags.debugMode ? (
          <section className="debug-panel">
            <h3>Debug</h3>
            <p>{plannerSummary || "No planner summary yet."}</p>
            <div className="timeline">
              {runEvents.map((event, idx) => (
                <div key={`${event.type}-${idx}`} className="timeline-item">
                  <span>{event.type}</span>
                  <code>{JSON.stringify(event.payload || {})}</code>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <footer className="composer-wrap">
          {error ? <div className="error-banner">{error}</div> : null}
          <div className="composer">
            <textarea
              ref={textAreaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message Aivon..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handlePlan();
                }
              }}
            />
            <button onClick={() => void handlePlan()} disabled={loading || !input.trim()}>
              <SendHorizontal size={18} />
            </button>
          </div>
        </footer>
      </main>

      <aside className="memory-panel">
        <h3>Memories</h3>
        <div className="memory-list">
          {memories.map((memory) => (
            <div key={memory.id} className="memory-item">
              <span>{memory.content}</span>
              <button onClick={() => deleteMemoryItem(memory.id)}>Delete</button>
            </div>
          ))}
        </div>
        {memorySuggestions.length ? (
          <div className="memory-suggestions">
            <h4>Suggestions</h4>
            {memorySuggestions.map((item, idx) => (
              <div key={`${item.content}-${idx}`} className="memory-item">
                <span>{item.content}</span>
                <button onClick={() => acceptMemory(item)}>Save</button>
              </div>
            ))}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
