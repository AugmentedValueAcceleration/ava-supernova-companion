// ─── Today, derived from the active plan ────────────────────────────────────
//
// Today and Plans were two systems that never spoke. TodayView never imported
// the plan store, so a user could generate a twelve-week plan and the screen
// they open every morning had no idea it existed — they built a programme in
// one place and logged their day in another.
//
// This joins them, and does it at READ time rather than copying plan days into
// the day store. A copy would go stale the moment the plan was edited, and
// there would be two answers to "what am I doing today". So:
//
//   • the PLAN stays the single source of what was prescribed
//   • the LOGS stay the single source of what actually happened
//   • this module joins the two for display, owning neither
//
// Status is therefore never stored twice. A planned meal is eaten because a
// log entry points at it (`planned_meal_id`); a session is done because a
// GymSession for that plan-day says so. Nothing to keep in step.

import type {
  HealthPlan, HealthPlanDay, HealthPlanExercise, HealthPlanMeal, HealthDailyMeal,
  HealthPlanDayProgress,
} from './health-types';
import type { GymSession, GymSessionStatus } from './gym-types';
import { getAllPlans, getPlan, writePlanRaw } from './health-plan-store';
import { loadDay } from './health-day-store';
import { listSessionsForDate } from './gym-session-store';

/** Whole days between two YYYY-MM-DD dates.
 *
 *  Parsed as UTC midnight on both sides deliberately. The existing day-index
 *  maths elsewhere parses local midnight and divides by 86,400,000, which
 *  drifts by an hour across a DST boundary and can land a long plan on the
 *  wrong day. Anchoring both ends to UTC makes the subtraction exact. */
function dayDiff(fromIso: string, toIso: string): number {
  const day = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
  return day(toIso) - day(fromIso);
}

/** 1-based day index of `date` within an active plan, or null if the plan
 *  hasn't started, has finished, or was never placed on a date. */
export function planDayIndexFor(plan: HealthPlan, date: string): number | null {
  if (plan.status !== 'active' || !plan.start_date) return null;
  const idx = dayDiff(plan.start_date, date) + 1;
  return idx >= 1 && idx <= plan.duration_days ? idx : null;
}

export interface TodaySession {
  plan_id: string;
  plan_title: string;
  day_index: number;
  kind: HealthPlanDay['kind'];
  title: string | null;
  exercises: HealthPlanExercise[];
  notes: string | null;
  /** The session actually run for this plan-day, if the user has started one. */
  session: GymSession | null;
  status: GymSessionStatus;
}

export interface TodayMeal {
  plan_id: string;
  day_index: number;
  planned: HealthPlanMeal;
  /** The log entry fulfilling this planned meal, if any. */
  logged: HealthDailyMeal | null;
  status: 'pending' | 'eaten' | 'swapped' | 'skipped';
}

export interface TodayDerived {
  /** True when at least one plan is active and covers this date. */
  hasPlan: boolean;
  sessions: TodaySession[];
  meals: TodayMeal[];
  /** Meals logged today that no planned meal claims — ad-hoc eating. */
  extraMeals: HealthDailyMeal[];
}

/**
 * What the active plans call for on `date`, joined to what actually happened.
 *
 * Reads every ACTIVE plan rather than assuming one: the store's rule is
 * one-active-per-TYPE, so a user can legitimately be running a fitness plan and
 * a meal plan at once. Training and meals are gathered from whichever plans
 * carry them, which also means a `combined` plan and a separate meal plan
 * coexist without either being silently dropped.
 */
export function deriveToday(date: string): TodayDerived {
  const day = loadDay(date);
  const gymSessions = listSessionsForDate(date);
  const sessions: TodaySession[] = [];
  const meals: TodayMeal[] = [];

  for (const plan of getAllPlans()) {
    const dayIndex = planDayIndexFor(plan, date);
    if (dayIndex == null) continue;
    const planDay = plan.days.find((d) => d.day_index === dayIndex);
    if (!planDay) continue;

    // Training — a rest day still surfaces, so the plan can say "rest" out loud
    // rather than the day just looking empty.
    if (planDay.training.length > 0 || planDay.kind !== 'training') {
      const session = gymSessions.find(
        (s) => s.plan_id === plan.id && s.day_index === dayIndex,
      ) ?? null;
      sessions.push({
        plan_id: plan.id,
        plan_title: plan.title,
        day_index: dayIndex,
        kind: planDay.kind,
        title: planDay.title,
        exercises: planDay.training,
        notes: planDay.notes,
        session,
        status: session?.status ?? 'pending',
      });
    }

    for (const planned of planDay.meals) {
      const logged = day.log.meals.find((m) => m.planned_meal_id === planned.id) ?? null;
      meals.push({
        plan_id: plan.id,
        day_index: dayIndex,
        planned,
        logged,
        status: logged ? (logged.status ?? 'eaten') : 'pending',
      });
    }
  }

  const claimed = new Set(meals.map((m) => m.logged?.id).filter(Boolean));
  return {
    hasPlan: sessions.length > 0 || meals.length > 0,
    sessions,
    meals,
    extraMeals: day.log.meals.filter((m) => !claimed.has(m.id)),
  };
}

