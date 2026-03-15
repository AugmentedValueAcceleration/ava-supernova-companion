// API client for Ava Supernova platform
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SUPABASE_URL = 'https://znhqolmxbfmolatxcbph.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuaHFvbG14YmZtb2xhdHhjYnBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkzMDg2MDYsImV4cCI6MjA1NDg4NDYwNn0.o2MNlXJaZKsBkFSBVJyPK7BsBplnhPb96w1C3ByVnEU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      getItem: (key: string) => SecureStore.getItemAsync(key),
      setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
      removeItem: (key: string) => SecureStore.deleteItemAsync(key),
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Platform API base
const API_BASE = 'https://ava-supernova.com/api';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

// Tasks API
export const tasksApi = {
  async list(filters?: { status?: string; priority?: string; category?: string }) {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.priority) params.set('priority', filters.priority);
    if (filters?.category) params.set('category', filters.category);
    const res = await fetch(`${API_BASE}/tasks?${params}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  },

  async create(task: { title: string; description?: string; priority?: string; category?: string; due_date?: string }) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/tasks`, { method: 'POST', headers, body: JSON.stringify(task) });
    if (!res.ok) throw new Error('Failed to create task');
    return res.json();
  },

  async update(id: string, updates: Record<string, unknown>) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/tasks/${id}`, { method: 'PATCH', headers, body: JSON.stringify(updates) });
    if (!res.ok) throw new Error('Failed to update task');
    return res.json();
  },

  async delete(id: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE', headers });
    if (!res.ok) throw new Error('Failed to delete task');
    return res.json();
  },
};

// Journal API
export const journalApi = {
  async list(month?: string) {
    const headers = await getAuthHeaders();
    const params = month ? `?month=${month}` : '';
    const res = await fetch(`${API_BASE}/journal${params}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch journal');
    return res.json();
  },

  async get(date: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/journal/${date}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch entry');
    return res.json();
  },

  async upsert(entry: { date: string; user_content?: string; user_mood?: number; ava_content?: string }) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/journal`, { method: 'POST', headers, body: JSON.stringify(entry) });
    if (!res.ok) throw new Error('Failed to save entry');
    return res.json();
  },
};

// Memory API
export const memoryApi = {
  async list() {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/memories`, { headers });
    if (!res.ok) throw new Error('Failed to fetch memories');
    return res.json();
  },
};

// Chat API — streaming conversation with Ava
export const chatApi = {
  async sendMessage(
    message: string,
    conversationHistory: Array<{ role: string; content: string }>,
    config: { provider: string; model: string; apiKey: string },
    onChunk: (text: string) => void,
    onToolCall?: (tool: string, args: Record<string, unknown>) => void,
  ) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/companion/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        history: conversationHistory,
        provider: config.provider,
        model: config.model,
      }),
    });

    if (!res.ok) throw new Error('Chat request failed');
    if (!res.body) throw new Error('No response body');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'text') onChunk(parsed.content);
          if (parsed.type === 'tool_call' && onToolCall) onToolCall(parsed.name, parsed.args);
        } catch {
          // skip malformed chunks
        }
      }
    }
  },
};
