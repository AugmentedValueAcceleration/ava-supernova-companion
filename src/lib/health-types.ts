// ─── Companion health-plan types ────────────────────────────────────────────
//
// Mirrors @ava/core/health types and the extension's dashboard HealthPlan so a
// plan synced from any surface deserialises here unchanged. Kept as a local
// copy (not a core import) because the companion is a standalone Next.js app
// with no @ava/core dependency.

export type HealthPlanType = 'fitness' | 'meal' | 'combined';
export type HealthPlanSource = 'manual' | 'ava';
export type HealthPlanStatus = 'draft' | 'active' | 'completed' | 'archived';

/**
 * Library facts captured when an item is added to a plan.
 *
 * Copied onto the plan rather than looked up on demand, for two reasons. The
 * checks then run with no network at all — a plan opened on a train still warns
 * about a bad knee — and a plan stays a faithful record of what was chosen even
 * if the library entry is later edited.
 *
 * Every field optional: plans built before this existed carry none, and the
 * services already treat missing metadata as "don't judge" rather than guessing.
 */
export interface PlanExerciseMeta {
  movement_pattern?: string | null;
  force_type?: string | null;
  session_role?: string | null;
  laterality?: string | null;
  /** compound / isolation / bodyweight / plyometric / mobility / … */
  exercise_type?: string | null;
  difficulty?: number | null;
  equipment?: string[] | null;
  contraindications?: ExerciseContraindication[] | null;
}

/** One ingredient line as the recipe wrote it, for the recipe's OWN default
 *  servings. Stored unscaled on purpose: the plan's servings can change, and a
 *  number derived at read time can never go stale the way a copied one can. */
export interface PlanIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  optional?: boolean;
}

export interface PlanMealMeta {
  /** main / side / breakfast / dessert / … — what the dish IS. Needed so a
   *  swap can offer a dinner in place of a dinner; without it the ranker has
   *  nothing to match on when a meal carries no macros. */
  course?: string | null;
  total_time_minutes?: number | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  level?: CookingLevel | null;
  default_servings?: number | null;
  batch_portions?: number | null;
  keeps_fridge_days?: number | null;
  /** Free-from flags as slugs — what proves an allergen absent. */
  dietary_flags?: string[] | null;
  diets?: string[] | null;
  allergens?: string[] | null;
  /** The lines this meal needs, already narrowed to its skill level. Captured
   *  at add time so a shopping list works in a shop with no signal — the same
   *  reason sets and macros are captured rather than fetched. */
  ingredients?: PlanIngredient[] | null;
}

export interface HealthPlanExercise {
  id: string;
  ref?: { kind: 'exercise'; slug: string } | null;
  name: string;
  sets: number | null;
  reps: string | null;
  weight: string | null;
  rest_seconds: number | null;
  tempo: string | null;
  notes: string | null;
  meta?: PlanExerciseMeta | null;
}

export interface HealthPlanMeal {
  id: string;
  slot: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  ref?: { kind: 'recipe'; slug: string } | null;
  name: string;
  servings: number | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  notes: string | null;
  meta?: PlanMealMeta | null;
}

export type HealthPlanDayProgress = 'pending' | 'partial' | 'done' | 'skipped';

/**
 * What actually happened on a plan day.
 *
 * Deliberately a ROLL-UP, not a second copy of the logs. The detail lives where
 * it is captured: sets performed in `GymSession`, what was eaten in
 * `HealthDailyMeal`. Both of those are keyed by date, so deriving a plan's
 * progress would mean loading every day's log just to draw one plan card — for
 * every card in the library. This is the cheap summary that makes a plan
 * self-describing; it is written when completion flows back, never typed.
 */
export interface HealthPlanDayCompletion {
  training: HealthPlanDayProgress;
  nutrition: HealthPlanDayProgress;
  /** First time this day was considered done. Null until it is. */
  completed_at: string | null;
}

export interface HealthPlanDay {
  day_index: number;
  kind: 'training' | 'rest' | 'active_recovery';
  title: string | null;
  training: HealthPlanExercise[];
  meals: HealthPlanMeal[];
  notes: string | null;
  /** Absent on plans written before completion tracking; normalised on load. */
  completion?: HealthPlanDayCompletion | null;
}

export interface HealthPlanSummary {
  id: string;
  type: HealthPlanType;
  title: string;
  status: HealthPlanStatus;
  duration_days: number;
  start_date: string | null;
  source: HealthPlanSource;
  updated_at: string | null;
}

