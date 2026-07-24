// ─── Companion health-plan types ────────────────────────────────────────────
//
// Mirrors @ava/core/health types and the extension's dashboard HealthPlan so a
// plan synced from any surface deserialises here unchanged. Kept as a local
// copy (not a core import) because the companion is a standalone Next.js app
// with no @ava/core dependency.

export type HealthPlanType = 'fitness' | 'meal' | 'combined';
export type HealthPlanSource = 'manual' | 'ava';
export type HealthPlanStatus = 'draft' | 'active' | 'completed' | 'archived';

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
}

export interface HealthPlanDay {
  day_index: number;
  kind: 'training' | 'rest' | 'active_recovery';
  title: string | null;
  training: HealthPlanExercise[];
  meals: HealthPlanMeal[];
  notes: string | null;
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
}

// ─── Health profile (mirrors the extension's HealthProfile) ─────────────────

export type HealthGoal = 'fat_loss' | 'muscle_gain' | 'maintenance' | 'athletic' | 'recovery' | 'longevity';

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
