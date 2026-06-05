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
  journalPrefix: 'ava-journal-',          // ava-journal-YYYY-MM-DD
  planPrefix: 'ava-companion-plan-',       // ava-companion-plan-{id}
} as const;

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

function dateFromJournalKey(k: string): string { return k.slice(K.journalPrefix.length); }
function idFromPlanKey(k: string): string { return k.slice(K.planPrefix.length); }

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
    }
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

  for (const [path, content] of Object.entries(bundle.files)) {
    if (path === 'tasks.json') {
      // Merge by id (safe-merge keeps existing companion tasks).
      const incoming = tasksFromFile(content);
      const existing = parse<Record<string, unknown>[]>(kv.get(K.tasks), []);
      if (overwrite) {
        kv.set(K.tasks, JSON.stringify(incoming));
      } else {
        const haveIds = new Set(existing.map((t) => String(t.id)));
        const merged = [...existing, ...incoming.filter((t) => !haveIds.has(String(t.id)))];
        skipped += incoming.length - (merged.length - existing.length);
        kv.set(K.tasks, JSON.stringify(merged));
      }
      projected.add('tasks');
    } else if (path === 'personality.json') {
      if (setMerge(K.personality, content)) projected.add('personality');
    } else if (path === 'health/profile.json') {
      if (setMerge(K.healthProfile, content)) projected.add('health profile');
    } else if (path.startsWith('journal/') && path.endsWith('.json')) {
      const date = path.slice('journal/'.length, -'.json'.length);
      if (setMerge(`${K.journalPrefix}${date}`, JSON.stringify(journalFromFile(content)))) projected.add('journal');
    } else if (path.startsWith('health/plans/') && path.endsWith('.json')) {
      const id = path.slice('health/plans/'.length, -'.json'.length);
      if (setMerge(`${K.planPrefix}${id}`, content)) projected.add('health plans');
    }
    // else: carried in the shadow only (memory/, history/, learning.json, …).
  }

  return { projected: [...projected], carried: Object.keys(bundle.files).length, skipped };
}
