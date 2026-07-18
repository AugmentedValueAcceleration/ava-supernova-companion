// The single source of truth for wiping the companion's on-device data.
//
// WHY IT'S AN ALLOW-LIST, NOT A DENY-LIST: sign-out used to clear a
// hand-written list of keys living inside SettingsView. Every time a store was
// added (tasks, journal, memories, plans, gym sessions, personality…) someone
// had to remember to append it — and nobody did, so memories, journals, health
// profile and even a platform key survived logout. One entry was also simply
// wrong (it filtered `ava-companion-journal…` while entries are `ava-journal-…`),
// so it had never matched anything.
//
// So we invert it: we enumerate what to KEEP and wipe everything else under the
// `ava-` namespace. A new store added tomorrow is cleared by default — the safe
// direction to fail. If something genuinely must survive, add it here
// deliberately, in one place, where the decision is visible.

/** Device identity + machine-level prefs. Not user content — these survive
 *  both sign-out and "clear all data" so the install keeps working sanely. */
const ALWAYS_KEEP = new Set<string>([
  'ava-companion-device-id',
  'ava-companion-device-name',
  'ava-companion-fingerprint',
  'ava-companion-lang',
  'ava-data-mode',
  'ava-companion-consent-accepted',
]);

/** Credentials + the account-shaped bits. Kept when the user is only clearing
 *  their content (they stay signed in); removed on a real sign-out. */
const CREDENTIAL_KEYS = new Set<string>([
  'ava-companion-api-key',
  'ava-companion-provider-keys',
  'ava-companion-platform-key',
  'ava-signin-state',
  'ava-signin-state-at',
]);

function wipe(keep: Set<string>): void {
  if (typeof localStorage === 'undefined') return;
  // Snapshot first — removing while iterating localStorage is unsafe.
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith('ava-')) continue;
    if (keep.has(key)) continue;
    localStorage.removeItem(key);
  }
}

/** Everything the user created, on this device: chats, tasks, journal,
 *  memories, plans, gym sessions, health profile, personality. Leaves the user
 *  signed in and their keys intact. */
export function clearUserContent(): void {
  wipe(new Set<string>([...ALWAYS_KEEP, ...CREDENTIAL_KEYS]));
}

/** A real sign-out: user content AND credentials. Only device identity and
 *  locale survive, so the next person on this device starts clean. */
export function clearOnSignOut(): void {
  wipe(ALWAYS_KEEP);
}

// ─── Inspector ──────────────────────────────────────────────────────────────
// The companion has no "local folder" to open — it's a web app, so everything
// lives in localStorage. This is the honest equivalent: show exactly what's on
// the device, per store, with the raw contents. Doubles as a diagnostic — if
// Memories reads 0 items, saving is broken; if it reads 3 but the tab is empty,
// reading is broken.

export interface LocalStoreInfo {
  id: string;
  label: string;
  /** Item count where countable (array length / number of prefixed keys). */
  count: number;
  bytes: number;
  /** Pretty-printed contents, truncated — for the expandable view. */
  raw: string;
}

interface StoreDef { id: string; label: string; key?: string; prefix?: string }

const STORES: StoreDef[] = [
  { id: 'memories', label: 'Memories', key: 'ava-companion-memories' },
  { id: 'tasks', label: 'Tasks', key: 'ava-companion-tasks' },
  { id: 'chats', label: 'Chats', key: 'ava-companion-conversations' },
  { id: 'journal', label: 'Journal entries', prefix: 'ava-journal-' },
  { id: 'plans', label: 'Health plans', prefix: 'ava-companion-plan-' },
  { id: 'gym', label: 'Gym sessions', prefix: 'ava-companion-gym-session-' },
  { id: 'profile', label: 'Health profile', key: 'ava-companion-health-profile' },
  { id: 'personality', label: 'Personality', key: 'ava-personality' },
];

const MAX_RAW = 4000;

function pretty(value: unknown): string {
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function truncate(s: string): string {
  return s.length > MAX_RAW ? `${s.slice(0, MAX_RAW)}\n… (${s.length - MAX_RAW} more chars)` : s;
}

/** Everything on this device, grouped. Unlisted `ava-` keys land in "Other" so
 *  nothing is hidden — if a new store appears, you still see it. */
export function describeLocalData(): LocalStoreInfo[] {
  if (typeof localStorage === 'undefined') return [];
  const seen = new Set<string>();
  const out: LocalStoreInfo[] = [];

  for (const def of STORES) {
    if (def.key) {
      seen.add(def.key);
      const rawStr = localStorage.getItem(def.key);
      let count = 0;
      let body: unknown = null;
      if (rawStr) {
        try { body = JSON.parse(rawStr); } catch { body = rawStr; }
        count = Array.isArray(body) ? body.length : 1;
      }
      out.push({ id: def.id, label: def.label, count, bytes: rawStr?.length ?? 0, raw: rawStr ? truncate(pretty(body)) : '(empty)' });
    } else if (def.prefix) {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(def.prefix!));
      keys.forEach(k => seen.add(k));
      const bag: Record<string, unknown> = {};
      let bytes = 0;
      for (const k of keys) {
        const v = localStorage.getItem(k) ?? '';
        bytes += v.length;
        try { bag[k] = JSON.parse(v); } catch { bag[k] = v; }
      }
      out.push({ id: def.id, label: def.label, count: keys.length, bytes, raw: keys.length ? truncate(pretty(bag)) : '(empty)' });
    }
  }

  // Anything else under the ava- namespace (prefs, keys, device id, new stores).
  const others = Object.keys(localStorage).filter(k => k.startsWith('ava-') && !seen.has(k)).sort();
  if (others.length) {
    const bag: Record<string, unknown> = {};
    let bytes = 0;
    for (const k of others) {
      const v = localStorage.getItem(k) ?? '';
      bytes += v.length;
      // Never surface secrets in the inspector.
      bag[k] = /key|token|secret/i.test(k) ? '••••••••' : v.slice(0, 200);
    }
    out.push({ id: 'other', label: 'Other (prefs, device, keys)', count: others.length, bytes, raw: truncate(pretty(bag)) });
  }

  return out;
}
