import {
  Sparkles,
  Plus,
  Search,
  Settings,
  LogOut,
  Pin,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon
} from "lucide-react";
import { motion } from "framer-motion";

export function Sidebar({
  open,
  chats,
  activeChatId,
  onSelect,
  onNewChat,
  onSearch,
  onRename,
  onDelete,
  onPin,
  onSettings,
  onLogout,
  onToggle,
  query,
  onQueryChange,
  user,
  theme,
  onThemeToggle,
  searchRef
}) {
  const initials =
    user?.displayName?.charAt(0) ||
    user?.email?.charAt(0) ||
    "U";

  return (
    <motion.aside
      className="sidebar"
      data-open={open ? "true" : "false"}
      animate={{ width: open ? 280 : 72 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
    >
      <div className="sidebar-brand">
        <div className="brand-mark">A</div>
        {open ? (
          <div className="brand-text">
            <span className="brand-name">Aivon</span>
            <span className="brand-sub">AI Assistant</span>
          </div>
        ) : null}
        <button className="icon-btn collapse-btn" onClick={onToggle} title="Toggle sidebar">
          {open ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      <button className="new-chat" onClick={onNewChat}>
        <Plus size={16} /> {open ? "New chat" : ""}
      </button>

      <div className="sidebar-search">
        {open ? (
          <div className="search-field">
            <Search size={14} />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search chats"
            />
          </div>
        ) : (
          <button className="icon-btn" onClick={onSearch} title="Search chats">
            <Search size={16} />
          </button>
        )}
      </div>

      <div className="chat-list">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`chat-item ${activeChatId === chat.id ? "active" : ""} ${chat.pinned ? "pinned" : ""}`}
          >
            <button onClick={() => onSelect(chat.id)}>
              <Sparkles size={14} /> {open ? chat.title : ""}
            </button>
            {open ? (
              <div className="chat-actions">
                <button
                  onClick={() => onPin(chat.id, !chat.pinned)}
                  title={chat.pinned ? "Unpin" : "Pin"}
                  className={chat.pinned ? "active" : ""}
                >
                  <Pin size={14} />
                </button>
                <button onClick={() => onRename(chat.id)} title="Rename">
                  <Pencil size={14} />
                </button>
                <button onClick={() => onDelete(chat.id)} title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">{initials}</div>
          {open ? (
            <div className="user-meta">
              <span className="user-name">{user?.displayName || "Aivon User"}</span>
              <span className="user-email">{user?.email || ""}</span>
            </div>
          ) : null}
        </div>
        <div className="footer-actions">
          <button className="icon-btn" onClick={onThemeToggle} title="Toggle theme">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="icon-btn" onClick={onSettings} title="Settings">
            <Settings size={16} />
          </button>
          <button className="icon-btn" onClick={onLogout} title="Log out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
