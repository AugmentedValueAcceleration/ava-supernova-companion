// ─── Safety and availability checks ─────────────────────────────────────────
//
// The rule the whole plan rests on: a bad knee should be a GUARANTEE, not a
// polite request buried in a prompt. Today the generator is told "if the
// profile mentions an injury, respect it" and we hope. This module is what
// replaces the hoping.
//
// It reports; it never rewrites. Generation uses it to drop unsafe options
// before the model ever sees them, and the manual builder uses it to warn while
// someone is composing by hand. Same rules, different moment — which is the
// whole point of it living here rather than inside the generator.

import type { HealthProfile, ExerciseContraindication } from './health-types';

export interface SafetyFinding {
  /** Severity of THIS condition for THIS movement, from the library link. */
  severity: 'avoid' | 'caution' | 'modify';
  /** The library's name for the condition, e.g. "Acute knee injury". */
  condition: string;
  /** What in the profile triggered it, so the warning can be traced. */
  matched: string;
  /** Why, and what to do instead. */
  note: string | null;
}

export interface ExerciseCheck {
  findings: SafetyFinding[];
  /** Kit the exercise needs that the profile doesn't list. */
  missing_equipment: string[];
  /** True if anything is marked avoid — the bar for excluding outright. */
  blocked: boolean;
}

/**
 * Words that carry no body-part meaning.
 *
 * Sides are stripped because a left-knee problem and a right-knee problem meet
 * the same contraindication; the library records the condition, not the side.
 */
const NOISE = new Set([
  'left', 'right', 'both', 'my', 'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on',
  'acute', 'chronic', 'old', 'bad', 'dodgy', 'sore', 'weak', 'injury', 'injured',
  'pain', 'painful', 'problem', 'problems', 'issue', 'issues', 'condition',
  'history', 'post', 'op', 'surgery', 'recovering', 'from', 'mild', 'slight',
]);

function tokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/[\s-]+/)
      .filter(w => w.length > 2 && !NOISE.has(w)),
  );
}

/**
 * Does a free-text profile entry refer to the same thing as a library name?
 *
 * Exact match first — if the profile ever offers the twelve library conditions
 * as options instead of a text field, this becomes the only path and the
 * heuristic below stops mattering. Until then "left knee" has to find "Acute
 * knee injury", which means overlapping on the meaningful token: knee.
 *
 * It deliberately OVER-matches. This is a safety check, so a warning the user
 * dismisses costs a tap, and a missed one costs an injury. That trade is not
 * close.
 */
function refersToSame(profileText: string, libraryName: string): boolean {
  const a = profileText.trim().toLowerCase();
  const b = libraryName.trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b || b.includes(a) || a.includes(b)) return true;
  const ta = tokens(a);
  const tb = tokens(b);
  for (const w of ta) if (tb.has(w)) return true;

  // Same word, different ending. Found by testing: "pregnant" and "Pregnancy"
  // share no whole token, so exact matching let a pregnancy contraindication
  // through — a false negative, which is the direction that actually hurts
  // someone. Comparing a five-character prefix catches the grammatical variants
  // (pregnant/pregnancy, herniated/herniation) without being loose enough to
  // collide: the short body-part words that would be risky here — knee, hip,
  // back, disc — are all under five characters and so still need exact matches.
  for (const w of ta) {
    if (w.length < 5) continue;
    for (const v of tb) {
      if (v.length < 5) continue;
      if (w.slice(0, 5) === v.slice(0, 5)) return true;
    }
  }
  return false;
}

/**
 * The parts of an exercise this check actually reads.
 *
 * Deliberately narrower than ExerciseDetail so a plan row — which stores only
 * these two facts, captured when the exercise was added — can be checked
 * without refetching the catalogue. A full ExerciseDetail still satisfies it,
 * so existing callers are unaffected.
 */
export interface CheckableExercise {
  contraindications?: ExerciseContraindication[] | null;
  equipment?: Array<{ name: string }> | string[] | null;
}

/** Check one exercise against a profile's injuries and available kit. */
export function checkExercise(exercise: CheckableExercise, profile: HealthProfile | null): ExerciseCheck {
  const empty: ExerciseCheck = { findings: [], missing_equipment: [], blocked: false };
  if (!profile) return empty;

  const injuries = profile.constraints.injuries ?? [];
  const contras: ExerciseContraindication[] = exercise.contraindications ?? [];
  const findings: SafetyFinding[] = [];

  for (const c of contras) {
    for (const injury of injuries) {
      if (!refersToSame(injury, c.name)) continue;
      findings.push({
        severity: (c.severity as SafetyFinding['severity']) ?? 'caution',
        condition: c.name,
        matched: injury,
        note: c.note ?? null,
      });
      break; // one finding per condition, not one per matching phrasing
    }
  }

  // Equipment is availability, not safety — a missing bench means you can't do
  // it today, not that it's dangerous. Reported separately for that reason.
  // An empty list means "not specified", not "owns nothing", so we say nothing.
  const owned = profile.constraints.equipment_available ?? [];
  const kit = (exercise.equipment ?? []).map(e => (typeof e === 'string' ? e : e.name));
  const missing_equipment = owned.length === 0
    ? []
    : kit.filter(name => name && !owned.some(have => refersToSame(have, name)));

  return {
    findings,
    missing_equipment,
    blocked: findings.some(f => f.severity === 'avoid'),
  };
}

