// ─── Copy, and change your mind ─────────────────────────────────────────────
//
// Copying a week is only half a feature. The useful half is being able to say
// "same again, but not that one — I tried it and I hated it."
//
// So SWAP is not something that lives inside the duplicate flow. It is an
// action on any plan row, anywhere: a plan Ava generated, a week you copied, a
// Thursday you changed your mind about. Duplicate-and-adjust is then just
// copy + swap, one feature instead of two, and it works everywhere.
//
// Three things this owns:
//
//   1. finding honest alternatives  — same job in the session, not just
//                                     "another exercise"
//   2. deciding what carries over   — your numbers mean something on a
//                                     like-for-like swap and nothing on a
//                                     different movement
//   3. applying it to the days you  — one day, some days, or every remaining
//      chose                          occurrence
//
// Pure. The caller supplies the candidate pool it has already loaded, exactly
// like the other services, so the same rules run server-side when Ava proposes
// a swap and client-side when someone picks one by hand.

import type {
  HealthPlan, HealthPlanDay, HealthPlanExercise, HealthPlanMeal,
  HealthProfile, HealthGoal, PlanExerciseMeta, PlanMealMeta,
} from './health-types';
import { checkExercise, checkRecipe } from './health-safety';

// ── 1. Where does this appear? ──────────────────────────────────────────────

export interface Occurrence {
  day_index: number;
  /** The row's id within that day — what applySwap targets. */
  row_id: string;
  /** True once the day has been completed; swapping it rewrites history. */
  done: boolean;
}

/**
 * Every place an exercise or recipe appears in a plan.
 *
 * Matched on the library ref, not the name: a renamed row is still the same
 * movement, and two different movements can share a name across the catalogue.
 * Falls back to the name only when there is no ref, which is the free-text case.
 */
export function occurrencesOf(
  plan: HealthPlan,
  kind: 'exercise' | 'recipe',
  identity: { slug?: string | null; name?: string | null },
): Occurrence[] {
  const slug = identity.slug ?? null;
  const name = (identity.name ?? '').trim().toLowerCase();
  const out: Occurrence[] = [];

  for (const day of plan.days) {
    const rows: Array<HealthPlanExercise | HealthPlanMeal> =
      kind === 'exercise' ? day.training : day.meals;
    for (const row of rows) {
      const matches = slug
        ? row.ref?.slug === slug
        : !!name && row.name.trim().toLowerCase() === name;
      if (!matches) continue;
      out.push({
        day_index: day.day_index,
        row_id: row.id,
        done: day.completion?.training === 'done' || day.completion?.nutrition === 'done',
      });
    }
  }
  return out;
}

/** Occurrences from `fromDay` onward — the sensible default selection, since
 *  changing your mind should not rewrite what you already did. */
export function upcomingOccurrences(all: Occurrence[], fromDay: number): Occurrence[] {
  return all.filter(o => o.day_index >= fromDay && !o.done);
}

// ── 2. What carries over? ───────────────────────────────────────────────────

export type CarryDecision = 'carry' | 'reset' | 'carry_reps_only';

export interface CarryVerdict {
  decision: CarryDecision;
  /** Plain sentence for the UI — the user can override, so they deserve the why. */
  reason: string;
}

/** Rep ranges and rest that suit a goal, when we are starting the numbers over. */
const GOAL_SHAPE: Record<string, { reps: string; rest: number }> = {
  fat_loss:    { reps: '12-15', rest: 45 },
  muscle_gain: { reps: '8-12',  rest: 90 },
  athletic:    { reps: '5-8',   rest: 150 },
  recovery:    { reps: '10-15', rest: 60 },
  longevity:   { reps: '10-12', rest: 60 },
  maintenance: { reps: '8-12',  rest: 90 },
};

/**
 * Should the old sets/reps/weight carry to the new movement?
 *
 * Not a fixed answer — it depends on what actually changed, and on what the
 * person is training for.
 *
 * A like-for-like swap (same pattern, same push/pull, same role, same
 * laterality) is the same job done a different way, so your numbers are still
 * meaningful and carrying them keeps your progression intact. Change the job
 * and they are not: eight reps of a barbell squat and eight reps of a Bulgarian
 * split squat are different sessions.
 *
 * Weight is treated more carefully than reps, because it is the one that hurts
 * people. It never carries across a change of laterality or equipment — a
 * bilateral load moved onto one leg is roughly double the demand per side, and
 * a number carried blindly there is how someone gets injured.
 *
 * The GOAL deliberately plays no part in this decision, only in what the
 * numbers reset TO — see numbersFor. No goal makes carrying a bilateral load
 * onto one leg safe, so letting it soften this would be letting a preference
 * override a safety rule.
 */
