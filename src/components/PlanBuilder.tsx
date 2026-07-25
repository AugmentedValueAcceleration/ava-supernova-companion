'use client';

// ─── Plan day builder (Phase 4a-ii) ─────────────────────────────────────────
//
// Open a plan → navigate its weeks/days → build each day: set it training /
// rest / recovery, title it, and add exercises + meals straight from the
// catalogue (the picker reuses /api/health/exercises + /recipes). Saves through
// the synced plan store on every edit.

import { useState, useCallback, useMemo, useEffect } from 'react';
import { t, useLocale } from '@/lib/i18n';
import { getPlan, savePlan } from '@/lib/health-plan-store';
import { healthCatalogApi } from '@/lib/api';
import { CustomSelect } from './CustomSelect';
import { CataloguePicker } from './CataloguePicker';
import type {
  HealthPlan, HealthPlanDay, HealthPlanExercise, HealthPlanMeal, ExerciseCard, RecipeCard,
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

function newId(p: string) { return crypto?.randomUUID?.() ?? `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

export function PlanBuilder({ planId, token, onBack, initialDay }: { planId: string; token?: string | null; onBack: () => void; initialDay?: number }) {
  useLocale();
  void token;
  const [plan, setPlanState] = useState<HealthPlan | null>(() => getPlan(planId));
  const [dayIndex, setDayIndex] = useState(initialDay ?? 1);
  const [picker, setPicker] = useState<null | 'exercise' | 'recipe'>(null);

  // Persist + keep local state in lockstep.
  const update = useCallback((mutate: (p: HealthPlan) => HealthPlan) => {
    setPlanState(prev => (prev ? savePlan(mutate(prev)) : prev));
  }, []);

  const showsTraining = plan?.type === 'fitness' || plan?.type === 'combined';
  const showsMeals = plan?.type === 'meal' || plan?.type === 'combined';
  const weeks = useMemo(() => plan ? Math.ceil(plan.duration_days / 7) : 0, [plan]);
  const day = plan?.days.find(d => d.day_index === dayIndex) ?? null;

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

  const addExercise = (e: ExerciseCard) => setDay(d => ({
    ...d,
    kind: d.kind === 'rest' ? 'training' : d.kind,
    training: [...d.training, { id: newId('ex'), ref: { kind: 'exercise', slug: e.slug }, name: e.name, sets: 3, reps: '8-12', weight: null, rest_seconds: 90, tempo: null, notes: null }],
  }));
  const addMeal = (r: RecipeCard) => setDay(d => ({
    ...d,
    meals: [...d.meals, { id: newId('ml'), slot: 'lunch', ref: { kind: 'recipe', slug: r.slug }, name: r.name, servings: 1, calories: null, protein_g: null, carbs_g: null, fat_g: null, notes: null }],
  }));

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

            {showsTraining && (
              <Group title={t('planBuilderTrainingSection')} onAdd={() => setPicker('exercise')}>
                {day.training.length === 0
                  ? <Empty>{t('planBuilderNoExercises')}</Empty>
                  : day.training.map(ex => <ExerciseRow key={ex.id} ex={ex}
                      onChange={patch => setDay(d => ({ ...d, training: d.training.map(x => x.id === ex.id ? { ...x, ...patch } : x) }))}
                      onRemove={() => setDay(d => ({ ...d, training: d.training.filter(x => x.id !== ex.id) }))} />)}
              </Group>
            )}

            {showsMeals && (
              <Group title={t('planBuilderMealsSection')} onAdd={() => setPicker('recipe')}>
                {day.meals.length === 0
                  ? <Empty>{t('planBuilderNoMeals')}</Empty>
                  : day.meals.map(ml => <MealRow key={ml.id} ml={ml}
                      onChange={patch => setDay(d => ({ ...d, meals: d.meals.map(x => x.id === ml.id ? { ...x, ...patch } : x) }))}
                      onRemove={() => setDay(d => ({ ...d, meals: d.meals.filter(x => x.id !== ml.id) }))} />)}
              </Group>
            )}

            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{t('planBuilderNotesLabel')}</div>
              <textarea value={day.notes ?? ''} onChange={e => setDay(d => ({ ...d, notes: e.target.value || null }))} rows={2}
                className="w-full bg-ava-surface border border-ava-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-ava-purple focus:outline-none resize-none" />
            </div>
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

function Group({ title, onAdd, children }: { title: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] uppercase tracking-wider text-gray-500">{title}</h3>
        <button onClick={onAdd} className="rounded-full border border-ava-purple/40 bg-ava-purple/10 px-3 py-1 text-[11px] text-ava-purple-light">{t('planBuilderGroupAddButton')}</button>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-ava-border px-3 py-3 text-[12px] text-gray-500 italic">{children}</div>;
}

const cellCls = 'bg-ava-bg border border-ava-border rounded px-2 py-1 text-[12px] text-white w-full focus:border-ava-purple focus:outline-none';

function ExerciseRow({ ex, onChange, onRemove }: { ex: HealthPlanExercise; onChange: (p: Partial<HealthPlanExercise>) => void; onRemove: () => void }) {
  const numOrNull = (s: string) => { const n = Number(s); return s.trim() && Number.isFinite(n) ? n : null; };
  return (
    <div className="rounded-lg border border-ava-border bg-ava-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-white truncate">{ex.name}</span>
        <button onClick={onRemove} className="text-gray-500 hover:text-red-300 text-lg leading-none">×</button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        <Cell label={t('planBuilderExerciseSetsLabel')}><input inputMode="numeric" value={ex.sets ?? ''} onChange={e => onChange({ sets: numOrNull(e.target.value) })} className={cellCls} /></Cell>
        <Cell label={t('planBuilderExerciseRepsLabel')}><input value={ex.reps ?? ''} onChange={e => onChange({ reps: e.target.value || null })} className={cellCls} /></Cell>
        <Cell label={t('planBuilderExerciseWeightLabel')}><input value={ex.weight ?? ''} onChange={e => onChange({ weight: e.target.value || null })} className={cellCls} /></Cell>
        <Cell label={t('planBuilderExerciseRestLabel')}><input inputMode="numeric" value={ex.rest_seconds ?? ''} onChange={e => onChange({ rest_seconds: numOrNull(e.target.value) })} className={cellCls} /></Cell>
      </div>
    </div>
  );
}

function MealRow({ ml, onChange, onRemove }: { ml: HealthPlanMeal; onChange: (p: Partial<HealthPlanMeal>) => void; onRemove: () => void }) {
  const numOrNull = (s: string) => { const n = Number(s); return s.trim() && Number.isFinite(n) ? n : null; };
  return (
    <div className="rounded-lg border border-ava-border bg-ava-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-white truncate">{ml.name}</span>
        <button onClick={onRemove} className="text-gray-500 hover:text-red-300 text-lg leading-none">×</button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <CustomSelect
          value={ml.slot}
          onChange={v => onChange({ slot: v as HealthPlanMeal['slot'] })}
          options={MEAL_SLOTS.map(s => ({ value: s, label: mealSlotLabel(s) }))}
          className="w-32 shrink-0"
        />
        <Cell label={t('planBuilderMealServingsLabel')}><input inputMode="decimal" value={ml.servings ?? ''} onChange={e => onChange({ servings: numOrNull(e.target.value) })} className={cellCls} /></Cell>
      </div>
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[9px] uppercase tracking-wider text-gray-600 mb-0.5">{label}</span>{children}</label>;
}

