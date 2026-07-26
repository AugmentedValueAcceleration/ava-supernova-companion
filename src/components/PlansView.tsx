'use client';

// ─── Plans library (Phase 4a-i) ─────────────────────────────────────────────
//
// The manual-plan surface, mirroring the extension's Plans tab: Programs (the
// list) + Calendar (a month grid of the active plan), a create flow
// (type → duration → title → draft/active), and lifecycle (activate, which
// archives others of the same type; delete). Day composition — building each
// day from the catalogue — lands in 4a-ii.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from './Button';
import { t, useLocale } from '@/lib/i18n';
import { listPlans, getPlan, savePlan, removePlan, blankPlan, PLANS_CHANGED_EVENT } from '@/lib/health-plan-store';
import { syncPlans, syncPlanDeletion } from '@/lib/health-plan-sync';
import type { HealthPlanSummary, HealthPlanType, HealthPlanStatus } from '@/lib/health-types';
import { PlanBuilder } from './PlanBuilder';
import { todayIso } from '@/lib/health-day-store';
import { listSessions } from '@/lib/gym-session-store';
import { progressPlan, summarise } from '@/lib/health-plan-progression';
import { planCardState } from '@/lib/health-today';
import { loadProfile } from '@/lib/health-profile-store';
import { GenerateSheet, Sparkle } from './GenerateSheet';
import type { ProgressionResult } from '@/lib/health-plan-progression';

const TYPES: [HealthPlanType, string][] = [['fitness', 'Fitness'], ['meal', 'Meal'], ['combined', 'Combined']];
/**
 * Short on purpose. People finish a week; a twelve-week plan abandoned in week
 * two taught nobody anything, and eleven of its weeks were written before we
 * knew a single thing about how the person responded. Length comes from
 * REPEATING a finished plan, which now advances it from what the log actually
 * shows — so a programme is built out of evidence rather than assumption.
 *
 * Manual plans can still be any length: the field below accepts a number, for
 * the 14- and 21-day blocks that were previously impossible to express.
 */
const DURATIONS: [number, string][] = [[1, '1 day'], [3, '3 days'], [7, '1 week']];

const STATUS_CLS: Record<HealthPlanStatus, string> = {
  draft: 'bg-ava-border text-gray-400',
  active: 'bg-emerald-400/15 text-emerald-300',
  completed: 'bg-sky-400/15 text-sky-300',
  archived: 'bg-ava-border text-gray-500',
};

function durationLabel(days: number): string {
  if (days <= 1) return '1 day';
  // Only call it "weeks" when it actually is some. A 10-day plan rounded to
  // "1 week" is a lie about a plan the user typed the length of themselves.
  if (days % 7 === 0) {
    const w = days / 7;
    return w === 1 ? '1 week' : `${w} weeks`;
  }
  return `${days} days`;
}

function statusLabel(s: HealthPlanStatus): string {
  switch (s) {
    case 'draft':     return t('plansStatusDraft');
    case 'active':    return t('plansStatusActive');
    case 'completed': return t('plansStatusCompleted');
    case 'archived':  return t('plansStatusArchived');
  }
}

