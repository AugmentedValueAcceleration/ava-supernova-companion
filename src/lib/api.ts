const API_BASE = 'https://ava-supernova.com/api';

export async function apiFetch(path: string, options: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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

// Models
export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  free: boolean;
}

export const MODELS: ModelOption[] = [
  // Free
  { id: 'glm-4.7-flash', name: 'GLM-4.7 Flash', provider: 'Zhipu AI', free: true },
  { id: 'glm-4-flash', name: 'GLM-4.5 Flash', provider: 'Zhipu AI', free: true },
  // Paid
  { id: 'glm-5', name: 'GLM-5', provider: 'Zhipu AI', free: false },
  { id: 'kimi-k2.5', name: 'Kimi K2.5', provider: 'Moonshot AI', free: false },
  { id: 'deepseek-chat', name: 'DeepSeek V3.2', provider: 'DeepSeek', free: false },
  { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', provider: 'DeepSeek', free: false },
  { id: 'qwen-plus', name: 'Qwen 3.5 Plus', provider: 'Alibaba Cloud', free: false },
  { id: 'mistral-large-latest', name: 'Mistral Large', provider: 'Mistral', free: false },
  { id: 'codestral-latest', name: 'Codestral', provider: 'Mistral', free: false },
  { id: 'devstral-latest', name: 'Devstral 2', provider: 'Mistral', free: false },
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'Anthropic', free: false },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'Anthropic', free: false },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'Anthropic', free: false },
];

// Chat — streaming (token optional for guest mode with free models)
export async function sendChat(
  token: string | null,
  message: string,
  history: Array<{ role: string; content: string }>,
  model: string,
  onChunk: (text: string) => void,
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/companion/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, history, model }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Chat failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
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
