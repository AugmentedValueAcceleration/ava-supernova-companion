'use client';

// ─── Swap sheet ─────────────────────────────────────────────────────────────
//
// "Same again, but not that one — I tried it and I hated it."
//
// Three decisions in one sheet, in the order someone actually makes them:
//
//   1. what instead   — ranked alternatives that do the same job, each saying
//                       why it is offered, and anything the profile argues
//                       against shown last WITH its reason rather than hidden
//   2. where          — this day, or the other places it appears; days already
//                       completed are off by default, because changing your
//                       mind should not rewrite what you already did
//   3. the numbers    — carried or started fresh, decided from what actually
//                       changed and what you are training for, with the reason
//                       shown and the choice left with you
//
// Step 3 only appears when there is a genuine judgement to make. If the sheet
// has nothing useful to say about the numbers it does not ask.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { t, useLocale } from '@/lib/i18n';
import { healthCatalogApi } from '@/lib/api';
import { planExerciseFrom, planMealFrom } from '@/lib/health-plan-insights';
import {
  occurrencesOf, upcomingOccurrences, shouldCarryNumbers,
  rankExerciseAlternatives, rankRecipeAlternatives,
  applyExerciseSwap, applyMealSwap,
} from '@/lib/health-plan-swap';
import type {
  Occurrence, RankedExercise, RankedRecipe, CarryDecision,
} from '@/lib/health-plan-swap';
import type {
  HealthPlan, HealthProfile, HealthPlanExercise, HealthPlanMeal,
  ExerciseDetail, RecipeDetail,
} from '@/lib/health-types';

type Row = HealthPlanExercise | HealthPlanMeal;

