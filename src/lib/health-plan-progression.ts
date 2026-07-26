// ─── Repeat, but progressed ─────────────────────────────────────────────────
//
// Short plans are the right unit — people finish a week, and a finished week
// builds the log. The objection is that training needs time: progressive
// overload does not happen inside seven days, and a fitness plan that cannot
// progress you is not a programme.
//
// This is the answer to that. Repeating a plan no longer re-runs it
// identically; it advances it using what the log actually shows. A little more
// weight where the sets were completed comfortably, held where they were not,
// and flagged for swapping where something was repeatedly skipped.
//
// Which makes a short plan BETTER than a long block rather than a compromise:
// week five is written knowing weeks one to four, and a twelve-week programme
// generated on day one can never be. Eleven of its weeks were written before
// anyone knew a single thing about how the person responded.
//
// Everything here reads the log and proposes. It writes nothing, and it never
// progresses on absence — a session nobody recorded is not evidence of success.

import type {
  HealthPlan, HealthPlanExercise, PlanExerciseMeta,
} from './health-types';
import type { GymSession, GymExercise } from './gym-types';

// ── Reading what happened ───────────────────────────────────────────────────

export interface ExercisePerformance {
  key: string;                 // slug when there is one, else normalised name
  name: string;
  /** Sessions in which this exercise appeared and the person logged something. */
  performed: number;
  /** Plan days that called for it where nothing was logged at all. */
  skipped: number;
  /**
   * Sets completed, and how many were asked for IN THE SESSIONS THAT HAPPENED.
   *
   * Deliberately not "sets the plan asked for across the whole plan": an
   * exercise on three plan days targets nine sets, and someone who trained once
   * and completed all three would look like they failed two thirds of it. The
   * comparison has to be against what was actually put in front of them.
   */
  setsCompleted: number;
  setsExpected: number;
  /** Heaviest logged weight, in kg. Null when the work was not loaded. */
  topWeight: number | null;
  /** Reps at that top weight — the honest measure for loaded work, since 20
   *  reps at 40kg says nothing about whether 60kg got easier. */
  repsAtTop: number | null;
  /** Best reps in any set, regardless of load. This is what judges unloaded
   *  work, where there is no weight to attach reps to. */
  bestReps: number | null;
  /** Highest RPE the person recorded. 9-10 means it was already hard. */
  topRpe: number | null;
  /** True when every targeted set was completed in every session performed. */
  completedEverySet: boolean;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const keyOf = (x: { ref?: { slug: string } | null; name: string }) =>
  x.ref?.slug ? `slug:${x.ref.slug}` : `name:${norm(x.name)}`;

/** The top of a rep prescription — "8-12" → 12, "10" → 10, "AMRAP" → null. */
export function topOfRange(reps: string | null): number | null {
  if (!reps) return null;
  const range = reps.trim().match(/^(\d+)\s*[-–—]\s*(\d+)$/);
  if (range) return Number(range[2]);
  if (/^\d+$/.test(reps.trim())) return Number(reps.trim());
  return null;
}

/** A weight prescription as a number of kg, or null when it isn't one
 *  ("bodyweight", "red band", "RPE 7"). */
export function weightKg(weight: string | null): number | null {
  if (!weight) return null;
  const m = weight.trim().match(/^(\d+(?:\.\d+)?)\s*(kg|kgs|kilo|kilos)?$/i);
  if (m) return Number(m[1]);
  const lb = weight.trim().match(/^(\d+(?:\.\d+)?)\s*(lb|lbs|pound|pounds)$/i);
  if (lb) return Math.round(Number(lb[1]) * 0.45359237 * 10) / 10;
  return null;
}

/**
 * What the log says about every exercise in this plan.
 *
 * Only sessions belonging to THIS plan count. A freestyle session where
 * somebody happened to bench press is not evidence about their programme —
 * it might have been a deload, a test, or someone else's gym.
 */
export function readPerformance(plan: HealthPlan, sessions: GymSession[]): Map<string, ExercisePerformance> {
  const mine = sessions.filter(s => s.plan_id === plan.id);
  const out = new Map<string, ExercisePerformance>();

  const ensure = (k: string, name: string): ExercisePerformance => {
    if (!out.has(k)) {
      out.set(k, {
        key: k, name, performed: 0, skipped: 0, setsCompleted: 0, setsExpected: 0,
        topWeight: null, repsAtTop: null, bestReps: null, topRpe: null, completedEverySet: true,
      });
    }
    return out.get(k)!;
  };

  // Register every exercise the plan names, so one that was never trained still
  // gets a row and is reported as "no evidence" rather than silently missing.
  for (const day of plan.days) {
    for (const ex of day.training) ensure(keyOf(ex), ex.name);
  }

  // What was actually done.
  const seenInSession = new Map<string, Set<string>>();
  for (const s of mine) {
    for (const ex of s.exercises as GymExercise[]) {
      const k = keyOf(ex);
      const p = ensure(k, ex.name);
      const logged = (ex.sets ?? []).filter(set => set.reps != null || set.weight != null);
      if (logged.length === 0) continue;

      if (!seenInSession.has(s.id)) seenInSession.set(s.id, new Set());
      if (!seenInSession.get(s.id)!.has(k)) { p.performed += 1; seenInSession.get(s.id)!.add(k); }

      p.setsCompleted += logged.length;
      // Expectation counted from THIS session's target, so the comparison is
      // against what was actually asked of them on the days they trained.
      p.setsExpected += ex.target_sets ?? logged.length;
      if ((ex.target_sets ?? 0) > logged.length) p.completedEverySet = false;

      for (const set of logged) {
        if (set.weight != null && (p.topWeight == null || set.weight > p.topWeight)) {
          p.topWeight = set.weight;
          p.repsAtTop = set.reps ?? null;
        }
        if (set.reps != null && (p.bestReps == null || set.reps > p.bestReps)) p.bestReps = set.reps;
        if (set.rpe != null && (p.topRpe == null || set.rpe > p.topRpe)) p.topRpe = set.rpe;
      }
    }
  }

  // A plan day that called for it, on a day with a session that recorded
  // nothing for it, is a skip. Days with no session at all are not counted as
  // skips here — that is a missed session, which is a different conversation.
  for (const s of mine) {
    const loggedKeys = new Set(
      (s.exercises as GymExercise[])
        .filter(e => (e.sets ?? []).some(x => x.reps != null || x.weight != null))
        .map(e => keyOf(e)),
    );
    for (const e of s.exercises as GymExercise[]) {
      const k = keyOf(e);
      if (!loggedKeys.has(k)) ensure(k, e.name).skipped += 1;
    }
  }

  return out;
}

// ── Deciding what to do about it ────────────────────────────────────────────

export type ProgressionAction = 'progress_load' | 'progress_reps' | 'hold' | 'suggest_swap' | 'no_evidence';

export interface ProgressionChange {
  key: string;
  name: string;
  action: ProgressionAction;
  /** Plain sentence for the UI — this is a proposal, so it must be arguable. */
  reason: string;
  from: { sets: number | null; reps: string | null; weight: string | null };
  to: { sets: number | null; reps: string | null; weight: string | null };
}

/**
 * How much to add.
 *
 * The classic increments, chosen by what the movement is rather than a flat
 * percentage: the lower body tolerates a bigger jump than a lateral raise. The
 * pattern is on the plan row already, captured when the exercise was added.
 */
const LOWER = new Set(['squat', 'hinge', 'lunge']);
export function loadStepKg(meta: PlanExerciseMeta | null | undefined): number {
  const pattern = meta?.movement_pattern ?? '';
  if (LOWER.has(pattern)) return 5;
  if (meta?.exercise_type === 'isolation') return 1.25;
  return 2.5;
}

/**
 * Decide what happens to one exercise next time round.
 *
 * The bar for adding weight is deliberately high — every targeted set
 * completed, the top of the rep range cleared, and no sign it was already
 * maximal. Progressing someone who scraped through is how a programme stalls at
 * best and hurts them at worst. Where the evidence is not there, holding is a
 * real decision and is said out loud rather than passed off as progress.
 */
export function decideFor(
  ex: HealthPlanExercise,
  perf: ExercisePerformance | undefined,
): ProgressionChange {
  const from = { sets: ex.sets, reps: ex.reps, weight: ex.weight };
  const base = { key: keyOf(ex), name: ex.name, from };

  // Checked BEFORE "no evidence", because being skipped repeatedly is not an
  // absence of evidence — it is evidence, and the most actionable kind. An
  // exercise nobody does is worth nothing however well it is programmed.
  if (perf && perf.skipped >= 2 && perf.skipped > perf.performed) {
    return {
      ...base, action: 'suggest_swap', to: from,
      reason: `Skipped ${perf.skipped} times while the rest of the session got done — worth swapping for something you will actually do.`,
    };
  }

  if (!perf || perf.performed === 0) {
    return {
      ...base, action: 'no_evidence', to: from,
      reason: 'Nothing logged for this last time, so it stays as it was.',
    };
  }

  const top = topOfRange(ex.reps);
  // Loaded work is judged on the reps achieved AT the top weight; unloaded work
  // has no weight to attach reps to, so it is judged on the best set. Without
  // this, every bodyweight exercise held forever — there was no rep evidence at
  // all, because reps were only ever recorded next to a weight.
  const repsAchieved = perf.topWeight != null ? perf.repsAtTop : perf.bestReps;
  const clearedRange = top != null && repsAchieved != null && repsAchieved >= top;
  const allSets = perf.completedEverySet && perf.setsExpected > 0 && perf.setsCompleted >= perf.setsExpected;
  const wasMaximal = perf.topRpe != null && perf.topRpe >= 9;

  if (!allSets) {
    return {
      ...base, action: 'hold', to: from,
      reason: `You got ${perf.setsCompleted} of ${perf.setsExpected} sets — same again before adding anything.`,
    };
  }
  if (wasMaximal) {
    return {
      ...base, action: 'hold', to: from,
      reason: `You finished it, but at RPE ${perf.topRpe} — that is already hard enough. Same again.`,
    };
  }
  if (!clearedRange) {
    return {
      ...base, action: 'hold', to: from,
      reason: top != null
        ? `Every set done, but not yet at ${top} reps — hold here until the top of the range is comfortable.`
        : 'Every set done. Holding, because there is no rep target to judge it against.',
    };
  }

  // Earned it. Load if the weight is a number we can add to; otherwise reps,
  // because "bodyweight + 2.5kg" is not a thing.
  const current = weightKg(ex.weight);
  if (current != null) {
    const step = loadStepKg(ex.meta);
    const next = Math.round((current + step) * 100) / 100;
    return {
      ...base, action: 'progress_load',
      to: { sets: ex.sets, reps: ex.reps, weight: `${next}kg` },
      reason: `Every set done and you cleared ${top} reps at ${current}kg — up to ${next}kg.`,
    };
  }

  const nextReps = top != null ? bumpRange(ex.reps, 1) : ex.reps;
  return {
    ...base, action: 'progress_reps',
    to: { sets: ex.sets, reps: nextReps, weight: ex.weight },
    reason: `Every set done at the top of the range — one more rep${ex.weight ? '' : ' (no load to add)'}.`,
  };
}

/** Step a rep prescription up. Mirrors bumpReps in health-plan-swap, kept
 *  separate only because that one is a user-chosen step and this one is
 *  evidence-driven; the arithmetic is the same. */
function bumpRange(reps: string | null, by: number): string | null {
  if (!reps) return reps;
  const s = reps.trim();
  const range = s.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
  if (range) return `${Number(range[1]) + by}-${Number(range[2]) + by}`;
  if (/^\d+$/.test(s)) return String(Number(s) + by);
  return reps;
}

// ── Producing the next round ────────────────────────────────────────────────

export interface ProgressionResult {
  plan: HealthPlan;
  changes: ProgressionChange[];
  /** True when the log had nothing to say about any exercise. */
  noEvidence: boolean;
}

/**
 * Build the next run of a plan from the last one.
 *
 * Returns a NEW plan starting today, with the training advanced where the log
 * earned it. Meals are copied unchanged: eating one more portion each week is
 * not progression, it is just more food.
 *
 * Completion is cleared — this run has not happened yet.
 */
export function progressPlan(
  plan: HealthPlan,
  sessions: GymSession[],
  startDate: string,
): ProgressionResult {
  const perf = readPerformance(plan, sessions);
  const changes: ProgressionChange[] = [];
  const decided = new Map<string, ProgressionChange>();

  // One decision per exercise, not per occurrence — an exercise appearing on
  // three days progresses once and consistently, otherwise day 1 and day 5 of
  // the same movement drift apart.
  for (const day of plan.days) {
    for (const ex of day.training) {
      const k = keyOf(ex);
      if (decided.has(k)) continue;
      const change = decideFor(ex, perf.get(k));
      decided.set(k, change);
      changes.push(change);
    }
  }

  const next: HealthPlan = {
    ...plan,
    status: 'active',
    start_date: startDate,
    days: plan.days.map(day => ({
      ...day,
      completion: null,
      training: day.training.map(ex => {
        const change = decided.get(keyOf(ex));
        if (!change || change.action === 'hold' || change.action === 'no_evidence' || change.action === 'suggest_swap') return ex;
        return { ...ex, sets: change.to.sets, reps: change.to.reps, weight: change.to.weight };
      }),
    })),
  };

  return {
    plan: next,
    changes,
    noEvidence: changes.every(c => c.action === 'no_evidence'),
  };
}

/** One line summarising the round, for the confirmation screen. */
export function summarise(changes: ProgressionChange[]): string {
  const up = changes.filter(c => c.action === 'progress_load' || c.action === 'progress_reps').length;
  const held = changes.filter(c => c.action === 'hold').length;
  const swap = changes.filter(c => c.action === 'suggest_swap').length;
  const bits: string[] = [];
  if (up) bits.push(`${up} moving up`);
  if (held) bits.push(`${held} holding`);
  if (swap) bits.push(`${swap} worth swapping`);
  return bits.join(' · ') || 'Nothing logged last time — repeating as it was.';
}
