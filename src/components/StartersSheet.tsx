'use client';

// ─── Starter plans ──────────────────────────────────────────────────────────
//
// The cold-start answer. Someone who has just installed this has no plan, no
// history, and no reason to spend a credit finding out whether it is any good.
// A professionally built week, free, is what makes day one worth having —
// every competitor charges a subscription for exactly this.
//
// Two screens: the shelf, then the whole plan. You read the week BEFORE you
// start it, which is the only reason starting can land it active — committing
// someone's week on one blind tap would not be fair, but it is fine once they
// have seen what is in it.
//
// Starting takes a COPY. From that moment the plan is theirs: swap a movement,
// change the numbers, and none of it touches the shelf. If we later fix or
// retire the original, their week does not shift under them mid-way.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { t, useLocale } from '@/lib/i18n';
import { BottomSheet, SheetConfirm } from './BottomSheet';
import { healthCatalogApi } from '@/lib/api';
import { loadProfile } from '@/lib/health-profile-store';
import { savePlan, newPlanId } from '@/lib/health-plan-store';
import { todayIso } from '@/lib/health-day-store';
import { planFromCurated, orderForProfile, shapeOf } from '@/lib/health-starters';
import type { CuratedPlanSummary, CuratedPlanDetail } from '@/lib/health-starters';
import type { HealthPlan } from '@/lib/health-types';

function goalLabel(goal: string | null): string {
  switch (goal) {
    case 'fat_loss':    return t('plansGoalFatLoss');
    case 'muscle_gain': return t('plansGoalMuscleGain');
    case 'maintenance': return t('plansGoalMaintenance');
    case 'athletic':    return t('plansGoalAthletic');
    case 'recovery':    return t('plansGoalRecovery');
    case 'longevity':   return t('plansGoalLongevity');
    default:            return '';
  }
}

function lengthLabel(days: number): string {
  if (days === 1) return t('startersSingleSession');
  if (days === 7) return t('startersOneWeek');
  return `${days} ${t('startersDays')}`;
}

