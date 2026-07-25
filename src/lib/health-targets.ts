// ─── Energy and protein targets ─────────────────────────────────────────────
//
// The goal used to be an adjective. It reached the plan generator as a word
// inside a sentence — "match the goal (e.g. a cut = a sensible deficit)" — and
// nothing computed it, nothing checked it, and the user never saw a number.
//
// These are the numbers. Deterministic, derived from the profile, and shown
// rather than hidden, so a plan claiming a sensible deficit can be checked
// against one.
//
// Everything returns null when the inputs aren't there. A target invented from
// a missing weight is worse than no target, because it looks authoritative.
//
// NOT medical advice, and deliberately mainstream: Mifflin-St Jeor for BMR,
// conventional activity multipliers, protein in the ranges sports nutrition
// bodies publish. Someone with a clinical reason to differ has one.

import type { HealthProfile, HealthGoal } from './health-types';

export interface HealthTargets {
  bmr: number | null;
  /** BMR × activity, before the goal is applied. */
  maintenance_calories: number | null;
  /** Maintenance adjusted for the goal — what the plan should aim at. */
  target_calories: number | null;
  target_protein_g: number | null;
  /** Which inputs were missing, so the UI can ask for exactly those. */
  missing: string[];
}

/** Whole years, or null if no date of birth. */
function ageFrom(dob: string | null): number | null {
  if (!dob) return null;
  const born = Date.parse(`${dob}T00:00:00Z`);
  if (Number.isNaN(born)) return null;
  const years = (Date.now() - born) / (365.2425 * 86_400_000);
  return years > 0 && years < 130 ? Math.floor(years) : null;
}

/**
 * Activity multiplier from training days per week.
 *
 * The profile has no explicit activity level and asking for one is a question
 * the user has already answered by saying how often they train. Deliberately
 * conservative: a sedentary desk job with three gym sessions is not "very
 * active", and over-estimating maintenance is the common way a fat-loss plan
 * quietly stops being a deficit.
 */
function activityFactor(daysPerWeek: number | null): number {
  if (daysPerWeek == null) return 1.375; // assume light rather than sedentary or athletic
  if (daysPerWeek <= 1) return 1.2;
  if (daysPerWeek <= 3) return 1.375;
  if (daysPerWeek <= 5) return 1.55;
  return 1.725;
}

/** Multiplier applied to maintenance. */
function goalEnergyFactor(goal: HealthGoal | null): number {
  switch (goal) {
    case 'fat_loss':    return 0.80; // ~20% deficit — sustainable, not aggressive
    case 'muscle_gain': return 1.10; // modest surplus; more is mostly fat
    case 'athletic':    return 1.05;
    default:            return 1.00; // maintenance, recovery, longevity, unset
  }
}

/** Grams of protein per kg of bodyweight. */
function proteinPerKg(goal: HealthGoal | null): number {
  switch (goal) {
    case 'fat_loss':    return 2.0; // highest — preserving lean mass in a deficit
    case 'muscle_gain': return 1.8;
    case 'athletic':    return 1.8;
    default:            return 1.6;
  }
}

export function computeTargets(profile: HealthProfile | null): HealthTargets {
  const empty: HealthTargets = {
    bmr: null, maintenance_calories: null, target_calories: null,
    target_protein_g: null, missing: ['profile'],
  };
  if (!profile) return empty;

  const { sex, height_cm, weight_kg, date_of_birth } = profile.body;
  const age = ageFrom(date_of_birth);
  const missing: string[] = [];
  if (weight_kg == null) missing.push('weight');
  if (height_cm == null) missing.push('height');
  if (age == null) missing.push('date of birth');
  if (sex == null) missing.push('sex');

  if (weight_kg == null || height_cm == null || age == null || sex == null) {
    return { ...empty, missing };
  }

  // Mifflin-St Jeor. The published equation has male and female constants only;
  // for anyone who hasn't said, or whose answer is neither, we take the midpoint
  // rather than defaulting to one or refusing to show anything.
  const constant = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  const bmr = Math.round(10 * weight_kg + 6.25 * height_cm - 5 * age + constant);

  const maintenance = Math.round(bmr * activityFactor(profile.training?.days_per_week ?? null));
  const goal = profile.goals.primary;

  return {
    bmr,
    maintenance_calories: maintenance,
    target_calories: Math.round(maintenance * goalEnergyFactor(goal)),
    target_protein_g: Math.round(weight_kg * proteinPerKg(goal)),
    missing,
  };
}

/**
 * Does a day's planned energy actually match the goal it claims?
 *
 * The generator is told "a cut = a sensible deficit" and its answer has never
 * been checked. This is the check: it does not rewrite anything, it reports,
 * so both the plan builder and any review step can say plainly that a plan
 * labelled fat loss is prescribing a surplus.
 *
 * The 12% band is deliberately loose. Day-to-day variation around a weekly
 * average is normal and healthy; flagging every day that isn't exact would
 * train people to ignore the warning.
 */
export function checkDayAgainstTargets(
  plannedCalories: number,
  targets: HealthTargets,
): { ok: boolean; delta: number; message: string } | null {
  if (targets.target_calories == null || plannedCalories <= 0) return null;
  const delta = plannedCalories - targets.target_calories;
  const pct = delta / targets.target_calories;
  if (Math.abs(pct) <= 0.12) return { ok: true, delta, message: '' };
  return {
    ok: false,
    delta,
    message: delta > 0
      ? `${Math.round(delta)} kcal above your target`
      : `${Math.round(-delta)} kcal below your target`,
  };
}
