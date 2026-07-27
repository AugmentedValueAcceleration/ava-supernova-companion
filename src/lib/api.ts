import { getLanguage } from './i18n';
import { readLocalTasks, applyTaskLocal } from './companion-task-store';
import { readLocalMemories, applyMemoryLocal } from './companion-memory-store';
import { readRecentJournal } from './companion-journal-store';
import { readPlansForContext } from './health-plan-store';
import { getActiveProviderKey } from '@/components/SettingsView';

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
  // Swap candidates — "something else that does the same job". Returned
  // UNRANKED; the device ranks them against the local profile so injuries and
  // allergens never leave it.
  alternatives: (kind: 'exercise' | 'recipe', slug: string) =>
    apiFetch(withLocale(`/health/alternatives?kind=${kind}&slug=${encodeURIComponent(slug)}`)).then(r => r.json()),
  // Lookup taxonomies (collections / diets / dietary_flags / cuisines / …)
  // for the recipe filter dropdowns. Public.
  taxonomies: () => apiFetch('/health/taxonomies').then(r => r.json()),
  // The curated starter shelf — professionally built plans, free to begin.
  // Public and anon: requiring a login in front of the one feature designed to
  // prove the product before anyone commits would defeat it.
  curatedPlans: (p: { goal?: string | null; level?: string | null } = {}) => {
    const u = new URLSearchParams();
    if (p.goal) u.set('goal', p.goal);
    if (p.level) u.set('level', p.level);
    const q = u.toString();
    return apiFetch(`/health/curated-plans${q ? `?${q}` : ''}`).then(r => r.json());
  },
  curatedPlan: (id: string) =>
    apiFetch(`/health/curated-plans?id=${encodeURIComponent(id)}`).then(r => r.json()),
  // Fire-and-forget: the only signal we get about which starters work. Never
  // allowed to fail a start.
  curatedPlanStarted: (id: string) =>
    apiFetch('/health/curated-plans/started', { method: 'POST', body: JSON.stringify({ id }) })
      .then(r => r.json()).catch(() => ({ ok: false })),
  // Ingredient lines for a set of recipes, in one request. Used to fill in
  // plans made before ingredients were captured, and plans generated on the
  // server, which only ever carried a slug. Written back onto the plan rows so
  // the shopping list works in a shop with no signal.
  ingredients: (recipes: string[]) =>
    apiFetch(`/health/ingredients?recipes=${encodeURIComponent(recipes.join(','))}`).then(r => r.json()),
  // Pictures for a set of library slugs, in one request. A plan row carries a
  // ref, not an image; asking per row would be thirty requests to draw a week.
  images: (exercises: string[], recipes: string[]) => {
    const u = new URLSearchParams();
    if (exercises.length) u.set('exercises', exercises.join(','));
    if (recipes.length) u.set('recipes', recipes.join(','));
    return apiFetch(`/health/images?${u.toString()}`)
      .then(r => r.json() as Promise<{ exercises: Record<string, string>; recipes: Record<string, string> }>);
  },
};