/** The full plan as stored locally and synced. `profile_snapshot` stays
 *  opaque on the companion — we never read it, only round-trip it. */
export interface HealthPlan {
  schema_version: number;
  id: string;
  type: HealthPlanType;
  title: string;
  goal: string | null;
  source: HealthPlanSource;
  status: HealthPlanStatus;
  duration_days: number;
  start_date: string | null;
  profile_snapshot: unknown | null;
  days: HealthPlanDay[];
  created_at: string | null;
  updated_at: string | null;
}

// ─── Catalogue cards (browse) ───────────────────────────────────────────────
// The list-item shapes returned by /api/health/exercises and /recipes.

export interface ExerciseCard {
  id: string;
  slug: string;
  name: string;
  exercise_type: string | null;
  workout_type: string;
  difficulty: number | null;
  thumbnail_url: string | null;
}

export interface RecipeCard {
  id: string;
  slug: string;
  name: string;
  origin_country: string | null;
  course: string | null;
  hero_image_url: string | null;
}

// ─── Catalogue detail (tap-through) ─────────────────────────────────────────

export interface MuscleTag { slug: string; name: string; category: string; role: string }
export interface EquipmentTag { slug: string; name: string }

export interface ExerciseRoutine {
  sets: number | null;
  reps_target: string | number | null;
  rest_seconds: number | null;
  tempo: string | null;
  frequency_per_week: number | null;
  progression: string | null;
  // Programmable-gym additions. OPTIONAL on purpose: the API served rows
  // without these before the gym rebuild, and declaring them required crashed
  // the extension on older payloads.
  rpe?: number | null;
  percent_1rm?: string | null;
  seconds_per_set?: number | null;
}

export interface CardioPrescription {
  style?: string | null;
  duration_minutes?: number | null;
  heart_rate_zone?: string | null;
  work_seconds?: number | null;
  rest_seconds?: number | null;
  rounds?: number | null;
}

export interface ExerciseContraindication {
  slug: string;
  name: string;
  category?: string | null;
  severity: string;              // avoid | caution | modify
  note?: string | null;
}

export interface ExerciseAlternative {
  slug: string;
  name: string;
}

export interface ExerciseDetail {
  id: string;
  slug: string;
  name: string;
  exercise_type: string | null;
  workout_type: string;
  difficulty: number | null;
  description: string | null;
  steps: string[];
  routine: ExerciseRoutine;
  beginner_detail: string | null;
  common_mistakes: string | null;
  demo_video_url: string | null;
  thumbnail_url: string | null;
  muscles: MuscleTag[];
  equipment: EquipmentTag[];
  movement_pattern?: string | null;
  force_type?: string | null;
  laterality?: string | null;
  session_role?: string | null;
  coaching_cues?: string[] | null;
  cardio?: CardioPrescription | null;
  contraindications?: ExerciseContraindication[] | null;
  regression?: ExerciseAlternative | null;
  progression?: ExerciseAlternative | null;
  substitutions?: ExerciseAlternative[] | null;
}

export interface RecipeIngredient {
  sort_order: number;
  quantity: number | null;
  unit: string | null;
  name: string;
  notes: string | null;
  optional: boolean;
  /** Which skill level this ingredient belongs to; null = shared by all. */
  level?: 'beginner' | 'intermediate' | 'expert' | null;
}

export interface RecipeStep {
  sort_order: number;
  action: string;                       // the instruction text
  notes: string | null;
  technique_term: string | null;
  time_estimate_seconds: number | null;
  tricky_flag: boolean;
}

export interface RecipeVersion {
  level: 'beginner' | 'intermediate' | 'expert';
  description: string | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  total_time_minutes: number | null;
  default_servings: number | null;
  nutrition: Record<string, number | null | undefined>;
  steps: RecipeStep[];
  // The API has always returned these; the companion's copy of the type never
  // declared them, so nothing here could see them. Optional because a plan may
  // hold a row captured before they were read.
  /** "Free from" flags — what positively proves an allergen absent. */
  dietary_flags?: string[];
  diets?: string[];
  /** Portions a sensible batch yields, when the dish scales and keeps. */
  batch_portions?: number | null;
}

