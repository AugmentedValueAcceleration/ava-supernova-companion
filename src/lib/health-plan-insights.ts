// ─── What the builder knows while you build ─────────────────────────────────
//
// The generator got the intelligence services first: it filters its pools, so
// an unsafe exercise is never offered. Someone building a plan BY HAND gets no
// such protection — they pick from the whole catalogue, and the app has been
// happy to watch them put a barbell squat on a day for a person whose profile
// says acute knee injury.
//
// This is that gap closed. Same services, same rules, different moment:
// generation removes the option, the builder tells you about it. It is the
// weaker of the two on purpose — someone composing by hand has reasons, and a
// tool that refuses to let a coach write what they meant to write gets thrown
// away. It advises loudly and blocks nothing.
//
// Two halves:
//   1. capture  — turn a catalogue detail into a plan row, keeping the library
//                 facts the checks need so they run later with no network
//   2. judge    — read a day (and the week around it) and say what's wrong
//
// Pure. No I/O, no storage, no React. The extension and the IDE take the same
// two functions when the plan surfaces are mirrored there.

import type {
  ExerciseDetail, RecipeDetail, HealthProfile, HealthPlan, HealthPlanDay,
  HealthPlanExercise, HealthPlanMeal, PlanExerciseMeta, PlanMealMeta, CookingLevel,
} from './health-types';
import { checkExercise, checkRecipe, type ExerciseCheck } from './health-safety';
import { computeTargets, checkDayAgainstTargets, type HealthTargets } from './health-targets';
import { checkWeekBalance, checkSessionOrder, type BalanceFinding, type BalanceDay } from './health-balance';
import { checkCooking, cookingHint, dayTypeFor, type CookingCheck } from './health-cooking';

// ── 1. Capture ──────────────────────────────────────────────────────────────

