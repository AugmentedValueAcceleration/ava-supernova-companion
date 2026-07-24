// ─── Companion health-plan cloud sync ───────────────────────────────────────
//
// Reconciles the local plan store (health-plan-store.ts) with the cloud copy
// behind /api/health/plans/sync. Last-write-wins per plan id, by updated_at.
//
// Gated by Data Mode: 'cloud' / 'both' sync; 'local' stays fully on-device and
// never calls the network. A no-token (guest / BYOK) user is local-only too —
// the cloud endpoint is account-gated.

import { plansApi } from './api';
import { healthSyncEnabled } from './data-mode';
import type { HealthPlan } from './health-types';
import { getAllPlans, writePlanRaw, PLANS_CHANGED_EVENT } from './health-plan-store';

/** True only when the user has a token AND has opted health data into the
 *  cloud. Local by default — see healthSyncEnabled(). */
function shouldSync(token?: string | null): boolean {
  return !!token && healthSyncEnabled();
}

function isNewer(a: HealthPlan, b: HealthPlan): boolean {
  return (a.updated_at ?? '') > (b.updated_at ?? '');
}

/**
 * Full reconcile: pull the cloud set, merge newest-wins into local, then push
 * the merged local set back so the cloud ends up with anything local-only or
 * locally-newer. Safe to call on app focus / Wellbeing open. No-ops in local
 * mode. Returns the number of plans that changed locally.
 */
export async function syncPlans(token?: string | null): Promise<number> {
  if (!shouldSync(token)) return 0;

  // 1. Pull
  let cloud: HealthPlan[];
  try {
    const res = await plansApi.list(token!);
    cloud = Array.isArray(res?.plans) ? (res.plans as HealthPlan[]) : [];
  } catch {
    // Offline / transient — keep working locally, try again next focus.
    return 0;
  }

  // 2. Merge cloud → local (newest wins)
  const localById = new Map(getAllPlans().map((p) => [p.id, p]));
  let changed = 0;
  for (const remote of cloud) {
    if (!remote?.id) continue;
    const local = localById.get(remote.id);
    if (!local || isNewer(remote, local)) {
      // Newest-wins on content, but never let a client that doesn't know about
      // completion tracking erase it. The extension and IDE still write plans
      // without `completion` (mirroring is a later step), and a newer save from
      // one of those would otherwise wipe the local adherence record — a
      // user's training history lost because they opened a different surface.
      // Content follows the newer copy; completion is preserved per-day where
      // the remote has none of its own.
      const merged: HealthPlan = local
        ? {
            ...remote,
            days: remote.days?.map((rd) => {
              const ld = local.days?.find((d) => d.day_index === rd.day_index);
              return rd.completion ? rd : { ...rd, completion: ld?.completion ?? null };
            }) ?? [],
          }
        : remote;
      writePlanRaw(merged);
      localById.set(remote.id, merged);
      changed++;
    }
  }
  if (changed > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PLANS_CHANGED_EVENT));
  }

  // 3. Push merged local set back so the cloud catches local-only/newer plans.
  const merged = Array.from(localById.values());
  if (merged.length > 0) {
    try {
      await plansApi.sync(token!, merged);
    } catch {
      // Push failure is non-fatal — local is intact, retry next focus.
    }
  }

  return changed;
}

/** Propagate a local deletion to the cloud so it doesn't resurrect on the
 *  next pull. Caller removes locally first; this clears the remote copy. */
export async function syncPlanDeletion(token: string | null | undefined, id: string): Promise<void> {
  if (!shouldSync(token)) return;
  try {
    await plansApi.remove(token!, id);
  } catch {
    // Best-effort; a stale remote will be re-deleted on the next attempt.
  }
}
