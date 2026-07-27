'use client';

// ─── Plan day builder (Phase 4a-ii) ─────────────────────────────────────────
//
// Open a plan → navigate its weeks/days → build each day: set it training /
// rest / recovery, title it, and add exercises + meals straight from the
// catalogue (the picker reuses /api/health/exercises + /recipes). Saves through
// the synced plan store on every edit.
//
// The builder now runs the same intelligence the generator does. Generation
// filters its pools so an unsafe choice is never offered; someone building by
// hand picks from the whole catalogue, so instead it tells them — a
// contraindication against their own profile, a day that misses its calorie
// target, a week with four presses and no hinge, a Tuesday recipe that needs
// longer than they said they have.
//
// It advises and never blocks. Someone composing by hand has reasons.

import { useState, useCallback, useMemo, useEffect } from 'react';
import { t, useLocale } from '@/lib/i18n';
import { getPlan, savePlan } from '@/lib/health-plan-store';
import { loadProfile, PROFILE_CHANGED_EVENT } from '@/lib/health-profile-store';
import { healthCatalogApi } from '@/lib/api';
import { planExerciseFrom, planMealFrom, rescaleMeal, dayInsights, dateForPlanDay, groupSession, mealsInOrder } from '@/lib/health-plan-insights';
import type { SessionGroupKey } from '@/lib/health-plan-insights';
import type { DayInsights, ExerciseInsight, MealInsight } from '@/lib/health-plan-insights';
import type { BalanceFinding } from '@/lib/health-balance';
import { CustomSelect } from './CustomSelect';
import { CataloguePicker } from './CataloguePicker';
import { SwapSheet } from './SwapSheet';
import { DuplicateSheet } from './DuplicateSheet';
import { AssistSheet } from './AssistSheet';
import { ShoppingListSheet } from './ShoppingListSheet';
import { PrepSheet } from './PrepSheet';
import { LibraryThumb } from './LibraryThumb';
import { ExerciseDetailView, RecipeDetailView } from './CatalogDetail';
import { useLibraryImages } from '@/lib/use-library-images';
import type {
  HealthPlan, HealthPlanDay, HealthPlanExercise, HealthPlanMeal, ExerciseCard, RecipeCard,
  HealthProfile, ExerciseDetail, RecipeDetail,
} from '@/lib/health-types';

const MEAL_SLOTS: HealthPlanMeal['slot'][] = ['breakfast', 'lunch', 'dinner', 'snack'];

function kindLabel(k: HealthPlanDay['kind']): string {
  switch (k) {
    case 'training':         return t('planBuilderTrainingKind');
    case 'active_recovery':  return t('planBuilderRecoveryKind');
    case 'rest':             return t('planBuilderRestKind');
  }
}

function sessionGroupLabel(k: SessionGroupKey): string {
  switch (k) {
    case 'warmup':    return t('sessionGroupWarmup');
    case 'main':      return t('sessionGroupMain');
    case 'accessory': return t('sessionGroupAccessory');
    case 'finisher':  return t('sessionGroupFinisher');
    case 'cooldown':  return t('sessionGroupCooldown');
    case 'other':     return '';
  }
}

function mealSlotLabel(s: HealthPlanMeal['slot']): string {
  switch (s) {
    case 'breakfast': return t('planBuilderMealBreakfast');
    case 'lunch':     return t('planBuilderMealLunch');
    case 'dinner':    return t('planBuilderMealDinner');
    case 'snack':     return t('planBuilderMealSnack');
  }
}

const KINDS: HealthPlanDay['kind'][] = ['training', 'active_recovery', 'rest'];