export function PlansView({ token }: { token?: string | null }) {
  useLocale();
  const [plans, setPlans] = useState<HealthPlanSummary[]>(() => listPlans());
  const [tab, setTab] = useState<'programs' | 'calendar'>('programs');
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<{ id: string; day: number } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [repeating, setRepeating] = useState<ProgressionResult | null>(null);

  const refresh = useCallback(() => setPlans(listPlans()), []);
  useEffect(() => {
    syncPlans(token).then(refresh).catch(() => {});
    window.addEventListener(PLANS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PLANS_CHANGED_EVENT, refresh);
  }, [token, refresh]);

  // Open the day builder for a plan, at a specific day when opened from the calendar.
  if (open) return <PlanBuilder planId={open.id} initialDay={open.day} token={token} onBack={() => { setOpen(null); refresh(); }} />;

  const activate = (id: string) => {
    const p = getPlan(id);
    if (!p) return;
    savePlan({ ...p, status: 'active' });
    syncPlans(token).catch(() => {});
  };
  const del = (id: string) => {
    removePlan(id);
    syncPlanDeletion(token, id);
  };
  // Repeat used to re-run a plan IDENTICALLY, which is the one thing a training
  // programme must not do — an unchanged week repeated for a month stops
  // working. It now proposes the plan ADVANCED from what the log actually
  // shows, and the user confirms it. Nothing is written until they do.
  const repeat = (id: string) => {
    const p = getPlan(id);
    if (!p) return;
    setRepeating(progressPlan(p, listSessions(), todayIso()));
  };
  const confirmRepeat = () => {
    if (!repeating) return;
    savePlan(repeating.plan);
    setRepeating(null);
    refresh();
    syncPlans(token).catch(() => {});
  };
  const create = (type: HealthPlanType, duration: number, title: string, status: HealthPlanStatus) => {
    const base = blankPlan(type, duration, title.trim() || `New ${type} plan`);
    const saved = savePlan({ ...base, status });
    syncPlans(token).catch(() => {});
    setCreating(false);
    setOpen({ id: saved.id, day: 1 }); // flow straight into the builder to add days (matches extension/IDE)
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full pb-28">
        <div className="px-4 py-3 border-b border-ava-border">
          <h2 className="font-semibold text-white text-lg">{t('plansHeading')}</h2>
          {/* TWO DOORS, both visible. There used to be one button, "New", which
              meant manual — so there was no separation between building a plan
              yourself and asking Ava, because there was no visible choice at
              all. Ava leads because it is the better answer for most people;
              building by hand is right there and free. */}
          <div className="mt-2.5 flex gap-2">
            <Button variant="primary" size="lg" block onClick={() => setGenerating(true)}>
              <Sparkle className="w-3.5 h-3.5" />
              {t('plansAskAvaButton')}
            </Button>
            <Button variant="secondary" size="lg" block onClick={() => setCreating(true)}>
              {t('plansBuildOwnButton')}
            </Button>
          </div>
          <div className="mt-1.5 flex gap-2 text-[10px] text-gray-600">
            <span className="flex-1 text-center">{t('plansAskAvaHint')}</span>
            <span className="flex-1 text-center">{t('plansBuildOwnHint')}</span>
          </div>
        </div>

        <div className="flex gap-1 border-b border-ava-border px-2">
          <TabBtn label={t('plansTabPrograms')} active={tab === 'programs'} onClick={() => setTab('programs')} />
          <TabBtn label={t('plansTabCalendar')} active={tab === 'calendar'} onClick={() => setTab('calendar')} />
        </div>

        {tab === 'programs'
          ? <Programs plans={plans} onActivate={activate} onRepeat={repeat} onDelete={del} onOpen={(id) => setOpen({ id, day: 1 })} />
          : <Calendar plans={plans} onOpenDay={(id, day) => setOpen({ id, day })} />}
      </div>

      {creating && <CreateSheet onCancel={() => setCreating(false)} onCreate={create} />}
      {generating && (
        <GenerateSheet
          token={token ?? null}
          profile={loadProfile()}
          onAccept={p => { const saved = savePlan(p); refresh(); syncPlans(token).catch(() => {}); setOpen({ id: saved.id, day: 1 }); }}
          onClose={() => setGenerating(false)}
        />
      )}
      {repeating && (
        <RepeatSheet result={repeating} onConfirm={confirmRepeat} onCancel={() => setRepeating(null)} />
      )}
    </div>
  );
}

/**
 * What repeating this plan will actually do.
 *
 * Shown before anything is written, because this changes the weight someone
 * puts on a bar. Every line carries its reason — "you got 2 of 3 sets", "at RPE
 * 9" — so the decision is arguable rather than magic. Holding is presented as a
 * real decision, not a failure to progress, because it is one.
 */
