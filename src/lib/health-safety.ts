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

import type { HealthProfile, ExerciseDetail, ExerciseContraindication } from './health-types';

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

/** Check one exercise against a profile's injuries and available kit. */
export function checkExercise(exercise: ExerciseDetail, profile: HealthProfile | null): ExerciseCheck {
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
  const missing_equipment = owned.length === 0
    ? []
    : (exercise.equipment ?? [])
        .map(e => e.name)
        .filter(name => name && !owned.some(have => refersToSame(have, name)));

  return {
    findings,
    missing_equipment,
    blocked: findings.some(f => f.severity === 'avoid'),
  };
}

/**
 * Does a recipe carry something the user must not eat?
 *
 * Allergens are the highest-stakes filter in the product, so this is a HARD
 * exclude with no override — an allergen is not a preference. Diets are
 * separate and softer: eating outside a chosen diet is a choice, not a risk.
 *
 * Takes the recipe's own allergen and diet names so it works the same whether
 * the caller loaded them from the API or the database.
 */
export function checkRecipe(
  recipe: { allergens?: string[]; diets?: string[] },
  profile: HealthProfile | null,
): { blocked_allergens: string[]; off_diet: string[]; blocked: boolean } {
  if (!profile) return { blocked_allergens: [], off_diet: [], blocked: false };

  const has = recipe.allergens ?? [];
  const blocked_allergens = (profile.constraints.allergens ?? [])
    .filter(a => has.some(r => refersToSame(a, r)));

  // A recipe is off-diet if the user follows a diet the recipe doesn't satisfy.
  const recipeDiets = recipe.diets ?? [];
  const off_diet = (profile.constraints.dietary ?? [])
    .filter(d => !recipeDiets.some(r => refersToSame(d, r)));

  return {
    blocked_allergens,
    off_diet,
    blocked: blocked_allergens.length > 0,
  };
}

/** Exposed so the generator can reuse exactly the same matching rather than
 *  inventing a second, slightly different one. */
export const __matching = { refersToSame, tokens };
