import { useMemo } from "react";

export function usePinnedChats(chats) {
  return useMemo(() => {
    const pinned = chats.filter((chat) => chat.pinned);
    const rest = chats.filter((chat) => !chat.pinned);
    return [...pinned, ...rest];
  }, [chats]);
}