export function SwapSheet({ plan, kind, row, dayIndex, profile, onApply, onClose }: {
  plan: HealthPlan;
  kind: 'exercise' | 'recipe';
  row: Row;
  dayIndex: number;
  profile: HealthProfile | null;
  onApply: (next: HealthPlan) => void;
  onClose: () => void;
}) {
  useLocale();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [candidates, setCandidates] = useState<Array<RankedExercise | RankedRecipe>>([]);
  const [pickedSlug, setPickedSlug] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  // Where this appears, and which of those the user wants changed.
  const occurrences = useMemo(
    () => occurrencesOf(plan, kind, { slug: row.ref?.slug ?? null, name: row.name }),
    [plan, kind, row],
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set([row.id]));

  const [carryOverride, setCarryOverride] = useState<CarryDecision | null>(null);

  useEffect(() => {
    let cancelled = false;
    const slug = row.ref?.slug;
    if (!slug) { setLoading(false); setFailed(true); return; }
    (async () => {
      try {
        const res = await healthCatalogApi.alternatives(kind, slug);
        if (cancelled) return;
        const pool = res?.candidates ?? [];
        // Ranked HERE, on the device, against the local profile — the server
        // never sees the injuries or allergens this is judged on.
        const ranked = kind === 'exercise'
          ? rankExerciseAlternatives(
              { slug, meta: (row as HealthPlanExercise).meta ?? null }, pool, profile)
          : rankRecipeAlternatives(
              {
                slug,
                course: (row as HealthPlanMeal).meta?.course ?? null,
                calories: (row as HealthPlanMeal).calories ?? null,
                meta: (row as HealthPlanMeal).meta ?? null,
              }, pool, profile);
        setCandidates(ranked);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [kind, row, profile]);

  const picked = candidates.find(c => c.slug === pickedSlug) ?? null;

  // What happens to the numbers, once something is picked. Exercises only —
  // a recipe carries no sets and reps to argue about.
  const verdict = useMemo(() => {
    if (kind !== 'exercise' || !picked) return null;
    return shouldCarryNumbers(
      (row as HealthPlanExercise).meta,
      (picked as RankedExercise).meta,
    );
  }, [kind, picked, row]);

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const selectAllUpcoming = useCallback(() => {
    setSelected(new Set(upcomingOccurrences(occurrences, dayIndex).map(o => o.row_id)));
  }, [occurrences, dayIndex]);

  const apply = async () => {
    if (!picked || selected.size === 0) return;
    setApplying(true);
    try {
      if (kind === 'exercise') {
        const res = await healthCatalogApi.exercise(picked.slug);
        const detail = res?.exercise as ExerciseDetail | undefined;
        if (!detail) throw new Error('no detail');
        const replacement = planExerciseFrom(detail);
        const decision = carryOverride
          ? { decision: carryOverride, reason: '' }
          : verdict ?? { decision: 'carry' as CarryDecision, reason: '' };
        onApply(applyExerciseSwap(plan, selected, replacement, decision, profile?.goals?.primary ?? null));
      } else {
        const res = await healthCatalogApi.recipe(picked.slug);
        const detail = res?.recipe as RecipeDetail | undefined;
        if (!detail) throw new Error('no detail');
        const replacement = planMealFrom(detail, { level: profile?.kitchen?.level ?? null });
        onApply(applyMealSwap(plan, selected, replacement));
      }
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setApplying(false);
    }
  };

  const multi = occurrences.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="bg-ava-bg border-t border-ava-border rounded-t-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="shrink-0 px-4 pt-3 pb-2 border-b border-ava-border">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ava-border" />
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-gray-500">{t('swapSheetTitle')}</div>
              <div className="text-white text-sm font-medium truncate">{row.name}</div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white text-sm shrink-0">{t('swapSheetCancel')}</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
          {/* ── 1. What instead ─────────────────────────────────────────── */}
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{t('swapSheetInsteadHeading')}</h3>
            {loading && <div className="text-[12px] text-gray-500 py-4 text-center">{t('swapSheetLoading')}</div>}
            {!loading && failed && <div className="text-[12px] text-gray-500 py-4 text-center">{t('swapSheetFailed')}</div>}
            {!loading && !failed && candidates.length === 0 && (
              <div className="rounded-lg border border-ava-border px-3 py-3 text-[12px] text-gray-500 italic">
                {t('swapSheetNoAlternatives')}
              </div>
            )}
            <div className="space-y-1.5">
              {candidates.slice(0, 12).map(c => {
                const on = c.slug === pickedSlug;
                return (
                  <button
                    key={c.slug}
                    onClick={() => setPickedSlug(on ? null : c.slug)}
                    className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                      on ? 'border-ava-purple bg-ava-purple/10' : c.caution ? 'border-ava-border/60' : 'border-ava-border'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`text-sm truncate ${on ? 'text-ava-purple-light' : 'text-white'}`}>{c.name}</span>
                      {'calories' in c && c.calories != null && (
                        <span className="text-[10px] text-gray-500 tabular-nums shrink-0">{c.calories} kcal</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] text-gray-500">{c.why}</div>
                    {/* Shown, not hidden — someone who knows their own knee gets to decide. */}
                    {c.caution && <div className="mt-1 text-[10px] text-amber-200/80">{c.caution}</div>}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── 2. Where ────────────────────────────────────────────────── */}
          {picked && multi && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] uppercase tracking-wider text-gray-500">{t('swapSheetWhereHeading')}</h3>
                <button onClick={selectAllUpcoming} className="text-[10px] text-ava-purple-light">
                  {t('swapSheetSelectRemaining')}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {occurrences.map(o => (
                  <OccurrenceChip
                    key={o.row_id}
                    occurrence={o}
                    on={selected.has(o.row_id)}
                    onToggle={() => toggle(o.row_id)}
                  />
                ))}
              </div>
              {occurrences.some(o => o.done) && (
                <div className="mt-2 text-[10px] text-gray-500">{t('swapSheetDoneDaysNote')}</div>
              )}
            </section>
          )}

          {/* ── 3. The numbers ──────────────────────────────────────────── */}
          {picked && verdict && (
            <section>
              <h3 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{t('swapSheetNumbersHeading')}</h3>
              <div className="rounded-lg border border-ava-border bg-ava-surface px-3 py-2">
                <div className="text-[11px] text-gray-300 leading-snug">
                  {(carryOverride ?? verdict.decision) === verdict.decision
                    ? verdict.reason
                    : t('swapSheetOverridden')}
                </div>
                <div className="mt-2 flex gap-1.5">
                  {(['carry', 'carry_reps_only', 'reset'] as CarryDecision[]).map(d => {
                    const on = (carryOverride ?? verdict.decision) === d;
                    return (
                      <button
                        key={d}
                        onClick={() => setCarryOverride(d === verdict.decision ? null : d)}
                        className={`flex-1 rounded-md border py-1.5 text-[10px] ${
                          on ? 'border-ava-purple bg-ava-purple/10 text-ava-purple-light' : 'border-ava-border text-gray-400'
                        }`}
                      >
                        {d === 'carry' ? t('swapSheetKeepNumbers')
                          : d === 'carry_reps_only' ? t('swapSheetKeepRepsOnly')
                          : t('swapSheetStartFresh')}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="shrink-0 border-t border-ava-border px-4 py-3">
          <button
            onClick={apply}
            disabled={!picked || selected.size === 0 || applying}
            className="w-full rounded-lg bg-ava-purple/90 py-2.5 text-sm text-white disabled:opacity-40 disabled:bg-ava-surface disabled:text-gray-500"
          >
            {applying ? t('swapSheetApplying')
              : !picked ? t('swapSheetPickOne')
              : selected.size > 1 ? `${t('swapSheetSwapButton')} · ${selected.size}`
              : t('swapSheetSwapButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

function OccurrenceChip({ occurrence, on, onToggle }: { occurrence: Occurrence; on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`rounded-full border px-3 py-1 text-[11px] ${
        on ? 'border-ava-purple bg-ava-purple/15 text-ava-purple-light'
           : occurrence.done ? 'border-ava-border/50 text-gray-600'
           : 'border-ava-border text-gray-400'
      }`}
    >
      {t('swapSheetDayWord')} {occurrence.day_index}
      {occurrence.done && ' ✓'}
    </button>
  );
}