function RepeatSheet({ result, onConfirm, onCancel }: {
  result: ProgressionResult; onConfirm: () => void; onCancel: () => void;
}) {
  const order: Record<string, number> = {
    progress_load: 0, progress_reps: 1, suggest_swap: 2, hold: 3, no_evidence: 4,
  };
  const changes = [...result.changes].sort((a, b) => (order[a.action] ?? 9) - (order[b.action] ?? 9));

  const tone = (a: string) =>
    a === 'progress_load' || a === 'progress_reps'
      ? 'border-emerald-500/30 bg-emerald-500/5'
      : a === 'suggest_swap'
        ? 'border-amber-500/30 bg-amber-500/5'
        : 'border-ava-border bg-ava-bg';

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60" onClick={onCancel}>
      <div className="bg-ava-bg border-t border-ava-border rounded-t-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="shrink-0 px-4 pt-3 pb-2 border-b border-ava-border">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ava-border" />
          <div className="text-[10px] uppercase tracking-wider text-gray-500">{t('repeatSheetTitle')}</div>
          <div className="text-white text-sm font-medium">{result.plan.title}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">{summarise(result.changes)}</div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
          {result.noEvidence && (
            <div className="rounded-lg border border-ava-border bg-ava-surface px-3 py-2.5 text-[11px] text-gray-400 leading-snug mb-2">
              {t('repeatSheetNoEvidence')}
            </div>
          )}
          {changes.map(c => (
            <div key={c.key} className={`rounded-lg border px-3 py-2 ${tone(c.action)}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-white truncate">{c.name}</span>
                <span className="text-[11px] text-gray-400 tabular-nums shrink-0">
                  {c.action === 'progress_load' && c.from.weight !== c.to.weight
                    ? `${c.from.weight} → ${c.to.weight}`
                    : c.action === 'progress_reps' && c.from.reps !== c.to.reps
                      ? `${c.from.reps} → ${c.to.reps}`
                      : t('repeatSheetSame')}
                </span>
              </div>
              <div className="mt-0.5 text-[10px] text-gray-500 leading-snug">{c.reason}</div>
            </div>
          ))}
        </div>

        <div className="shrink-0 border-t border-ava-border px-4 py-3 flex gap-2">
          <Button variant="secondary" size="lg" block onClick={onCancel}>{t('repeatSheetCancel')}</Button>
          <Button variant="primary" size="lg" block onClick={onConfirm}>{t('repeatSheetStart')}</Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The line under a plan's title.
 *
 * It used to read "type · duration · tap to build", which describes AUTHORING —
 * something you do once — rather than DOING, which is what you come back for
 * every day. So a library of live programmes read like a folder of documents.
 *
 * A plan that has started says where you are in it and how it is going; one
 * that has not still says what it is, because that is genuinely all there is to
 * say about a draft.
 */
function PlanCardLine({ plan }: { plan: HealthPlanSummary }) {
  const state = useMemo(() => {
    const full = getPlan(plan.id);
    return full ? planCardState(full) : null;
  }, [plan.id, plan.updated_at]);

  const base = `${plan.type} · ${durationLabel(plan.duration_days)}`;

  if (!state || state.dayIndex == null) {
    return <div className="text-[11px] text-gray-500 mt-0.5 capitalize">{base} · {t('plansProgramsTapToBuild')}</div>;
  }

  const pct = state.adherence == null ? null : Math.round(state.adherence * 100);

  return (
    <div className="mt-0.5">
      <div className="text-[11px] text-gray-500 capitalize">
        {base} · {t('plansCardDayWord')} {state.dayIndex}/{state.duration}
      </div>
      <div className="mt-1 flex items-center gap-2">
        {/* A thin bar rather than a number alone — "day 3 of 7" is a position,
            and a position is easier to feel than to read. */}
        <div className="h-1 flex-1 rounded-full bg-ava-bg overflow-hidden">
          <div
            className="h-full rounded-full bg-ava-purple/70"
            style={{ width: `${Math.min(100, (state.dayIndex / Math.max(1, state.duration)) * 100)}%` }}
          />
        </div>
        {pct != null && (
          <span className={`text-[10px] tabular-nums shrink-0 ${
            pct >= 80 ? 'text-emerald-300/80' : pct >= 50 ? 'text-gray-400' : 'text-amber-300/80'
          }`}>
            {pct}% {t('plansCardKept')}
          </span>
        )}
      </div>
      {state.today && (
        <div className="mt-1 text-[11px] text-gray-400 capitalize truncate">
          {t('plansCardToday')} {state.today}
        </div>
      )}
    </div>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`-mb-px border-b-2 px-4 py-2 text-xs transition ${active ? 'border-ava-purple text-ava-purple-light font-semibold' : 'border-transparent text-gray-400'}`}>
      {label}
    </button>
  );
}

// ── Programs list ────────────────────────────────────────────────────────────

function Programs({ plans, onActivate, onRepeat, onDelete, onOpen }: {
  plans: HealthPlanSummary[]; onActivate: (id: string) => void; onRepeat: (id: string) => void; onDelete: (id: string) => void; onOpen: (id: string) => void;
}) {
  if (plans.length === 0) {
    // No button here. It used to carry a "Create your first plan" that went
    // straight to the MANUAL flow — left over from when that was the only way
    // in. With the two doors above it, that made three buttons for two actions
    // and quietly steered every new user away from Ava without saying so.
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm text-gray-400">{t('plansEmptyState')}</p>
        <p className="mt-1.5 text-[12px] text-gray-600">{t('plansEmptyStateHint')}</p>
      </div>
    );
  }
  return (
    <div className="px-4 py-4 space-y-3">
      {plans.map(p => (
        <div key={p.id} className="rounded-xl border border-ava-border bg-ava-surface p-4">
          <button onClick={() => onOpen(p.id)} className="flex items-start justify-between gap-3 w-full text-left">
            <div className="min-w-0 flex-1">
              <div className="text-white text-sm font-medium truncate">{p.title}</div>
              <PlanCardLine plan={p} />
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] capitalize ${STATUS_CLS[p.status]}`}>{statusLabel(p.status)}</span>
          </button>
          <div className="mt-3 flex gap-2">
            {p.status === 'draft' && (
              <button onClick={() => onActivate(p.id)} className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-300">{t('plansActivateButton')}</button>
            )}
            {(p.status === 'completed' || p.status === 'archived') && (
              <button onClick={() => onRepeat(p.id)} className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-300">{t('plansRepeatButton')}</button>
            )}
            <button onClick={() => onDelete(p.id)} className="rounded-full border border-ava-border px-3 py-1 text-[11px] text-gray-400 hover:text-red-300 hover:border-red-400/40">{t('plansDeleteButton')}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Calendar (active plan) ────────────────────────────────────────────────────

const dateKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function Calendar({ plans, onOpenDay }: { plans: HealthPlanSummary[]; onOpenDay: (id: string, day: number) => void }) {
  // Every plan that's been placed on a date — drafts that were never activated
  // have no start_date and simply don't appear (they live in Programs).
  const dated = plans.filter(p => p.start_date);
  const [month, setMonth] = useState(() => {
    const base = dated[0]?.start_date ? new Date(`${dated[0].start_date}T00:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  // Mark every day each plan spans — training dot for fitness/combined, meal
  // dot for meal/combined — plus what actually HAPPENED on it.
  //
  // The grid used to show placement only, so a month of perfectly kept training
  // looked identical to a month of intentions. Reading completion needs the
  // full plan rather than the summary, which is a handful of localStorage reads
  // for the plans that have been placed on a date at all.
  const marks = useMemo(() => {
    const todayKey = dateKey(new Date());
    const map = new Map<string, { training: boolean; meals: boolean; done: boolean; missed: boolean }>();

    for (const summary of dated) {
      const plan = getPlan(summary.id);
      if (!plan) continue;
      const start = new Date(`${plan.start_date}T00:00:00`);
      if (isNaN(start.getTime())) continue;

      const training = plan.type === 'fitness' || plan.type === 'combined';
      const meals = plan.type === 'meal' || plan.type === 'combined';

      for (let i = 0; i < plan.duration_days; i++) {
        const d = new Date(start); d.setDate(d.getDate() + i);
        const k = dateKey(d);
        const day = plan.days.find(x => x.day_index === i + 1) ?? null;

        const recorded = [day?.completion?.training, day?.completion?.nutrition].filter(Boolean) as string[];
        const isDone = recorded.length > 0 && recorded.every(m => m === 'done');
        // Passed, asked for something, recorded nothing. A rest day asks for
        // nothing and so can never be missed.
        const isMissed = !isDone && k < todayKey && day != null && day.kind !== 'rest';

        const prev = map.get(k) ?? { training: false, meals: false, done: false, missed: false };
        map.set(k, {
          training: prev.training || training,
          meals: prev.meals || meals,
          done: prev.done || isDone,
          // One plan kept and another missed on the same date is a miss worth
          // seeing, but never at the expense of showing the one that was kept.
          missed: prev.missed || isMissed,
        });
      }
    }
    return map;
  }, [dated]);

  // Which plan to open for a tapped date — prefer active, then most-recent.
  const planForDate = (date: Date): { id: string; day: number } | null => {
    const sel = date.getTime();
    const covering = dated.filter(p => {
      const s = new Date(`${p.start_date}T00:00:00`).getTime();
      return !isNaN(s) && sel >= s && sel <= s + (p.duration_days - 1) * 86400000;
    });
    if (covering.length === 0) return null;
    covering.sort((a, b) => {
      if ((a.status === 'active') !== (b.status === 'active')) return a.status === 'active' ? -1 : 1;
      return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
    });
    const p = covering[0];
    const day = Math.floor((sel - new Date(`${p.start_date}T00:00:00`).getTime()) / 86400000) + 1;
    return { id: p.id, day };
  };

  const todayK = dateKey(new Date());
  const year = month.getFullYear(), m = month.getMonth();
  const firstDow = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, m, d));

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setMonth(new Date(year, m - 1, 1))} className="text-gray-400 px-2">‹</button>
        <div className="text-sm text-white">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
        <button onClick={() => setMonth(new Date(year, m + 1, 1))} className="text-gray-400 px-2">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="text-[9px] text-gray-600 py-1">{d}</div>)}
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const mk = marks.get(dateKey(date));
          const isToday = dateKey(date) === todayK;
          return (
            // Done fills the cell, missed outlines it. Filled reads as
            // "banked" at a glance across a month, which is the thing worth
            // seeing; missed is an outline rather than a fill so a bad week
            // does not turn the calendar into a wall of alarm.
            <button
              key={i}
              onClick={() => { const t = planForDate(date); if (t) onOpenDay(t.id, t.day); }}
              disabled={!mk}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[11px] transition ${
                isToday ? 'ring-1 ring-ava-purple/60' : ''
              } ${
                !mk ? 'cursor-default text-gray-300'
                  : mk.done ? 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-100 active:scale-95'
                  : mk.missed ? 'bg-ava-surface border border-amber-400/40 text-amber-100/80 active:scale-95'
                  : 'bg-ava-surface border border-ava-border text-gray-300 active:scale-95'
              }`}
            >
              <span>{date.getDate()}</span>
              {mk && (
                <span className="mt-0.5 flex gap-0.5 items-center h-1">
                  {/* A finished day has said what it needs to; the type dots
                      would only add noise to a cell that is already green. */}
                  {mk.done ? (
                    <svg className="h-2 w-2 text-emerald-300" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.4}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 6.4 4.8 8.7 9.5 3.6" />
                    </svg>
                  ) : (
                    <>
                      {mk.training && <span className="h-1 w-1 rounded-full bg-ava-purple" />}
                      {mk.meals && <span className="h-1 w-1 rounded-full bg-amber-400" />}
                    </>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {dated.length > 0
        ? (
          <div className="mt-4 space-y-1.5 text-[10px] text-gray-500">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-ava-purple" /> {t('plansCalendarLegendTraining')}</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> {t('plansCalendarLegendMeals')}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500/25 border border-emerald-400/40" /> {t('plansCalendarLegendDone')}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm border border-amber-400/40" /> {t('plansCalendarLegendMissed')}</span>
            </div>
            <div>{t('plansCalendarTapDayHint')}</div>
          </div>
        )
        : <p className="mt-4 text-center text-[11px] text-gray-500">{t('plansCalendarEmptyState')}</p>}
    </div>
  );
}

// ── Create sheet ──────────────────────────────────────────────────────────────

function CreateSheet({ onCancel, onCreate }: {
  onCancel: () => void; onCreate: (type: HealthPlanType, duration: number, title: string, status: HealthPlanStatus) => void;
}) {
  const [type, setType] = useState<HealthPlanType>('fitness');
  const [duration, setDuration] = useState(7);
  const [title, setTitle] = useState('');
  const [activate, setActivate] = useState(false);

  return (
    // Was md:hidden, which made the create button do NOTHING on a desktop-width
    // browser — and the companion is a PWA people open on a laptop. A dead
    // button is worse than a missing one.
    <div className="fixed inset-0 z-[55]" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-lg rounded-t-3xl border-t border-ava-border bg-ava-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ava-border" />
        <h3 className="text-white font-semibold text-sm mb-4">{t('plansCreateSheetHeading')}</h3>

        <Label>{t('plansCreateTypeLabel')}</Label>
        <div className="flex gap-2 mb-4">
          {TYPES.map(([v, l]) => (
            <button key={v} onClick={() => setType(v)} className={`flex-1 rounded-lg border py-2 text-xs capitalize ${type === v ? 'border-ava-purple bg-ava-purple/10 text-ava-purple-light' : 'border-ava-border text-gray-400'}`}>{l}</button>
          ))}
        </div>

        <Label>{t('plansCreateDurationLabel')}</Label>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          {DURATIONS.map(([v, l]) => (
            <button key={v} onClick={() => setDuration(v)} className={`rounded-full border px-3 py-1.5 text-xs ${duration === v ? 'border-ava-purple bg-ava-purple/10 text-ava-purple-light' : 'border-ava-border text-gray-400'}`}>{l}</button>
          ))}
          {/* Any length you like — 14 and 21 days are common blocks and were
              simply not expressible before. Capped at a year to stop a typo
              generating a thousand empty days. */}
          <input
            inputMode="numeric"
            value={DURATIONS.some(([v]) => v === duration) ? '' : String(duration)}
            onChange={e => {
              const n = Number(e.target.value.replace(/\D/g, ''));
              if (Number.isFinite(n) && n > 0) setDuration(Math.min(365, n));
            }}
            placeholder={t('plansCreateCustomDays')}
            className={`w-24 rounded-full border px-3 py-1.5 text-xs bg-transparent placeholder-gray-600 focus:outline-none ${
              DURATIONS.some(([v]) => v === duration)
                ? 'border-ava-border text-gray-400'
                : 'border-ava-purple bg-ava-purple/10 text-ava-purple-light'
            }`}
          />
        </div>
        <div className="text-[10px] text-gray-500 mb-4">{t('plansCreateDurationHint')}</div>

        <Label>{t('plansCreateTitleLabel')}</Label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={type === 'meal' ? t('plansCreateMealPlanPlaceholder') : t('plansCreateFitnessPlanPlaceholder')}
          className="w-full bg-ava-bg border border-ava-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-ava-purple focus:outline-none mb-4" />

        <label className="flex items-center gap-2 mb-5 text-sm text-gray-300">
          <input type="checkbox" checked={activate} onChange={e => setActivate(e.target.checked)} className="accent-ava-purple" />
          {t('plansCreateActivateCheckbox')}
        </label>

        <button onClick={() => onCreate(type, duration, title, activate ? 'active' : 'draft')}
          className="w-full rounded-full border border-ava-purple/25 bg-ava-purple/10 py-3 text-sm font-semibold text-ava-purple hover:bg-ava-purple/20 transition">
          {t('plansCreateButton')}
        </button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{children}</div>;
}
