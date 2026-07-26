'use client';

/**
 * Fill in ingredients a plan never captured.
 *
 * Meals added by hand carry their ingredients from the moment they are chosen.
 * Two kinds do not: plans generated on the server, which only ever came back
 * with a recipe slug, and plans made before ingredients were captured at all.
 * For those the shopping list would be empty through no fault of the cook.
 *
 * So this asks the library once for the recipes a plan actually uses, writes
 * the lines onto the plan rows, and leaves the plan self-sufficient from then
 * on — one request per plan, not per shopping trip, and nothing to re-fetch in
 * a supermarket with no signal.
 *
 * It also backfills default_servings, which matters more than it looks: a meal
 * planned at two servings of a four-serving recipe must halve every quantity,
 * and without the recipe's own figure the list would shop for the whole thing.
 *
 * Only ever ADDS. A meal that already has its lines is left exactly as it is —
 * the captured copy is the record of what was planned, and a later edit to the
 * library recipe must not silently rewrite someone's week.
 */
import type { HealthPlan, PlanIngredient } from './health-types';
import { mealsNeedingIngredients, ingredientsForLevel } from './health-shopping-list';
import { healthCatalogApi } from './api';

interface Bundle {
  lines: Array<PlanIngredient & { level?: string | null }>;
  defaultServings: Record<string, number | null>;
}

export interface FillResult {
  /** The updated plan, when anything was actually filled. */
  plan: HealthPlan | null;
  /**
   * Whether the library could be reached at all.
   *
   * Distinguished from "nothing to fill" on purpose. Returning a bare null for
   * both meant a dead network and a plan of unlinked meals produced the same
   * silence, and the first real report could not be read: four meals came back
   * unshoppable with no way to tell which had happened.
   */
  reachedLibrary: boolean;
}

/**
 * Never throws: a shopping list that cannot be completed should say so, not
 * break the screen it is on.
 */
export async function fillMissingIngredients(plan: HealthPlan): Promise<FillResult> {
  const needed = mealsNeedingIngredients(plan.days ?? []);
  // Nothing to ask for is not a failure — every meal already has its lines, or
  // none of them is a library recipe in the first place.
  if (!needed.length) return { plan: null, reachedLibrary: true };

  let bundles: Record<string, Bundle>;
  try {
    const slugs = [...new Set(needed.map((n) => n.slug))];
    const res = await healthCatalogApi.ingredients(slugs);
    bundles = (res?.recipes ?? {}) as Record<string, Bundle>;
  } catch {
    return { plan: null, reachedLibrary: false };
  }

  let changed = false;
  const days = plan.days.map((day) => {
    const meals = day.meals.map((meal) => {
      const slug = meal.ref?.slug;
      if (!slug) return meal;
      if (meal.meta?.ingredients && meal.meta.ingredients.length > 0) return meal;

      const bundle = bundles[slug];
      if (!bundle) return meal;

      const level = meal.meta?.level ?? null;
      const lines = ingredientsForLevel(bundle.lines ?? [], level);
      if (!lines.length) return meal;

      // A plan whose meals never had meta at all still needs somewhere to put
      // the level's serving count, or every quantity would be shopped 1:1.
      const fallbackLevel = level ?? 'beginner';
      const servings = meal.meta?.default_servings
        ?? bundle.defaultServings?.[fallbackLevel]
        ?? null;

      changed = true;
      return {
        ...meal,
        meta: { ...(meal.meta ?? {}), ingredients: lines, default_servings: servings },
      };
    });
    return { ...day, meals };
  });

  return { plan: changed ? { ...plan, days } : null, reachedLibrary: true };
}
