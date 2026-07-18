// ─── Companion local HealthPlan store (localStorage) ────────────────────────
//
// The companion's source of truth for plans, mirroring the extension's
// globalState store (ExtensionHealthPlanStore) and the IDE's Tauri-fs store.
// Plans are addressed per-id under the `ava-companion-plan-${id}` key; the
// library is the scan of all such keys. Cloud sync layers on top via
// health-plan-sync.ts — this module stays purely local.
//
// `save` enforces the same one-active-plan-PER-TYPE rule the extension uses:
// activating a plan archives any other active plan of the same type.

import type { HealthPlan, HealthPlanSummary, HealthPlanType, HealthPlanDay } from './health-types';
import { planToSummary } from './health-types';

const PREFIX = 'ava-companion-plan-';
const planKey = (id: string): string => `${PREFIX}${id}`;

function hasStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

export function newPlanId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `hp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Every plan id currently in local storage. */
function planIds(): string[] {
  if (!hasStorage()) return [];
  const ids: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) ids.push(k.slice(PREFIX.length));
  }
  return ids;
}

export function getPlan(id: string): HealthPlan | null {
  if (!hasStorage()) return null;
  const raw = localStorage.getItem(planKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as HealthPlan;
  } catch {
    return null;
  }
}

export function getAllPlans(): HealthPlan[] {
  return planIds()
    .map(getPlan)
    .filter((p): p is HealthPlan => p !== null)
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
}

/** Library summaries, most-recently-updated first. */
export function listPlans(): HealthPlanSummary[] {
  return getAllPlans().map(planToSummary);
}

/** Compact plan context sent up to Ava each turn so she can *see* the user's
 *  plans — reference the active one, know what today calls for. Active plans
 *  resolve "today" from start_date + day_index; drafts are listed by title. */
export function readPlansForContext(): Array<{
  type: HealthPlanType;
  title: string;
  status: string;
  duration_days: number;
  start_date: string | null;
  today: { day_index: number; kind: string; title: string | null; training: number; meals: number; notes: string | null } | null;
}> {
  const out: ReturnType<typeof readPlansForContext> = [];
  for (const plan of getAllPlans()) {
    if (plan.status !== 'active' && plan.status !== 'draft') continue;
    let today = null as (typeof out)[number]['today'];
    if (plan.status === 'active' && plan.start_date) {
      const start = new Date(`${plan.start_date}T00:00:00`).getTime();
      const dayIndex = Math.floor((Date.now() - start) / 86_400_000) + 1;
      if (dayIndex >= 1 && dayIndex <= plan.duration_days) {
        const d = plan.days.find(x => x.day_index === dayIndex);
        if (d) today = { day_index: dayIndex, kind: d.kind, title: d.title, training: d.training.length, meals: d.meals.length, notes: d.notes };
      }
    }
    out.push({ type: plan.type, title: plan.title, status: plan.status, duration_days: plan.duration_days, start_date: plan.start_date, today });
  }
  return out;
}

/** Write a plan straight to storage with no side effects — used by the
 *  sync merge so a pulled plan doesn't re-trigger the archive rule. */
export function writePlanRaw(plan: HealthPlan): void {
  if (!hasStorage()) return;
  localStorage.setItem(planKey(plan.id), JSON.stringify(plan));
}

/** A blank plan skeleton — rest days for 1..duration, ready for the builder. */
export function blankPlan(type: HealthPlanType, durationDays: number, title: string): HealthPlan {
  const days: HealthPlanDay[] = [];
  for (let i = 1; i <= durationDays; i++) {
    days.push({ day_index: i, kind: 'rest', title: null, training: [], meals: [], notes: null });
  }
  return {
    schema_version: 1,
    id: newPlanId(),
    type,
    title,
    goal: null,
    source: 'manual',
    status: 'draft',
    duration_days: durationDays,
    start_date: null,
    profile_snapshot: null,
    days,
    created_at: null,
    updated_at: null,
  };
}

/** Create or update a plan from the manual UI path. Stamps updated_at,
 *  applies the one-active-per-type archive rule, sets start_date on
 *  activation, and notifies listeners. */
export function savePlan(plan: HealthPlan): HealthPlan {
  if (!hasStorage()) return plan;
  const now = new Date().toISOString();
  const next: HealthPlan = { ...plan, updated_at: now, created_at: plan.created_at ?? now };

  // Activating with no start date begins the plan today.
  if (next.status === 'active' && !next.start_date) {
    next.start_date = now.slice(0, 10);
  }

  if (next.status === 'active') {
    for (const other of getAllPlans()) {
      if (other.id !== next.id && other.type === next.type && other.status === 'active') {
        writePlanRaw({ ...other, status: 'archived', updated_at: now });
      }
    }
  }

  writePlanRaw(next);
  notifyChanged();
  return next;
}

export function removePlan(id: string): void {
  if (!hasStorage()) return;
  localStorage.removeItem(planKey(id));
  notifyChanged();
}

// Let UI react to plan changes without prop-drilling (same pattern as the
// app's `ava-settings-changed` / `ava-data-mode-changed` events).
export const PLANS_CHANGED_EVENT = 'ava-health-plans-changed';
function notifyChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PLANS_CHANGED_EVENT));
  }
}
