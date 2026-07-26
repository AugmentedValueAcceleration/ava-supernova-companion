'use client';

// ─── Today dashboard (Phase 3b) ─────────────────────────────────────────────
//
// The daily surface: Ava's morning brief, readiness/nutrition/training reads,
// and one-tap logging (meals / water / sleep / mood). Mirrors the extension's
// HealthDashboard — same compute logic, same honest empty states. The brief is
// generated server-side (1 credit); everything else is local + offline.

import { useState, useCallback, useMemo, useEffect } from 'react';
import { t, useLocale } from '@/lib/i18n';
import { loadProfile } from '@/lib/health-profile-store';
import { loadDay, saveDay, todayIso, logId, nowHHMM } from '@/lib/health-day-store';
import { briefApi, healthCatalogApi } from '@/lib/api';
import { recentForBrief } from '@/lib/health-progress';
import { deriveToday, todayMacros, refreshPlanCompletion, weekStrip, type TodayDerived, type TodaySession, type TodayMeal } from '@/lib/health-today';
import type { HealthProfile, HealthDailyPlan, HealthDailyLog, RecipeCard } from '@/lib/health-types';
import { CataloguePicker } from './CataloguePicker';
import { WeekStrip, ViewingBanner } from './WeekStrip';
import { LibraryThumb } from './LibraryThumb';
import { ExerciseDetailView, RecipeDetailView } from './CatalogDetail';
import { BottomSheet, SheetConfirm } from './BottomSheet';
import { useLibraryImages } from '@/lib/use-library-images';

