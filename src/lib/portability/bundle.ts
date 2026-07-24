/**
 * Portability bundle — the companion's view of the shared `.ava-backup`
 * payload (same `DataBundle` shape as `@ava/core/portability/bundle`):
 * a flat map of `relativePath -> file contents`, mirroring the desktop
 * file layout under AVA_HOME.
 *
 * The companion stores data in localStorage with its own keys/shapes, so
 * this module translates between the two:
 *
 *  • PROJECTED types — tasks, journal, health profile, health plans,
 *    personality — map both ways between companion localStorage and the
 *    desktop file shape, so an IDE/extension export is actually usable
 *    here (and the companion's own data exports back).
 *
 *  • SHADOW — every other file in an imported bundle (the memory graph,
 *    chat transcripts, learning, projects, creative metadata, …) is kept
 *    verbatim in a shadow and written back out untouched on the next
 *    export. The companion can't render them yet, but a round-trip never
 *    loses them. (Projecting memory + conversations into the UI is the
 *    planned follow-up.)
 */

export const BUNDLE_VERSION = 1 as const;

export interface DataBundle {
  v: typeof BUNDLE_VERSION;
  createdAt: string;
  /** Which surface produced it (companion). */
  source: string;
  /** relativePath (posix) -> utf8 contents. Desktop file layout. */
  files: Record<string, string>;
}

export interface RestoreResult {
  projected: string[];   // companion-usable types written
  carried: number;       // shadow files preserved for round-trip
  skipped: number;       // existing entries left untouched (safe-merge)
}

/** Minimal key/value store so this is unit-testable outside the browser. */
export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
}

/** Real localStorage adapter (browser / Capacitor webview). */
export function localStorageKV(): KV {
  return {
    get: (k) => localStorage.getItem(k),
    set: (k, v) => localStorage.setItem(k, v),
    remove: (k) => localStorage.removeItem(k),
    keys: () => Object.keys(localStorage),
  };
}

const SHADOW_KEY = 'ava-companion-bundle-shadow';

// Companion localStorage keys (mirror src/lib/* + panels).
const K = {
  tasks: 'ava-companion-tasks',
  personality: 'ava-personality',
  healthProfile: 'ava-companion-health-profile',
  memories: 'ava-companion-memories',
  conversations: 'ava-companion-conversations',
  journalPrefix: 'ava-journal-',          // ava-journal-YYYY-MM-DD
  planPrefix: 'ava-companion-plan-',       // ava-companion-plan-{id}
  // What the user actually DID. Plans and profile were already covered, but
  // the record of every meal eaten and every set performed was not — so an
  // export, a new device and an import lost the entire history while the
  // plans that produced it survived. These are also exactly what adherence
  // and per-exercise progression are computed from.
  dayPrefix: 'ava-companion-day-',                 // ava-companion-day-YYYY-MM-DD
  gymSessionPrefix: 'ava-companion-gym-session-',  // ava-companion-gym-session-{id}
} as const;

// Companion keeps at most this many conversations (mirrors chat-history.ts).
const MAX_CONVERSATIONS = 50;

