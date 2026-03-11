import { useMemo, useState } from "react";

export function useChatSearch(chats) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((chat) => chat.title?.toLowerCase().includes(q));
  }, [query, chats]);

  return { query, setQuery, results };
}