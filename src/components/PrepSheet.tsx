'use client';

// ─── Prep plan ──────────────────────────────────────────────────────────────
//
// Where the cooking lands. A meal plan says what to eat; this says what it
// costs you in evenings — which day is the heavy one, what has to be started
// the night before, and where you are about to cook the same thing three times
// when once would do.
//
// It states rather than nags. Nothing here blocks or rewrites a plan; a day
// over budget is shown as a fact about the day, and the cook decides.
//
// It also refuses to claim things it cannot know. A dish whose keeping time
// the library never recorded is never proposed for leftovers, and a day whose
// time budget the profile never captured is never called too much.

import { useMemo } from 'react';
import { t, useLocale } from '@/lib/i18n';
import { BottomSheet } from './BottomSheet';
import { weekPrep, shortDuration, type PrepSource, type CookOnce, type PrepDay } from '@/lib/health-prep';
import type { HealthPlan, HealthProfile } from '@/lib/health-types';
import { dateForPlanDay } from '@/lib/health-plan-insights';

export function PrepSheet({ plan, profile, onClose }: {
  plan: HealthPlan;
  profile: HealthProfile | null;
  onClose: () => void;
}) {
  useLocale();

  const sources: PrepSource[] = useMemo(
    () => plan.days.map(day => ({ day, date: dateForPlanDay(plan, day.day_index) })),
    [plan],
  );
  const prep = useMemo(() => weekPrep(sources, profile), [sources, profile]);

  // The scale every bar is drawn against. The busiest day fills the bar, so
  // the shape of the week reads at a glance even when nothing has a budget.
  const peak = Math.max(1, ...prep.days.map(d => d.minutes));
  const cooking = prep.days.some(d => d.minutes > 0);

  // Flattened with their day, soonest first — the order you would act on them.
  const ahead = useMemo(
    () => prep.days.flatMap(d => d.startAhead.map(s => ({ ...s, day: d.day_index }))),
    [prep],
  );

  return (
    <BottomSheet title={t('prepTitle')} subtitle={plan.title} onClose={onClose}>
      {!cooking ? (
        <div className="py-10 text-center text-sm text-gray-500">{t('prepNothingToCook')}</div>
      ) : (
        <>
          <div className="mb-3 text-[11px] text-gray-500">
            {shortDuration(prep.totalMinutes)} · {t('prepAcrossThePlan')}
          </div>

          {/* Cook once — first, because it is the only thing here that CHANGES
              the week rather than describing it. */}
          {prep.cookOnce.length > 0 && (
            <section className="mb-4">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-wider text-gray-500">{t('prepCookOnce')}</span>
                <span className="text-[10px] text-emerald-400/80">
                  {t('prepSaves')} {shortDuration(prep.minutesSaved)}
                </span>
              </div>
              <div className="space-y-1.5">
                {prep.cookOnce.map(c => <CookOnceRow key={c.slug} c={c} />)}
              </div>
            </section>
          )}

          <section>
            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-gray-500">{t('prepByDay')}</div>
            <div className="space-y-1">
              {prep.days.map(d => <DayRow key={d.day_index} d={d} peak={peak} heaviest={prep.heaviest === d.day_index} />)}
            </div>
          </section>

          {/* Spelled out, not left to a hover tooltip — there is no hover on a
              phone, and "this needed starting yesterday" is the one thing here
              you cannot act on after the fact. */}
          {ahead.length > 0 && (
            <section className="mt-4">
              <div className="mb-1.5 text-[10px] uppercase tracking-wider text-gray-500">{t('prepStartAhead')}</div>
              <div className="space-y-1">
                {ahead.map(a => (
                  <div key={`${a.day}-${a.mealId}`} className="flex items-baseline gap-2 text-[11px]">
                    <span className="w-10 shrink-0 text-gray-500">{t('prepDayWord')} {a.day}</span>
                    <span className="text-gray-300 first-letter:uppercase">{a.name}</span>
                    <span className="ml-auto shrink-0 text-ava-purple/80">
                      {a.daysAhead === 1 ? t('prepNightBefore') : `${a.daysAhead} ${t('prepDaysWord')}`}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </BottomSheet>
  );
}

function CookOnceRow({ c }: { c: CookOnce }) {
  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
      <div className="text-sm text-gray-200 first-letter:uppercase">{c.name}</div>
      <div className="mt-0.5 text-[11px] text-gray-400">
        {t('prepCookOnDay')} {c.cookOn} · {c.servings} {t('prepPortions')} · {t('prepCovers')} {t('prepDayWord')} {c.covers.join(', ')}
      </div>
      <div className="mt-0.5 text-[10px] text-gray-600">
        {t('prepKeeps')} {c.keepsDays} {t('prepDaysWord')} · {t('prepSaves')} {shortDuration(c.minutesSaved)}
      </div>
    </div>
  );
}

function DayRow({ d, peak, heaviest }: { d: PrepDay; peak: number; heaviest: boolean }) {
  const over = d.overBy != null;
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-10 shrink-0 text-[11px] text-gray-500">
        {t('prepDayWord')} {d.day_index}
      </span>
      <div className="relative h-5 flex-1 overflow-hidden rounded bg-ava-surface">
        <div
          className={`h-full rounded transition-all ${
            over ? 'bg-amber-500/30' : heaviest ? 'bg-ava-purple/40' : 'bg-ava-purple/20'
          }`}
          style={{ width: `${Math.round((d.minutes / peak) * 100)}%` }}
        />
        {/* The budget line, only when the profile actually stated one. */}
        {d.budget != null && d.budget < peak && (
          <div
            className="absolute inset-y-0 w-px bg-gray-500/60"
            style={{ left: `${Math.round((d.budget / peak) * 100)}%` }}
            title={`${d.budget} min`}
          />
        )}
      </div>
      <span className={`w-16 shrink-0 text-right text-[11px] ${over ? 'text-amber-300/90' : 'text-gray-400'}`}>
        {d.minutes > 0 ? shortDuration(d.minutes) : '—'}
      </span>
      {d.startAhead.length > 0 && (
        <span className="shrink-0 text-ava-purple/70" title={d.startAhead.map(s => s.name).join(', ')}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      )}
    </div>
  );
}