function parse<T>(raw: string | null, fallback: T): T {
  if (raw == null) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

// ── Field-level mappers: companion shape <-> desktop file shape ──────────────

// Tasks: companion Task[] (snake_case, no container) <-> tasks.json TaskStore.
function tasksToFile(kv: KV): string | null {
  const list = parse<Record<string, unknown>[] | null>(kv.get(K.tasks), null);
  if (!list) return null;
  const entries = list.map((t) => ({
    id: String(t.id ?? ''),
    title: String(t.title ?? ''),
    priority: (t.priority as string) ?? 'medium',
    status: (t.status as string) ?? 'todo',
    category: (t.category as string) ?? 'personal',
    source: (t.source as string) ?? 'user',
    ...(t.due_date ? { dueDate: t.due_date } : {}),
    // Carry through any desktop-only fields a prior import preserved on the item.
    ...(t.description ? { description: t.description } : {}),
    ...(t.project ? { project: t.project } : {}),
    ...(t.recurrence ? { recurrence: t.recurrence } : {}),
    ...(Array.isArray(t.subtasks) ? { subtasks: t.subtasks } : {}),
    ...(t.createdAt ? { createdAt: t.createdAt } : {}),
    ...(t.updatedAt ? { updatedAt: t.updatedAt } : {}),
    ...(t.completedAt ? { completedAt: t.completedAt } : {}),
  }));
  return JSON.stringify({ version: 1, lastModified: new Date().toISOString(), entries });
}

function tasksFromFile(content: string): Record<string, unknown>[] {
  const store = parse<{ entries?: Record<string, unknown>[] }>(content, {});
  const entries = Array.isArray(store.entries) ? store.entries : [];
  return entries.map((e) => ({
    id: String(e.id ?? ''),
    title: String(e.title ?? ''),
    priority: (e.priority as string) ?? 'medium',
    status: (e.status as string) ?? 'todo',
    category: (e.category as string) ?? 'personal',
    source: (e.source as string) ?? 'user',
    ...(e.dueDate ? { due_date: e.dueDate } : {}),
    // Preserve desktop-only fields on the companion item so export round-trips.
    ...(e.description ? { description: e.description } : {}),
    ...(e.project ? { project: e.project } : {}),
    ...(e.recurrence ? { recurrence: e.recurrence } : {}),
    ...(Array.isArray(e.subtasks) ? { subtasks: e.subtasks } : {}),
    ...(e.createdAt ? { createdAt: e.createdAt } : {}),
    ...(e.updatedAt ? { updatedAt: e.updatedAt } : {}),
    ...(e.completedAt ? { completedAt: e.completedAt } : {}),
  }));
}

// Journal: companion ava-journal-{date} {user_content,user_mood,ava_content}
//          <-> journal/{date}.json {userEntry:{content,mood,…}, avaEntry:{…}}
function journalToFile(raw: string, date: string): string {
  const c = parse<{ user_content?: string; user_mood?: number | null; ava_content?: string }>(raw, {});
  const now = new Date().toISOString();
  const userEntry = (c.user_content || c.user_mood != null)
    ? { content: c.user_content ?? '', ...(c.user_mood != null ? { mood: c.user_mood } : {}), createdAt: now, updatedAt: now }
    : null;
  const avaEntry = c.ava_content ? { content: c.ava_content, createdAt: now, updatedAt: now } : null;
  return JSON.stringify({ version: 1, date, userEntry, avaEntry });
}

function journalFromFile(content: string): { user_content: string; user_mood: number | null; ava_content: string } {
  const d = parse<{ userEntry?: { content?: string; mood?: number }; avaEntry?: { content?: string } }>(content, {});
  return {
    user_content: d.userEntry?.content ?? '',
    user_mood: d.userEntry?.mood ?? null,
    ava_content: d.avaEntry?.content ?? '',
  };
}

// Health profile, health plans, personality are byte-identical shapes across
// surfaces — copy raw, no field translation.

// Memory: desktop graph (memory/graph.json, nodes + edges) -> companion flat
// memory list (for DISPLAY). The companion can't model the graph, so edges +
// rich node metadata stay in the shadow; here we project the nodes so imported
// memories show up in the Memory panel. (Companion-origin memories aren't yet
// folded back into the graph on export — that's the planned follow-up.)
interface CompanionMemory {
  id: string; key: string; content: string; category: string;
  created_at: string; updated_at: string; synced?: boolean;
}
function deriveMemoryKey(content: string): string {
  const firstLine = (content.split('\n')[0] || '').trim();
  if (!firstLine) return 'memory';
  return firstLine.length > 60 ? firstLine.slice(0, 57) + '…' : firstLine;
}
function memoriesFromGraph(content: string): CompanionMemory[] {
  const g = parse<{ nodes?: Record<string, unknown>[] }>(content, {});
  const nodes = Array.isArray(g.nodes) ? g.nodes : [];
  return nodes
    .filter((n) => !n.archived)
    .map((n) => {
      const body = String(n.content ?? '');
      const created = String(n.createdAt ?? new Date().toISOString());
      return {
        id: String(n.id ?? ''),
        key: deriveMemoryKey(body),
        content: body,
        category: String(n.category ?? 'general'),
        created_at: created,
        updated_at: String(n.updatedAt ?? created),
        synced: true,
      };
    })
    .filter((m) => m.id && m.content);
}

// Conversations: desktop transcript (history/{id}.json, full agentic messages)
// -> companion chat (user/assistant text only, for DISPLAY). Tool/system/
// multimodal messages stay in the shadow.
interface CompanionConversation {
  id: string; title: string;
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: string }>;
  model: string; createdAt: string; updatedAt: string;
}
function conversationFromHistory(content: string): CompanionConversation | null {
  const h = parse<Record<string, unknown>>(content, {});
  if (!h?.id) return null;
  const raw = Array.isArray(h.messages) ? (h.messages as Record<string, unknown>[]) : [];
  const createdAt = String(h.createdAt ?? new Date().toISOString());
  const messages = raw
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m, i) => {
      let text = '';
      if (typeof m.content === 'string') text = m.content;
      else if (Array.isArray(m.content)) {
        text = (m.content as Record<string, unknown>[])
          .filter((p) => p?.type === 'text')
          .map((p) => String(p.text ?? ''))
          .join('\n');
      }
      return text
        ? { id: `${String(h.id)}-${i}`, role: m.role as 'user' | 'assistant', content: text, timestamp: createdAt }
        : null;
    })
    .filter((m): m is CompanionConversation['messages'][number] => m != null);
  return {
    id: String(h.id),
    title: String(h.title ?? 'Conversation'),
    messages,
    model: '',
    createdAt,
    updatedAt: String(h.updatedAt ?? createdAt),
  };
}

