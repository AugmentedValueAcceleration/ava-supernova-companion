'use client';

// ─── Progress ───────────────────────────────────────────────────────────────
//
// The payoff for everything the app has been recording and never showing.
// GymSession has stored every set performed against what was prescribed since
// the Gym shipped, and the only thing that ever read it was the Gym.
//
// No new capture here — this is a read of data that already existed.

import { useMemo } from 'react';
import { t, useLocale } from '@/lib/i18n';
import { todayIso } from '@/lib/health-day-store';
import { computeProgress, type ExerciseProgress, type DayIntake } from '@/lib/health-progress';
import type { WeightEntry } from '@/lib/health-types';

export function ProgressView() {
  useLocale();
  const today = todayIso();
  const p = useMemo(() => computeProgress(today), [today]);

  if (!p.has_any_data) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-4 py-16 text-center">
          <p className="text-[13px] text-gray-500">{t('progressEmpty')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full px-4 py-5 pb-28">

        {/* Headline figures. A null shows as an em dash, never 0% — "we have
            not seen you train yet" and "you did nothing" are different. */}
        <div className="grid grid-cols-3 gap-2.5">
          <Stat label={t('progressAdherence')} value={p.training.adherence_pct == null ? '—' : `${p.training.adherence_pct}%`} />
          <Stat label={t('progressStreak')} value={String(p.training.streak)} hint={t('progressDays')} />
          <Stat label={t('progressSessions')} value={String(p.training.sessions_completed)} />
        </div>

        {/* Where each active plan has got to */}
        {p.plans.length > 0 && (
          <section className="mt-6 space-y-2">
            {p.plans.map(pl => (
              <div key={pl.id} className="rounded-xl border border-ava-border bg-ava-surface p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px] text-white">{pl.title}</span>
                  <span className="shrink-0 font-mono text-[10px] text-gray-500">
                    {t('progressPlanDay')} {pl.day_index}/{pl.duration_days}
                  </span>
                </div>
                <Bar pct={Math.round((pl.day_index / pl.duration_days) * 100)} />
              </div>
            ))}
          </section>
        )}

        {/* Per-exercise progression — the chart that makes a training app worth
            opening. Needs two sessions of the same movement before it can show
            a direction, so it stays hidden until it can say something. */}
        <section className="mt-7">
          <h2 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{t('progressLifts')}</h2>
          {p.exercises.length === 0
            ? <p className="rounded-lg border border-ava-border px-4 py-4 text-[12px] italic text-gray-500">{t('progressNoLifts')}</p>
            : <div className="space-y-2">{p.exercises.slice(0, 8).map(e => <LiftRow key={e.key} ex={e} />)}</div>}
        </section>

        {p.intake.length > 0 && (
          <section className="mt-7">
            <h2 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{t('progressIntake')}</h2>
            <IntakeChart days={p.intake} />
          </section>
        )}

        {p.weight.length >= 2 && (
          <section className="mt-7">
            <h2 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{t('progressWeight')}</h2>
            <WeightRow entries={p.weight} />
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-ava-border bg-ava-surface px-3 py-3">
      <div className="text-[9px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 text-[19px] font-light text-white">{value}</div>
      {hint && <div className="text-[10px] text-gray-500">{hint}</div>}
    </div>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="mt-2 h-1 overflow-hidden rounded-full bg-ava-border">
      <div className="h-full rounded-full bg-ava-purple" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

/** One movement's trend. Shows first → latest top weight and a sparkline of
 *  volume, so both "am I lifting more" and "am I doing more work" are visible. */
function LiftRow({ ex }: { ex: ExerciseProgress }) {
  const first = ex.points[0];
  const last = ex.points[ex.points.length - 1];
  const delta = first.top_weight != null && last.top_weight != null ? last.top_weight - first.top_weight : null;
  const max = Math.max(...ex.points.map(p => p.volume), 1);

  return (
    <div className="rounded-xl border border-ava-border bg-ava-surface p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[12px] text-gray-200">{ex.name}</span>
        <span className="shrink-0 font-mono text-[10px] text-gray-500">
          {last.top_weight != null ? `${last.top_weight}kg` : `${last.top_reps ?? 0} reps`}
          {delta != null && delta !== 0 && (
            <span className={delta > 0 ? ' text-emerald-400' : ' text-gray-500'}>
              {' '}{delta > 0 ? '+' : ''}{delta}
            </span>
          )}
        </span>
      </div>
      <div className="mt-2 flex h-6 items-end gap-[3px]">
        {ex.points.slice(-14).map((pt, i) => (
          <div
            key={`${pt.date}-${i}`}
            className="flex-1 rounded-sm bg-ava-purple/60"
            style={{ height: `${Math.max(8, (pt.volume / max) * 100)}%` }}
            title={`${pt.date} · ${pt.volume}kg`}
          />
        ))}
      </div>
    </div>
  );
}

/** Actual against planned calories per logged day. Planned shows as a faint
 *  marker so over- and under-eating are both visible at a glance. */
function IntakeChart({ days }: { days: DayIntake[] }) {
  const recent = days.slice(-14);
  const max = Math.max(...recent.flatMap(d => [d.actual_calories ?? 0, d.planned_calories ?? 0]), 1);
  return (
    <div className="rounded-xl border border-ava-border bg-ava-surface p-3.5">
      <div className="flex h-20 items-end gap-[3px]">
        {recent.map(d => (
          <div key={d.date} className="relative flex-1" style={{ height: '100%' }} title={`${d.date} · ${d.actual_calories ?? 0} kcal`}>
            <div
              className="absolute bottom-0 w-full rounded-sm bg-ava-purple/60"
              style={{ height: `${((d.actual_calories ?? 0) / max) * 100}%` }}
            />
            {d.planned_calories != null && (
              <div
                className="absolute w-full border-t border-dashed border-gray-500"
                style={{ bottom: `${(d.planned_calories / max) * 100}%` }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeightRow({ entries }: { entries: WeightEntry[] }) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const delta = Math.round((last.weight_kg - first.weight_kg) * 10) / 10;
  return (
    <div className="rounded-xl border border-ava-border bg-ava-surface p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[19px] font-light text-white">{last.weight_kg}kg</span>
        <span className={`font-mono text-[11px] ${delta < 0 ? 'text-emerald-400' : delta > 0 ? 'text-gray-400' : 'text-gray-500'}`}>
          {delta > 0 ? '+' : ''}{delta}kg
        </span>
      </div>
    </div>
  );
}
