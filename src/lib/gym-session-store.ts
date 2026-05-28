// ─── Gym session local store (Phase 5) ──────────────────────────────────────
//
// Per-session records in localStorage under `ava-companion-gym-session-{id}`.
// Same local-first posture as plans and the daily log — the device owns the
// training data. Cloud sync is opt-in (same `healthSyncEnabled` gate, layered
// on later if/when the user turns it on).

import type { GymSession } from './gym-types';

const PREFIX = 'ava-companion-gym-session-';
export const GYM_SESSIONS_CHANGED_EVENT = 'ava-gym-sessions-changed';

const key = (id: string): string => `${PREFIX}${id}`;

function hasStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function notify(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GYM_SESSIONS_CHANGED_EVENT));
  }
}

export function loadSession(id: string): GymSession | null {
  if (!hasStorage()) return null;
  const raw = localStorage.getItem(key(id));
  if (!raw) return null;
  try { return JSON.parse(raw) as GymSession; } catch { return null; }
}

/** Save (create or update) a session — stamps updated_at, notifies listeners. */
export function saveSession(session: GymSession): GymSession {
  const next = { ...session, updated_at: new Date().toISOString() };
  if (hasStorage()) {
    localStorage.setItem(key(next.id), JSON.stringify(next));
  }
  notify();
  return next;
}

export function deleteSession(id: string): void {
  if (!hasStorage()) return;
  localStorage.removeItem(key(id));
  notify();
}

/** Every session id currently in local storage. */
function sessionIds(): string[] {
  if (!hasStorage()) return [];
  const ids: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) ids.push(k.slice(PREFIX.length));
  }
  return ids;
}

/** All sessions, most-recently-updated first. Drives the progress dashboard. */
export function listSessions(): GymSession[] {
  return sessionIds()
    .map(loadSession)
    .filter((s): s is GymSession => s !== null)
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
}

/** Sessions for a specific date (YYYY-MM-DD), newest first. */
export function listSessionsForDate(date: string): GymSession[] {
  return listSessions().filter(s => s.date === date);
}

/** The session currently in flight for a date, if any. */
export function activeSessionForDate(date: string): GymSession | null {
  return listSessionsForDate(date).find(s => s.status === 'in-progress' || s.status === 'pending') ?? null;
}