export function TodayView({ token }: { token?: string | null }) {
  useLocale();
  // The day being VIEWED, which is usually today but need not be. This was a
  // plain const, so there was no way to reach yesterday and a meal you forgot
  // to tick was simply lost. Every read and write below keys off it.
  const [today, setToday] = useState(() => todayIso());
  const isToday = today === todayIso();
  const [profile] = useState<HealthProfile | null>(() => loadProfile());
  const [plan, setPlan] = useState<HealthDailyPlan>(() => loadDay(today));

  // Switching day reloads that day's log. Without this the new date renders
  // yesterday's entries, which is a worse bug than the one being fixed.
  useEffect(() => { setPlan(loadDay(today)); }, [today]);
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefErr, setBriefErr] = useState<string | null>(null);
  const [openMeal, setOpenMeal] = useState<TodayMeal | null>(null);
  const [swapFor, setSwapFor] = useState<TodayMeal | null>(null);
  // Looking an exercise up. This is the screen you have open AT the rack, so
  // "how do I actually do this" is a more likely question here than anywhere
  // else in the product.
  const [viewing, setViewing] = useState<null | { kind: 'exercise' | 'recipe'; slug: string }>(null);

  const profileEmpty = !profile || (profile.body.weight_kg == null && profile.body.height_cm == null && profile.goals.primary == null);

  const commit = useCallback((mutate: (log: HealthDailyLog) => HealthDailyLog) => {
    setPlan(prev => saveDay({ ...prev, log: mutate(prev.log) }));
  }, []);

  // ── Planned-meal actions ──────────────────────────────────────────────────
  //
  // The macros come from the PLAN, which took them from the recipe's computed
  // nutrition — so eating a planned meal is one tap and nothing is typed. Plan
  // macros are per serving, so the log records the total actually eaten.
  //
  // Each action replaces any existing entry for that planned meal rather than
  // appending, so tapping twice can't double-count the day.
  const logPlannedMeal = useCallback((m: TodayMeal, status: 'eaten' | 'skipped', servings: number) => {
    const per = (v: number | null) => (v == null ? null : Math.round(v * servings));
    commit(log => ({
      ...log,
      meals: [
        ...log.meals.filter(x => x.planned_meal_id !== m.planned.id),
        {
          id: logId(),
          time: nowHHMM(),
          description: m.planned.name,
          // A skipped meal was not eaten, so it contributes nothing.
          calories: status === 'eaten' ? per(m.planned.calories) : null,
          protein_g: status === 'eaten' ? per(m.planned.protein_g) : null,
          carbs_g: status === 'eaten' ? per(m.planned.carbs_g) : null,
          fat_g: status === 'eaten' ? per(m.planned.fat_g) : null,
          ref: m.planned.ref ?? null,
          planned_meal_id: m.planned.id,
          status,
          servings: status === 'eaten' ? servings : null,
        },
      ],
    }));
    setOpenMeal(null);
  }, [commit]);

  const undoPlannedMeal = useCallback((m: TodayMeal) => {
    commit(log => ({ ...log, meals: log.meals.filter(x => x.planned_meal_id !== m.planned.id) }));
    setOpenMeal(null);
  }, [commit]);

  /**
   * Swap: you ate something, just not the thing that was planned.
   *
   * The macros come from the REPLACEMENT recipe's computed nutrition, fetched
   * on pick — using the planned meal's numbers would record a lie, and the
   * whole point of the meal log is that it says what actually happened.
   *
   * If the fetch fails the swap is still recorded, with null macros rather
   * than borrowed ones. An honest gap beats a confident wrong number.
   */
  const swapPlannedMeal = useCallback(async (m: TodayMeal, pick: RecipeCard) => {
    setSwapFor(null);
    setOpenMeal(null);
    // recipe_versions.nutrition is PER SERVING, same as plan meals, so one
    // serving of the replacement is a straight copy.
    let n: Record<string, number | null | undefined> = {};
    try {
      const res = await healthCatalogApi.recipe(pick.slug);
      n = (res?.recipe?.versions ?? [])[0]?.nutrition ?? {};
    } catch { /* recorded without macros — see above */ }
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
    commit(log => ({
      ...log,
      meals: [
        ...log.meals.filter(x => x.planned_meal_id !== m.planned.id),
        {
          id: logId(), time: nowHHMM(), description: pick.name,
          calories: num(n.calories), protein_g: num(n.protein_g),
          carbs_g: num(n.carbs_g), fat_g: num(n.fat_g),
          ref: { kind: 'recipe', slug: pick.slug },
          planned_meal_id: m.planned.id,
          status: 'swapped',
          servings: 1,
        },
      ],
    }));
  }, [commit]);

  // Push the day's roll-up back to the plan whenever the log changes.
  //
  // Deliberately an effect rather than a line after setPlan: the updater above
  // runs during React's render phase, so anything called straight after the
  // setPlan would read localStorage BEFORE saveDay had written to it and the
  // roll-up would sit one change behind. An effect runs after commit, when the
  // write has definitely landed. Safe to re-run — refreshPlanCompletion
  // recomputes from the logs and no-ops when nothing changed.
  useEffect(() => { refreshPlanCompletion(today); }, [today, plan]);

  const generateBrief = useCallback(async () => {
    if (!token) { setBriefErr('Sign in to let Ava write your brief.'); return; }
    setBriefBusy(true); setBriefErr(null);
    try {
      const res = await briefApi.generate(token, {
        date: today,
        hour: new Date().getHours(),
        profile,
        log: plan.log,
        // Aggregate evidence — how they've actually been doing — so the brief
        // can say something true rather than reasoning purely from intention.
        recent: recentForBrief(today),
      });
      if (res?.brief) setPlan(prev => saveDay({ ...prev, morning_brief: res.brief }));
      else setBriefErr(res?.error ?? 'Couldn’t write the brief.');
    } catch (e) {
      setBriefErr(e instanceof Error ? e.message : 'Couldn’t write the brief.');
    } finally {
      setBriefBusy(false);
    }
  }, [token, today, profile, plan.log]);

  // Joined at read time from the active plan + today's logs. Recomputed when
  // the day changes so ticking a meal updates the section immediately.
  const derived = useMemo(() => deriveToday(today), [today, plan]);
  const strip = useMemo(() => weekStrip(today), [today, plan]);

  const readiness = useMemo(() => computeReadiness(profile, plan), [profile, plan]);
  const nutrition = useMemo(() => computeNutrition(profile, plan), [profile, plan]);
  const training = useMemo(() => computeTraining(plan), [plan]);

  // Full-screen, matching the catalogue. Back returns to the same day you were
  // looking at, because none of Today's state is touched.
  if (viewing?.kind === 'exercise') {
    return <ExerciseDetailView slug={viewing.slug} onBack={() => setViewing(null)} />;
  }
  if (viewing?.kind === 'recipe') {
    return <RecipeDetailView slug={viewing.slug} onBack={() => setViewing(null)} />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Sticky, because it is navigation — scrolling down to log dinner should
          not lose the way back to the day you were correcting. */}
      <div className="sticky top-0 z-10 bg-ava-bg/95 backdrop-blur">
        <WeekStrip days={strip} selected={today} onSelect={setToday} />
        {!isToday && <ViewingBanner date={today} onToday={() => setToday(todayIso())} />}
      </div>

      <div className="max-w-3xl mx-auto w-full px-4 py-5 pb-28">
        {/* On today the long date and greeting are right; on another day they
            would be a lie, and the banner above already says where you are. */}
        {isToday && <>
          <div className="text-[11px] uppercase tracking-wider text-gray-500">{longDate()}</div>
          <h1 className="mt-1 text-xl font-light text-white">{greeting()}.</h1>
        </>}

        {profileEmpty && (
          <div className="mt-5 rounded-lg border border-ava-purple/30 bg-ava-purple/5 px-4 py-3 text-[12px] text-gray-300">
            {t('todayProfileSetupHint')}
          </div>
        )}

        {/* Morning brief */}
        <section className="mt-6">
          <h2 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{t('todayMorningBriefLabel')}</h2>
          {plan.morning_brief
            ? <p className="text-[15px] leading-relaxed text-white font-light">{plan.morning_brief}</p>
            : <p className="rounded-lg border border-ava-border px-4 py-4 text-[12px] text-gray-500 italic">{t('todayNoBriefEmpty')}</p>}
          {briefErr && <p className="mt-2 text-[12px] text-red-300">{briefErr}</p>}
          {/* A morning brief for a day that has already happened is neither
              useful nor free — it costs a credit to tell someone what to expect
              from last Tuesday. Logging back is the point of viewing a past day;
              generating is not. */}
          {isToday && (
            <button
              onClick={generateBrief}
              disabled={briefBusy || profileEmpty}
              className="mt-3 rounded-full border border-ava-purple/40 bg-ava-purple/10 px-4 py-1.5 text-[12px] text-ava-purple-light hover:bg-ava-purple/20 transition disabled:opacity-40"
            >
              {briefBusy ? t('todayBriefGeneratingButton') : plan.morning_brief ? t('todayBriefRewriteButton') : t('todayBriefCreateButton')}
            </button>
          )}
        </section>

        {/* Today's plan — derived from the active plan, never copied into the
            day store. Renders only when a plan actually covers today, so a
            user with no plan sees exactly what they saw before. */}
        {derived.hasPlan && <TodayPlanSection derived={derived} onOpenMeal={setOpenMeal} onView={setViewing} />}

        {/* Status */}
        <section className="mt-7">
          <h2 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{t('todayStatusLabel')}</h2>
          <div className="grid grid-cols-3 gap-2.5">
            <Tile label={t('todayReadinessTile')} value={readiness.value} hint={readiness.hint} />
            <Tile label={t('todayNutritionTile')} value={nutrition.value} hint={nutrition.hint} />
            <Tile label={t('todayTrainingTile')} value={training.value} hint={training.hint} />
          </div>
        </section>

        {/* Quick log */}
        <section className="mt-7">
          <h2 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{t('todayQuickLogLabel')}</h2>
          <QuickLog log={plan.log} commit={commit} />
        </section>
      </div>

      {openMeal && (
        <MealSheet
          meal={openMeal}
          onClose={() => setOpenMeal(null)}
          onLog={logPlannedMeal}
          onUndo={undoPlannedMeal}
          onSwap={() => setSwapFor(openMeal)}
          onViewRecipe={slug => { setOpenMeal(null); setViewing({ kind: 'recipe', slug }); }}
        />
      )}

      {swapFor && (
        <CataloguePicker
          kind="recipe"
          onClose={() => setSwapFor(null)}
          onPick={(item) => { void swapPlannedMeal(swapFor, item as RecipeCard); }}
        />
      )}
    </div>
  );
}

