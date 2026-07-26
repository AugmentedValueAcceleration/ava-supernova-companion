'use client';

// ─── Duplicate sheet ────────────────────────────────────────────────────────
//
// Copy this day onto others, or copy its whole week onto another week.
//
// Two modes rather than two features, because they are the same act at
// different scales, and someone building a 12-week programme wants the week one
// far more often than the day one.
//
// Deliberately says what it will overwrite BEFORE doing it. Copying is the one
// action here that destroys work — every other edit in the builder changes one
// field — so a day that already has something on it is marked, and the count of
// what will be replaced is on the button.

import { useState, useMemo } from 'react';
import { t, useLocale } from '@/lib/i18n';
import { duplicateDay, duplicateWeek, weekCount, progressDays, daysInWeek } from '@/lib/health-plan-swap';
import type { Progression } from '@/lib/health-plan-swap';
import type { HealthPlan } from '@/lib/health-types';
import { Button } from './Button';

export function DuplicateSheet({ plan, fromDay, onApply, onClose }: {
  plan: HealthPlan;
  fromDay: number;
  onApply: (next: HealthPlan) => void;
  onClose: () => void;
}) {
  useLocale();
  const weeks = weekCount(plan);
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const [targetDays, setTargetDays] = useState<Set<number>>(() => new Set());
  const [targetWeek, setTargetWeek] = useState<number | null>(null);
  const [progression, setProgression] = useState<Progression>('same');

  const sourceWeek = Math.floor((fromDay - 1) / 7) + 1;

  const hasContent = (index: number) => {
    const d = plan.days.find(x => x.day_index === index);
    return !!d && (d.training.length > 0 || d.meals.length > 0);
  };

  // What this will overwrite — counted up front, shown on the button.
  const willReplace = useMemo(() => {
    if (mode === 'day') return [...targetDays].filter(hasContent).length;
    if (targetWeek == null) return 0;
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const target = (targetWeek - 1) * 7 + 1 + i;
      const source = (sourceWeek - 1) * 7 + 1 + i;
      if (plan.days.some(d => d.day_index === source) && hasContent(target)) n++;
    }
    return n;
  }, [mode, targetDays, targetWeek, plan, sourceWeek]);

  const canApply = mode === 'day' ? targetDays.size > 0 : targetWeek != null;

  const apply = () => {
    // Copy first, then step the COPY forward — never the source. Repeating
    // week one unchanged for a month is the thing this is here to prevent.
    if (mode === 'day') {
      const days = [...targetDays];
      onApply(progressDays(duplicateDay(plan, fromDay, days), days, progression));
    } else if (targetWeek != null) {
      const copied = duplicateWeek(plan, sourceWeek, targetWeek);
      onApply(progressDays(copied, daysInWeek(copied, targetWeek), progression));
    }
    onClose();
  };

  const toggleDay = (i: number) =>
    setTargetDays(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div className="bg-ava-bg border-t border-ava-border rounded-t-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="shrink-0 px-4 pt-3 pb-2 border-b border-ava-border">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ava-border" />
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500">{t('duplicateSheetTitle')}</div>
              <div className="text-white text-sm font-medium">
                {mode === 'day'
                  ? `${t('duplicateSheetDayWord')} ${fromDay}`
                  : `${t('duplicateSheetWeekWord')} ${sourceWeek}`}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">{t('duplicateSheetCancel')}</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Copying a week only means something on a plan that has more than one. */}
          {weeks > 1 && (
            <div className="flex gap-2">
              {(['day', 'week'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 rounded-lg border py-2 text-xs ${
                    mode === m ? 'border-ava-purple bg-ava-purple/10 text-ava-purple-light' : 'border-ava-border text-gray-400'
                  }`}>
                  {m === 'day' ? t('duplicateSheetModeDay') : t('duplicateSheetModeWeek')}
                </button>
              ))}
            </div>
          )}

          {mode === 'day' ? (
            <section>
              <h3 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{t('duplicateSheetOntoDays')}</h3>
              <div className="grid grid-cols-7 gap-1.5">
                {plan.days.map(d => {
                  const isSource = d.day_index === fromDay;
                  const on = targetDays.has(d.day_index);
                  return (
                    <button key={d.day_index} disabled={isSource}
                      onClick={() => toggleDay(d.day_index)}
                      className={`aspect-square rounded-lg border text-[11px] flex flex-col items-center justify-center ${
                        isSource ? 'border-ava-border/40 text-gray-600'
                          : on ? 'border-ava-purple bg-ava-purple/15 text-ava-purple-light'
                          : 'border-ava-border text-gray-400'
                      }`}>
                      {d.day_index}
                      {/* A dot means there is something here to lose. */}
                      {!isSource && hasContent(d.day_index) && (
                        <span className="mt-0.5 h-1 w-1 rounded-full bg-amber-400/70" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : (
            <section>
              <h3 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{t('duplicateSheetOntoWeek')}</h3>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: weeks }, (_, i) => i + 1).map(w => (
                  <button key={w} disabled={w === sourceWeek}
                    onClick={() => setTargetWeek(w === targetWeek ? null : w)}
                    className={`rounded-full border px-3 py-1.5 text-[11px] ${
                      w === sourceWeek ? 'border-ava-border/40 text-gray-600'
                        : w === targetWeek ? 'border-ava-purple bg-ava-purple/15 text-ava-purple-light'
                        : 'border-ava-border text-gray-400'
                    }`}>
                    {t('duplicateSheetWeekWord')} {w}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Only worth asking about when there is training to progress. */}
          {plan.days.find(d => d.day_index === fromDay)?.training.length ? (
            <section>
              <h3 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{t('duplicateSheetProgressHeading')}</h3>
              <div className="flex gap-1.5">
                {(['same', 'one_more_rep', 'one_more_set'] as Progression[]).map(p => (
                  <button key={p} onClick={() => setProgression(p)}
                    className={`flex-1 rounded-md border py-1.5 text-[10px] ${
                      progression === p ? 'border-ava-purple bg-ava-purple/10 text-ava-purple-light' : 'border-ava-border text-gray-400'
                    }`}>
                    {p === 'same' ? t('duplicateSheetProgressSame')
                      : p === 'one_more_rep' ? t('duplicateSheetProgressRep')
                      : t('duplicateSheetProgressSet')}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 text-[10px] text-gray-500 leading-snug">
                {progression === 'same' ? t('duplicateSheetProgressSameNote')
                  : t('duplicateSheetProgressNote')}
              </div>
            </section>
          ) : null}

          <div className="rounded-lg border border-ava-border bg-ava-surface px-3 py-2 text-[11px] text-gray-400 leading-snug">
            {t('duplicateSheetKeepsNote')}
          </div>

          {willReplace > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200/90">
              {willReplace === 1
                ? t('duplicateSheetOverwriteOne')
                : `${t('duplicateSheetOverwriteManyPrefix')} ${willReplace} ${t('duplicateSheetOverwriteManySuffix')}`}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-ava-border px-4 py-3">
          <Button variant="primary" size="lg" block onClick={apply} disabled={!canApply}>
            {!canApply ? t('duplicateSheetPickTarget') : t('duplicateSheetCopyButton')}
          </Button>
        </div>
      </div>
    </div>
  );
}
