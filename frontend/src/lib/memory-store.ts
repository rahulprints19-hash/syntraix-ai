import { createApiKey, hashSecret } from "@/lib/security";

export type ApiKeyRecord = {
  created_at: string;
  id: string;
  key_hash: string;
  key_prefix: string;
  name: string;
  user_id: string;
};

export type ChatRecord = {
  id: string;
  title: string;
  updated_at: string;
  user_id: string;
};

export type MessageRecord = {
  chat_id: string;
  content: string;
  created_at: string;
  id: string;
  role: "assistant" | "user";
  user_id: string;
};

type MemoryStore = {
  apiKeys: ApiKeyRecord[];
  chats: ChatRecord[];
  messages: MessageRecord[];
  plans: Map<string, string>;
  usageTokens: number;
};

const globalStore = globalThis as typeof globalThis & {
  syntrixMemoryStore?: MemoryStore;
};

export function getMemoryStore(): MemoryStore {
  globalStore.syntrixMemoryStore ??= {
    apiKeys: [],
    chats: [],
    messages: [],
    plans: new Map(),
    usageTokens: 0
  };

  return globalStore.syntrixMemoryStore;
}

export function listChats(userId: string) {
  return getMemoryStore().chats
    .filter((chat) => chat.user_id === userId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 50)
    .map(({ id, title, updated_at }) => ({ id, title, updated_at }));
}

export function createChat(userId: string, title = "New chat") {
  const now = new Date().toISOString();
  const chat: ChatRecord = {
    id: crypto.randomUUID(),
    title,
    updated_at: now,
    user_id: userId
  };
  getMemoryStore().chats.unshift(chat);
  return { id: chat.id, title: chat.title, updated_at: chat.updated_at };
}

export function renameChat(userId: string, chatId: string, title: string) {
  const chat = getMemoryStore().chats.find((item) => item.id === chatId && item.user_id === userId);
  if (!chat) return null;

  chat.title = title;
  chat.updated_at = new Date().toISOString();
  return { id: chat.id, title: chat.title, updated_at: chat.updated_at };
}

export function deleteChat(userId: string, chatId: string) {
  const store = getMemoryStore();
  store.chats = store.chats.filter((chat) => !(chat.id === chatId && chat.user_id === userId));
  store.messages = store.messages.filter((message) => !(message.chat_id === chatId && message.user_id === userId));
}

export function chatBelongsToUser(userId: string, chatId: string) {
  return getMemoryStore().chats.some((chat) => chat.id === chatId && chat.user_id === userId);
}

export function addMessage(userId: string, chatId: string, role: "assistant" | "user", content: string) {
  const now = new Date().toISOString();
  const message: MessageRecord = {
    chat_id: chatId,
    content,
    created_at: now,
    id: crypto.randomUUID(),
    role,
    user_id: userId
  };
  const store = getMemoryStore();
  store.messages.push(message);

  const chat = store.chats.find((item) => item.id === chatId && item.user_id === userId);
  if (chat) chat.updated_at = now;

  return {
    content: message.content,
    created_at: message.created_at,
    id: message.id,
    role: message.role
  };
}

export function listMessages(userId: string, chatId: string) {
  return getMemoryStore().messages
    .filter((message) => message.user_id === userId && message.chat_id === chatId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(({ content, created_at, id, role }) => ({ content, created_at, id, role }));
}

export function addUsageTokens(tokens: number) {
  getMemoryStore().usageTokens += tokens;
}

export function listApiKeys(userId: string) {
  return getMemoryStore().apiKeys
    .filter((key) => key.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(({ created_at, id, key_prefix, name }) => ({ created_at, id, key_prefix, name }));
}

export function createStoredApiKey(userId: string, name: string) {
  const apiKey = createApiKey();
  const row: ApiKeyRecord = {
    created_at: new Date().toISOString(),
    id: crypto.randomUUID(),
    key_hash: hashSecret(apiKey),
    key_prefix: apiKey.slice(0, 10),
    name: name.slice(0, 80),
    user_id: userId
  };

  getMemoryStore().apiKeys.unshift(row);

  return {
    apiKey,
    key: {
      created_at: row.created_at,
      id: row.id,
      key_prefix: row.key_prefix,
      name: row.name
    }
  };
}

export function getUserPlan(userId: string) {
  return getMemoryStore().plans.get(userId) ?? "free";
}

export function setUserPlan(userId: string, planCode: string) {
  getMemoryStore().plans.set(userId, planCode);
}