export interface RecipeDetail {
  id: string;
  slug: string;
  name: string;
  cuisine_name: string | null;
  /** Every cuisine this recipe belongs to, primary first. */
  cuisines?: string[];
  origin_country: string | null;
  course: string | null;
  hero_image_url: string | null;
  overview: string | null;
  source_attribution: string | null;
  ingredients: RecipeIngredient[];
  versions: RecipeVersion[];
  /** Allergens present in the dish, recipe-level. */
  allergens?: string[];
  /** How long the finished dish keeps — recipe-level, shared across versions. */
  storage?: {
    keeps_fridge_days: number | null;
    keeps_freezer_months: number | null;
    from_frozen_notes: string | null;
  } | null;
}

// ─── Health profile (mirrors the extension's HealthProfile) ─────────────────

export type HealthGoal = 'fat_loss' | 'muscle_gain' | 'maintenance' | 'athletic' | 'recovery' | 'longevity';

export type TrainingExperience = 'beginner' | 'intermediate' | 'advanced';
/** Deliberately the same values as `recipe_versions.level`, so a profile can
 *  pick the right VERSION of a recipe rather than just the right recipe. */
export type CookingLevel = 'beginner' | 'intermediate' | 'expert';
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** A lift the user can already do, so weight prescription has somewhere to
 *  start. Without any of these the planner can only say "RPE 7", which is a
 *  dodge dressed up as a prescription. */
export interface BaselineLift {
  ref?: { kind: 'exercise'; slug: string } | null;
  name: string;
  weight_kg: number | null;
  reps: number | null;
}

export interface WeightEntry {
  date: string;
  weight_kg: number;
}

export interface HealthProfile {
  schema_version: 1;
  updated_at: string | null;
  body: {
    sex: 'female' | 'male' | 'other' | null;
    date_of_birth: string | null;
    height_cm: number | null;
    weight_kg: number | null;
    body_fat_pct: number | null;
  };
  goals: {
    primary: HealthGoal | null;
    weekly_focus: string | null;
  };
  constraints: {
    allergens: string[];
    dietary: string[];
    injuries: string[];
    equipment_available: string[];
    minutes_per_day_target: number | null;
  };
  schedule: {
    training_window: { start: string | null; end: string | null };
    meal_times: { breakfast: string | null; lunch: string | null; dinner: string | null };
    sleep_target: { bedtime: string | null; wake: string | null };
  };
  // ── What programming actually needs ───────────────────────────────────────
  // Optional so a profile written by core, the extension or the IDE — none of
  // which know about these yet — still loads. Normalised on read.
  training?: {
    experience: TrainingExperience | null;
    days_per_week: number | null;
    /** WHICH days, not just how many. `schedule.training_window` gives the time
     *  of day but nothing said "Mon/Wed/Fri", and you cannot shape a week
     *  without knowing that. */
    training_days: Weekday[];
    baseline_lifts: BaselineLift[];
  } | null;
  kitchen?: {
    level: CookingLevel | null;
    /** Cooking time is not one number. Twenty minutes on a work night and an
     *  hour at the weekend is the normal shape of a life, and a plan that
     *  ignores it prescribes a braise on a Tuesday. */
    minutes_weekday: number | null;
    minutes_weekend: number | null;
    /** Drives servings, leftovers and the shopping list — all wrong without it. */
    household_size: number | null;
    /** Matches `recipes.cost_tier`. Optional; the field exists and users care. */
    cost_tier: string | null;
  } | null;
  /** Current weight lives in `body.weight_kg`; this is the trend. You cannot
   *  show progress — or read whether a plan is working — from one number. */
  weight_history?: WeightEntry[] | null;
}

// ─── Daily plan + log (Today) ───────────────────────────────────────────────

/** What happened to a meal: eaten as planned, swapped for something else, or
 *  skipped. Ad-hoc meals logged with no plan behind them are 'eaten'. */
export type HealthMealStatus = 'eaten' | 'swapped' | 'skipped';

export interface HealthDailyMeal {
  id: string;
  time: string;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  // ── Brought up to the training log's standard ─────────────────────────────
  // The training side has always recorded prescribed (`target_*`) against
  // actual (`sets[]`), linked to the library by slug. The meal log recorded
  // free text and two macros, so a user hand-typed calories while every recipe
  // in the library carried nutrition computed from real ingredient data — and
  // nothing could answer "did they eat what was planned, or swap it?".
  carbs_g: number | null;
  fat_g: number | null;
  /** Library link. When set, the macros above come from the recipe's computed
   *  nutrition rather than being typed — the whole point of computing it. */
  ref?: { kind: 'recipe'; slug: string } | null;
  /** The `HealthPlanMeal.id` this fulfils, when the day came from a plan.
   *  Prescribed-versus-actual for food. */
  planned_meal_id?: string | null;
  status?: HealthMealStatus;
  /** Servings actually eaten — recipe macros are per serving, so one portion of
   *  a four-serving batch is a quarter of the numbers. */
  servings?: number | null;
}

