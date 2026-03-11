import { useState } from "react";
import { jsPDF } from "jspdf";

export function SettingsPanel({
  open,
  onClose,
  theme,
  onThemeChange,
  model,
  onModelChange,
  onClearChats,
  onClearAllChats,
  onExport,
  onLogout
}) {
  const [format, setFormat] = useState("markdown");

  if (!open) return null;

  function handleExport() {
    onExport(format);
  }

  return (
    <div className="settings-panel">
      <div className="settings-card">
        <h3>Settings</h3>
        <div className="setting-row">
          <span>Theme</span>
          <select value={theme} onChange={(event) => onThemeChange(event.target.value)}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>
        <div className="setting-row">
          <span>Model</span>
          <select value={model} onChange={(event) => onModelChange(event.target.value)}>
            <option value="Aivon Fast">Aivon Fast</option>
            <option value="Aivon Pro">Aivon Pro</option>
          </select>
        </div>
        <div className="setting-row">
          <span>Export Chat</span>
          <select value={format} onChange={(event) => setFormat(event.target.value)}>
            <option value="text">Text</option>
            <option value="markdown">Markdown</option>
            <option value="pdf">PDF</option>
          </select>
          <button onClick={handleExport}>Export</button>
        </div>
        <div className="setting-row">
          <span>Clear current chat</span>
          <button onClick={onClearChats}>Clear</button>
        </div>
        <div className="setting-row">
          <span>Clear all chats</span>
          <button onClick={onClearAllChats}>Clear all</button>
        </div>
        <div className="setting-row">
          <span>Log out</span>
          <button onClick={onLogout}>Log out</button>
        </div>
        <button className="ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export function exportToFile({ format, title, content }) {
  if (format === "pdf") {
    const doc = new jsPDF();
    doc.text(title || "Chat Export", 10, 10);
    doc.text(content.slice(0, 4000), 10, 20);
    doc.save(`${title || "chat"}.pdf`);
    return;
  }

  const blob = new Blob([content], { type: format === "markdown" ? "text/markdown" : "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${title || "chat"}.${format === "markdown" ? "md" : "txt"}`;
  link.click();
}
