import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "../components/sidebar/Sidebar.jsx";
import { ChatHeader } from "../components/chat/ChatHeader.jsx";
import { MessageList } from "../components/chat/MessageList.jsx";
import { Composer } from "../components/input/Composer.jsx";
import { TypingIndicator } from "../components/chat/TypingIndicator.jsx";
import { ToolPanel } from "../components/chat/ToolPanel.jsx";
import { DebugPanel } from "../components/chat/DebugPanel.jsx";
import { MemoryPanel } from "../components/settings/MemoryPanel.jsx";
import { AuthScreen } from "../components/auth/AuthScreen.jsx";
import { SettingsPanel, exportToFile } from "../components/settings/SettingsPanel.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useChatStore } from "../hooks/useChatStore.js";
import { useChatSearch } from "../hooks/useChatSearch.js";
import { usePinnedChats } from "../hooks/usePinnedChats.js";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts.js";
import { useTheme } from "../hooks/useTheme.js";
import { useAi } from "../hooks/useAi.js";

function makeTitle(text) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 6)
    .join(" ");
}

export default function App() {
  const { user, loading, logout } = useAuth();
  const {
    chats,
    messages,
    activeChat,
    activeChatId,
    setActiveChatId,
    newChat,
    sendMessage,
    renameChat,
    deleteChat,
    pinChat,
    updateChat
  } = useChatStore(user);

  const { query, setQuery, results } = useChatSearch(chats);
  const pinnedChats = usePinnedChats(results);

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 900;
  });
  const [input, setInput] = useState("");
  const [plannerSummary, setPlannerSummary] = useState("");
  const [proposals, setProposals] = useState([]);
  const [approvedMap, setApprovedMap] = useState({});
  const [runId, setRunId] = useState(null);
  const [events, setEvents] = useState([]);
  const [sources, setSources] = useState([]);
  const [memorySuggestions, setMemorySuggestions] = useState([]);
  const [memories, setMemories] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState(null);
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "dark";
    return localStorage.getItem("aivon_theme") || "dark";
  });
  const searchRef = useRef(null);
  const initChatRef = useRef(false);

  const { plan, run, mock, loading: aiLoading } = useAi();

  useTheme(theme);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aivon_theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    if (initChatRef.current) return;
    if (user && chats.length === 0) {
      initChatRef.current = true;
      void newChat("Aivon Fast");
    }
    if (chats.length > 0) {
      initChatRef.current = true;
    }
  }, [user, chats.length, newChat]);

  useKeyboardShortcuts({
    onNewChat: () => newChat(activeChat?.model),
    onSearch: () => {
      setSidebarOpen(true);
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  });

  const model = activeChat?.model || "Aivon Fast";

  const chatTitle = activeChat?.title || "New chat";

  const exportContent = useMemo(() => {
    return messages
      .map((msg) => `${msg.role === "user" ? "User" : "Aivon"}: ${msg.content}`)
      .join("\n\n");
  }, [messages]);

  const visibleMessages = useMemo(() => {
    if (!streamingMessage) return messages;
    return [...messages, streamingMessage];
  }, [messages, streamingMessage]);

  async function handleSelectChat(chatId) {
    setActiveChatId(chatId);
    if (typeof window !== "undefined" && window.innerWidth < 900) {
      setSidebarOpen(false);
    }
  }

  async function handlePlan() {
    if (!input.trim()) return;
    const content = input.trim();
    setInput("");
    let chatId = activeChatId;
    if (!chatId) {
      chatId = await newChat(model);
      if (!chatId) return;
    }

    await sendMessage(chatId, {
      role: "user",
      content
    });

    const shouldRename = !activeChatId || activeChat?.title?.toLowerCase().startsWith("new chat");
    if (shouldRename) {
      const title = makeTitle(content);
      if (title) {
        await updateChat(chatId, { title });
      }
    }

    try {
      const result = await plan({ chatId, message: content });
      setPlannerSummary(result.reasoningSummary || "");
      setProposals(result.proposals || []);
      setRunId(result.runId);
      const nextMap = {};
      (result.proposals || []).forEach((proposal) => {
        nextMap[proposal.id] = true;
      });
      setApprovedMap(nextMap);

      if (!result.proposals?.length) {
        await executeRun(result.runId, [], chatId);
      }
    } catch (err) {
      let fallbackText = "";
      const streamId = `stream-${Date.now()}`;
      setStreamingMessage({ id: streamId, role: "assistant", content: "", streaming: true });
      await mock({
        message: "AI connectivity is not configured yet. Add VITE_AI_API_BASE and auth to enable responses.",
        onToken: (token) => {
          fallbackText += token;
          setStreamingMessage((prev) => (prev ? { ...prev, content: fallbackText } : prev));
        }
      });
      setStreamingMessage(null);
      await sendMessage(chatId, { role: "assistant", content: fallbackText });
    }
  }

  async function executeRun(runIdValue, approvedToolIds, chatIdOverride) {
    const chatId = chatIdOverride || activeChatId;
    if (!runIdValue || !chatId) return;
    setEvents([]);
    setSources([]);
    setMemorySuggestions([]);
    const streamId = `stream-${Date.now()}`;
    setStreamingMessage({ id: streamId, role: "assistant", content: "", sources: [], streaming: true });

    let assistantContent = "";
    let assistantSources = [];

    await run({
      chatId,
      runId: runIdValue,
      approvedToolIds,
      onEvent: async (event) => {
        if (event.type === "delta") {
          assistantContent += event.text;
          setStreamingMessage((prev) =>
            prev ? { ...prev, content: (prev.content || "") + event.text } : prev
          );
        }
        if (event.type === "tool_start" || event.type === "tool_result" || event.type === "tool_error") {
          setEvents((prev) => [...prev, event]);
        }
        if (event.type === "citation") {
          assistantSources = event.sources || [];
          setSources(assistantSources);
          setStreamingMessage((prev) => (prev ? { ...prev, sources: assistantSources } : prev));
        }
        if (event.type === "memory_suggestions") {
          setMemorySuggestions(event.items || []);
        }
        if (event.type === "done") {
          await sendMessage(chatId, {
            role: "assistant",
            content: assistantContent,
            sources: assistantSources
          });
          setStreamingMessage(null);
        }
        if (event.type === "error") {
          setStreamingMessage(null);
        }
      }
    });
  }

  async function handleClearChat() {
    if (!activeChatId) return;
    await deleteChat(activeChatId);
  }

  async function handleClearAllChats() {
    if (!chats.length) return;
    const confirm = window.confirm("Clear all chats? This cannot be undone.");
    if (!confirm) return;
    await Promise.all(chats.map((chat) => deleteChat(chat.id)));
  }

  async function handleRename(chatId) {
    const title = window.prompt("New title");
    if (!title) return;
    await renameChat(chatId, title);
  }

  async function handleExport(format) {
    exportToFile({ format, title: chatTitle, content: exportContent });
  }

  if (loading) {
    return <div className="auth-screen"><div className="auth-card">Loading...</div></div>;
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="app-shell">
      <div
        className={`sidebar-overlay ${sidebarOpen ? "show" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />
      <Sidebar
        open={sidebarOpen}
        chats={pinnedChats}
        activeChatId={activeChatId}
        onSelect={handleSelectChat}
        onNewChat={() => newChat(model)}
        onSearch={() => {
          setSidebarOpen(true);
          requestAnimationFrame(() => searchRef.current?.focus());
        }}
        onRename={handleRename}
        onDelete={deleteChat}
        onPin={pinChat}
        onSettings={() => setSettingsOpen(true)}
        onLogout={logout}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        query={query}
        onQueryChange={setQuery}
        user={user}
        theme={theme}
        onThemeToggle={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
        searchRef={searchRef}
      />

      <main className="chat-main">
        <ChatHeader
          model={model}
          onModelChange={(value) => {
            if (!activeChatId) return;
            updateChat(activeChatId, { model: value });
          }}
          onClear={handleClearChat}
          onOpenSettings={() => setSettingsOpen(true)}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />

        {visibleMessages.length === 0 ? (
          <div className="empty-state">
            <h2>Welcome to Aivon AI</h2>
            <p>Ask anything, then approve tools when needed.</p>
          </div>
        ) : (
          <MessageList
            messages={visibleMessages}
            onRegenerate={() => executeRun(runId, Object.keys(approvedMap).filter((id) => approvedMap[id]))}
            onEditPrompt={(message) => setInput(message.content || "")}
          />
        )}

        {aiLoading && !streamingMessage ? <TypingIndicator /> : null}

        <ToolPanel
          proposals={proposals}
          approvedMap={approvedMap}
          onToggle={(id) => setApprovedMap((prev) => ({ ...prev, [id]: !prev[id] }))}
          onRun={() => executeRun(runId, Object.keys(approvedMap).filter((id) => approvedMap[id]))}
        />

        <DebugPanel summary={plannerSummary} events={events} />

        <div className="composer-wrap">
          <Composer value={input} onChange={setInput} onSend={handlePlan} disabled={aiLoading} />
        </div>
      </main>

      <MemoryPanel
        memories={memories}
        suggestions={memorySuggestions}
        onSave={(item) => setMemories((prev) => [...prev, { id: crypto.randomUUID(), ...item }])}
        onDelete={(id) => setMemories((prev) => prev.filter((m) => m.id !== id))}
        onEdit={(memory) => {
          const next = window.prompt("Edit memory", memory.content);
          if (!next) return;
          setMemories((prev) => prev.map((m) => (m.id === memory.id ? { ...m, content: next } : m)));
        }}
        onReject={(item) => setMemorySuggestions((prev) => prev.filter((m) => m.content !== item.content))}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        onClearChats={handleClearChat}
        onClearAllChats={handleClearAllChats}
        onExport={handleExport}
        model={model}
        onModelChange={(value) => {
          if (!activeChatId) return;
          updateChat(activeChatId, { model: value });
        }}
        onLogout={logout}
      />
    </div>
  );
}
