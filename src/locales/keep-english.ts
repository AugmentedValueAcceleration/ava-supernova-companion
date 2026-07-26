import type { StringKey } from './en.js';

/**
 * Keys whose English value is intentionally preserved across all locales.
 * Used by scripts/i18n-check.mjs to skip English-leak warnings on these keys.
 *
 * These are NOT untranslated gaps — every entry is a word that is genuinely
 * the same (or a standard loanword) in the languages that "kept" it:
 *   - German uses "Training", "System", "Countdown" as-is
 *   - Dutch uses "week", "lunch", "water", "Stopwatch", "sets" as-is
 *   - French uses "Journal", "Nutrition", "Muscles", "Notes" as-is
 *   - Italian uses "Privacy", "Account", "Chat" as-is
 *   - "kcal", "Tabata", "reps", "Plan", "Type", "Routine" transfer everywhere
 * Forcing a "translation" here would make the UI worse, not better.
 */
export const KEEP_ENGLISH: ReadonlySet<StringKey> = new Set<StringKey>([
  // Units & training protocols (universal)
  'todayLogMealKcalPlaceholder',     // kcal
  'todayLogMealProteinPlaceholder',  // protein g
  'gymModeTabata',                   // Tabata (proper noun)

  // Tech / UI loanwords — standard in Latin-script + many other locales
  'chat', 'system', 'version', 'support',
  'model', 'data', 'website', 'privacy', 'account', 'journal',

  // Fitness loanwords — used in-language as English in gym contexts
  'catalogDetailCardioSection',      // Cardio — same word in nl/pl/pt/vi/fr/it/es/de
  'gymHeading',                      // Gym
  'gymModeStopwatch',                // Stopwatch
  'gymModeCountdown',                // Countdown
  'gymModeSets',                     // Sets
  'gymButtonReset',                  // Reset
  'gymParamRounds',                  // Rounds
  'gymRoundLabel',                   // Round
  'planBuilderExerciseRepsLabel',    // reps
  'planBuilderExerciseSetsLabel',    // sets
  'todayLogWaterReset',              // reset

  // Cross-language cognates — identical word in the flagged language(s)
  'todayTrainingTile',               // Training
  'plansCalendarLegendTraining',     // Training
  'planBuilderTrainingKind',         // Training
  'planBuilderTrainingSection',      // Training
  'todayNutritionTile',              // Nutrition
  'catalogDetailMusclesSection',     // Muscles
  'catalogDetailRoutineSection',     // Routine
  'catalogDetailProgressionLabel',   // Progression:
  'catalogDetailIngredientOptional', // (optional)
  'plansHeading',                    // Plans
  'plansCreateTypeLabel',            // Type
  'planBuilderBackTitle',            // Plan
  'planBuilderNotesLabel',           // Notes
  'planBuilderWeekLabel',            // Week
  'planBuilderMealLunch',            // lunch
  'planBuilderMealSnack',            // snack
  'todayLogWaterButton',             // Water
  'todayNutritionWaterLabel',        // water

  // Same category, flagged by the checker and never listed. Each is a word the
  // flagged language genuinely keeps: French "Nutrition", Indonesian and
  // Turkish "Protein", Spanish and Portuguese "Total", German and Dutch
  // "Training". The languages that DO have their own word already carry it -
  // German shows "Eiweiss" for protein - so this only silences the ones where
  // English is the right answer.
  'planBuilderNutritionSection',     // Nutrition
  'duplicateSheetWeekWord',          // Week — Dutch keeps it
  'assistAvaSays',                   // Ava — her name, never translated
  'generateKnowsTraining',           // Training — German keeps it
  'planBuilderMacroProtein',         // Protein
  'mealSheetProtein',                // Protein
  'mealSheetTotal',                  // Total
  'todayPlanTrainingLabel',          // Training

  // Cross-language cognate — "passphrase" is a standard loanword in German
  // and Italian (and others); they keep it as-is.
  'backupPassphrase',                // Passphrase

  // Legacy — cloud toggle removed (companion is local-only); keys unused
  'dataModeCloud',                   // Cloud
  'dataModeLocal',                   // Local

  // Onboarding loanwords — copied in with the shared onboarding flow keys.
  // Each is a word the flagged languages genuinely keep as-is; translating
  // them would make the UI worse. Core carries the same set.
  // NB: avoid apostrophes in comments in this file — see i18n-check.mjs.
  'onboarding.feature.images.label', // Images — French keeps it
  'onboarding.feature.video.label',  // Video — German, Indonesian keep it
  'onboarding.hours.start',          // Start — German keeps it
  'onboarding.mode.plan.label',      // Plan — kept across most locales
  'proTip',                          // Pro tip — Dutch keeps it

  // Loanwords and international terms the flagged languages genuinely keep
  // as-is: Yoga, Pilates, HIIT, Tempo, Protein, Sodium, Calories, Total,
  // Routine, Sport, Enterprise, Open Source, Collections, Cuisine,
  // Description, Warm, Direct, Nutrition, Muscles, Sets, and the name Ava.
  // Forcing a translation here would make the UI worse, not better.
  'filterCollections',
  'filterCuisine',
  'health.browse.course.dessert',
  'health.browse.course.sauce',
  'health.browse.course.snack',
  'health.browse.level.expert',
  'health.browse.muscles',
  'health.browse.nutri.calories',
  'health.browse.nutri.fibre',
  'health.browse.nutri.protein',
  'health.browse.nutri.sodium',
  'health.browse.nutrition',
  'health.browse.opt',
  'health.browse.routine',
  'health.browse.routine.sets',
  'health.browse.routine.tempo',
  'health.browse.tab.ava',
  'health.browse.total',
  'health.browse.workout.hiit',
  'health.browse.workout.hybrid',
  'health.browse.workout.pilates',
  'health.browse.workout.yoga',
  'news.enterprise',
  'news.open_source',
  'news.sport',
  'persona.tone.direct.label',
  'persona.tone.warm.label',
  'personaDescription',
] as StringKey[]);
