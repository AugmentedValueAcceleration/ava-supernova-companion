// ─── Progress ───────────────────────────────────────────────────────────────
//
// Everything here is computed from data the app has been recording all along
// and never showing. GymSession has stored every set performed against what was
// prescribed, tagged with plan_id and ref.slug, since the Gym shipped — and
// until now the only thing that ever read it was the Gym itself.
//
// So this module adds no capture. It reads:
//
//   • plan day roll-ups  → adherence, plan position
//   • gym sessions       → streak, per-exercise progression
//   • daily logs         → intake against what the plan asked for
//   • profile            → weight trend
//
// Deliberately honest about absence. A figure with no data behind it comes back
// null rather than zero, because "0% adherence" and "we have not seen you train
// yet" are very different messages to show someone.

import type { HealthPlan, WeightEntry } from './health-types';
import { getAllPlans } from './health-plan-store';
import { loadDay } from './health-day-store';
import { listSessions } from './gym-session-store';
import { loadProfile } from './health-profile-store';
import { planDayIndexFor, deriveToday, todayMacros } from './health-today';

/** YYYY-MM-DD `n` days before `date` (inclusive window helper). */
function shiftDays(date: string, n: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`) + n * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export interface PlanProgress {
  id: string;
  title: string;
  type: HealthPlan['type'];
  day_index: number;
  duration_days: number;
  /** Days settled (training and nutrition both accounted for) ÷ days elapsed. */
  adherence_pct: number | null;
}

export interface ExerciseProgress {
  key: string;
  name: string;
  slug: string | null;
  points: Array<{ date: string; top_weight: number | null; top_reps: number | null; volume: number }>;
}

export interface DayIntake {
  date: string;
  planned_calories: number | null;
  actual_calories: number | null;
  actual_protein_g: number | null;
}

export interface Progress {
  plans: PlanProgress[];
  training: {
    sessions_completed: number;
    /** Consecutive days up to today where the plan was honoured — a rest day
     *  counts, because resting as instructed is following the plan. */
    streak: number;
    /** Null when nothing has been logged: no data is not the same as zero. */
    adherence_pct: number | null;
  };
  intake: DayIntake[];
  exercises: ExerciseProgress[];
  weight: WeightEntry[];
  has_any_data: boolean;
}

export function computeProgress(today: string, windowDays = 30): Progress {
  const plans = getAllPlans();
  const sessions = listSessions();
  const profile = loadProfile();

  // ── Plans: position and adherence from the day roll-ups ───────────────────
  const planProgress: PlanProgress[] = [];
  for (const plan of plans) {
    const dayIndex = planDayIndexFor(plan, today);
    if (dayIndex == null) continue;
    // Judge only days that have FINISHED. Today is still in progress — counting
    // it as a miss would score someone at 0% every morning before they had a
    // chance to do anything, and it would contradict the streak below, which
    // deliberately does not break on an unfinished day.
    const elapsed = plan.days.filter(d => d.day_index < dayIndex);
    const settled = elapsed.filter(d => {
      const c = d.completion;
      return c && c.training !== 'pending' && c.nutrition !== 'pending';
    });
    planProgress.push({
      id: plan.id,
      title: plan.title,
      type: plan.type,
      day_index: dayIndex,
      duration_days: plan.duration_days,
      adherence_pct: elapsed.length > 0 ? Math.round((settled.length / elapsed.length) * 100) : null,
    });
  }

  // ── Streak: walk back from today ──────────────────────────────────────────
  // A day counts if a session was completed OR the plan called for rest. Days
  // with no plan and no session end the streak — we can't credit a day we have
  // no evidence for.
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const date = shiftDays(today, -i);
    const trained = sessions.some(s => s.date === date && s.status === 'completed');
    let restDay = false;
    for (const plan of plans) {
      const idx = planDayIndexFor(plan, date);
      const day = idx != null ? plan.days.find(d => d.day_index === idx) : null;
      if (day && day.kind !== 'training') restDay = true;
    }
    if (trained || restDay) streak++;
    else if (i === 0) continue; // today isn't over yet — don't break the streak on it
    else break;
  }

  // ── Intake: planned against actual, per day in the window ─────────────────
  const intake: DayIntake[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const date = shiftDays(today, -i);
    const day = loadDay(date);
    if (day.log.meals.length === 0) continue;
    const derived = deriveToday(date);
    const macros = todayMacros(derived);
    intake.push({
      date,
      planned_calories: macros.planned.calories > 0 ? macros.planned.calories : null,
      actual_calories: macros.actual.calories > 0 ? macros.actual.calories : null,
      actual_protein_g: macros.actual.protein_g > 0 ? macros.actual.protein_g : null,
    });
  }

  // ── Per-exercise progression ──────────────────────────────────────────────
  // Grouped by slug so the same movement tracks across sessions and plans;
  // falls back to a normalised name for freestyle entries with no library link.
  const byExercise = new Map<string, ExerciseProgress>();
  const cutoff = shiftDays(today, -windowDays);
  for (const session of sessions) {
    if (session.date < cutoff || session.status !== 'completed') continue;
    for (const ex of session.exercises) {
      const slug = ex.ref?.slug ?? null;
      const key = slug ?? ex.name.trim().toLowerCase();
      if (!key) continue;
      const done = ex.sets.filter(s => s.reps != null);
      if (done.length === 0) continue;
      const entry = byExercise.get(key) ?? { key, name: ex.name, slug, points: [] };
      entry.points.push({
        date: session.date,
        top_weight: done.reduce<number | null>((m, s) => (s.weight != null && (m == null || s.weight > m) ? s.weight : m), null),
        top_reps: done.reduce<number | null>((m, s) => (s.reps != null && (m == null || s.reps > m) ? s.reps : m), null),
        volume: done.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0),
      });
      byExercise.set(key, entry);
    }
  }
  const exercises = [...byExercise.values()]
    .map(e => ({ ...e, points: e.points.sort((a, b) => a.date.localeCompare(b.date)) }))
    // Two points is the minimum that can show a direction; one is just a fact.
    .filter(e => e.points.length >= 2)
    .sort((a, b) => b.points.length - a.points.length);

  const completed = sessions.filter(s => s.status === 'completed' && s.date >= cutoff).length;

  return {
    plans: planProgress,
    training: {
      sessions_completed: completed,
      streak,
      adherence_pct: planProgress.length > 0
        ? Math.round(planProgress.reduce((n, p) => n + (p.adherence_pct ?? 0), 0) / planProgress.length)
        : null,
    },
    intake,
    exercises,
    weight: profile?.weight_history ?? [],
    has_any_data: completed > 0 || intake.length > 0 || planProgress.length > 0 || (profile?.weight_history?.length ?? 0) > 0,
  };
}