/**
 * Write the day's roll-up back onto its plan(s).
 *
 * RECOMPUTED from the logs every time rather than patched incrementally. An
 * incremental "mark it done" would drift the moment anything was undone — a
 * meal deleted, a session cleared — and a stale roll-up is worse than none,
 * because adherence would quietly overstate. Recomputing is idempotent: call it
 * as often as you like and it converges on what the logs actually say.
 *
 * Call after anything that changes what happened on `date`.
 *
 * A rest day counts as done. There is nothing to fail at, and treating it as
 * outstanding would score a perfectly followed week with four rest days at
 * roughly 43% adherence — punishing someone for resting exactly as instructed.
 */
export function refreshPlanCompletion(date: string): void {
  const derived = deriveToday(date);
  if (!derived.hasPlan) return;

  const byPlan = new Map<string, { dayIndex: number; training: HealthPlanDayProgress; nutrition: HealthPlanDayProgress }>();

  for (const s of derived.sessions) {
    const training: HealthPlanDayProgress =
      s.kind !== 'training' || s.exercises.length === 0 ? 'done'
      : s.status === 'completed' ? 'done'
      : s.status === 'in-progress' ? 'partial'
      : s.status === 'skipped' ? 'skipped'
      : 'pending';
    byPlan.set(s.plan_id, { dayIndex: s.day_index, training, nutrition: 'done' });
  }

  // Nutrition is judged per plan, because a combined plan and a meal plan can
  // each own part of the day.
  const mealsByPlan = new Map<string, TodayMeal[]>();
  for (const m of derived.meals) {
    mealsByPlan.set(m.plan_id, [...(mealsByPlan.get(m.plan_id) ?? []), m]);
  }
  for (const [planId, meals] of mealsByPlan) {
    const settled = meals.filter((m) => m.status !== 'pending');
    const nutrition: HealthPlanDayProgress =
      settled.length === 0 ? 'pending'
      : meals.every((m) => m.status === 'skipped') ? 'skipped'
      : settled.length === meals.length ? 'done'
      : 'partial';
    const existing = byPlan.get(planId);
    byPlan.set(planId, {
      dayIndex: meals[0].day_index,
      training: existing?.training ?? 'done', // meal-only plan: nothing to train
      nutrition,
    });
  }

  for (const [planId, next] of byPlan) {
    const plan = getPlan(planId);
    if (!plan) continue;
    const day = plan.days.find((d) => d.day_index === next.dayIndex);
    if (!day) continue;
    const prev = day.completion;
    const bothDone = next.training === 'done' && next.nutrition === 'done';
    const completed_at = bothDone ? (prev?.completed_at ?? new Date().toISOString()) : null;
    if (prev?.training === next.training && prev?.nutrition === next.nutrition && prev?.completed_at === completed_at) {
      continue; // nothing changed — don't churn updated_at or fire listeners
    }
    writePlanRaw({
      ...plan,
      days: plan.days.map((d) =>
        d.day_index === next.dayIndex
          ? { ...d, completion: { training: next.training, nutrition: next.nutrition, completed_at } }
          : d,
      ),
    });
  }
}

/** Macro totals for the day: what the plan asks for, and what was actually
 *  eaten. Ad-hoc meals count towards actual — they were still food. */
export function todayMacros(derived: TodayDerived): {
  planned: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  actual: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
} {
  const zero = () => ({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  const planned = zero();
  const actual = zero();
  for (const m of derived.meals) {
    planned.calories += m.planned.calories ?? 0;
    planned.protein_g += m.planned.protein_g ?? 0;
    planned.carbs_g += m.planned.carbs_g ?? 0;
    planned.fat_g += m.planned.fat_g ?? 0;
    if (m.logged && m.status !== 'skipped') {
      actual.calories += m.logged.calories ?? 0;
      actual.protein_g += m.logged.protein_g ?? 0;
      actual.carbs_g += m.logged.carbs_g ?? 0;
      actual.fat_g += m.logged.fat_g ?? 0;
    }
  }
  for (const m of derived.extraMeals) {
    actual.calories += m.calories ?? 0;
    actual.protein_g += m.protein_g ?? 0;
    actual.carbs_g += m.carbs_g ?? 0;
    actual.fat_g += m.fat_g ?? 0;
  }
  return { planned, actual };
}
