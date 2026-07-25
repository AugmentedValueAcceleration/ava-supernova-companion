// ─── Cooking feasibility ────────────────────────────────────────────────────
//
// A meal plan that ignores the clock is a meal plan nobody cooks. The library
// already knows how long every recipe version takes and what skill it assumes —
// prep_time_minutes, cook_time_minutes, total_time_minutes, level,
// default_servings, batch_portions, keeps_fridge_days — and the generator has
// only ever been sent recipe NAMES, so none of it reaches a plan.
//
// This is the difference between a plan that photographs well and one someone
// can actually cook on a Tuesday after work.
//
// Pure, like the other services: the caller passes what it loaded.

import type { HealthProfile, CookingLevel } from './health-types';

/** The library fields this reasons over. */
export interface RecipeTiming {
  total_time_minutes?: number | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  level?: CookingLevel | string | null;
  default_servings?: number | null;
  batch_portions?: number | null;
  keeps_fridge_days?: number | null;
}

export type DayType = 'weekday' | 'weekend';

/** Saturday and Sunday are the long-cook days for most people. Deliberately a
 *  simple rule rather than a setting: shift workers can set both budgets the
 *  same and lose nothing. */
export function dayTypeFor(dateIso: string): DayType {
  const d = new Date(`${dateIso}T00:00:00Z`).getUTCDay();
  return d === 0 || d === 6 ? 'weekend' : 'weekday';
}

const LEVEL_RANK: Record<string, number> = { beginner: 0, intermediate: 1, expert: 2 };

export interface CookingCheck {
  /** Minutes available for this kind of day, or null if not stated. */
  budget: number | null;
  over_by: number | null;
  /** Recipe assumes more skill than the profile claims. */
  too_advanced: boolean;
  /** Cook once, eat more than once — worth surfacing while planning. */
  batch_covers: number | null;
  keeps_days: number | null;
  fits: boolean;
}

/**
 * Can this person cook this, on this kind of day?
 *
 * Time and skill are separate judgements. Running over the clock on a Tuesday
 * makes a recipe impractical; being above someone's stated confidence makes it
 * a stretch. Neither is a safety matter, so nothing here blocks — unlike an
 * allergen, which does.
 */
export function checkCooking(
  recipe: RecipeTiming,
  profile: HealthProfile | null,
  dayType: DayType,
): CookingCheck {
  const kitchen = profile?.kitchen ?? null;
  const budget = dayType === 'weekend'
    ? kitchen?.minutes_weekend ?? null
    : kitchen?.minutes_weekday ?? null;

  const total = recipe.total_time_minutes
    ?? ((recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0) || null);

  const over_by = budget != null && total != null && total > budget ? total - budget : null;

  // Only judge skill when both sides said something. An unstated cooking level
  // is not "beginner" — it is unknown, and guessing would hide good recipes.
  const wants = LEVEL_RANK[String(recipe.level ?? '')];
  const has = LEVEL_RANK[String(kitchen?.level ?? '')];
  const too_advanced = wants != null && has != null && wants > has;

  // Batch cooking: portions beyond what's needed today, and how long they last.
  // This is how people actually eat well across a work week, and the data has
  // been sitting there unused.
  const portions = recipe.batch_portions ?? recipe.default_servings ?? null;
  const household = kitchen?.household_size ?? 1;
  const batch_covers = portions != null && portions > household
    ? Math.floor(portions / Math.max(1, household)) - 1
    : null;

  return {
    budget,
    over_by,
    too_advanced,
    batch_covers,
    keeps_days: recipe.keeps_fridge_days ?? null,
    fits: over_by == null && !too_advanced,
  };
}

/**
 * A short, plain sentence for the UI — or null when there's nothing to say.
 *
 * Returns one line, not a list. Somebody choosing a recipe wants the reason it
 * might not suit them, not an audit.
 */
export function cookingHint(check: CookingCheck): string | null {
  if (check.over_by != null) {
    return `About ${check.over_by} min over your ${check.budget} min budget for this day.`;
  }
  if (check.too_advanced) {
    return 'A step up from the cooking level on your profile.';
  }
  if (check.batch_covers != null && check.batch_covers > 0) {
    const keeps = check.keeps_days != null ? `, keeps ${check.keeps_days} days` : '';
    return `Cook once, covers ${check.batch_covers} more meal${check.batch_covers === 1 ? '' : 's'}${keeps}.`;
  }
  return null;
}