// Reverse: companion memories -> desktop graph.json. Folds phone state into
// the (preserved) shadow graph so nothing in it is lost:
//   • a memory whose id is already a node = imported → update its content /
//     category / updatedAt only (keep edges + all other node metadata)
//   • a memory with a new id = phone-native → add a minimal valid node
//   • nodes with no matching memory (e.g. deleted on the phone) are KEPT —
//     deletions don't propagate in v1 (safer; delete on the desktop instead)
function memoriesToGraph(memories: CompanionMemory[], currentGraphJson?: string): string {
  const base = parse<{ nodes?: Record<string, unknown>[]; edges?: unknown[]; lastDecayRun?: unknown; lastForgetRun?: unknown }>(
    currentGraphJson ?? null, {},
  );
  const nodes = Array.isArray(base.nodes) ? [...base.nodes] : [];
  const indexById = new Map(nodes.map((n, i) => [String(n.id), i]));
  const now = new Date().toISOString();
  for (const m of memories) {
    const id = String(m.id);
    const at = indexById.get(id);
    if (at != null) {
      nodes[at] = { ...nodes[at], content: m.content, category: m.category, updatedAt: m.updated_at || (nodes[at].updatedAt as string) };
    } else {
      nodes.push({
        id,
        category: m.category || 'general',
        content: m.content,
        createdAt: m.created_at || now,
        updatedAt: m.updated_at || m.created_at || now,
        lastRecalledAt: null,
        recallCount: 0,
      });
    }
  }
  return JSON.stringify({
    version: 4,
    nodes,
    edges: Array.isArray(base.edges) ? base.edges : [],
    lastModified: now,
    lastDecayRun: base.lastDecayRun ?? null,
    lastForgetRun: base.lastForgetRun ?? null,
  });
}

// Reverse: companion conversation -> desktop history/{id}.json transcript.
// Only used for phone-native chats; imported transcripts keep their richer
// shadow file verbatim (so tool/system messages aren't lost).
function conversationToHistory(conv: CompanionConversation): string {
  return JSON.stringify({
    id: conv.id,
    title: conv.title,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    messages: (conv.messages || []).map((m) => ({ role: m.role, content: m.content })),
  });
}

function dateFromJournalKey(k: string): string { return k.slice(K.journalPrefix.length); }
function idFromPlanKey(k: string): string { return k.slice(K.planPrefix.length); }
function dateFromDayKey(k: string): string { return k.slice(K.dayPrefix.length); }
function idFromGymSessionKey(k: string): string { return k.slice(K.gymSessionPrefix.length); }

// ── Orchestrators ────────────────────────────────────────────────────────────

/** Build a DataBundle from companion localStorage, folding in the preserved
 *  shadow so nothing carried from a prior import is lost. */
export function gatherBundle(kv: KV, source = 'companion'): DataBundle {
  // Start from the shadow (everything a prior import carried but we don't render).
  const files: Record<string, string> = { ...parse<Record<string, string>>(kv.get(SHADOW_KEY), {}) };

  // Regenerate projected files from current localStorage (captures edits;
  // overwrites the shadow's copy of these specific paths).
  const tasks = tasksToFile(kv);
  if (tasks) files['tasks.json'] = tasks; else delete files['tasks.json'];

  const personality = kv.get(K.personality);
  if (personality) files['personality.json'] = personality;

  const healthProfile = kv.get(K.healthProfile);
  if (healthProfile) files['health/profile.json'] = healthProfile;

  // Journal — one file per date.
  for (const key of kv.keys()) {
    if (key.startsWith(K.journalPrefix)) {
      const date = dateFromJournalKey(key);
      const raw = kv.get(key);
      if (raw) files[`journal/${date}.json`] = journalToFile(raw, date);
    } else if (key.startsWith(K.planPrefix)) {
      const id = idFromPlanKey(key);
      const raw = kv.get(key);
      if (raw) files[`health/plans/${id}.json`] = raw; // identical shape
    } else if (key.startsWith(K.dayPrefix)) {
      const date = dateFromDayKey(key);
      const raw = kv.get(key);
      if (raw) files[`health/days/${date}.json`] = raw; // identical shape
    } else if (key.startsWith(K.gymSessionPrefix)) {
      const id = idFromGymSessionKey(key);
      const raw = kv.get(key);
      if (raw) files[`health/sessions/${id}.json`] = raw; // identical shape
    }
  }

  // Memory — fold companion memories into the (preserved) shadow graph, or
  // create a graph if this device has only ever held phone-native memories.
  const mems = parse<CompanionMemory[]>(kv.get(K.memories), []);
  if (mems.length || files['memory/graph.json']) {
    files['memory/graph.json'] = memoriesToGraph(mems, files['memory/graph.json']);
  }

  // Conversations — keep imported transcripts verbatim (richer), add any
  // phone-native chats as new history files.
  const convs = parse<CompanionConversation[]>(kv.get(K.conversations), []);
  for (const c of convs) {
    const path = `history/${c.id}.json`;
    if (!files[path]) files[path] = conversationToHistory(c);
  }

  return { v: BUNDLE_VERSION, createdAt: new Date().toISOString(), source, files };
}

