export interface Conversation {
  id: string;
  title: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string; // ISO string for serialization
  }>;
  model: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'ava-companion-conversations';
const ACTIVE_KEY = 'ava-companion-active-conversation';
const MAX_CONVERSATIONS = 50;

function loadAll(): Conversation[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveAll(conversations: Conversation[]) {
  // Keep only the most recent conversations
  const trimmed = conversations.slice(0, MAX_CONVERSATIONS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function getConversations(): Conversation[] {
  return loadAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getActiveConversationId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveConversationId(id: string | null) {
  if (id) {
    localStorage.setItem(ACTIVE_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_KEY);
  }
}

export function getConversation(id: string): Conversation | null {
  return loadAll().find(c => c.id === id) || null;
}

export function saveConversation(conversation: Conversation) {
  const all = loadAll();
  const idx = all.findIndex(c => c.id === conversation.id);
  if (idx >= 0) {
    all[idx] = conversation;
  } else {
    all.unshift(conversation);
  }
  saveAll(all);
  setActiveConversationId(conversation.id);
}

export function deleteConversation(id: string) {
  const all = loadAll().filter(c => c.id !== id);
  saveAll(all);
  const activeId = getActiveConversationId();
  if (activeId === id) {
    setActiveConversationId(null);
  }
}

export function generateTitle(messages: Array<{ role: string; content: string }>): string {
  // Use first user message as title, truncated
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return 'New conversation';
  const title = firstUser.content.slice(0, 50);
  return title.length < firstUser.content.length ? title + '...' : title;
}

export function clearAllConversations() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(ACTIVE_KEY);
}

export function createConversation(model: string): Conversation {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    title: 'New conversation',
    messages: [],
    model,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