// ── Meal sheet — the nutrition counterpart to the Gym runner ─────────────────
//
// The Gym has had a session runner from the start: see what's planned, tick it
// off, save what you did. Food had nothing equivalent — the only way to record
// a meal was to type its name and hand-type its calories, while the recipe it
// came from already carried nutrition computed from real ingredient data.
//
// So this is deliberately not a form. The numbers are already known; the only
// thing the app doesn't know is whether you ate it, and how much.

function MealSheet({ meal, onClose, onLog, onUndo, onSwap, onViewRecipe }: {
  meal: TodayMeal;
  onClose: () => void;
  onLog: (m: TodayMeal, status: 'eaten' | 'skipped', servings: number) => void;
  onUndo: (m: TodayMeal) => void;
  onSwap: () => void;
  /** Absent for a free-text meal — there is no recipe behind it. */
  onViewRecipe?: (slug: string) => void;
}) {
  // Default to what was actually logged if this is being revisited, else to
  // what the plan asked for.
  const [servings, setServings] = useState<number>(meal.logged?.servings ?? meal.planned.servings ?? 1);
  const per = (v: number | null) => (v == null ? null : Math.round(v * servings));
  const logged = meal.logged != null;

  const rows: Array<[string, number | null]> = [
    [t('mealSheetProtein'), per(meal.planned.protein_g)],
    [t('mealSheetCarbs'), per(meal.planned.carbs_g)],
    [t('mealSheetFat'), per(meal.planned.fat_g)],
  ];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div className="rounded-t-2xl border-t border-ava-border bg-ava-bg px-5 pb-8 pt-5" onClick={e => e.stopPropagation()}>
        <div className="text-[10px] uppercase tracking-wider text-gray-500">{meal.planned.slot}</div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <h3 className="text-[17px] font-light text-white min-w-0 truncate">{meal.planned.name}</h3>
          {/* The recipe lives HERE rather than on the row's tap, because the
              row's job is eat / skip / swap and that is what people came for.
              But at six o'clock the thing you actually need is how to cook it,
              and it was unreachable from the plan entirely. */}
          {meal.planned.ref?.slug && onViewRecipe && (
            <button onClick={() => onViewRecipe(meal.planned.ref!.slug)}
              className="shrink-0 text-[11px] text-ava-purple-light underline underline-offset-2">
              {t('mealSheetViewRecipe')}
            </button>
          )}
        </div>

        {meal.planned.calories != null && (
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-[24px] font-light text-white">{per(meal.planned.calories)}</span>
            <span className="text-[11px] text-gray-500">kcal · {t('mealSheetTotal').toLowerCase()}</span>
          </div>
        )}

        <div className="mt-3 flex gap-4">
          {rows.filter(([, v]) => v != null).map(([label, v]) => (
            <div key={label}>
              <div className="text-[9px] uppercase tracking-wider text-gray-500">{label}</div>
              <div className="text-[13px] text-gray-200">{v}g</div>
            </div>
          ))}
        </div>

        {/* Servings — plan macros are per serving, so this scales everything
            above. Half portions are real life, hence the 0.5 step. */}
        <div className="mt-5 flex items-center justify-between">
          <span className="text-[12px] text-gray-400">{t('mealSheetServings')}</span>
          <div className="flex items-center gap-3">
            <StepBtn onClick={() => setServings(s => Math.max(0.5, Math.round((s - 0.5) * 2) / 2))}>−</StepBtn>
            <span className="w-10 text-center font-mono text-[14px] text-white">{servings}</span>
            <StepBtn onClick={() => setServings(s => Math.min(20, Math.round((s + 0.5) * 2) / 2))}>+</StepBtn>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          {logged ? (
            <button onClick={() => onUndo(meal)} className="flex-1 rounded-full border border-ava-border px-4 py-2.5 text-[13px] text-gray-300">
              {t('mealSheetUndo')}
            </button>
          ) : (
            <button onClick={() => onLog(meal, 'skipped', servings)} className="flex-1 rounded-full border border-ava-border px-4 py-2.5 text-[13px] text-gray-400">
              {t('mealSheetSkip')}
            </button>
          )}
          <button
            onClick={() => onLog(meal, 'eaten', servings)}
            className="flex-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2.5 text-[13px] text-emerald-300"
          >
            {t('mealSheetEat')}
          </button>
        </div>

        {/* Swap sits apart from the primary pair: it opens a search rather than
            committing anything, so it shouldn't look like a third answer to
            "did you eat this?". */}
        <button
          onClick={onSwap}
          className="mt-3 w-full rounded-full px-4 py-2 text-[12px] text-gray-500 hover:text-ava-purple-light transition"
        >
          {t('mealSheetSwap')}
        </button>
      </div>
    </div>
  );
}

function StepBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="h-8 w-8 rounded-full border border-ava-border text-[15px] leading-none text-gray-300 hover:border-ava-purple/50 hover:text-white transition">
      {children}
    </button>
  );
}

// ── Today's plan ─────────────────────────────────────────────────────────────
//
// The join that was missing: what the active plan asks for today, shown next to
// what has actually been logged. Read-only for now — ticking a meal off and
// running the session land in the meal flow and the completion pass.

function kindLabel(kind: TodaySession['kind']): string {
  if (kind === 'rest') return t('todayPlanRest');
  if (kind === 'active_recovery') return t('todayPlanRecovery');
  return t('todayPlanTrainingLabel');
}

function TodayPlanSection({ derived, onOpenMeal, onView }: {
  derived: TodayDerived;
  onOpenMeal: (m: TodayMeal) => void;
  onView: (v: { kind: 'exercise' | 'recipe'; slug: string }) => void;
}) {
  const macros = useMemo(() => todayMacros(derived), [derived]);
  // One request for everything on the screen. This is the surface people open
  // every morning and it was rendering a workout and a day's food as two lists
  // of plain text, while 182 verified demonstration photographs sat unused.
  const images = useLibraryImages(
    derived.sessions.flatMap(s => s.exercises.map(e => e.ref?.slug)),
    derived.meals.map(m => m.planned.ref?.slug),
  );
  return (
    <section className="mt-7">
      <h2 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{t('todayPlanLabel')}</h2>

      {derived.sessions.map(s => (
        <div key={`${s.plan_id}-${s.day_index}`} className="mb-2.5 rounded-xl border border-ava-border bg-ava-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-white truncate">{s.title || kindLabel(s.kind)}</div>
              <div className="mt-0.5 text-[10px] text-gray-500">{s.plan_title} · {t('todayPlanLabel')} {s.day_index}</div>
            </div>
            {s.status === 'completed' && <Pill tone="done">{t('todayPlanDone')}</Pill>}
            {s.status === 'in-progress' && <Pill tone="active">{t('todayPlanInProgress')}</Pill>}
          </div>

          {s.exercises.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {s.exercises.map(ex => (
                <li key={ex.id}>
                  {/* Tapping opens the technique guide. This is the screen open
                      AT the rack, so "how do I actually do this" is a more
                      likely question here than anywhere else in the product. */}
                  <button
                    onClick={ex.ref?.slug ? () => onView({ kind: 'exercise', slug: ex.ref!.slug }) : undefined}
                    disabled={!ex.ref?.slug}
                    className="w-full flex items-center gap-2.5 text-[12px] text-left group disabled:cursor-default"
                  >
                    <LibraryThumb src={images.exercise(ex.ref?.slug)} kind="exercise" alt={ex.name} />
                    <span className={`flex-1 min-w-0 truncate text-gray-200 ${ex.ref?.slug ? 'group-hover:text-ava-purple-light' : ''}`}>
                      {ex.name}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-gray-500">
                      {[ex.sets ? `${ex.sets}×${ex.reps ?? ''}` : ex.reps, ex.weight].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            /* A rest day is a prescription, not an absence. Rendered as a
               positive statement with its own mark, because a blank card reads
               as "the plan forgot about today" and quietly invites people to
               train through the day that was meant to let them adapt. */
            <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2.5">
              <svg className="w-4 h-4 shrink-0 text-sky-300/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
              </svg>
              <div className="min-w-0">
                <div className="text-[12px] text-sky-100/90">{t('todayRestDayTitle')}</div>
                <div className="text-[11px] text-gray-400 leading-snug">{t('todayPlanRestHint')}</div>
              </div>
            </div>
          )}

          {s.notes && <p className="mt-2.5 text-[11px] leading-relaxed text-gray-400">{s.notes}</p>}
        </div>
      ))}

      {derived.meals.length > 0 && (
        <div className="rounded-xl border border-ava-border bg-ava-surface p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[10px] uppercase tracking-wider text-gray-500">{t('todayPlanMealsLabel')}</span>
            {/* Actual against planned — the number the whole nutrition half exists to make true. */}
            <span className="font-mono text-[10px] text-gray-500">
              {Math.round(macros.actual.calories)} / {Math.round(macros.planned.calories)} kcal
            </span>
          </div>
          <ul className="mt-2.5 space-y-1.5">
            {derived.meals.map(m => (
              <li key={m.planned.id}>
                <button onClick={() => onOpenMeal(m)} className="flex w-full items-center gap-2.5 text-left text-[12px]">
                {/* Dimmed once dealt with, so the eye goes to what is still to
                    come without the row disappearing. */}
                <span className={m.status === 'pending' ? '' : 'opacity-45'}>
                  <LibraryThumb src={images.recipe(m.planned.ref?.slug)} kind="recipe" alt={m.planned.name} />
                </span>
                <span className="flex-1 min-w-0 truncate">
                  <span className="font-mono text-[10px] text-gray-500">{(m.planned.slot ?? '').slice(0, 2)}</span>{' '}
                  <span className={m.status === 'pending' ? 'text-gray-200' : 'text-gray-400 line-through'}>{m.planned.name}</span>
                </span>
                <span className="shrink-0 text-[10px] text-gray-500">
                  {m.status === 'eaten' ? t('todayPlanEaten')
                    : m.status === 'swapped' ? t('todayPlanSwapped')
                    : m.status === 'skipped' ? t('todayPlanSkipped')
                    : m.planned.calories != null ? `${m.planned.calories} kcal` : ''}
                </span>
                </button>
              </li>
            ))}
          </ul>
          {derived.extraMeals.length > 0 && (
            <p className="mt-2.5 text-[10px] text-gray-500">
              {t('todayPlanExtraMeals')}: {derived.extraMeals.map(m => m.description).filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Pill({ tone, children }: { tone: 'done' | 'active'; children: React.ReactNode }) {
  const cls = tone === 'done'
    ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
    : 'border-ava-purple/40 bg-ava-purple/10 text-ava-purple-light';
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${cls}`}>{children}</span>;
}

// ── Status tiles ─────────────────────────────────────────────────────────────

interface Figure { value: string; hint: string }

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-ava-border bg-ava-surface px-3 py-3">
      <div className="text-[9px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 text-[17px] font-light text-white">{value}</div>
      <div className="mt-1 text-[10px] text-gray-500 leading-snug">{hint}</div>
    </div>
  );
}

function computeReadiness(profile: HealthProfile | null, plan: HealthDailyPlan): Figure {
  const sleep = plan.log.sleep_hours;
  const mood = plan.log.mood;
  if (sleep == null && mood == null) return { value: '—', hint: t('todayReadinessEmptyHint') };
  const target = targetSleepHours(profile);
  let score = 0, weight = 0;
  if (sleep != null) { score += Math.min(sleep / target, 1) * 0.6; weight += 0.6; }
  if (mood != null) { score += (mood / 5) * 0.4; weight += 0.4; }
  const pct = Math.round((score / weight) * 100);
  const word = pct >= 80 ? t('todayReadinessStrong') : pct >= 60 ? t('todayReadinessGood') : pct >= 40 ? t('todayReadinessFair') : t('todayReadinessLow');
  const bits: string[] = [];
  if (sleep != null) bits.push(`${fmtH(sleep)}/${fmtH(target)} ${t('todayReadinessSleepLabel')}`);
  if (mood != null) bits.push(`${t('todayReadinessMoodLabel')} ${mood}/5`);
  return { value: word, hint: bits.join(' · ') };
}

function computeNutrition(profile: HealthProfile | null, plan: HealthDailyPlan): Figure {
  const meals = plan.log.meals;
  const water = plan.log.water_ml;
  if (meals.length === 0 && water === 0) return { value: '—', hint: t('todayNutritionEmptyHint') };
  const protein = meals.reduce((a, m) => a + (m.protein_g ?? 0), 0);
  const kcal = meals.reduce((a, m) => a + (m.calories ?? 0), 0);
  const target = proteinTarget(profile);
  const bits: string[] = [];
  if (protein > 0) bits.push(target != null ? `${Math.round(protein)}/${target}g P` : `${Math.round(protein)}g P`);
  if (kcal > 0) bits.push(`${kcal} kcal`);
  bits.push(`${fmtWater(water)} ${t('todayNutritionWaterLabel')}`);
  return { value: meals.length === 0 ? '—' : `${meals.length} ${t('todayNutritionMealsValue')}`, hint: bits.join(' · ') };
}

function computeTraining(plan: HealthDailyPlan): Figure {
  const training = plan.items.filter(i => i.kind === 'workout' || i.kind === 'mobility');
  if (training.length === 0) return { value: t('todayTrainingRestValue'), hint: t('todayTrainingNoSessionHint') };
  const done = training.filter(i => i.status === 'done').length;
  return { value: `${done}/${training.length}`, hint: t('todayTrainingSessionsHint') };
}

// ── Quick log ────────────────────────────────────────────────────────────────

type LogKind = 'meal' | 'water' | 'sleep' | 'mood';
const MOOD_FACE: Record<number, string> = { 1: '😔', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };

/**
 * Quick log.
 *
 * Each button now opens the SAME bottom sheet the meal flow uses, rather than
 * expanding a cramped panel inline that shoved the page around and sat under
 * the keyboard on a phone. Field focused, one confirm, always in the same place.
 */
function QuickLog({ log, commit }: { log: HealthDailyLog; commit: (m: (l: HealthDailyLog) => HealthDailyLog) => void }) {
  const [open, setOpen] = useState<LogKind | null>(null);
  const close = useCallback(() => setOpen(null), []);
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <LogBtn label={log.meals.length > 0 ? `${log.meals.length} ${t('todayLogMealsButton')}` : t('todayLogAddMealButton')} active={open === 'meal'} onClick={() => setOpen('meal')} />
        <LogBtn label={log.water_ml > 0 ? fmtWater(log.water_ml) : t('todayLogWaterButton')} active={open === 'water'} onClick={() => setOpen('water')} />
        <LogBtn label={log.sleep_hours != null ? fmtH(log.sleep_hours) : t('todayLogSleepButton')} active={open === 'sleep'} onClick={() => setOpen('sleep')} />
        <LogBtn label={log.mood != null ? MOOD_FACE[log.mood] : t('todayLogMoodButton')} active={open === 'mood'} onClick={() => setOpen('mood')} />
      </div>

      {open === 'meal' && (
        <BottomSheet title={t('todayLogAddMealButton')} onClose={close}
          subtitle={log.meals.length > 0 ? `${log.meals.length} ${t('todayLogMealsButton')}` : undefined}>
          <MealEditor log={log} commit={commit} onDone={close} />
        </BottomSheet>
      )}

      {open === 'water' && (
        <BottomSheet title={t('todayLogWaterButton')} subtitle={fmtWater(log.water_ml)} onClose={close}
          footer={<SheetConfirm label={t('todayLogDone')} onClick={close} />}>
          <div className="flex flex-wrap items-center gap-2">
            {[250, 500].map(ml => (
              <Chip key={ml} onClick={() => commit(l => ({ ...l, water_ml: Math.max(0, l.water_ml + ml) }))}>+{ml}ml</Chip>
            ))}
            <Chip onClick={() => commit(l => ({ ...l, water_ml: Math.max(0, l.water_ml - 250) }))} disabled={log.water_ml <= 0}>−250ml</Chip>
            <Chip onClick={() => commit(l => ({ ...l, water_ml: 0 }))} disabled={log.water_ml <= 0}>{t('todayLogWaterReset')}</Chip>
          </div>
        </BottomSheet>
      )}

      {open === 'sleep' && (
        <BottomSheet title={t('todayLogSleepButton')} onClose={close}
          footer={<SheetConfirm label={t('todayLogDone')} onClick={close} />}>
          <div className="flex items-center justify-center gap-4 py-2">
            <Chip onClick={() => commit(l => ({ ...l, sleep_hours: Math.max(0, round1((l.sleep_hours ?? 7.5) - 0.5)) }))}>−30m</Chip>
            <span className="min-w-[5rem] text-center text-[22px] font-light text-white tabular-nums">{fmtH(log.sleep_hours ?? 7.5)}</span>
            <Chip onClick={() => commit(l => ({ ...l, sleep_hours: Math.min(14, round1((l.sleep_hours ?? 7.5) + 0.5)) }))}>+30m</Chip>
          </div>
          {log.sleep_hours != null && (
            <div className="mt-2 text-center">
              <Chip onClick={() => commit(l => ({ ...l, sleep_hours: null }))}>{t('todayLogSleepClear')}</Chip>
            </div>
          )}
        </BottomSheet>
      )}

      {open === 'mood' && (
        // No confirm: choosing the face IS the action, so asking for a second
        // tap to agree with the one just made would be ceremony.
        <BottomSheet title={t('todayLogMoodButton')} onClose={close}>
          <div className="flex gap-2 py-2">
            {([1, 2, 3, 4, 5] as const).map(m => (
              <button key={m} onClick={() => { commit(l => ({ ...l, mood: m })); close(); }}
                className={`flex-1 rounded-lg border py-4 text-[26px] transition ${log.mood === m ? 'border-ava-purple/60 bg-ava-purple/10' : 'border-ava-border'}`}>
                {MOOD_FACE[m]}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

function LogBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-lg border px-3 py-2 text-[12px] transition ${active ? 'border-ava-purple/60 bg-ava-purple/10 text-ava-purple-light' : 'border-ava-border text-gray-300'}`}>
      {label}
    </button>
  );
}

function Chip({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className="rounded-md border border-ava-border bg-ava-surface px-2.5 py-1 text-[11px] text-gray-300 disabled:opacity-40">{children}</button>;
}

function MealEditor({ log, commit, onDone }: {
  log: HealthDailyLog;
  commit: (m: (l: HealthDailyLog) => HealthDailyLog) => void;
  /** Present when hosted in a sheet — adding is the confirm, so it closes. */
  onDone?: () => void;
}) {
  const [desc, setDesc] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const numOrNull = (s: string) => { const n = Number(s); return s.trim() && Number.isFinite(n) && n > 0 ? Math.round(n) : null; };
  const add = () => {
    if (!desc.trim()) return;
    // Ad-hoc entry: typed by hand, so carbs/fat stay null and there's no recipe
    // or plan behind it. A meal logged this way was eaten by definition.
    commit(l => ({
      ...l,
      meals: [...l.meals, {
        id: logId(), time: nowHHMM(), description: desc.trim(),
        calories: numOrNull(kcal), protein_g: numOrNull(protein),
        carbs_g: null, fat_g: null,
        ref: null, planned_meal_id: null, status: 'eaten', servings: null,
      }],
    }));
    setDesc(''); setKcal(''); setProtein('');
    // In a sheet, adding the meal IS the confirm — leaving it open on an empty
    // form makes it unclear whether the meal landed.
    onDone?.();
  };
  const fc = 'rounded-md border border-ava-border bg-ava-surface px-3 py-1.5 text-[12px] text-white placeholder-gray-500 focus:border-ava-purple focus:outline-none';
  return (
    <div>
      {log.meals.length > 0 && (
        <ul className="mb-3 space-y-1">
          {log.meals.map(m => (
            <li key={m.id} className="flex items-baseline justify-between gap-2 text-[12px]">
              <span className="truncate text-white"><span className="font-mono text-[10px] text-gray-500">{m.time}</span> {m.description}</span>
              <button onClick={() => commit(l => ({ ...l, meals: l.meals.filter(x => x.id !== m.id) }))} className="text-gray-500 hover:text-red-300">×</button>
            </li>
          ))}
        </ul>
      )}
      <input value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder={t('todayLogMealPlaceholder')} className={`w-full ${fc}`} />
      <div className="mt-2 flex gap-2">
        <input value={kcal} onChange={e => setKcal(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder={t('todayLogMealKcalPlaceholder')} className={`min-w-0 flex-1 ${fc}`} />
        <input value={protein} onChange={e => setProtein(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder={t('todayLogMealProteinPlaceholder')} className={`min-w-0 flex-1 ${fc}`} />
        <button onClick={add} disabled={!desc.trim()} className="shrink-0 rounded-md border border-ava-purple/40 bg-ava-purple/10 px-4 py-1.5 text-[12px] text-ava-purple-light disabled:opacity-40">{t('todayLogMealAddButton')}</button>
      </div>
    </div>
  );
}

// ── utils ────────────────────────────────────────────────────────────────────

function targetSleepHours(profile: HealthProfile | null): number {
  const bed = parseHHMM(profile?.schedule.sleep_target.bedtime ?? null);
  const wake = parseHHMM(profile?.schedule.sleep_target.wake ?? null);
  if (bed == null || wake == null) return 8;
  let mins = wake - bed;
  if (mins <= 0) mins += 24 * 60;
  return mins / 60;
}
function proteinTarget(profile: HealthProfile | null): number | null {
  const kg = profile?.body.weight_kg;
  if (kg == null) return null;
  const goal = profile?.goals.primary;
  const factor = goal === 'muscle_gain' || goal === 'athletic' ? 2.0 : goal === 'fat_loss' ? 1.8 : 1.6;
  return Math.round(kg * factor);
}
function parseHHMM(s: string | null): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}
function fmtH(h: number): string { return `${Number(h.toFixed(1))}h`; }
function fmtWater(ml: number): string { return ml >= 1000 ? `${Number((ml / 1000).toFixed(1))}L` : `${ml}ml`; }
function round1(n: number): number { return Math.round(n * 10) / 10; }
function longDate(): string { return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }); }
function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Late one';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Winding down';
}