/** Restore a DataBundle into companion localStorage. Projected types are
 *  written into the companion's own stores (safe-merge unless overwrite);
 *  every file is also kept in the shadow so the next export reproduces the
 *  whole bundle. */
export function restoreBundle(kv: KV, bundle: DataBundle, opts?: { overwrite?: boolean }): RestoreResult {
  if (bundle?.v !== BUNDLE_VERSION) throw new Error('Unsupported backup version');
  const overwrite = !!opts?.overwrite;
  const projected = new Set<string>();
  let skipped = 0;

  // Keep the full file set as shadow (preserves memory graph, transcripts,
  // learning, etc. for a lossless round-trip).
  kv.set(SHADOW_KEY, JSON.stringify(bundle.files));

  const setMerge = (key: string, value: string): boolean => {
    if (!overwrite && kv.get(key) != null) { skipped++; return false; }
    kv.set(key, value);
    return true;
  };

  // Merge a fresh list into an existing by-id list (safe-merge keeps existing).
  const mergeById = (key: string, incoming: Record<string, unknown>[], cap?: number) => {
    const existing = parse<Record<string, unknown>[]>(kv.get(key), []);
    let next: Record<string, unknown>[];
    if (overwrite) {
      next = incoming;
    } else {
      const have = new Set(existing.map((e) => String(e.id)));
      const fresh = incoming.filter((e) => !have.has(String(e.id)));
      skipped += incoming.length - fresh.length;
      next = [...existing, ...fresh];
    }
    if (cap && next.length > cap) {
      next = next
        .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
        .slice(0, cap);
    }
    kv.set(key, JSON.stringify(next));
  };

  const importedConvs: Record<string, unknown>[] = [];

  for (const [path, content] of Object.entries(bundle.files)) {
    if (path === 'tasks.json') {
      mergeById(K.tasks, tasksFromFile(content));
      projected.add('tasks');
    } else if (path === 'personality.json') {
      if (setMerge(K.personality, content)) projected.add('personality');
    } else if (path === 'health/profile.json') {
      if (setMerge(K.healthProfile, content)) projected.add('health profile');
    } else if (path === 'memory/graph.json') {
      mergeById(K.memories, memoriesFromGraph(content) as unknown as Record<string, unknown>[]);
      projected.add('memory');
    } else if (path.startsWith('history/') && path.endsWith('.json')) {
      const c = conversationFromHistory(content);
      if (c) importedConvs.push(c as unknown as Record<string, unknown>);
    } else if (path.startsWith('journal/') && path.endsWith('.json')) {
      const date = path.slice('journal/'.length, -'.json'.length);
      if (setMerge(`${K.journalPrefix}${date}`, JSON.stringify(journalFromFile(content)))) projected.add('journal');
    } else if (path.startsWith('health/plans/') && path.endsWith('.json')) {
      const id = path.slice('health/plans/'.length, -'.json'.length);
      if (setMerge(`${K.planPrefix}${id}`, content)) projected.add('health plans');
    } else if (path.startsWith('health/days/') && path.endsWith('.json')) {
      const date = path.slice('health/days/'.length, -'.json'.length);
      if (setMerge(`${K.dayPrefix}${date}`, content)) projected.add('daily logs');
    } else if (path.startsWith('health/sessions/') && path.endsWith('.json')) {
      const id = path.slice('health/sessions/'.length, -'.json'.length);
      if (setMerge(`${K.gymSessionPrefix}${id}`, content)) projected.add('gym sessions');
    }
    // else: carried in the shadow only (learning.json, projects.json, …).
  }

  if (importedConvs.length) {
    mergeById(K.conversations, importedConvs, MAX_CONVERSATIONS);
    projected.add('conversations');
  }

  return { projected: [...projected], carried: Object.keys(bundle.files).length, skipped };
}