export function shouldCarryNumbers(
  from: PlanExerciseMeta | null | undefined,
  to: PlanExerciseMeta | null | undefined,
): CarryVerdict {
  // Nothing to reason with — leave the numbers alone rather than invent a
  // reason to change them.
  if (!from || !to) {
    return { decision: 'carry', reason: 'Keeping your sets and reps — nothing to compare the two movements on.' };
  }

  const samePattern = !!from.movement_pattern && from.movement_pattern === to.movement_pattern;
  const sameForce = !!from.force_type && from.force_type === to.force_type;
  const sameRole = !!from.session_role && from.session_role === to.session_role;
  const sameLaterality = from.laterality === to.laterality;
  const sameType = from.exercise_type === to.exercise_type;

  if (!sameRole && from.session_role && to.session_role) {
    return {
      decision: 'reset',
      reason: `Starting the numbers fresh — this is ${roleWord(to.session_role)} work, not ${roleWord(from.session_role)}.`,
    };
  }

  if (!samePattern || !sameForce) {
    return {
      decision: 'reset',
      reason: 'Starting the numbers fresh — this trains a different movement, so the old sets and reps would not mean much.',
    };
  }

  // Same job, but loaded differently across the body. Reps still transfer;
  // the weight does not, and quietly carrying it is the unsafe option.
  if (!sameLaterality) {
    return {
      decision: 'carry_reps_only',
      reason: from.laterality === 'bilateral'
        ? 'Keeping your sets and reps, clearing the weight — one side at a time is close to double the load per limb.'
        : 'Keeping your sets and reps, clearing the weight — both sides together takes a different load.',
    };
  }

  if (!sameType) {
    return {
      decision: 'carry_reps_only',
      reason: 'Keeping your sets and reps, clearing the weight — different kit, so the number will not transfer.',
    };
  }

  return {
    decision: 'carry',
    reason: 'Keeping your sets, reps and weight — same movement pattern, so your progression still counts.',
  };
}

function roleWord(role: string): string {
  switch (role) {
    case 'main': return 'main lift';
    case 'accessory': return 'accessory';
    case 'finisher': return 'finisher';
    case 'warmup': return 'warm-up';
    case 'cooldown': return 'cool-down';
    case 'mobility': return 'mobility';
    default: return role;
  }
}

/** The numbers the swapped-in row should start with, given the verdict. */
export function numbersFor(
  old: HealthPlanExercise,
  replacement: HealthPlanExercise,
  verdict: CarryVerdict,
  goal: HealthGoal | null | undefined,
): Pick<HealthPlanExercise, 'sets' | 'reps' | 'weight' | 'rest_seconds' | 'tempo'> {
  if (verdict.decision === 'carry') {
    return {
      sets: old.sets, reps: old.reps, weight: old.weight,
      rest_seconds: old.rest_seconds, tempo: old.tempo,
    };
  }
  if (verdict.decision === 'carry_reps_only') {
    return {
      sets: old.sets, reps: old.reps, weight: null,
      rest_seconds: old.rest_seconds, tempo: replacement.tempo,
    };
  }
  // Reset. Prefer the library's own prescription for the new movement; fall
  // back to a shape that suits what the person is actually training for, which
  // is why the goal is passed in at all.
  const shape = GOAL_SHAPE[goal ?? ''] ?? GOAL_SHAPE.maintenance;
  return {
    sets: replacement.sets ?? 3,
    reps: replacement.reps ?? shape.reps,
    weight: null,
    rest_seconds: replacement.rest_seconds ?? shape.rest,
    tempo: replacement.tempo,
  };
}

// ── 3. Finding alternatives ─────────────────────────────────────────────────

export interface ExerciseCandidate {
  slug: string;
  name: string;
  meta: PlanExerciseMeta;
  thumbnail_url?: string | null;
}

