// ─── Companion daily-plan store (Today) ─────────────────────────────────────
//
// One HealthDailyPlan per date, keyed `ava-companion-day-{YYYY-MM-DD}` in
// localStorage. Device-local for now — daily logs are personal and there's no
// daily-plan sync endpoint yet (plans + profile sync; the day log stays local).

import type { HealthDailyPlan } from './health-types';

const keyFor = (date: string) => `ava-companion-day-${date}`;

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function freshDailyPlan(date: string): HealthDailyPlan {
  return {
    schema_version: 1,
    date,
    morning_brief: null,
    brief_reasoning: null,
    items: [],
    log: { meals: [], water_ml: 0, sleep_hours: null, mood: null },
    updated_at: null,
  };
}

export function loadDay(date: string): HealthDailyPlan {
  if (typeof localStorage === 'undefined') return freshDailyPlan(date);
  const raw = localStorage.getItem(keyFor(date));
  if (!raw) return freshDailyPlan(date);
  try {
    return JSON.parse(raw) as HealthDailyPlan;
  } catch {
    return freshDailyPlan(date);
  }
}

export function saveDay(plan: HealthDailyPlan): HealthDailyPlan {
  const next = { ...plan, updated_at: new Date().toISOString() };
  if (typeof localStorage !== 'undefined') localStorage.setItem(keyFor(plan.date), JSON.stringify(next));
  return next;
}

export function logId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