/**
 * Which "free from" flag positively proves a recipe is clear of an allergen.
 *
 * The library has an allergens table and a recipe_allergens join, and checking
 * the real data found it holds 2 rows across 824 published recipes — recipes
 * with "peanut" in the title are untagged. An allergen filter reading only that
 * table excludes nothing while looking like it works, which is worse than
 * having no filter at all.
 *
 * The dietary flags ARE populated — 98% of versions carry at least one, and the
 * six free-from flags run from 38% (shellfish) to 84% (nut). So safety is
 * derived from the field that exists rather than the one that is empty.
 *
 * The polarity matters and it is deliberately the cautious way round: a flag is
 * a positive assertion of ABSENCE. "Marked dairy-free" means safe; not marked
 * means UNKNOWN, and unknown is treated as unsafe. That over-excludes, which
 * costs someone a few recipes. The other direction costs them a reaction.
 */
export const ALLERGEN_FREE_FROM_FLAG: Record<string, string> = {
  peanut: 'nut_free',
  'tree nuts': 'nut_free',
  gluten: 'gluten_free',
  dairy: 'dairy_free',
  egg: 'egg_free',
  soy: 'soy_free',
  shellfish: 'shellfish_free',
};

/** Look up the proving flag for a free-text allergen, e.g. "peanuts" → nut_free. */
export function freeFromFlagFor(allergen: string): string | null {
  const a = allergen.trim().toLowerCase();
  for (const [key, flag] of Object.entries(ALLERGEN_FREE_FROM_FLAG)) {
    if (refersToSame(a, key)) return flag;
  }
  return null;
}

/**
 * Does a recipe carry something the user must not eat?
 *
 * Allergens are the highest-stakes filter in the product, so this is a HARD
 * exclude with no override — an allergen is not a preference. Diets are
 * separate and softer: eating outside a chosen diet is a choice, not a risk.
 *
 * Three outcomes rather than two, because the honest answer is sometimes "we
 * cannot tell":
 *   - blocked_allergens  the recipe is tagged with it, or lacks the flag that
 *                        would prove it absent
 *   - unverifiable       the library has no flag for this allergen at all
 *                        (fish, sesame, sulphites, celery, mustard, lupin,
 *                        molluscs) — say so rather than imply a clean check
 *
 * Takes the recipe's own tags so it works the same whether the caller loaded
 * them from the API or the database.
 */
export function checkRecipe(
  recipe: { allergens?: string[]; diets?: string[]; dietary_flags?: string[] },
  profile: HealthProfile | null,
): { blocked_allergens: string[]; unverifiable: string[]; off_diet: string[]; blocked: boolean } {
  if (!profile) return { blocked_allergens: [], unverifiable: [], off_diet: [], blocked: false };

  const tagged = recipe.allergens ?? [];
  // Flags arrive as slugs (nut_free) or display names (Nut-free) depending on
  // the endpoint; normalise both to the slug form before comparing.
  const flags = new Set((recipe.dietary_flags ?? [])
    .map(f => f.trim().toLowerCase().replace(/[\s-]+/g, '_')));

  const blocked_allergens: string[] = [];
  const unverifiable: string[] = [];

  for (const a of profile.constraints.allergens ?? []) {
    // An explicit tag is the strongest evidence there is — trust it first, on
    // the rare recipe that has one.
    if (tagged.some(r => refersToSame(a, r))) { blocked_allergens.push(a); continue; }
    const flag = freeFromFlagFor(a);
    if (!flag) { unverifiable.push(a); continue; }
    if (!flags.has(flag)) blocked_allergens.push(a);
  }

  // A recipe is off-diet if the user follows a diet the recipe doesn't satisfy.
  const recipeDiets = recipe.diets ?? [];
  const off_diet = (profile.constraints.dietary ?? [])
    .filter(d => !recipeDiets.some(r => refersToSame(d, r)));

  return {
    blocked_allergens,
    unverifiable,
    off_diet,
    blocked: blocked_allergens.length > 0,
  };
}

/** Exposed so the generator can reuse exactly the same matching rather than
 *  inventing a second, slightly different one. */
export const __matching = { refersToSame, tokens };
