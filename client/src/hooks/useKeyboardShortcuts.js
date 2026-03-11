import { useEffect } from "react";

export function useKeyboardShortcuts({ onNewChat, onSearch }) {
  useEffect(() => {
    function handler(event) {
      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      if (ctrlOrMeta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onSearch?.();
      }
      if (ctrlOrMeta && event.key.toLowerCase() === "n") {
        event.preventDefault();
        onNewChat?.();
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNewChat, onSearch]);
}