export function PlanBuilder({ planId, token, onBack, initialDay }: { planId: string; token?: string | null; onBack: () => void; initialDay?: number }) {
  useLocale();
  const [plan, setPlanState] = useState<HealthPlan | null>(() => getPlan(planId));
  const [dayIndex, setDayIndex] = useState(initialDay ?? 1);
  const [picker, setPicker] = useState<null | 'exercise' | 'recipe'>(null);
  const [adding, setAdding] = useState(false);
  const [swapping, setSwapping] = useState<null | { kind: 'exercise' | 'recipe'; row: HealthPlanExercise | HealthPlanMeal }>(null);
  // Looking something up. A plan row names an exercise and prescribes numbers,
  // but "3×8-12 Bulgarian Split Squat" is only useful to someone who already
  // knows what that is — and the library has the technique guide, the cues and
  // the demonstration sitting behind the slug the row is already carrying.
  const [viewing, setViewing] = useState<null | { kind: 'exercise' | 'recipe'; slug: string }>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [assisting, setAssisting] = useState(false);
  // The plan's whole point, for anyone following the food half of it: what to
  // buy. Offered from the plan rather than from a day, because you shop for a
  // week and cook for a day.
  const [shopping, setShopping] = useState(false);
  // What the week costs in evenings — the heavy days, what needs starting the
  // night before, and where cooking once would cover three meals.
  const [prepping, setPrepping] = useState(false);

  // The profile is what every check is measured against. Kept live so editing
  // an injury on the profile tab updates the warnings here without a reload.
  const [profile, setProfile] = useState<HealthProfile | null>(() => loadProfile());
  useEffect(() => {
    const refresh = () => setProfile(loadProfile());
    window.addEventListener(PROFILE_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PROFILE_CHANGED_EVENT, refresh);
  }, []);

  // Persist + keep local state in lockstep.
  const update = useCallback((mutate: (p: HealthPlan) => HealthPlan) => {
    setPlanState(prev => (prev ? savePlan(mutate(prev)) : prev));
  }, []);

  const showsTraining = plan?.type === 'fitness' || plan?.type === 'combined';
  const showsMeals = plan?.type === 'meal' || plan?.type === 'combined';
  const weeks = useMemo(() => plan ? Math.ceil(plan.duration_days / 7) : 0, [plan]);
  const day = plan?.days.find(d => d.day_index === dayIndex) ?? null;

  // Every judgement the builder can make about this day. Recomputed on any
  // edit — that immediacy is the point: you see the day go over its target as
  // you add the meal that takes it over.
  const insights: DayInsights | null = useMemo(
    () => (plan && day ? dayInsights(plan, day, profile, dateForPlanDay(plan, day.day_index)) : null),
    [plan, day, profile],
  );

  // Pictures for this day's rows. Batched into one request and cached for the
  // session, so paging through a week does not re-ask for the same squat.
  const images = useLibraryImages(
    day?.training.map(e => e.ref?.slug) ?? [],
    day?.meals.map(m => m.ref?.slug) ?? [],
  );

  // Full-screen, matching how the catalogue opens a detail — back returns to
  // exactly the day you were editing, because the builder's state is untouched.
  if (viewing?.kind === 'exercise') {
    return <ExerciseDetailView slug={viewing.slug} onBack={() => setViewing(null)} />;
  }
  if (viewing?.kind === 'recipe') {
    return <RecipeDetailView slug={viewing.slug} onBack={() => setViewing(null)} />;
  }

  if (!plan) {
    return (
      <div className="flex-1 flex flex-col">
        <BackBar onBack={onBack} title={t('planBuilderBackTitle')} />
        <div className="flex-1 flex items-center justify-center text-sm text-gray-500">{t('planBuilderNotFound')}</div>
      </div>
    );
  }

  const setDay = (mutate: (d: HealthPlanDay) => HealthPlanDay) =>
    update(p => ({ ...p, days: p.days.map(d => d.day_index === dayIndex ? mutate(d) : d) }));

  // Adding pulls the full catalogue entry, not just the card.
  //
  // The card carries a name and a slug; every fact the checks need — movement
  // pattern, contraindications, macros, cooking time — is on the detail. Fetch
  // it once here and store it on the plan row, and the day can then be judged
  // with no network at all, on a train, a year later, even if the library entry
  // has since changed. It also seeds sets/reps from the library's own
  // prescription instead of a hardcoded 3×8-12.
  //
  // If the fetch fails the item is still added, just without the extras — a
  // dropped connection should not stop someone writing their plan.
  const addExercise = async (e: ExerciseCard) => {
    setAdding(true);
    try {
      let row;
      try {
        const res = await healthCatalogApi.exercise(e.slug);
        const detail = res?.exercise as ExerciseDetail | undefined;
        row = detail ? planExerciseFrom(detail) : null;
      } catch { row = null; }
      row ??= planExerciseFrom({ slug: e.slug, name: e.name, routine: {} } as ExerciseDetail);
      setDay(d => ({
        ...d,
        kind: d.kind === 'rest' ? 'training' : d.kind,
        training: [...d.training, row],
      }));
    } finally { setAdding(false); }
  };

  const addMeal = async (r: RecipeCard) => {
    setAdding(true);
    try {
      let row;
      try {
        const res = await healthCatalogApi.recipe(r.slug);
        const detail = res?.recipe as RecipeDetail | undefined;
        // Servings is what YOU eat, not what the household cooks: planMealFrom
        // scales macros by it, so setting it to a household of four would
        // multiply the day's calories by four against a target meant for one
        // person. Household belongs to the shopping list, which is the only
        // place it means "how much food to buy".
        row = detail ? planMealFrom(detail, { level: profile?.kitchen?.level ?? null }) : null;
      } catch { row = null; }
      row ??= planMealFrom({ slug: r.slug, name: r.name, versions: [] } as unknown as RecipeDetail);
      setDay(d => ({ ...d, meals: [...d.meals, row] }));
    } finally { setAdding(false); }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full pb-28">
        <BackBar
          onBack={onBack}
          title={plan.title}
          subtitle={`${plan.type} · ${plan.duration_days <= 1 ? '1 day' : `${Math.round(plan.duration_days / 7)} weeks`}`}
          // Only when there is food to shop for. A training-only plan has no
          // use for it and an empty button is a dead end.
          action={plan.days.some(d => d.meals.length > 0) ? (
            <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPrepping(true)}
              aria-label={t('prepTitle')}
              className="flex items-center gap-1.5 rounded-full border border-ava-border px-3 py-1.5 text-[11px] text-gray-300 active:scale-95"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('prepTitle')}
            </button>
            <button
              onClick={() => setShopping(true)}
              aria-label={t('shoppingListTitle')}
              className="flex items-center gap-1.5 rounded-full border border-ava-border px-3 py-1.5 text-[11px] text-gray-300 active:scale-95"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12A1.125 1.125 0 0 1 19.75 21.75H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z" />
              </svg>
              {t('shoppingListTitle')}
            </button>
            </div>
          ) : undefined}
        />

        {/* Day navigator */}
        <div className="px-4 py-3 border-b border-ava-border">
          {weeks > 1 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-2">
              {Array.from({ length: weeks }, (_, w) => {
                const inWeek = dayIndex > w * 7 && dayIndex <= (w + 1) * 7;
                return <button key={w} onClick={() => setDayIndex(w * 7 + 1)} className={`shrink-0 rounded-full px-3 py-1 text-[11px] border ${inWeek ? 'border-ava-purple/25 bg-ava-purple/15 text-ava-purple' : 'border-ava-border text-gray-400'}`}>{t('planBuilderWeekLabel')} {w + 1}</button>;
              })}
            </div>
          )}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {plan.days.filter(d => d.day_index > Math.floor((dayIndex - 1) / 7) * 7 && d.day_index <= Math.floor((dayIndex - 1) / 7) * 7 + 7).map(d => {
              const has = d.training.length > 0 || d.meals.length > 0;
              return (
                <button key={d.day_index} onClick={() => setDayIndex(d.day_index)}
                  className={`shrink-0 w-10 h-10 rounded-lg text-[11px] flex flex-col items-center justify-center border ${d.day_index === dayIndex ? 'border-ava-purple/25 bg-ava-purple/15 text-ava-purple' : 'border-ava-border text-gray-400'}`}>
                  {d.day_index}
                  {has && <span className="mt-0.5 h-1 w-1 rounded-full bg-current opacity-70" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day editor */}
        {day && (
          <div className="px-4 py-4 space-y-5">
            <div className="flex gap-2">
              {KINDS.map(k => (
                <button key={k} onClick={() => setDay(d => ({ ...d, kind: k }))}
                  className={`flex-1 rounded-lg border py-2 text-xs ${day.kind === k ? 'border-ava-purple bg-ava-purple/10 text-ava-purple-light' : 'border-ava-border text-gray-400'}`}>{kindLabel(k)}</button>
              ))}
            </div>

            <input value={day.title ?? ''} onChange={e => setDay(d => ({ ...d, title: e.target.value || null }))}
              placeholder={t('planBuilderDayTitlePlaceholder')}
              className="w-full bg-ava-surface border border-ava-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-ava-purple focus:outline-none" />

            {/* Ava, for the parts of this day you want help with. Near the top
                because on an empty day it is the fastest way to start, and it
                proposes rather than replaces so it is safe on a full one. */}
            <button
              onClick={() => setAssisting(true)}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-ava-purple/40 bg-ava-purple/10 py-2 text-[12px] text-ava-purple-light"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
              </svg>
              {day.training.length === 0 && day.meals.length === 0
                ? t('planBuilderAskAvaEmpty')
                : t('planBuilderAskAva')}
            </button>

            {showsMeals && insights && <DayNutrition insights={insights} />}

            {/* A rest day is something the plan CHOSE. Saying so where the
                exercise list would be stops it reading as an unfinished day. */}
            {day.kind === 'rest' && day.training.length === 0 && (
              <div className="flex items-center gap-2.5 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2.5">
                <svg className="w-4 h-4 shrink-0 text-sky-300/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                </svg>
                <div className="min-w-0">
                  <div className="text-[12px] text-sky-100/90">{t('todayRestDayTitle')}</div>
                  <div className="text-[11px] text-gray-400 leading-snug">{t('planBuilderRestDayHint')}</div>
                </div>
              </div>
            )}

            {/* Active recovery is NOT a lighter training day, and the builder
                treated it as one — same heading, same section, nothing to tell
                them apart but the word on the button. It is a deliberate day of
                easy movement: mobility, a walk, stretching. Saying so is the
                difference between a recovery day someone respects and one they
                quietly turn into another session. */}
            {day.kind === 'active_recovery' && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-[11px] text-gray-400 leading-snug">
                <span className="text-emerald-100/90">{t('planBuilderRecoveryKind')}</span>{' — '}
                {t('planBuilderRecoveryHint')}
              </div>
            )}

            {showsTraining && day.kind !== 'rest' && (
              <Group
                title={day.kind === 'active_recovery' ? t('planBuilderRecoverySection') : t('planBuilderTrainingSection')}
                onAdd={() => setPicker('exercise')}
                busy={adding}
              >
                {day.training.length === 0
                  ? <Empty>{t('planBuilderNoExercises')}</Empty>
                  // Grouped by the job each exercise does — warm up, the hard
                  // thing, the supporting work, finish. The library records the
                  // role; rendering one flat list threw it away and made a
                  // well-ordered session look like a pile. Order INSIDE a group
                  // is the author's and is never rearranged.
                  : groupSession(day.training).map(group => (
                      <div key={group.key} className="space-y-2">
                        {group.key !== 'other' && (
                          <div className="text-[9px] uppercase tracking-wider text-gray-600 pt-1">
                            {sessionGroupLabel(group.key)}
                          </div>
                        )}
                        {group.items.map(ex => <ExerciseRow key={ex.id} ex={ex}
                          image={images.exercise(ex.ref?.slug)}
                          insight={insights?.exercises.find(i => i.exercise.id === ex.id) ?? null}
                          onView={ex.ref?.slug ? () => setViewing({ kind: 'exercise', slug: ex.ref!.slug }) : null}
                          onSwap={ex.ref?.slug ? () => setSwapping({ kind: 'exercise', row: ex }) : null}
                          onChange={patch => setDay(d => ({ ...d, training: d.training.map(x => x.id === ex.id ? { ...x, ...patch } : x) }))}
                          onRemove={() => setDay(d => ({ ...d, training: d.training.filter(x => x.id !== ex.id) }))} />)}
                      </div>
                    ))}
              </Group>
            )}

            {showsTraining && day.kind !== 'rest' && insights && <Findings findings={[...insights.order, ...insights.week]} />}

            {showsMeals && (
              <Group title={t('planBuilderMealsSection')} onAdd={() => setPicker('recipe')} busy={adding}>
                {day.meals.length === 0
                  ? <Empty>{t('planBuilderNoMeals')}</Empty>
                  // In eating order, each carrying the running total to that
                  // point — "700 kcal" says nothing, "1,850 of 2,195 by dinner"
                  // tells you whether the snack is needed.
                  : mealsInOrder(day.meals).map(({ meal: ml, runningCalories }) => <MealRow key={ml.id} ml={ml}
                      image={images.recipe(ml.ref?.slug)}
                      running={runningCalories}
                      target={insights?.targets.target_calories ?? null}
                      insight={insights?.meals.find(i => i.meal.id === ml.id) ?? null}
                      onView={ml.ref?.slug ? () => setViewing({ kind: 'recipe', slug: ml.ref!.slug }) : null}
                      onSwap={ml.ref?.slug ? () => setSwapping({ kind: 'recipe', row: ml }) : null}
                      onChange={patch => setDay(d => ({ ...d, meals: d.meals.map(x => x.id === ml.id ? { ...x, ...patch } : x) }))}
                      onServings={v => setDay(d => ({ ...d, meals: d.meals.map(x => x.id === ml.id ? rescaleMeal(x, v) : x) }))}
                      onRemove={() => setDay(d => ({ ...d, meals: d.meals.filter(x => x.id !== ml.id) }))} />)}
              </Group>
            )}

            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{t('planBuilderNotesLabel')}</div>
              <textarea value={day.notes ?? ''} onChange={e => setDay(d => ({ ...d, notes: e.target.value || null }))} rows={2}
                className="w-full bg-ava-surface border border-ava-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-ava-purple focus:outline-none resize-none" />
            </div>

            {/* Copying is only worth offering once there is something to copy. */}
            {(day.training.length > 0 || day.meals.length > 0) && (
              <button
                onClick={() => setDuplicating(true)}
                className="w-full rounded-lg border border-ava-border py-2 text-[12px] text-gray-400 hover:text-white hover:border-ava-purple/40"
              >
                {t('planBuilderDuplicateButton')}
              </button>
            )}
          </div>
        )}
      </div>

      {picker && (
        <CataloguePicker
          kind={picker}
          onClose={() => setPicker(null)}
          onPick={(item) => { if (picker === 'exercise') addExercise(item as ExerciseCard); else addMeal(item as RecipeCard); setPicker(null); }}
        />
      )}

      {swapping && (
        <SwapSheet
          plan={plan}
          kind={swapping.kind}
          row={swapping.row}
          dayIndex={dayIndex}
          profile={profile}
          onApply={next => setPlanState(savePlan(next))}
          onClose={() => setSwapping(null)}
        />
      )}

      {duplicating && day && (
        <DuplicateSheet
          plan={plan}
          fromDay={day.day_index}
          onApply={next => setPlanState(savePlan(next))}
          onClose={() => setDuplicating(false)}
        />
      )}

      {prepping && (
        <PrepSheet plan={plan} profile={profile} onClose={() => setPrepping(false)} />
      )}

      {shopping && (
        <ShoppingListSheet
          source={{ kind: 'plan', plan }}
          // The sheet fills in ingredients the plan never captured and saves
          // them; take the filled copy so this screen is not left holding the
          // version without them.
          onPlanFilled={setPlanState}
          onClose={() => setShopping(false)}
        />
      )}

      {assisting && day && (
        <AssistSheet
          plan={plan}
          day={day}
          token={token ?? null}
          profile={profile}
          // Ava's day replaces THIS day only, and only once accepted. The
          // day_index is forced back because the plan's own numbering is the
          // truth, not whatever came back over the wire.
          onApply={next => setPlanState(savePlan({
            ...plan,
            days: plan.days.map(d =>
              d.day_index === day.day_index ? { ...next, day_index: d.day_index, completion: d.completion ?? null } : d),
          }))}
          onClose={() => setAssisting(false)}
        />
      )}
    </div>
  );
}

function BackBar({ onBack, title, subtitle, action }: {
  onBack: () => void; title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 bg-ava-bg/95 backdrop-blur border-b border-ava-border px-4 py-3 flex items-center gap-3">
      <button onClick={onBack} className="text-gray-300 hover:text-white"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg></button>
      <div className="min-w-0">
        <div className="text-white text-sm font-medium truncate">{title}</div>
        {subtitle && <div className="text-[11px] text-gray-500 capitalize">{subtitle}</div>}
      </div>
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </div>
  );
}

function Group({ title, onAdd, busy, children }: { title: string; onAdd: () => void; busy?: boolean; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] uppercase tracking-wider text-gray-500">{title}</h3>
        <button onClick={onAdd} disabled={busy}
          className="rounded-full border border-ava-purple/40 bg-ava-purple/10 px-3 py-1 text-[11px] text-ava-purple-light disabled:opacity-50">
          {busy ? t('planBuilderGroupAdding') : t('planBuilderGroupAddButton')}
        </button>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

// ── Advisories ──────────────────────────────────────────────────────────────
//
// One visual language for everything the builder wants to say, so severity
// reads at a glance without anyone learning a legend: amber warns, grey
// informs. Nothing is red — red says "you cannot", and here you always can.

function Note({ tone = 'info', children }: { tone?: 'warn' | 'info'; children: React.ReactNode }) {
  const cls = tone === 'warn'
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-200/90'
    : 'border-ava-border bg-ava-bg text-gray-400';
  return <div className={`rounded-md border px-2 py-1.5 text-[11px] leading-snug ${cls}`}>{children}</div>;
}

function Findings({ findings }: { findings: BalanceFinding[] }) {
  if (findings.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {findings.map((f, i) => (
        <Note key={`${f.kind}-${i}`} tone={f.severity === 'warn' ? 'warn' : 'info'}>{f.message}</Note>
      ))}
    </div>
  );
}

/**
 * The day's nutrition against the day's target.
 *
 * A bar rather than a number, because "2,400 kcal" means nothing on its own and
 * "just over" means everything. When there is no target — no weight or height
 * on the profile — it shows the totals and says why it can't judge them, rather
 * than quietly showing nothing.
 */
function DayNutrition({ insights }: { insights: DayInsights }) {
  const { macros, targets, calorieVerdict, proteinVerdict, cookingMinutes } = insights;
  const target = targets.target_calories;
  const pct = target ? Math.min(140, Math.round((macros.calories / target) * 100)) : 0;
  const over = calorieVerdict?.ok === false && calorieVerdict.delta > 0;
  const under = calorieVerdict?.ok === false && calorieVerdict.delta < 0;

  return (
    <section className="rounded-lg border border-ava-border bg-ava-surface p-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[10px] uppercase tracking-wider text-gray-500">{t('planBuilderNutritionSection')}</h3>
        {cookingMinutes != null && (
          <span className="text-[10px] text-gray-500">{cookingMinutes} {t('planBuilderCookingTotal')}</span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-xl text-white tabular-nums">{Math.round(macros.calories)}</span>
        <span className="text-[11px] text-gray-500">
          {target ? `${t('planBuilderKcalOf')} ${target}` : t('planBuilderKcalPlanned')}
        </span>
      </div>

      {target != null && (
        <div className="mt-1.5 h-1.5 rounded-full bg-ava-bg overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${over ? 'bg-amber-400/70' : under ? 'bg-sky-400/60' : 'bg-ava-purple/70'}`}
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        </div>
      )}

      <div className="mt-2 flex gap-3 text-[11px] text-gray-400 tabular-nums">
        <span>{t('planBuilderMacroProtein')} {Math.round(macros.protein_g)}g{targets.target_protein_g ? ` / ${targets.target_protein_g}g` : ''}</span>
        <span>{t('planBuilderMacroCarbs')} {Math.round(macros.carbs_g)}g</span>
        <span>{t('planBuilderMacroFat')} {Math.round(macros.fat_g)}g</span>
      </div>

      <div className="mt-2 space-y-1.5">
        {calorieVerdict?.ok === false && <Note tone="warn">{calorieVerdict.message}</Note>}
        {proteinVerdict?.ok === false && <Note tone="warn">{proteinVerdict.message}</Note>}
        {target == null && targets.missing.length > 0 && (
          <Note>{t('planBuilderNoTargetYet')} {targets.missing.join(', ')}</Note>
        )}
      </div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-ava-border px-3 py-3 text-[12px] text-gray-500 italic">{children}</div>;
}

const cellCls = 'bg-ava-bg border border-ava-border rounded px-2 py-1 text-[12px] text-white w-full focus:border-ava-purple focus:outline-none';

function ExerciseRow({ ex, image, insight, onView, onSwap, onChange, onRemove }: {
  ex: HealthPlanExercise; image: string | null; insight: ExerciseInsight | null;
  /** Null for a free-text row — there is no library entry to open. */
  onView: (() => void) | null;
  onSwap: (() => void) | null;
  onChange: (p: Partial<HealthPlanExercise>) => void; onRemove: () => void;
}) {
  const numOrNull = (s: string) => { const n = Number(s); return s.trim() && Number.isFinite(n) ? n : null; };
  const findings = insight?.check.findings ?? [];
  const missing = insight?.check.missing_equipment ?? [];
  // 'avoid' means the library says not with this condition. Border it so it is
  // visible before you read a word of the warning.
  const avoid = findings.some(f => f.severity === 'avoid');
  return (
    <div className={`rounded-lg border bg-ava-surface p-3 ${avoid ? 'border-amber-500/40' : 'border-ava-border'}`}>
      <div className="flex items-center gap-2.5">
        {/* The picture and the name open the library entry — the technique
            guide, the cues, the demonstration. A row that says "3×8-12
            Bulgarian Split Squat" is only useful to someone who already knows
            what that is, and the answer was one tap away behind a slug the row
            was already carrying. */}
        {onView ? (
          <button onClick={onView} className="flex items-center gap-2.5 min-w-0 flex-1 text-left group">
            <LibraryThumb src={image} kind="exercise" alt={ex.name} />
            <span className="flex-1 min-w-0 text-sm text-white truncate group-hover:text-ava-purple-light">{ex.name}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <LibraryThumb src={image} kind="exercise" alt={ex.name} />
            <span className="flex-1 min-w-0 text-sm text-white truncate">{ex.name}</span>
          </div>
        )}
        <div className="flex items-center gap-2 shrink-0">
          {/* Only offered on a library-linked row — there is nothing to find
              alternatives to for a free-text entry. */}
          {onSwap && <SwapButton onClick={onSwap} />}
          <button onClick={onRemove} className="text-gray-500 hover:text-red-300 text-lg leading-none">×</button>
        </div>
      </div>

      {(findings.length > 0 || missing.length > 0) && (
        <div className="mt-2 space-y-1.5">
          {findings.map(f => (
            <Note key={f.condition} tone={f.severity === 'avoid' ? 'warn' : 'info'}>
              <span className="font-medium">
                {f.severity === 'avoid' ? t('planBuilderSafetyAvoid') : f.severity === 'modify' ? t('planBuilderSafetyModify') : t('planBuilderSafetyCaution')}
              </span>
              {` — ${f.condition} · ${t('planBuilderSafetyMatched')} ${f.matched}`}
              {f.note ? ` ${f.note}` : ''}
            </Note>
          ))}
          {missing.length > 0 && <Note>{t('planBuilderMissingKit')} {missing.join(', ')}</Note>}
        </div>
      )}

      <div className="mt-2 grid grid-cols-4 gap-2">
        <Cell label={t('planBuilderExerciseSetsLabel')}><input inputMode="numeric" value={ex.sets ?? ''} onChange={e => onChange({ sets: numOrNull(e.target.value) })} className={cellCls} /></Cell>
        <Cell label={t('planBuilderExerciseRepsLabel')}><input value={ex.reps ?? ''} onChange={e => onChange({ reps: e.target.value || null })} className={cellCls} /></Cell>
        <Cell label={t('planBuilderExerciseWeightLabel')}><input value={ex.weight ?? ''} onChange={e => onChange({ weight: e.target.value || null })} className={cellCls} /></Cell>
        <Cell label={t('planBuilderExerciseRestLabel')}><input inputMode="numeric" value={ex.rest_seconds ?? ''} onChange={e => onChange({ rest_seconds: numOrNull(e.target.value) })} className={cellCls} /></Cell>
      </div>
    </div>
  );
}

function MealRow({ ml, image, running, target, insight, onView, onSwap, onChange, onServings, onRemove }: {
  ml: HealthPlanMeal; image: string | null; insight: MealInsight | null;
  /** Calories to this point in the day, including this meal. */
  running: number;
  target: number | null;
  /** Null for a free-text row — there is no recipe to open. */
  onView: (() => void) | null;
  onSwap: (() => void) | null;
  onChange: (p: Partial<HealthPlanMeal>) => void;
  onServings: (v: number | null) => void;
  onRemove: () => void;
}) {
  const numOrNull = (s: string) => { const n = Number(s); return s.trim() && Number.isFinite(n) ? n : null; };
  const blocked = insight?.blocked_allergens ?? [];
  const unverifiable = insight?.unverifiable ?? [];
  const offDiet = insight?.off_diet ?? [];
  return (
    <div className={`rounded-lg border bg-ava-surface p-3 ${blocked.length ? 'border-amber-500/40' : 'border-ava-border'}`}>
      <div className="flex items-center gap-2.5">
        {/* Tapping opens the recipe — ingredients, method, the three skill
            levels. "Chicken Satay, 520 kcal" is a line in a plan; the thing you
            actually need at six o'clock is how to cook it. */}
        <button
          onClick={onView ?? undefined}
          disabled={!onView}
          className="flex items-center gap-2.5 min-w-0 flex-1 text-left group disabled:cursor-default"
        >
          <LibraryThumb src={image} kind="recipe" alt={ml.name} />
        <div className="flex-1 min-w-0">
          <div className={`text-sm text-white truncate ${onView ? 'group-hover:text-ava-purple-light' : ''}`}>{ml.name}</div>
          {/* Macros come from the library, so they follow the servings. Sits
              under the name now rather than below the whole row, so the
              picture, the dish and its numbers read as one thing. */}
          {ml.calories != null && (
            <div className="text-[11px] text-gray-500 tabular-nums truncate">
              {Math.round(ml.calories)} kcal
              {ml.protein_g != null && ` · ${Math.round(ml.protein_g)}g ${t('planBuilderMacroProtein').toLowerCase()}`}
              {ml.meta?.total_time_minutes != null && ` · ${ml.meta.total_time_minutes} min`}
            </div>
          )}
          </div>
        </button>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-2">
            {onSwap && <SwapButton onClick={onSwap} />}
            <button onClick={onRemove} className="text-gray-500 hover:text-red-300 text-lg leading-none">×</button>
          </div>
          {/* The running total to this point. This is the number that makes a
              target legible — you can see at dinner whether the snack is
              needed, instead of adding four figures up in your head. */}
          {running > 0 && (
            <span className="text-[10px] tabular-nums text-gray-600">
              {Math.round(running)}{target ? `/${target}` : ''}
            </span>
          )}
        </div>
      </div>

      {(blocked.length > 0 || unverifiable.length > 0 || offDiet.length > 0 || insight?.hint) && (
        <div className="mt-2 space-y-1.5">
          {blocked.length > 0 && <Note tone="warn">{t('planBuilderAllergenWarning')} {blocked.join(', ')}</Note>}
          {/* Said out loud rather than passed over. The library has no field for
              these, so the honest answer is that it cannot check — not silence,
              which would read as a clean result. */}
          {unverifiable.length > 0 && <Note>{t('planBuilderAllergenUnverifiable')} {unverifiable.join(', ')}</Note>}
          {offDiet.length > 0 && <Note>{t('planBuilderOffDiet')} {offDiet.join(', ')}</Note>}
          {insight?.hint && <Note>{insight.hint}</Note>}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <CustomSelect
          value={ml.slot}
          onChange={v => onChange({ slot: v as HealthPlanMeal['slot'] })}
          options={MEAL_SLOTS.map(s => ({ value: s, label: mealSlotLabel(s) }))}
          className="w-32 shrink-0"
        />
        <Cell label={t('planBuilderMealServingsLabel')}><input inputMode="decimal" value={ml.servings ?? ''} onChange={e => onServings(numOrNull(e.target.value))} className={cellCls} /></Cell>
      </div>
    </div>
  );
}

/** Two arrows crossing — the same idea as a refresh, but the exchange reading
 *  rather than the reload one, so it does not look like "reload this row". */
function SwapButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={t('swapSheetTitle')} title={t('swapSheetTitle')}
      className="text-gray-500 hover:text-ava-purple-light">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    </button>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[9px] uppercase tracking-wider text-gray-600 mb-0.5">{label}</span>{children}</label>;
}

