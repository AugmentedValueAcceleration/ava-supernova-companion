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

const TYPES: [HealthPlanType, string][] = [['fitness', 'Fitness'], ['meal', 'Meal'], ['combined', 'Combined']];
const DURATIONS: [number, string][] = [[1, '1 day'], [7, '1 week'], [28, '4 weeks'], [56, '8 weeks'], [84, '12 weeks']];

const STATUS_CLS: Record<HealthPlanStatus, string> = {
  draft: 'bg-ava-border text-gray-400',
  active: 'bg-emerald-400/15 text-emerald-300',
  completed: 'bg-sky-400/15 text-sky-300',
  archived: 'bg-ava-border text-gray-500',
};

function durationLabel(days: number): string {
  if (days <= 1) return '1 day';
  const w = Math.round(days / 7);
  return w === 1 ? '1 week' : `${w} weeks`;
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
  // Repeat = re-run the same plan from today: force a fresh start date and
  // re-activate (which archives any other active plan of the same type).
  const repeat = (id: string) => {
    const p = getPlan(id);
    if (!p) return;
    savePlan({ ...p, status: 'active', start_date: todayIso() });
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
        <div className="px-4 py-3 border-b border-ava-border flex items-center justify-between">
          <h2 className="font-semibold text-white text-lg">{t('plansHeading')}</h2>
          <Button onClick={() => setCreating(true)} size="sm">{t('plansNewButton')}</Button>
        </div>

        <div className="flex gap-1 border-b border-ava-border px-2">
          <TabBtn label={t('plansTabPrograms')} active={tab === 'programs'} onClick={() => setTab('programs')} />
          <TabBtn label={t('plansTabCalendar')} active={tab === 'calendar'} onClick={() => setTab('calendar')} />
        </div>

        {tab === 'programs'
          ? <Programs plans={plans} onActivate={activate} onRepeat={repeat} onDelete={del} onNew={() => setCreating(true)} onOpen={(id) => setOpen({ id, day: 1 })} />
          : <Calendar plans={plans} onOpenDay={(id, day) => setOpen({ id, day })} />}
      </div>

      {creating && <CreateSheet onCancel={() => setCreating(false)} onCreate={create} />}
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

function Programs({ plans, onActivate, onRepeat, onDelete, onNew, onOpen }: {
  plans: HealthPlanSummary[]; onActivate: (id: string) => void; onRepeat: (id: string) => void; onDelete: (id: string) => void; onNew: () => void; onOpen: (id: string) => void;
}) {
  if (plans.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm text-gray-400">{t('plansEmptyState')}</p>
        <Button onClick={onNew} variant="secondary" className="mt-3">{t('plansEmptyStateButton')}</Button>
      </div>
    );
  }
  return (
    <div className="px-4 py-4 space-y-3">
      {plans.map(p => (
        <div key={p.id} className="rounded-xl border border-ava-border bg-ava-surface p-4">
          <button onClick={() => onOpen(p.id)} className="flex items-start justify-between gap-3 w-full text-left">
            <div className="min-w-0">
              <div className="text-white text-sm font-medium truncate">{p.title}</div>
              <div className="text-[11px] text-gray-500 mt-0.5 capitalize">{p.type} · {durationLabel(p.duration_days)} · {t('plansProgramsTapToBuild')}</div>
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
  // dot for meal/combined — so all created plans are visible at a glance.
  const marks = useMemo(() => {
    const map = new Map<string, { training: boolean; meals: boolean }>();
    for (const p of dated) {
      const start = new Date(`${p.start_date}T00:00:00`);
      if (isNaN(start.getTime())) continue;
      const training = p.type === 'fitness' || p.type === 'combined';
      const meals = p.type === 'meal' || p.type === 'combined';
      for (let i = 0; i < p.duration_days; i++) {
        const d = new Date(start); d.setDate(d.getDate() + i);
        const k = dateKey(d); const prev = map.get(k) ?? { training: false, meals: false };
        map.set(k, { training: prev.training || training, meals: prev.meals || meals });
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
            <button
              key={i}
              onClick={() => { const t = planForDate(date); if (t) onOpenDay(t.id, t.day); }}
              disabled={!mk}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[11px] text-gray-300 ${isToday ? 'ring-1 ring-ava-purple/60' : ''} ${mk ? 'bg-ava-surface border border-ava-border active:scale-95 transition' : 'cursor-default'}`}
            >
              <span>{date.getDate()}</span>
              {mk && (
                <span className="mt-0.5 flex gap-0.5">
                  {mk.training && <span className="h-1 w-1 rounded-full bg-ava-purple" />}
                  {mk.meals && <span className="h-1 w-1 rounded-full bg-amber-400" />}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {dated.length > 0
        ? (
          <div className="mt-4 flex gap-4 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-ava-purple" /> {t('plansCalendarLegendTraining')}</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> {t('plansCalendarLegendMeals')}</span>
            <span className="ml-auto">{t('plansCalendarTapDayHint')}</span>
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
  const [duration, setDuration] = useState(28);
  const [title, setTitle] = useState('');
  const [activate, setActivate] = useState(false);

  return (
    <div className="md:hidden fixed inset-0 z-[55]" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-ava-border bg-ava-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ava-border" />
        <h3 className="text-white font-semibold text-sm mb-4">{t('plansCreateSheetHeading')}</h3>

        <Label>{t('plansCreateTypeLabel')}</Label>
        <div className="flex gap-2 mb-4">
          {TYPES.map(([v, l]) => (
            <button key={v} onClick={() => setType(v)} className={`flex-1 rounded-lg border py-2 text-xs capitalize ${type === v ? 'border-ava-purple bg-ava-purple/10 text-ava-purple-light' : 'border-ava-border text-gray-400'}`}>{l}</button>
          ))}
        </div>

        <Label>{t('plansCreateDurationLabel')}</Label>
        <div className="flex flex-wrap gap-2 mb-4">
          {DURATIONS.map(([v, l]) => (
            <button key={v} onClick={() => setDuration(v)} className={`rounded-full border px-3 py-1.5 text-xs ${duration === v ? 'border-ava-purple bg-ava-purple/10 text-ava-purple-light' : 'border-ava-border text-gray-400'}`}>{l}</button>
          ))}
        </div>

        <Label>{t('plansCreateTitleLabel')}</Label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={type === 'meal' ? t('plansCreateMealPlanPlaceholder') : t('plansCreateFitnessPlanPlaceholder')}
          className="w-full bg-ava-bg border border-ava-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-ava-purple focus:outline-none mb-4" />

        <label className="flex items-center gap-2 mb-5 text-sm text-gray-300">
          <input type="checkbox" checked={activate} onChange={e => setActivate(e.target.checked)} className="accent-ava-purple" />
          {t('plansCreateActivateCheckbox')}
        </label>

        <button onClick={() => onCreate(type, duration, title, activate ? 'active' : 'draft')}
          className="w-full rounded-full bg-ava-purple py-3 text-sm font-semibold text-white hover:bg-ava-purple-dark transition">
          {t('plansCreateButton')}
        </button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{children}</div>;
}
