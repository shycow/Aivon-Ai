import { Settings, Trash2, Menu } from "lucide-react";

export function ChatHeader({ model, onModelChange, onClear, onOpenSettings, onToggleSidebar }) {
  return (
    <header className="chat-header">
      <div className="brand">
        <button className="icon-btn mobile-only" type="button" onClick={onToggleSidebar}>
          <Menu size={18} />
        </button>
        <div>
          <span className="logo">Aivon</span>
          <span className="sub">AI Assistant</span>
        </div>
      </div>
      <div className="header-actions">
        <select value={model} onChange={(event) => onModelChange(event.target.value)}>
          <option value="Aivon Fast">Aivon Fast</option>
          <option value="Aivon Pro">Aivon Pro</option>
        </select>
        <button type="button" onClick={onClear}>
          <Trash2 size={16} /> Clear
        </button>
        <button type="button" onClick={onOpenSettings}>
          <Settings size={16} /> Settings
        </button>
      </div>
    </header>
  );
}
