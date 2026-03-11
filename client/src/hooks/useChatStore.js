import { useEffect, useMemo, useState } from "react";
import {
  createChat,
  subscribeChats,
  subscribeMessages,
  addMessage,
  renameChat,
  deleteChat,
  pinChat,
  updateChat
} from "../lib/firebase/chats.js";

export function useChatStore(user) {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeChats(user.uid, (nextChats) => setChats(nextChats));
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user || !activeChatId) return;
    const unsub = subscribeMessages(user.uid, activeChatId, (nextMessages) => setMessages(nextMessages));
    return () => unsub();
  }, [user, activeChatId]);

  useEffect(() => {
    if (!activeChatId && chats.length) {
      setActiveChatId(chats[0].id);
    }
  }, [activeChatId, chats]);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) || null,
    [chats, activeChatId]
  );

  async function newChat(model) {
    if (!user) return null;
    const chatId = await createChat(user.uid, { title: "New chat", model });
    setActiveChatId(chatId);
    return chatId;
  }

  async function sendMessage(chatId, message) {
    if (!user) return;
    await addMessage(user.uid, chatId, message);
  }

  async function rename(chatId, title) {
    if (!user) return;
    await renameChat(user.uid, chatId, title);
  }

  async function remove(chatId) {
    if (!user) return;
    await deleteChat(user.uid, chatId);
  }

  async function pin(chatId, pinned) {
    if (!user) return;
    await pinChat(user.uid, chatId, pinned);
  }

  async function update(chatId, updates) {
    if (!user) return;
    await updateChat(user.uid, chatId, updates);
  }

  return {
    chats,
    messages,
    activeChat,
    activeChatId,
    setActiveChatId,
    newChat,
    sendMessage,
    renameChat: rename,
    deleteChat: remove,
    pinChat: pin,
    updateChat: update
  };
}