export interface RankedExercise extends ExerciseCandidate {
  /** Higher is a closer match. */
  score: number;
  /** Why it is being offered — shown under the name. */
  why: string;
  /** Set when the person's own profile argues against it. Offered last, never hidden. */
  caution: string | null;
}

/**
 * Alternatives that do the same job in the session.
 *
 * Ranked rather than filtered, because "closest match" and "only exact matches"
 * are different products — a hard filter on a 184-exercise library hands back
 * an empty sheet more often than it should.
 *
 * The library's own substitution table would be the ideal source, but it holds
 * 10 links across 8 of 184 exercises, so it cannot carry this. Pattern, force
 * and role are on all 184, and they describe the job well enough to rank by:
 * a horizontal pull that is an accessory is a fair swap for another one.
 *
 * Anything the profile makes unsafe sinks to the bottom with a reason, rather
 * than vanishing — someone who knows their own knee should be able to see the
 * option and decide.
 */
export function rankExerciseAlternatives(
  from: { slug?: string | null; meta?: PlanExerciseMeta | null },
  pool: ExerciseCandidate[],
  profile: HealthProfile | null,
): RankedExercise[] {
  const f = from.meta ?? {};
  const out: RankedExercise[] = [];

  for (const c of pool) {
    if (c.slug === from.slug) continue;

    let score = 0;
    const bits: string[] = [];
    if (f.movement_pattern && c.meta.movement_pattern === f.movement_pattern) { score += 4; bits.push('same movement'); }
    if (f.force_type && c.meta.force_type === f.force_type) { score += 3; bits.push(f.force_type === 'push' ? 'pushing' : f.force_type === 'pull' ? 'pulling' : 'same type'); }
    if (f.session_role && c.meta.session_role === f.session_role) { score += 2; bits.push(roleWord(f.session_role)); }
    if (f.laterality && c.meta.laterality === f.laterality) score += 1;
    if (f.exercise_type && c.meta.exercise_type === f.exercise_type) score += 1;
    // Prefer a similar difficulty — a swap should not quietly make the session
    // harder than the one it replaces.
    if (f.difficulty != null && c.meta.difficulty != null) {
      score += Math.max(0, 2 - Math.abs(f.difficulty - c.meta.difficulty));
    }
    // A zero score is NOT a reason to drop it. The pool arrives already
    // narrowed to the same movement pattern or force, so every member is a
    // legitimate candidate; scoring only decides the order. Dropping zeros
    // meant a row saved before the metadata existed — nothing to match on —
    // produced an empty sheet out of a pool of sixty perfectly good options.

    const check = checkExercise(c.meta, profile);
    const avoid = check.findings.find(x => x.severity === 'avoid');
    let caution: string | null = null;
    if (avoid) { caution = `Your profile flags this for ${avoid.condition}.`; score -= 100; }
    else if (check.findings.length > 0) { caution = `Take care — ${check.findings[0].condition}.`; score -= 3; }
    else if (check.missing_equipment.length > 0) { caution = `Needs ${check.missing_equipment.join(', ')}.`; score -= 2; }

    out.push({ ...c, score, caution, why: bits.slice(0, 2).join(' · ') || 'similar' });
  }

  return out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export interface RecipeCandidate {
  slug: string;
  name: string;
  course: string | null;
  meta: PlanMealMeta;
  calories: number | null;
  protein_g: number | null;
  hero_image_url?: string | null;
}

export interface RankedRecipe extends RecipeCandidate {
  score: number;
  why: string;
  caution: string | null;
}

/**
 * Alternatives for a meal, holding the day roughly where it was.
 *
 * Same course first — a dinner should be replaced by a dinner. Then similar
 * calories, so swapping one meal does not quietly blow the day's target, and
 * similar time, so a Tuesday swap is still cookable on a Tuesday.
 *
 * Anything carrying an allergen the person reacts to is removed outright, not
 * ranked down. That is the one place in this file where a hard exclude is
 * right: an allergen is not a preference and there is nothing to weigh it up
 * against.
 */
export function rankRecipeAlternatives(
  from: { slug?: string | null; course?: string | null; calories?: number | null; meta?: PlanMealMeta | null },
  pool: RecipeCandidate[],
  profile: HealthProfile | null,
): RankedRecipe[] {
  const fromKcal = from.calories ?? null;
  const fromTime = from.meta?.total_time_minutes ?? null;
  const out: RankedRecipe[] = [];

  for (const c of pool) {
    if (c.slug === from.slug) continue;

    const safety = checkRecipe(
      { allergens: c.meta.allergens ?? undefined, diets: c.meta.diets ?? undefined, dietary_flags: c.meta.dietary_flags ?? undefined },
      profile,
    );
    if (safety.blocked) continue; // hard exclude — the one that is not a preference

    let score = 0;
    const bits: string[] = [];
    if (from.course && c.course === from.course) { score += 4; bits.push(c.course); }
    if (fromKcal != null && c.calories != null) {
      const drift = Math.abs(c.calories - fromKcal) / Math.max(1, fromKcal);
      if (drift <= 0.15) { score += 3; bits.push('similar calories'); }
      else if (drift <= 0.3) score += 1;
    }
    if (fromTime != null && c.meta.total_time_minutes != null && c.meta.total_time_minutes <= fromTime) {
      score += 2; bits.push('no slower');
    }
    // Kept even at zero, for the same reason as the exercise pool: the server
    // already filtered to the same course, so these are all real options and
    // the score only orders them. The allergen exclusion above is the only
    // thing that removes anything here.

    let caution: string | null = null;
    if (safety.off_diet.length > 0) { caution = `Outside your ${safety.off_diet.join(', ')} diet.`; score -= 3; }
    else if (safety.unverifiable.length > 0) caution = `Cannot be checked for ${safety.unverifiable.join(', ')}.`;

    out.push({ ...c, score, caution, why: bits.slice(0, 2).join(' · ') || 'similar' });
  }

  return out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

// ── 4. Applying it ──────────────────────────────────────────────────────────

/**
 * Swap an exercise into the chosen occurrences.
 *
 * Returns a NEW plan; nothing here mutates. Rows not in `rowIds` are untouched,
 * which is what makes "change three of the five" work.
 */
export function applyExerciseSwap(
  plan: HealthPlan,
  rowIds: Set<string>,
  replacement: HealthPlanExercise,
  verdict: CarryVerdict,
  goal: HealthGoal | null | undefined,
): HealthPlan {
  return {
    ...plan,
    days: plan.days.map(day => ({
      ...day,
      training: day.training.map(row => {
        if (!rowIds.has(row.id)) return row;
        return {
          ...replacement,
          // Keep the row's own id so anything pointing at it still resolves.
          id: row.id,
          notes: row.notes,
          ...numbersFor(row, replacement, verdict, goal),
        };
      }),
    })),
  };
}

/** Swap a recipe into the chosen occurrences, preserving each row's slot and
 *  servings — you chose to eat something else at lunch, not to move lunch. */
export function applyMealSwap(
  plan: HealthPlan,
  rowIds: Set<string>,
  replacement: HealthPlanMeal,
): HealthPlan {
  return {
    ...plan,
    days: plan.days.map(day => ({
      ...day,
      meals: day.meals.map(row => {
        if (!rowIds.has(row.id)) return row;
        const servings = row.servings && row.servings > 0 ? row.servings : 1;
        const per = replacement.servings && replacement.servings > 0 ? replacement.servings : 1;
        const scale = (v: number | null) => (v == null ? null : Math.round((v / per) * servings));
        return {
          ...replacement,
          id: row.id,
          slot: row.slot,
          servings,
          notes: row.notes,
          calories: scale(replacement.calories),
          protein_g: scale(replacement.protein_g),
          carbs_g: scale(replacement.carbs_g),
          fat_g: scale(replacement.fat_g),
        };
      }),
    })),
  };
}

// ── 5. Duplicate ────────────────────────────────────────────────────────────

function cloneRowIds<T extends { id: string }>(rows: T[], prefix: string): T[] {
  return rows.map((r, i) => ({
    ...r,
    // Fresh ids: two days holding rows with the same id would make "swap just
    // this one" impossible, which is the whole point of the feature above.
    id: `${prefix}-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`,
  }));
}

/**
 * Copy one day onto one or more others.
 *
 * Completion is deliberately NOT copied — a copied day has not been done. The
 * title, kind, exercises, meals and notes are.
 */
export function duplicateDay(plan: HealthPlan, fromIndex: number, toIndexes: number[]): HealthPlan {
  const source = plan.days.find(d => d.day_index === fromIndex);
  if (!source) return plan;
  const targets = new Set(toIndexes.filter(i => i !== fromIndex));
  if (targets.size === 0) return plan;

  return {
    ...plan,
    days: plan.days.map(day => {
      if (!targets.has(day.day_index)) return day;
      return {
        ...day,
        kind: source.kind,
        title: source.title,
        notes: source.notes,
        training: cloneRowIds(source.training, 'ex'),
        meals: cloneRowIds(source.meals, 'ml'),
        completion: null,
      } satisfies HealthPlanDay;
    }),
  };
}

/**
 * Copy a whole week onto another, day for day.
 *
 * Weeks are 1-based. A partial target week (the last week of a 10-day plan)
 * copies as far as it goes rather than refusing.
 */
export function duplicateWeek(plan: HealthPlan, fromWeek: number, toWeek: number): HealthPlan {
  if (fromWeek === toWeek) return plan;
  const offset = (toWeek - fromWeek) * 7;
  const sourceStart = (fromWeek - 1) * 7 + 1;

  let next = plan;
  for (let i = 0; i < 7; i++) {
    const from = sourceStart + i;
    const to = from + offset;
    if (!plan.days.some(d => d.day_index === from)) continue;
    if (!plan.days.some(d => d.day_index === to)) continue;
    next = duplicateDay(next, from, [to]);
  }
  return next;
}

/** How many weeks a plan spans, for the week pickers. */
export function weekCount(plan: HealthPlan): number {
  return Math.max(1, Math.ceil(plan.duration_days / 7));
}

// ── 6. Progressing a copy ───────────────────────────────────────────────────
//
// "Never repeat week 1 for a month" is already the standing instruction to the
// coach. Copying a week forward unchanged does exactly that, so a copy can be
// nudged as it lands.
//
// Deliberately an EXPLICIT CHOICE rather than a silent rule. Load progression
// cannot be automated honestly here: weight is free text — "60kg", "bodyweight",
// "red band" — and adding 2.5% to "bodyweight" is nonsense. Volume can be
// stepped safely and reversibly, so that is what is offered, and the person
// picks it. Progression driven by what they actually LIFTED is a separate,
// better thing that needs the log.

export type Progression = 'same' | 'one_more_rep' | 'one_more_set';

/**
 * Step a rep prescription up by one.
 *
 * Handles the three shapes the library and users actually write: a plain count
 * ("8"), a range ("8-12", "8–12"), and anything else — time, distance, "AMRAP",
 * "30s" — which is returned untouched because adding a rep to it is meaningless.
 */
export function bumpReps(reps: string | null): string | null {
  if (!reps) return reps;
  const s = reps.trim();

  const range = s.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
  if (range) {
    const lo = Number(range[1]), hi = Number(range[2]);
    if (Number.isFinite(lo) && Number.isFinite(hi)) return `${lo + 1}-${hi + 1}`;
  }

  if (/^\d+$/.test(s)) return String(Number(s) + 1);

  // Time, distance, AMRAP, per-side notation — not a rep count. Leave it be
  // rather than mangle it into something that reads like a number.
  return reps;
}

/**
 * Apply a progression to every training row in the given days.
 *
 * Only touches training. Meals do not progress — eating one more portion each
 * week is not a nutrition plan.
 */
export function progressDays(
  plan: HealthPlan,
  dayIndexes: number[],
  progression: Progression,
): HealthPlan {
  if (progression === 'same') return plan;
  const targets = new Set(dayIndexes);

  return {
    ...plan,
    days: plan.days.map(day => {
      if (!targets.has(day.day_index)) return day;
      return {
        ...day,
        training: day.training.map(ex => {
          // Warm-ups, cool-downs and mobility are not the place to add volume.
          const role = ex.meta?.session_role ?? null;
          if (role === 'warmup' || role === 'cooldown' || role === 'mobility') return ex;
          return progression === 'one_more_rep'
            ? { ...ex, reps: bumpReps(ex.reps) }
            : { ...ex, sets: ex.sets == null ? ex.sets : ex.sets + 1 };
        }),
      };
    }),
  };
}

/** The day indexes a week covers that actually exist in the plan. */
export function daysInWeek(plan: HealthPlan, week: number): number[] {
  const start = (week - 1) * 7 + 1;
  return plan.days
    .filter(d => d.day_index >= start && d.day_index < start + 7)
    .map(d => d.day_index);
}
