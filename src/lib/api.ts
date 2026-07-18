import { getLanguage } from './i18n';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://ava-supernova.com/api';

/** Append `?locale=xx` for non-English, matching how the IDE + extension fetch
 *  the catalogue. The health catalogue translates on demand and caches
 *  server-side; without this a non-English user always got English content. */
function withLocale(path: string): string {
  const l = getLanguage();
  if (!l || l === 'en') return path;
  return path + (path.includes('?') ? '&' : '?') + `locale=${encodeURIComponent(l)}`;
}

function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = localStorage.getItem('ava-companion-device-id');
  if (!id) {
    id = crypto.randomUUID().slice(0, 16);
    localStorage.setItem('ava-companion-device-id', id);
  }
  return id;
}

// Read the user's active companion locale (set via Settings → Language).
// Falls back to 'en' on the server or when the lang preference is missing.
// The server uses this on chat turns to make Ava reply in the user's
// chosen language without an explicit "language changed" notification —
// every request carries it, so a fresh choice takes effect on the very
// next message.
function getCompanionLang(): string {
  if (typeof localStorage === 'undefined' || typeof navigator === 'undefined') return 'en';
  const saved = localStorage.getItem('ava-companion-lang');
  if (saved && saved !== 'auto') return saved;
  return (navigator.language || 'en').split('-')[0] === 'zh'
    ? navigator.language.toLowerCase().includes('tw') ? 'zh-TW' : 'zh-CN'
    : (navigator.language || 'en').split('-')[0];
}

