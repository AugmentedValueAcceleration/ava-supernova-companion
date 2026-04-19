export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://ava-supernova.com/api';

function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = localStorage.getItem('ava-companion-device-id');
  if (!id) {
    id = crypto.randomUUID().slice(0, 16);
    localStorage.setItem('ava-companion-device-id', id);
  }
  return id;
}

export async function apiFetch(path: string, options: RequestInit = {}, token?: string) {
  // Data Mode header so server-side routes that gate on it
  // (generate-image, generate-music, render-video, companion chat
  // tool-level writes) see the user's choice on every call.
  const dataMode = (typeof localStorage !== 'undefined' ? localStorage.getItem('ava-data-mode') : null) || 'cloud';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Ava-Platform': 'companion',
    'X-Ava-Device': getDeviceId(),
    'X-Ava-Data-Mode': dataMode,
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res;
}

// Tasks
export const tasksApi = {
  list: (token: string) => apiFetch('/tasks?status=todo,in-progress', {}, token).then(r => r.json()),
  create: (token: string, task: { title: string; priority?: string; category?: string; due_date?: string }) =>
    apiFetch('/tasks', { method: 'POST', body: JSON.stringify(task) }, token).then(r => r.json()),
  update: (token: string, id: string, updates: Record<string, unknown>) =>
    apiFetch(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }, token).then(r => r.json()),
  delete: (token: string, id: string) =>
    apiFetch(`/tasks/${id}`, { method: 'DELETE' }, token).then(r => r.json()),
};

// Journal
export const journalApi = {
  get: (token: string, date: string) => apiFetch(`/journal/${date}`, {}, token).then(r => r.json()),
  upsert: (token: string, entry: { date: string; user_content?: string; user_mood?: number }) =>
    apiFetch('/journal', { method: 'POST', body: JSON.stringify(entry) }, token).then(r => r.json()),
  delete: (token: string, date: string) =>
    apiFetch(`/journal/${date}`, { method: 'DELETE' }, token).then(r => r.json()),
};

// Memories
export const memoriesApi = {
  list: (token: string) => apiFetch('/memories', {}, token).then(r => r.json()),
  create: (token: string, memory: { key: string; content: string; category?: string; scope?: string }) =>
    apiFetch('/memories', { method: 'POST', body: JSON.stringify(memory) }, token).then(r => r.json()),
  update: (token: string, id: string, updates: Record<string, unknown>) =>
    apiFetch(`/memories/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }, token).then(r => r.json()),
  delete: (token: string, id: string) =>
    apiFetch(`/memories/${id}`, { method: 'DELETE' }, token).then(r => r.json()),
};

// Models
export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  free: boolean;       // true = available with free account (3M tokens)
  requiresAccount: boolean; // true = needs signed-in account
}

export const MODELS: ModelOption[] = [
  // Free with account (3M Qwen tokens)
  { id: 'qwen3.6-plus', name: 'Qwen 3.6 Plus', provider: 'Alibaba Cloud', free: true, requiresAccount: true },
  { id: 'qwen3.5-flash', name: 'Qwen 3.5 Flash', provider: 'Alibaba Cloud', free: true, requiresAccount: true },
  { id: 'qwen3.5-omni-flash', name: 'Qwen 3.5 Omni Flash', provider: 'Alibaba Cloud', free: true, requiresAccount: true },
  { id: 'qwen3.5-omni-plus', name: 'Qwen 3.5 Omni Plus', provider: 'Alibaba Cloud', free: true, requiresAccount: true },
  { id: 'qwen3.5-plus', name: 'Qwen 3.5 Plus', provider: 'Alibaba Cloud', free: true, requiresAccount: true },
  // BYOK — requires own API key
  { id: 'glm-5', name: 'GLM-5', provider: 'Zhipu AI', free: false, requiresAccount: false },
  { id: 'kimi-k2.5', name: 'Kimi K2.5', provider: 'Moonshot AI', free: false, requiresAccount: false },
  { id: 'deepseek-chat', name: 'DeepSeek V3.2', provider: 'DeepSeek', free: false, requiresAccount: false },
  { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', provider: 'DeepSeek', free: false, requiresAccount: false },
  { id: 'mistral-large-latest', name: 'Mistral Large', provider: 'Mistral', free: false, requiresAccount: false },
  { id: 'codestral-latest', name: 'Codestral', provider: 'Mistral', free: false, requiresAccount: false },
  { id: 'devstral-latest', name: 'Devstral 2', provider: 'Mistral', free: false, requiresAccount: false },
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'Anthropic', free: false, requiresAccount: false },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'Anthropic', free: false, requiresAccount: false },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'Anthropic', free: false, requiresAccount: false },
];

// Chat — streaming (token optional for guest mode with free models)
export async function sendChat(
  token: string | null,
  message: string,
  history: Array<{ role: string; content: string }>,
  model: string,
  onChunk: (text: string) => void,
  providerApiKey?: string | null,
  personalityPrefix?: string | null,
) {
  // Data Mode is read lazily from localStorage so the user's choice
  // travels with every turn. Server-side tool handlers (task_manage,
  // journal_write, memory_save) skip their DB writes when this is
  // 'local'. Default 'cloud' when the header is missing (matches the
  // companion's cloud-first expectation).
  const dataMode = (typeof localStorage !== 'undefined' ? localStorage.getItem('ava-data-mode') : null) || 'cloud';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Ava-Platform': 'companion',
    'X-Ava-Device': getDeviceId(),
    'X-Ava-Data-Mode': dataMode,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const bodyPayload: Record<string, unknown> = { message, history, model };
  if (providerApiKey) bodyPayload.providerApiKey = providerApiKey;
  if (personalityPrefix) bodyPayload.personalityPrefix = personalityPrefix;

  const res = await fetch(`${API_BASE}/companion/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyPayload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Chat failed' }));
    throw new Error(`${res.status}: ${err.error || 'Request failed'}`);
  }

  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'text' && parsed.content) {
          onChunk(parsed.content);
        }
      } catch {
        // skip
      }
    }
  }
}
