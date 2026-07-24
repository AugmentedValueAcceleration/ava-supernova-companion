// ─── Companion health profile store (local-first + cloud sync) ──────────────
//
// The HealthProfile is a single per-user document — body stats, goals,
// schedule. Local-first (localStorage), with optional cloud sync through
// /api/health/profile/sync (last-write-wins by updated_at), gated by DataMode.

import { profileApi } from './api';
import { healthSyncEnabled } from './data-mode';
import type { HealthProfile } from './health-types';
import { normaliseHealthProfile } from './health-types';

const KEY = 'ava-companion-health-profile';
export const PROFILE_CHANGED_EVENT = 'ava-health-profile-changed';

export function loadProfile(): HealthProfile | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    // Normalise rather than cast: profiles predate the training/kitchen
    // branches, and core/extension/IDE still write without them.
    return normaliseHealthProfile(JSON.parse(raw));
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
  let winner = remoteTime > localTime ? remote : local;
  if (!winner) return null;

  // Newest-wins on content, but a cloud profile written by core, the extension
  // or the IDE has no training/kitchen branches yet — none of those surfaces
  // know about them until they are mirrored. Letting a newer save from one of
  // those overwrite would silently drop the user's experience level, training
  // days and kitchen setup, and they would have no idea why their plans got
  // worse. Keep the local branches when the remote has nothing to say.
  let merged = false;
  if (winner === remote && local) {
    const salvaged = {
      ...remote!,
      training: remote!.training ?? local.training,
      kitchen: remote!.kitchen ?? local.kitchen,
      weight_history: remote!.weight_history ?? local.weight_history,
    };
    merged = JSON.stringify(salvaged) !== JSON.stringify(remote);
    winner = salvaged;
  }

  // Mirror the winner locally if the cloud was ahead.
  if (winner !== local) writeRaw(winner);

  // Push up when local was ahead (or to seed an empty cloud) — and also when we
  // just salvaged branches the cloud was missing, otherwise the cloud copy stays
  // stale and the next device to sync loses them all over again.
  if (winner === local || merged) {
    try { await profileApi.sync(token, winner); } catch { /* retry next sync */ }
  }
  return winner;
}