export interface HealthDailyLog {
  meals: HealthDailyMeal[];
  water_ml: number;
  sleep_hours: number | null;
  mood: 1 | 2 | 3 | 4 | 5 | null;
}

export interface HealthDailyPlanItem {
  id: string;
  time: string;
  kind: 'mobility' | 'meal' | 'workout' | 'rest' | 'sleep' | 'note';
  title: string;
  detail?: string | null;
  ref?: { kind: 'exercise' | 'recipe' | 'workout'; slug: string } | null;
  duration_minutes?: number | null;
  status: 'pending' | 'done' | 'skipped';
}

export interface HealthDailyPlan {
  schema_version: 1;
  date: string;
  morning_brief: string | null;
  brief_reasoning: string | null;
  items: HealthDailyPlanItem[];
  log: HealthDailyLog;
  updated_at: string | null;
}

export function emptyHealthProfile(): HealthProfile {
  return {
    schema_version: 1,
    updated_at: null,
    body: { sex: null, date_of_birth: null, height_cm: null, weight_kg: null, body_fat_pct: null },
    goals: { primary: null, weekly_focus: null },
    constraints: { allergens: [], dietary: [], injuries: [], equipment_available: [], minutes_per_day_target: null },
    schedule: {
      training_window: { start: null, end: null },
      meal_times: { breakfast: null, lunch: null, dinner: null },
      sleep_target: { bedtime: null, wake: null },
    },
    training: { experience: null, days_per_week: null, training_days: [], baseline_lifts: [] },
    kitchen: { level: null, minutes_weekday: null, minutes_weekend: null, household_size: null, cost_tier: null },
    weight_history: [],
  };
}

/**
 * Fill in anything a stored profile is missing.
 *
 * Profiles predate the training/kitchen branches, and profiles written by core,
 * the extension or the IDE still won't have them until those surfaces are
 * mirrored. Rather than make every reader defend itself, normalise once at the
 * load boundary — the same treatment the meal log and plan days get.
 *
 * Nothing here invents a value. A missing field becomes null or an empty list,
 * never a guess: a planner that assumes "intermediate" because nobody asked is
 * worse than one that knows it doesn't know.
 */
export function normaliseHealthProfile(raw: unknown): HealthProfile {
  const empty = emptyHealthProfile();
  const p = (raw ?? {}) as Partial<HealthProfile>;
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    ...empty,
    ...p,
    body: { ...empty.body, ...(p.body ?? {}) },
    goals: { ...empty.goals, ...(p.goals ?? {}) },
    constraints: {
      ...empty.constraints,
      ...(p.constraints ?? {}),
      allergens: arr<string>(p.constraints?.allergens),
      dietary: arr<string>(p.constraints?.dietary),
      injuries: arr<string>(p.constraints?.injuries),
      equipment_available: arr<string>(p.constraints?.equipment_available),
    },
    schedule: {
      training_window: { ...empty.schedule.training_window, ...(p.schedule?.training_window ?? {}) },
      meal_times: { ...empty.schedule.meal_times, ...(p.schedule?.meal_times ?? {}) },
      sleep_target: { ...empty.schedule.sleep_target, ...(p.schedule?.sleep_target ?? {}) },
    },
    training: {
      ...empty.training!,
      ...(p.training ?? {}),
      training_days: arr<Weekday>(p.training?.training_days),
      baseline_lifts: arr<BaselineLift>(p.training?.baseline_lifts),
    },
    kitchen: { ...empty.kitchen!, ...(p.kitchen ?? {}) },
    weight_history: arr<WeightEntry>(p.weight_history),
  };
}

export function planToSummary(p: HealthPlan): HealthPlanSummary {
  return {
    id: p.id,
    type: p.type,
    title: p.title,
    status: p.status,
    duration_days: p.duration_days,
    start_date: p.start_date,
    source: p.source,
    updated_at: p.updated_at,
  };
}