export function StartersSheet({ onStarted, onClose }: {
  onStarted: (plan: HealthPlan) => void;
  onClose: () => void;
}) {
  useLocale();
  const [shelf, setShelf] = useState<CuratedPlanSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<CuratedPlanDetail | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Their stated goal orders the shelf but never filters it — someone whose
  // profile says muscle gain should still see the recovery week, because the
  // reason they need it may be the reason they stopped training.
  const primaryGoal = useMemo(() => loadProfile()?.goals?.primary ?? null, []);

  useEffect(() => {
    let live = true;
    healthCatalogApi.curatedPlans()
      .then((r: { plans?: CuratedPlanSummary[] }) => {
        if (!live) return;
        setShelf(orderForProfile(r.plans ?? [], primaryGoal));
      })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [primaryGoal]);

  const openPlan = useCallback(async (id: string) => {
    setOpening(id);
    try {
      const r = await healthCatalogApi.curatedPlan(id);
      if (r?.plan) setOpen(r.plan as CuratedPlanDetail);
    } catch { setFailed(true); } finally { setOpening(null); }
  }, []);

  const start = useCallback(async () => {
    if (!open) return;
    setStarting(true);
    try {
      const plan = planFromCurated(open, { id: newPlanId(), startDate: todayIso() });
      const saved = savePlan(plan);
      // Fire and forget — a counter must never cost someone their plan.
      void healthCatalogApi.curatedPlanStarted(open.id);
      onStarted(saved);
    } finally { setStarting(false); }
  }, [open, onStarted]);

  /* ── the whole plan, before you commit to it ─────────────────────────── */
  if (open) {
    const shape = shapeOf(open.days ?? []);
    return (
      <BottomSheet
        title={open.title}
        subtitle={[goalLabel(open.goal), lengthLabel(open.duration_days)].filter(Boolean).join(' · ')}
        onClose={() => setOpen(null)}
        busy={starting}
        footer={<SheetConfirm label={starting ? t('startersStarting') : t('startersStartButton')} onClick={start} disabled={starting} />}
      >
        {open.summary && <p className="text-sm text-gray-300 mb-3">{open.summary}</p>}
        {open.description && <p className="text-[12px] text-gray-400 leading-relaxed mb-3">{open.description}</p>}

        <div className="flex flex-wrap gap-1.5 mb-4">
          {[
            open.level,
            `${shape.training} ${t('startersSessions')}`,
            shape.rest > 0 ? `${shape.rest} ${t('startersRestDays')}` : null,
            open.minutes_per_session ? `${open.minutes_per_session} ${t('startersMinutes')}` : null,
          ].filter(Boolean).map((s, i) => (
            <span key={i} className="rounded-full border border-ava-border px-2.5 py-1 text-[11px] text-gray-400 capitalize">{s}</span>
          ))}
        </div>

        {/* What kit it assumes. A plan needing a rack is no use to somebody
            with two dumbbells, and finding that out on day three is worse
            than finding it out now. */}
        {open.equipment?.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{t('startersEquipment')}</div>
            <div className="text-[12px] text-gray-400">{open.equipment.join(', ')}</div>
          </div>
        )}

        <div className="space-y-2">
          {(open.days ?? []).map(d => {
            const rest = (d.training?.length ?? 0) === 0;
            return (
              <div key={d.day_index} className="rounded-lg border border-ava-border bg-ava-surface px-3 py-2.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] text-gray-200">
                    {t('startersDay')} {d.day_index}{d.title ? ` — ${d.title}` : ''}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {rest ? t('startersRest') : `${d.training.length} ${t('startersExercises')}`}
                  </span>
                </div>
                {!rest && (
                  <ul className="mt-1.5 space-y-0.5">
                    {d.training.map((ex, i) => (
                      <li key={i} className="text-[11px] text-gray-400 flex justify-between gap-3">
                        <span className="first-letter:uppercase">{ex.name}</span>
                        {(ex.sets || ex.reps) && (
                          <span className="shrink-0 text-gray-500">
                            {ex.sets && ex.reps ? `${ex.sets} × ${ex.reps}` : ex.sets ? `${ex.sets}` : ex.reps}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </BottomSheet>
    );
  }

  /* ── the shelf ───────────────────────────────────────────────────────── */
  return (
    <BottomSheet title={t('startersTitle')} subtitle={t('startersSubtitle')} onClose={onClose}>
      {shelf === null && !failed && (
        <div className="py-10 text-center text-sm text-gray-500">{t('startersLoading')}</div>
      )}

      {failed && (
        <div className="py-10 text-center text-sm text-gray-500">{t('startersFailed')}</div>
      )}

      {shelf?.length === 0 && (
        <div className="py-10 text-center text-sm text-gray-500">{t('startersEmpty')}</div>
      )}

      <div className="space-y-2">
        {(shelf ?? []).map(p => (
          <button
            key={p.id}
            onClick={() => openPlan(p.id)}
            disabled={!!opening}
            className="w-full flex gap-3 items-center rounded-lg border border-ava-border bg-ava-surface p-2.5 text-left active:scale-[0.99]"
          >
            {p.cover_image_url ? (
              <img src={p.cover_image_url} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-ava-bg flex items-center justify-center text-lg shrink-0">🏋</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm text-gray-200 truncate">{p.title}</div>
              <div className="text-[11px] text-gray-500 truncate">
                {[goalLabel(p.goal), lengthLabel(p.duration_days), p.level].filter(Boolean).join(' · ')}
              </div>
              {p.summary && <div className="text-[11px] text-gray-600 truncate mt-0.5">{p.summary}</div>}
            </div>
            {opening === p.id && <span className="text-[11px] text-gray-500 shrink-0">…</span>}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
