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