function newId(prefix: string): string {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** The library facts worth keeping on a plan row. */
export function exerciseMetaFrom(detail: ExerciseDetail): PlanExerciseMeta {
  return {
    movement_pattern: detail.movement_pattern ?? null,
    force_type: detail.force_type ?? null,
    session_role: detail.session_role ?? null,
    laterality: detail.laterality ?? null,
    equipment: (detail.equipment ?? []).map(e => e.name),
    contraindications: detail.contraindications ?? null,
  };
}

/**
 * Build a plan row from a catalogue exercise, seeded with the library's own
 * prescription rather than a hardcoded 3×8-12.
 *
 * The library carries sets, reps, rest and tempo for every exercise and the
 * builder has been ignoring all of it. Starting from what the library
 * recommends means the common case needs no editing at all.
 */
export function planExerciseFrom(detail: ExerciseDetail): HealthPlanExercise {
  const r = detail.routine ?? {};
  const reps = r.reps_target == null ? null : String(r.reps_target);
  return {
    id: newId('ex'),
    ref: { kind: 'exercise', slug: detail.slug },
    name: detail.name,
    sets: r.sets ?? 3,
    reps: reps ?? '8-12',
    weight: null,
    rest_seconds: r.rest_seconds ?? 90,
    tempo: r.tempo ?? null,
    notes: null,
    meta: exerciseMetaFrom(detail),
  };
}

/** Pick the version matching someone's cooking level, else the simplest one. */
export function versionFor(detail: RecipeDetail, level: CookingLevel | null | undefined) {
  const versions = detail.versions ?? [];
  const ORDER: CookingLevel[] = ['beginner', 'intermediate', 'expert'];
  const exact = level ? versions.find(v => v.level === level) : null;
  if (exact) return exact;
  return [...versions].sort((a, b) => ORDER.indexOf(a.level) - ORDER.indexOf(b.level))[0] ?? null;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Build a plan row from a catalogue recipe, with real macros.
 *
 * Macros are scaled by servings and stored, not left null. The plan is then
 * complete on its own — the day total is right with no network, and it stays
 * right if the recipe is later edited, because a plan is a record of what was
 * chosen at the time.
 */
export function planMealFrom(
  detail: RecipeDetail,
  opts: { slot?: HealthPlanMeal['slot']; servings?: number; level?: CookingLevel | null } = {},
): HealthPlanMeal {
  const v = versionFor(detail, opts.level ?? null);
  const servings = opts.servings && opts.servings > 0 ? opts.servings : 1;
  const n = (v?.nutrition ?? {}) as Record<string, number | null | undefined>;
  const scale = (x: number | null) => (x == null ? null : Math.round(x * servings));

  const meta: PlanMealMeta = {
    total_time_minutes: v?.total_time_minutes ?? null,
    prep_time_minutes: v?.prep_time_minutes ?? null,
    cook_time_minutes: v?.cook_time_minutes ?? null,
    level: v?.level ?? null,
    default_servings: v?.default_servings ?? null,
    batch_portions: v?.batch_portions ?? null,
    keeps_fridge_days: detail.storage?.keeps_fridge_days ?? null,
    dietary_flags: v?.dietary_flags ?? null,
    diets: v?.diets ?? null,
    allergens: detail.allergens ?? null,
  };

  return {
    id: newId('ml'),
    slot: opts.slot ?? 'lunch',
    ref: { kind: 'recipe', slug: detail.slug },
    name: detail.name,
    servings,
    calories: scale(num(n.calories)),
    protein_g: scale(num(n.protein_g)),
    carbs_g: scale(num(n.carbs_g)),
    fat_g: scale(num(n.fat_g)),
    notes: null,
    meta,
  };
}

/**
 * Re-scale a meal's macros when its servings change.
 *
 * Works off the per-serving figure implied by the stored pair, so it stays
 * correct however many times it is adjusted, and does nothing when the meal has
 * no macros to scale.
 */
export function rescaleMeal(meal: HealthPlanMeal, servings: number | null): HealthPlanMeal {
  const from = meal.servings && meal.servings > 0 ? meal.servings : 1;
  const to = servings && servings > 0 ? servings : 1;
  if (from === to) return { ...meal, servings };
  const f = (v: number | null) => (v == null ? null : Math.round((v / from) * to));
  return {
    ...meal, servings,
    calories: f(meal.calories), protein_g: f(meal.protein_g),
    carbs_g: f(meal.carbs_g), fat_g: f(meal.fat_g),
  };
}

// ── 2. Judge ────────────────────────────────────────────────────────────────

/**
 * The calendar date a plan day falls on — the inverse of planDayIndexFor.
 *
 * Returns null for a plan that was never placed on a date, which is the normal
 * state of a draft. UTC-anchored for the same reason the forward direction is:
 * dividing local milliseconds by a day drifts across a DST boundary and lands a
 * long plan on the wrong date.
 */
export function dateForPlanDay(plan: HealthPlan, dayIndex: number): string | null {
  if (!plan.start_date) return null;
  const start = Date.parse(`${plan.start_date}T00:00:00Z`);
  if (Number.isNaN(start)) return null;
  return new Date(start + (dayIndex - 1) * 86_400_000).toISOString().slice(0, 10);
}

export interface MealInsight {
  meal: HealthPlanMeal;
  /** Allergens present, or not provably absent — the strongest warning here. */
  blocked_allergens: string[];
  /** Allergens the library holds no evidence about, either way. */
  unverifiable: string[];
  off_diet: string[];
  cooking: CookingCheck | null;
  hint: string | null;
}

export interface ExerciseInsight {
  exercise: HealthPlanExercise;
  check: ExerciseCheck;
}

export interface DayMacros { calories: number; protein_g: number; carbs_g: number; fat_g: number }

export interface DayInsights {
  macros: DayMacros;
  targets: HealthTargets;
  /** Null when there is no target to compare against, or nothing planned. */
  calorieVerdict: { ok: boolean; delta: number; message: string } | null;
  proteinVerdict: { ok: boolean; delta: number; message: string } | null;
  exercises: ExerciseInsight[];
  meals: MealInsight[];
  /** Ordering advice for this day's session. */
  order: BalanceFinding[];
  /** Imbalances across the whole plan — a week is the unit that matters. */
  week: BalanceFinding[];
  /** Total hands-on time the day's cooking asks for. */
  cookingMinutes: number | null;
  /** True if anything here is worth the user's attention. */
  hasWarnings: boolean;
}

/** Sum a day's planned macros. Missing values count as nothing, not zero-known. */
export function dayMacros(day: HealthPlanDay): DayMacros {
  const total = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  for (const m of day.meals) {
    total.calories += m.calories ?? 0;
    total.protein_g += m.protein_g ?? 0;
    total.carbs_g += m.carbs_g ?? 0;
    total.fat_g += m.fat_g ?? 0;
  }
  return total;
}

/** Protein has its own band — 15% under is worth saying, over is not a problem. */
function proteinVerdict(planned: number, targets: HealthTargets) {
  if (targets.target_protein_g == null || planned <= 0) return null;
  const delta = planned - targets.target_protein_g;
  if (delta >= 0 || Math.abs(delta) / targets.target_protein_g <= 0.15) {
    return { ok: true, delta, message: '' };
  }
  return { ok: false, delta, message: `${Math.round(-delta)}g short of your protein target` };
}

/**
 * Everything the builder can say about the day in front of you.
 *
 * The week-level balance check reads the WHOLE plan, not the current day, since
 * "four presses and no hinge" is a property of a week. It is reported alongside
 * the day so the person editing day 3 can see what day 3 is doing to the week.
 */
export function dayInsights(
  plan: HealthPlan,
  day: HealthPlanDay,
  profile: HealthProfile | null,
  dateIso?: string | null,
): DayInsights {
  const macros = dayMacros(day);
  const targets = computeTargets(profile);

  const exercises: ExerciseInsight[] = day.training.map(exercise => ({
    exercise,
    check: checkExercise(exercise.meta ?? {}, profile),
  }));

  // Cooking budget depends on which kind of day it is. Prefer the plan's real
  // calendar date; fall back to the day's position in the week so an unstarted
  // plan still distinguishes a Saturday from a Tuesday.
  const dayType = dateIso
    ? dayTypeFor(dateIso)
    : ((day.day_index % 7 === 6 || day.day_index % 7 === 0) ? 'weekend' : 'weekday');

  const meals: MealInsight[] = day.meals.map(meal => {
    const m = meal.meta ?? null;
    const safety = checkRecipe(
      {
        allergens: m?.allergens ?? undefined,
        diets: m?.diets ?? undefined,
        dietary_flags: m?.dietary_flags ?? undefined,
      },
      // Without stored metadata there is nothing to judge — an old plan row or
      // a free-text meal. Say nothing rather than warn about every meal.
      m ? profile : null,
    );
    const cooking = m ? checkCooking(m, profile, dayType) : null;
    return {
      meal,
      blocked_allergens: safety.blocked_allergens,
      unverifiable: safety.unverifiable,
      off_diet: safety.off_diet,
      cooking,
      hint: cooking ? cookingHint(cooking) : null,
    };
  });

  const toBalanceDay = (d: HealthPlanDay): BalanceDay => ({
    kind: d.kind,
    exercises: d.training.map(e => ({ name: e.name, meta: e.meta ?? null })),
  });

  const cookingMinutes = day.meals.reduce<number | null>((acc, m) => {
    const t = m.meta?.total_time_minutes ?? null;
    return t == null ? acc : (acc ?? 0) + t;
  }, null);

  const order = checkSessionOrder(day.training.map(e => ({ name: e.name, meta: e.meta ?? null })));
  const week = checkWeekBalance(plan.days.map(toBalanceDay));

  const calorieVerdict = checkDayAgainstTargets(macros.calories, targets);
  const protein = proteinVerdict(macros.protein_g, targets);

  return {
    macros, targets,
    calorieVerdict, proteinVerdict: protein,
    exercises, meals, order, week, cookingMinutes,
    hasWarnings:
      exercises.some(e => e.check.findings.length > 0 || e.check.missing_equipment.length > 0)
      || meals.some(m => m.blocked_allergens.length > 0 || m.off_diet.length > 0 || m.unverifiable.length > 0)
      || order.length > 0 || week.length > 0
      || calorieVerdict?.ok === false || protein?.ok === false,
  };
}
