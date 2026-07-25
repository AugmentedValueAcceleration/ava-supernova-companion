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
import { planExerciseFrom, planMealFrom, rescaleMeal, dayInsights, dateForPlanDay } from '@/lib/health-plan-insights';
import type { DayInsights, ExerciseInsight, MealInsight } from '@/lib/health-plan-insights';
import type { BalanceFinding } from '@/lib/health-balance';
import { CustomSelect } from './CustomSelect';
import { CataloguePicker } from './CataloguePicker';
import { SwapSheet } from './SwapSheet';
import { DuplicateSheet } from './DuplicateSheet';
import { AssistSheet } from './AssistSheet';
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
  const [duplicating, setDuplicating] = useState(false);
  const [assisting, setAssisting] = useState(false);

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
        row = detail ? planMealFrom(detail, { level: profile?.kitchen?.level ?? null }) : null;
      } catch { row = null; }
      row ??= planMealFrom({ slug: r.slug, name: r.name, versions: [] } as unknown as RecipeDetail);
      setDay(d => ({ ...d, meals: [...d.meals, row] }));
    } finally { setAdding(false); }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full pb-28">
        <BackBar onBack={onBack} title={plan.title} subtitle={`${plan.type} · ${plan.duration_days <= 1 ? '1 day' : `${Math.round(plan.duration_days / 7)} weeks`}`} />

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

            {showsTraining && (
              <Group title={t('planBuilderTrainingSection')} onAdd={() => setPicker('exercise')} busy={adding}>
                {day.training.length === 0
                  ? <Empty>{t('planBuilderNoExercises')}</Empty>
                  : day.training.map(ex => <ExerciseRow key={ex.id} ex={ex}
                      insight={insights?.exercises.find(i => i.exercise.id === ex.id) ?? null}
                      onSwap={ex.ref?.slug ? () => setSwapping({ kind: 'exercise', row: ex }) : null}
                      onChange={patch => setDay(d => ({ ...d, training: d.training.map(x => x.id === ex.id ? { ...x, ...patch } : x) }))}
                      onRemove={() => setDay(d => ({ ...d, training: d.training.filter(x => x.id !== ex.id) }))} />)}
              </Group>
            )}

            {showsTraining && insights && <Findings findings={[...insights.order, ...insights.week]} />}

            {showsMeals && (
              <Group title={t('planBuilderMealsSection')} onAdd={() => setPicker('recipe')} busy={adding}>
                {day.meals.length === 0
                  ? <Empty>{t('planBuilderNoMeals')}</Empty>
                  : day.meals.map(ml => <MealRow key={ml.id} ml={ml}
                      insight={insights?.meals.find(i => i.meal.id === ml.id) ?? null}
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

function BackBar({ onBack, title, subtitle }: { onBack: () => void; title: string; subtitle?: string }) {
  return (
    <div className="sticky top-0 z-10 bg-ava-bg/95 backdrop-blur border-b border-ava-border px-4 py-3 flex items-center gap-3">
      <button onClick={onBack} className="text-gray-300 hover:text-white"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg></button>
      <div className="min-w-0">
        <div className="text-white text-sm font-medium truncate">{title}</div>
        {subtitle && <div className="text-[11px] text-gray-500 capitalize">{subtitle}</div>}
      </div>
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

function ExerciseRow({ ex, insight, onSwap, onChange, onRemove }: {
  ex: HealthPlanExercise; insight: ExerciseInsight | null;
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
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-white truncate">{ex.name}</span>
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

function MealRow({ ml, insight, onSwap, onChange, onServings, onRemove }: {
  ml: HealthPlanMeal; insight: MealInsight | null;
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
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-white truncate">{ml.name}</span>
        <div className="flex items-center gap-2 shrink-0">
          {onSwap && <SwapButton onClick={onSwap} />}
          <button onClick={onRemove} className="text-gray-500 hover:text-red-300 text-lg leading-none">×</button>
        </div>
      </div>

      {/* Per-serving macros come from the library, so they update as servings do. */}
      {ml.calories != null && (
        <div className="mt-1 text-[11px] text-gray-500 tabular-nums">
          {Math.round(ml.calories)} kcal
          {ml.protein_g != null && ` · ${Math.round(ml.protein_g)}g ${t('planBuilderMacroProtein').toLowerCase()}`}
          {ml.meta?.total_time_minutes != null && ` · ${ml.meta.total_time_minutes} min`}
        </div>
      )}

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