// Ava helping with ONE day inside the plan builder. Charged (1 credit, 2 for a
// combined plan), so it needs the account key — unlike the read-only catalogue
// above. Returns a PROPOSAL; nothing is saved until the user accepts it.
export const healthAssistApi = {
  /**
   * A WHOLE plan, generated from the person's profile and the filtered library.
   *
   * The same endpoint the extension uses. The companion previously had no route
   * to it at all: asking Ava in chat produced a skeleton with empty days, so
   * everything the generator knows — allergens excluded, injuries screened,
   * calories targeted — reached one surface and not the other. A plan should be
   * a plan wherever you ask for it.
   */
  plan: (token: string, payload: {
    type: 'fitness' | 'meal' | 'combined';
    duration_days: number;
    title?: string;
    goal?: string | null;
    profile?: unknown;
  }) =>
    fetch(`${API_BASE}/health/generate/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...payload, ...currentModelAndKey() }),
    }).then(async r => {
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error || `Request failed (${r.status})`);
      return body as {
        type: string; title: string; goal: string | null; duration_days: number;
        days: unknown[]; credits_charged: number;
        filtering: {
          exercises_available: number; recipes_available: number;
          excluded: Record<string, number>;
          unverifiable_allergens: string[];
        } | null;
      };
    }),

  day: (token: string, payload: {
    type: 'fitness' | 'meal' | 'combined';
    goal?: string | null;
    profile?: unknown;
    day: unknown;
    week?: unknown[];
    instruction: string;
  }) =>
    fetch(`${API_BASE}/health/generate/day`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...payload, ...currentModelAndKey() }),
    }).then(async r => {
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error || `Request failed (${r.status})`);
      return body as {
        day: unknown;
        note: string;
        credits_charged: number;
        unverifiable_allergens: string[];
      };
    }),
};

// News desk — public read of the same published articles the web /news page
// and the newsroom serve. No auth. `list` supports a category filter; `article`
// pulls the full body + related pieces for the in-app reader.
// Both calls carry the reader's locale so the desk arrives in their language.
// The server translates once per (post, locale), caches it, and serves English
// meanwhile — so a cold cache costs a reader nothing but the original wording.
export const newsApi = {
  list: (p: { category?: string | null; limit?: number; page?: number } = {}) => {
    const u = new URLSearchParams({ limit: String(p.limit ?? 30), page: String(p.page ?? 1) });
    if (p.category) u.set('category', p.category);
    return apiFetch(withLocale(`/news?${u.toString()}`)).then(r => r.json());
  },
  article: (slug: string) => apiFetch(withLocale(`/news/${encodeURIComponent(slug)}`)).then(r => r.json()),
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
  // `hour` drives the greeting and `recent` lets the brief reason from evidence
  // rather than intention. Both were missing: without `hour` the prompt's
  // time-of-day ladder fell all the way through and every brief opened with
  // "Evening", whatever the actual time.
  generate: (
    token: string,
    context: { date: string; hour: number; profile: unknown; log: unknown; recent?: unknown },
  ) =>
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

// ── Provider source (wallet) ────────────────────────────────────────────────
// A signed-in user can run on the platform's CREDITS or on their own BYOK keys.
// Without a switch the companion decided this silently by key presence — holding
// a Qwen key quietly billed your key even for a credit model, with no way to
// choose your plan. This is the explicit toggle: 'platform' = credits (ignore
// keys), 'byok' = your own keys. Guests are always effectively 'byok' (no plan).
// Read fresh at send time in useChat, and drives the picker filter in
// CompanionApp. setProviderSource fires a window event so open views re-sync.
export type ProviderSource = 'platform' | 'byok';

export function getProviderSource(): ProviderSource {
  if (typeof localStorage === 'undefined') return 'platform';
  return localStorage.getItem('ava-companion-provider-source') === 'byok' ? 'byok' : 'platform';
}

/**
 * The model this person has chosen, and their own key if they have one.
 *
 * Generation used to send neither. The server therefore hardwired Qwen and
 * accepted a BYOK key only if it was a Qwen key — so somebody on DeepSeek or
 * Kimi had their plan written on the platform's Qwen key AND was charged
 * credits for it, silently. Their own key means their own bill; this is what
 * lets the server know there is one.
 *
 * Read here rather than passed down from every caller, the same way apiFetch
 * already reads data mode, device id and language. Returns nothing rather than
 * guessing when the picker has not been touched, so the server keeps its own
 * default.
 */
export function currentModelAndKey(): { model?: string; providerApiKey?: string } {
  if (typeof window === 'undefined') return {};
  let model: string | undefined;
  try {
    const stored = localStorage.getItem('ava-companion-model');
    // 'auto' is a fleet, not a model id — the server cannot resolve it, so let
    // it fall through to its own default rather than sending a value that
    // would resolve to the wrong provider.
    if (stored && stored !== 'auto') model = stored;
  } catch { /* private mode */ }

  let providerApiKey: string | undefined;
  try {
    if (getProviderSource() === 'byok' && model) {
      const key = getActiveProviderKey(model);
      if (key) providerApiKey = key;
    }
  } catch { /* settings unavailable — fall back to the account key */ }

  return { ...(model ? { model } : {}), ...(providerApiKey ? { providerApiKey } : {}) };
}


export function setProviderSource(src: ProviderSource): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem('ava-companion-provider-source', src);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ava-provider-source-changed', { detail: src }));
  }
}

// ── Orchestrated fleets ─────────────────────────────────────────────────────
// The four fleets are ALWAYS shown at the top of the picker (not gated behind
// sign-in). They're available on a signed-in platform account (run on credits),
// OR to a BYOK user who holds the provider keys the fleet needs — mirroring the
// IDE's mode-availability.ts:
//   Maestro   (auto)      → Qwen
//   Aurora    (aurora)    → Mistral
//   Supernova (supernova) → DeepSeek + Qwen
//   Longxiang (longxiang) → Moonshot + Qwen + DeepSeek
//   Supernova           → Qwen + DeepSeek
//   Longxiang           → Moonshot + Qwen + DeepSeek, BYOK-ONLY
//
// NOTE the key name is 'kimi', not 'moonshot'. The companion's ProviderKeys
// store (SettingsView.tsx) files the Moonshot credential under `kimi`, so
// requiring 'moonshot' here would never match any stored key and would lock
// Longxiang permanently — silently, since the flag hides the failure.
export const FLEET_KEY_REQUIREMENTS: Record<string, Array<'qwen' | 'mistral' | 'deepseek' | 'kimi'>> = {
  auto: ['qwen'],
  aurora: ['mistral'],
  supernova: ['qwen', 'deepseek'],
  longxiang: ['kimi', 'qwen', 'deepseek'],
};

/**
 * Longxiang's launch flag. This is the ONE place in the codebase that mirrors
 * core's LONGXIANG_ENABLED rather than importing it — the companion is a
 * separate submodule with no @ava/core dependency, so there is nothing to
 * import from. Flip this together with core/src/auto/longxiang-router.ts.
 */
export const LONGXIANG_LIVE = true;

export function isFleet(id: string): boolean {
  if (id === 'longxiang' && !LONGXIANG_LIVE) return false;
  return id in FLEET_KEY_REQUIREMENTS;
}

/** A fleet is usable if the user is signed in (credits) OR holds every BYOK key
 *  it needs. `keys` is loadProviderKeys(). Non-fleet ids return false. */
export function fleetAvailable(
  id: string,
  signedIn: boolean,
  keys: { qwen?: string; mistral?: string; deepseek?: string; kimi?: string },
): boolean {
  const req = FLEET_KEY_REQUIREMENTS[id];
  if (!req) return false;
  if (id === 'longxiang' && !LONGXIANG_LIVE) return false;
  if (signedIn) return true;
  return req.every((k) => !!keys[k]);
}

export const MODELS: ModelOption[] = [
  // ── NO FLEETS ON THE COMPANION (operator, 2026-07-23) ───────────────────
  // The orchestrated fleets (Maestro/Aurora/Supernova/Longxiang) are removed
  // from the companion. Orchestration is a sledgehammer for quick mobile
  // productivity, and now that single models are creditable an account user
  // would just burn credits on an ensemble when one cheap model would do.
  // Fleets remain the identity of the coding surfaces (IDE + extension); the
  // companion's identity is single models the user can reason about directly.

  // ── SINGLE FLEET MODELS — account CREDITS or BYOK ──────────────────────
  // Reverses the 2026-07-18 removal (single-picking was made a BYOK-only
  // perk; the operator has now opened it to the account tier). These are the
  // single models our fleets are built from, selectable directly: on a
  // signed-in plan they run on credits (free:true), and a BYOK user reaches
  // them with the provider's key too. ONE entry serves both — available if
  // signed-in OR keyed, exactly like a fleet; CompanionApp's avail() branch
  // handles the OR. Qwen 3.7 Max is deliberately NOT here: no fleet uses it
  // and its $2.50/$7.50 sits outside the plan, so it stays BYOK-only below.
  { id: 'qwen3.7-plus', name: 'Qwen 3.7 Plus', provider: 'Alibaba Cloud', free: true, requiresAccount: false },
  { id: 'qwen3.5-flash', name: 'Qwen 3.5 Flash', provider: 'Alibaba Cloud', free: true, requiresAccount: false },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'DeepSeek', free: true, requiresAccount: false },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'DeepSeek', free: true, requiresAccount: false },
  { id: 'kimi-k3', name: 'Kimi K3', provider: 'Moonshot AI', free: true, requiresAccount: false },
  { id: 'kimi-k2.7-code', name: 'Kimi K2.7 Code', provider: 'Moonshot AI', free: true, requiresAccount: false },
  { id: 'mistral-medium-3.5', name: 'Mistral Medium 3.5', provider: 'Mistral', free: true, requiresAccount: false },
  { id: 'mistral-small-4', name: 'Mistral Small 4', provider: 'Mistral', free: true, requiresAccount: false },
  { id: 'mistral-large-3', name: 'Mistral Large 3', provider: 'Mistral', free: true, requiresAccount: false },
  // Qwen 3.7 Max — Alibaba's heavy flagship, opened to credits 2026-07-23. Not
  // a fleet coordinator, but selectable directly like the rest; 3.22× rate.
  { id: 'qwen3.7-max', name: 'Qwen 3.7 Max', provider: 'Alibaba Cloud', free: true, requiresAccount: false },

  // ── BYOK-only — full lineup, no curation ───────────────────────────────
  // Not fleet members / no managed billing path: reachable only with the
  // user's own key. The user pays per token, so it's their call which to use.
  // Codestral + Devstral retired 2026-07-23 — superseded by Mistral Small 4 /
  // Medium 3.5 (now credit singles above). Kept in sync with
  // packages/core/src/providers/*/models.ts (picker-visible models only).
  { id: 'glm-5.2', name: 'GLM-5.2', provider: 'Zhipu AI', free: false, requiresAccount: false },
  { id: 'glm-4.5-air', name: 'GLM-4.5 Air', provider: 'Zhipu AI', free: false, requiresAccount: false },
  { id: 'MiniMax-M3', name: 'MiniMax M3', provider: 'MiniMax', free: false, requiresAccount: false },
  { id: 'MiniMax-M2.7', name: 'MiniMax M2.7', provider: 'MiniMax', free: false, requiresAccount: false },
  { id: 'MiniMax-M2.7-highspeed', name: 'MiniMax M2.7 Highspeed', provider: 'MiniMax', free: false, requiresAccount: false },
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
  onEvent?: (evt: { type: string; [k: string]: unknown }) => void,
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
  // Local data mode: Ava's server-side tools can't read the device, so send
  // compact snapshots of the user's local data. Tasks (list/complete/dedupe),
  // memories (recall/reference), and recent journal with content (so she can
  // read how they've been and learn about them to assist better).
  if (dataMode === 'local') {
    try { bodyPayload.localTasks = readLocalTasks(); } catch { /* none yet */ }
    try { bodyPayload.localMemories = readLocalMemories(); } catch { /* none yet */ }
    try { bodyPayload.localJournal = readRecentJournal(); } catch { /* none yet */ }
    try { bodyPayload.localPlans = readPlansForContext(); } catch { /* none yet */ }
  }

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
        } else if (parsed.type === 'tool_call' || parsed.type === 'tool_result') {
          // Surface tool activity so the UI can show what Ava's doing.
          onEvent?.(parsed);
        } else if (parsed.type === 'health_plan' && parsed.plan) {
          // Phase 4c: companion-Ava (on core) emits health plans she builds —
          // save into the local-first plan store so it lands in the Plans tab.
          // Lazy require so it's tree-shaken for non-health chats.
          // savePlan applies the one-active-per-type archive rule and stamps
          // start_date when status === 'active' — same lifecycle as a plan
          // created via the manual builder.
          import('./health-plan-store').then(m => { try { m.savePlan(parsed.plan); } catch { /* ignore */ } });
        } else if (parsed.type === 'task_local' && parsed.action) {
          // Ava created/completed/updated/deleted a task. In Local mode the
          // write can't happen server-side, so apply it to the same store the
          // Tasks tab reads (which also fires a change event to refresh it).
          try { applyTaskLocal(parsed); } catch { /* ignore */ }
        } else if (parsed.type === 'journal_local' && parsed.date) {
          // Ava wrote a journal entry (the user's, or her own). Apply to the
          // local ava-journal-{date} store the Journal tab reads.
          import('./companion-journal-store').then(m => { try { m.applyJournalLocal(parsed); } catch { /* ignore */ } });
        } else if (parsed.type === 'memory_local' && parsed.memory) {
          // Ava saved a memory. Apply to the local memory store the Memory tab reads.
          try { applyMemoryLocal(parsed); } catch { /* ignore */ }
        }
      } catch {
        // skip
      }
    }
  }
}