export async function apiFetch(path: string, options: RequestInit = {}, token?: string) {
  // Data Mode header so server-side routes that gate on it
  // (generate-image, generate-music, render-video, companion chat
  // tool-level writes) see the user's choice on every call.
  const dataMode = (typeof localStorage !== 'undefined' ? localStorage.getItem('ava-data-mode') : null) || 'local';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Ava-Platform': 'companion',
    'X-Ava-Device': getDeviceId(),
    'X-Ava-Data-Mode': dataMode,
    'X-Ava-Language': getCompanionLang(),
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

// Health catalogue — public, paginated read of the exercise + recipe
// libraries (same endpoints the extension/IDE use). No auth needed.
export const healthCatalogApi = {
  exercises: (p: { offset?: number; limit?: number; q?: string; workoutType?: string | null }) => {
    const u = new URLSearchParams({ limit: String(p.limit ?? 24), offset: String(p.offset ?? 0) });
    if (p.q) u.set('q', p.q);
    if (p.workoutType) u.set('workout_type', p.workoutType);
    return apiFetch(withLocale(`/health/exercises?${u.toString()}`)).then(r => r.json());
  },
  recipes: (p: { offset?: number; limit?: number; q?: string; course?: string | null; collections?: string[]; diets?: string[]; flags?: string[]; cuisines?: string[]; maxTime?: number | null; sort?: 'curated' | 'name' }) => {
    const u = new URLSearchParams({ limit: String(p.limit ?? 24), offset: String(p.offset ?? 0) });
    if (p.q) u.set('q', p.q);
    if (p.course) u.set('course', p.course);
    // Structured filters — comma-separated slug lists (OR within an axis, AND
    // across axes). `flag` covers "free from"; same contract as every surface.
    if (p.collections?.length) u.set('collection', p.collections.join(','));
    if (p.diets?.length) u.set('diet', p.diets.join(','));
    if (p.flags?.length) u.set('flag', p.flags.join(','));
    if (p.cuisines?.length) u.set('cuisine', p.cuisines.join(','));
    if (p.maxTime != null) u.set('max_time', String(p.maxTime));
    if (p.sort && p.sort !== 'curated') u.set('sort', p.sort);
    return apiFetch(withLocale(`/health/recipes?${u.toString()}`)).then(r => r.json());
  },
  exercise: (slug: string) => apiFetch(withLocale(`/health/exercises/${encodeURIComponent(slug)}`)).then(r => r.json()),
  recipe: (slug: string) => apiFetch(withLocale(`/health/recipes/${encodeURIComponent(slug)}`)).then(r => r.json()),
  // Lookup taxonomies (collections / diets / dietary_flags / cuisines / …)
  // for the recipe filter dropdowns. Public.
  taxonomies: () => apiFetch('/health/taxonomies').then(r => r.json()),
};

// News desk — public read of the same published articles the web /news page
// and the newsroom serve. No auth. `list` supports a category filter; `article`
// pulls the full body + related pieces for the in-app reader.
export const newsApi = {
  list: (p: { category?: string | null; limit?: number; page?: number } = {}) => {
    const u = new URLSearchParams({ limit: String(p.limit ?? 30), page: String(p.page ?? 1) });
    if (p.category) u.set('category', p.category);
    return apiFetch(`/news?${u.toString()}`).then(r => r.json());
  },
  article: (slug: string) => apiFetch(`/news/${encodeURIComponent(slug)}`).then(r => r.json()),
};

// Health profile — single-object cloud copy for cross-surface sync.
export const profileApi = {
  get: (token: string) => apiFetch('/health/profile/sync', {}, token).then(r => r.json()),
  sync: (token: string, profile: unknown) =>
    apiFetch('/health/profile/sync', { method: 'POST', body: JSON.stringify({ profile }) }, token).then(r => r.json()),
};

// Morning brief — Ava-authored paragraph from a profile + log snapshot.
// Charges 1 credit (server-side, off the resolved user id).
export const briefApi = {
  generate: (token: string, context: { date: string; profile: unknown; log: unknown }) =>
    apiFetch('/health/morning-brief', { method: 'POST', body: JSON.stringify({ context }) }, token).then(r => r.json()),
};

// Health plans — cloud copy for cross-surface sync (see health-plan-sync.ts)
export const plansApi = {
  list: (token: string) =>
    apiFetch('/health/plans/sync', {}, token).then(r => r.json()),
  sync: (token: string, plans: unknown[]) =>
    apiFetch('/health/plans/sync', { method: 'POST', body: JSON.stringify({ plans }) }, token).then(r => r.json()),
  remove: (token: string, id: string) =>
    apiFetch(`/health/plans/sync?id=${encodeURIComponent(id)}`, { method: 'DELETE' }, token).then(r => r.json()),
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
  // NOT "free" — no model is free; the credit system meters every one. This
  // flag means the model runs on the account's plan CREDITS (billed from the
  // credit balance) rather than needing a BYOK key. The picker badges it
  // CREDITS, never FREE. (Field name kept for now to avoid a wide rename.)
  free: boolean;
  requiresAccount: boolean; // true = needs signed-in account
  adminOnly?: boolean; // true = filtered out of picker unless user.tier === 'admin'
}

// ── Orchestrated fleets ─────────────────────────────────────────────────────
// The three fleets are ALWAYS shown at the top of the picker (not gated behind
// sign-in). They're available on a signed-in platform account (run on credits),
// OR to a BYOK user who holds the provider keys the fleet needs — mirroring the
// IDE's mode-availability.ts:
//   Maestro (auto)      → Qwen
//   Aurora  (aurora)    → Mistral
//   Supernova           → Qwen + DeepSeek
export const FLEET_KEY_REQUIREMENTS: Record<string, Array<'qwen' | 'mistral' | 'deepseek'>> = {
  auto: ['qwen'],
  aurora: ['mistral'],
  supernova: ['qwen', 'deepseek'],
};

export function isFleet(id: string): boolean {
  return id in FLEET_KEY_REQUIREMENTS;
}

/** A fleet is usable if the user is signed in (credits) OR holds every BYOK key
 *  it needs. `keys` is loadProviderKeys(). Non-fleet ids return false. */
export function fleetAvailable(
  id: string,
  signedIn: boolean,
  keys: { qwen?: string; mistral?: string; deepseek?: string },
): boolean {
  const req = FLEET_KEY_REQUIREMENTS[id];
  if (!req) return false;
  if (signedIn) return true;
  return req.every((k) => !!keys[k]);
}

export const MODELS: ModelOption[] = [
  // ── ORCHESTRATED FLEETS (the account/credit models) ─────────────────────
  // The three fleets the IDE + extension surface to signed-in users, matched
  // here so the companion offers the same thing. Each is a whole multi-model
  // fleet behind one pick; the backend (api/companion/chat) maps the id to the
  // fleet's lead (auto→qwen3.7-plus, supernova→deepseek-v4-pro,
  // aurora→mistral-medium-3.5). Public for any signed-in platform user — the
  // admin gate was retired 2026-04-30 (mode-availability.ts). BYOK users reach
  // them with the fleet's keys (Maestro=Qwen, Aurora=Mistral, Supernova=Qwen+
  // DeepSeek). On a plan they run on credits — NOT free; every model is metered
  // by the credit system. '✦' matches the other surfaces.
  { id: 'auto',      name: '✦ Maestro',   provider: 'Orchestrated · balanced', free: true, requiresAccount: true },
  { id: 'aurora',    name: '✦ Aurora',    provider: 'Orchestrated · EU-sovereign', free: true, requiresAccount: true },
  { id: 'supernova', name: '✦ Supernova', provider: 'Orchestrated · polyglot', free: true, requiresAccount: true },

  // ── PLATFORM SINGLES: removed 2026-07-18 ────────────────────────────────
  // A signed-in plan surfaces the three orchestrated fleets and NOTHING else
  // — single-model picking is a BYOK-only perk. The account is what promotes
  // the fleets; the fleets are the product. We no longer expose the managed
  // singles (Qwen 3.7 Plus / 3.5 Flash, Mistral Medium 3.5 / Small 4,
  // DeepSeek V4 Flash) as direct picks. Those models still run *inside* the
  // fleets — you just reach a specific one only by bringing its own key
  // (see the BYOK lineup below). Reverses the 2026-04-29 curated-singles
  // decision.

  // ── BYOK — full lineup, no curation ────────────────────────────────────
  // The user pays per token, so it's their call which to use. Mirror of the
  // IDE / extension BYOK lineup for consistency across surfaces — kept in sync
  // with packages/core/src/providers/*/models.ts (picker-visible models only:
  // hiddenFromPicker + disabled excluded). Reconciled 2026-07-17.
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'DeepSeek', free: false, requiresAccount: false },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'DeepSeek', free: false, requiresAccount: false },
  { id: 'kimi-k3', name: 'Kimi K3', provider: 'Moonshot AI', free: false, requiresAccount: false },
  { id: 'kimi-k2.7-code', name: 'Kimi K2.7 Code', provider: 'Moonshot AI', free: false, requiresAccount: false },
  { id: 'qwen3.7-max', name: 'Qwen 3.7 Max', provider: 'Alibaba Cloud', free: false, requiresAccount: false },
  { id: 'glm-5.2', name: 'GLM-5.2', provider: 'Zhipu AI', free: false, requiresAccount: false },
  { id: 'glm-4.5-air', name: 'GLM-4.5 Air', provider: 'Zhipu AI', free: false, requiresAccount: false },
  { id: 'MiniMax-M3', name: 'MiniMax M3', provider: 'MiniMax', free: false, requiresAccount: false },
  { id: 'MiniMax-M2.7', name: 'MiniMax M2.7', provider: 'MiniMax', free: false, requiresAccount: false },
  { id: 'MiniMax-M2.7-highspeed', name: 'MiniMax M2.7 Highspeed', provider: 'MiniMax', free: false, requiresAccount: false },
  { id: 'mistral-large-3', name: 'Mistral Large 3', provider: 'Mistral', free: false, requiresAccount: false },
  { id: 'mistral-medium-3.5', name: 'Mistral Medium 3.5', provider: 'Mistral', free: false, requiresAccount: false },
  { id: 'mistral-small-4', name: 'Mistral Small 4', provider: 'Mistral', free: false, requiresAccount: false },
  { id: 'codestral-latest', name: 'Codestral', provider: 'Mistral', free: false, requiresAccount: false },
  { id: 'devstral-latest', name: 'Devstral 2', provider: 'Mistral', free: false, requiresAccount: false },
  { id: 'claude-fable-5', name: 'Claude Fable 5', provider: 'Anthropic', free: false, requiresAccount: false },
  { id: 'claude-opus-4-8', name: 'Claude Opus 4.8', provider: 'Anthropic', free: false, requiresAccount: false },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', provider: 'Anthropic', free: false, requiresAccount: false },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'Anthropic', free: false, requiresAccount: false },
  { id: 'hy3-preview', name: 'Hunyuan Hy3', provider: 'Tencent Hunyuan', free: false, requiresAccount: false },
  { id: 'nvidia/nemotron-3-ultra-550b-a55b', name: 'Nemotron 3 Ultra', provider: 'NVIDIA', free: false, requiresAccount: false },
  { id: 'mimo-v2.5-pro', name: 'MiMo V2.5-Pro', provider: 'Xiaomi', free: false, requiresAccount: false },
  { id: 'mimo-v2.5', name: 'MiMo V2.5', provider: 'Xiaomi', free: false, requiresAccount: false },
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
  const dataMode = (typeof localStorage !== 'undefined' ? localStorage.getItem('ava-data-mode') : null) || 'local';
  const lang = getCompanionLang();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Ava-Platform': 'companion',
    'X-Ava-Device': getDeviceId(),
    'X-Ava-Data-Mode': dataMode,
    'X-Ava-Language': lang,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  // Also include in body for endpoints that prefer to read it that way.
  // Whichever the server reads, the latest user-chosen locale travels
  // on every turn, so a language change in Settings takes effect on the
  // very next message without any explicit notification.
  const bodyPayload: Record<string, unknown> = { message, history, model, language: lang };
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
        } else if (parsed.type === 'health_plan' && parsed.plan) {
          // Phase 4c: companion-Ava (on core) emits health plans she builds —
          // save into the local-first plan store so it lands in the Plans tab.
          // Lazy require so it's tree-shaken for non-health chats.
          // savePlan applies the one-active-per-type archive rule and stamps
          // start_date when status === 'active' — same lifecycle as a plan
          // created via the manual builder.
          import('./health-plan-store').then(m => { try { m.savePlan(parsed.plan); } catch { /* ignore */ } });
        }
      } catch {
        // skip
      }
    }
  }
}
