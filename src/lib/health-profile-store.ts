// ─── Companion health profile store (local-first + cloud sync) ──────────────
//
// The HealthProfile is a single per-user document — body stats, goals,
// schedule. Local-first (localStorage), with optional cloud sync through
// /api/health/profile/sync (last-write-wins by updated_at), gated by DataMode.

import { profileApi } from './api';
import { healthSyncEnabled } from './data-mode';
import type { HealthProfile } from './health-types';

const KEY = 'ava-companion-health-profile';
export const PROFILE_CHANGED_EVENT = 'ava-health-profile-changed';

export function loadProfile(): HealthProfile | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as HealthProfile;
  } catch {
    return null;
  }
}

/** Write the profile locally with a fresh updated_at and notify listeners. */
export function saveProfile(profile: HealthProfile): HealthProfile {
  const next = { ...profile, updated_at: new Date().toISOString() };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(KEY, JSON.stringify(next));
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PROFILE_CHANGED_EVENT));
  }
  return next;
}

function writeRaw(profile: HealthProfile): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(profile));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PROFILE_CHANGED_EVENT));
}

/**
 * Reconcile local ↔ cloud (newest wins by updated_at), then push the winner
 * up so both ends match. No-ops in local mode / for guests. Returns the
 * effective profile (or null if neither side has one).
 */
export async function syncProfile(token?: string | null): Promise<HealthProfile | null> {
  const local = loadProfile();
  if (!token || !healthSyncEnabled()) return local;

  let remote: HealthProfile | null;
  try {
    const res = await profileApi.get(token);
    remote = (res?.profile as HealthProfile | null) ?? null;
  } catch {
    return local; // offline — keep local
  }

  const localTime = local?.updated_at ?? '';
  const remoteTime = remote?.updated_at ?? '';
  const winner = remoteTime > localTime ? remote : local;
  if (!winner) return null;

  // Mirror the winner locally if the cloud was ahead.
  if (winner === remote) writeRaw(remote!);

  // Push the winner up if local was ahead (or to seed an empty cloud).
  if (winner === local) {
    try { await profileApi.sync(token, local); } catch { /* retry next sync */ }
  }
  return winner;
}
