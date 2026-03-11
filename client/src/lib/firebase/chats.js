import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import { db } from "./client.js";

export function chatsRef(userId) {
  return collection(db, "users", userId, "chats");
}

export function messagesRef(userId, chatId) {
  return collection(db, "users", userId, "chats", chatId, "messages");
}

export async function createChat(userId, data) {
  const ref = await addDoc(chatsRef(userId), {
    title: data.title || "New chat",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    pinned: false,
    model: data.model || "Aivon Fast"
  });
  return ref.id;
}

export function subscribeChats(userId, callback) {
  const q = query(chatsRef(userId), orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const chats = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    callback(chats);
  });
}

export function subscribeMessages(userId, chatId, callback) {
  const q = query(messagesRef(userId, chatId), orderBy("timestamp", "asc"));
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    callback(messages);
  });
}

export async function addMessage(userId, chatId, message) {
  await addDoc(messagesRef(userId, chatId), {
    ...message,
    timestamp: serverTimestamp()
  });
  await updateDoc(doc(db, "users", userId, "chats", chatId), {
    updatedAt: serverTimestamp()
  });
}

export async function updateChat(userId, chatId, updates) {
  await updateDoc(doc(db, "users", userId, "chats", chatId), {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

export async function deleteChat(userId, chatId) {
  const msgs = await getDocs(messagesRef(userId, chatId));
  const deletions = msgs.docs.map((msg) => deleteDoc(msg.ref));
  await Promise.all(deletions);
  await deleteDoc(doc(db, "users", userId, "chats", chatId));
}

export async function renameChat(userId, chatId, title) {
  await updateChat(userId, chatId, { title });
}

export async function pinChat(userId, chatId, pinned) {
  await updateChat(userId, chatId, { pinned });
}

export async function searchChats(userId, queryText) {
  const q = query(chatsRef(userId), where("title", ">=", queryText), where("title", "<=", `${queryText}\uf8ff`));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}
