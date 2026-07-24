// ─── Companion daily-plan store (Today) ─────────────────────────────────────
//
// One HealthDailyPlan per date, keyed `ava-companion-day-{YYYY-MM-DD}` in
// localStorage. Device-local for now — daily logs are personal and there's no
// daily-plan sync endpoint yet (plans + profile sync; the day log stays local).

import type { HealthDailyPlan, HealthDailyMeal } from './health-types';

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

/**
 * Bring a stored meal up to the current shape.
 *
 * Logs written before the meal log gained a recipe link, carbs/fat, a planned
 * link and a status are still sitting in localStorage on every existing user's
 * device. A blind `as HealthDailyPlan` cast let those flow into code that
 * expects the new fields — the same two-shapes trap that took the platform
 * build down over exercise `steps`. Normalise here, at the one boundary
 * everything loads through, so no caller has to care when its data was written.
 *
 * A meal that predates `status` was, by definition, one the user logged as
 * having eaten — 'eaten' is the honest default, not a guess.
 */
function normaliseMeal(raw: unknown): HealthDailyMeal {
  const m = (raw ?? {}) as Partial<HealthDailyMeal> & Record<string, unknown>;
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    id: typeof m.id === 'string' ? m.id : logId(),
    time: typeof m.time === 'string' ? m.time : '',
    description: typeof m.description === 'string' ? m.description : null,
    calories: num(m.calories),
    protein_g: num(m.protein_g),
    carbs_g: num(m.carbs_g),
    fat_g: num(m.fat_g),
    ref: m.ref && typeof m.ref === 'object' && 'slug' in m.ref ? m.ref : null,
    planned_meal_id: typeof m.planned_meal_id === 'string' ? m.planned_meal_id : null,
    status: m.status === 'swapped' || m.status === 'skipped' ? m.status : 'eaten',
    servings: num(m.servings),
  };
}

export function loadDay(date: string): HealthDailyPlan {
  if (typeof localStorage === 'undefined') return freshDailyPlan(date);
  const raw = localStorage.getItem(keyFor(date));
  if (!raw) return freshDailyPlan(date);
  try {
    const parsed = JSON.parse(raw) as HealthDailyPlan;
    const fresh = freshDailyPlan(date);
    // Merge over a fresh plan so a log missing whole branches (an early
    // schema, or a partial write) still returns something complete.
    return {
      ...fresh,
      ...parsed,
      log: {
        ...fresh.log,
        ...(parsed.log ?? {}),
        meals: Array.isArray(parsed.log?.meals) ? parsed.log.meals.map(normaliseMeal) : [],
      },
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
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
