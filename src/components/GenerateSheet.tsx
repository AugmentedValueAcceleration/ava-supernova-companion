'use client';

// ─── Ask Ava for a plan ─────────────────────────────────────────────────────
//
// The companion had no route to plan generation at all. Asking Ava in chat
// produced a skeleton with empty days, so everything the generator knows —
// allergens excluded, injuries screened, calories targeted, cooking time
// respected — reached the extension and not the phone. And the Plans screen had
// exactly one button, "New", which meant manual: no visible choice, so of
// course there was no separation between building it yourself and asking her.
//
// Three things make this feel like Ava made it rather than a form submitting:
//
//   1. It SHOWS WHAT SHE KNOWS before she starts. Reading your own goal, your
//      own injuries and your own allergens back to you is the difference
//      between a service and a vending machine — and it makes the profile
//      visibly worth filling in.
//   2. It says what it COST and what it EXCLUDED. A plan that quietly dropped
//      245 recipes for a shellfish allergy should say so; that is the product
//      working, and hiding it wastes the only evidence the user has.
//   3. It PROPOSES. Nothing is saved until they accept, same as every other
//      Ava surface here.

import { useState, useMemo } from 'react';
import { t, useLocale } from '@/lib/i18n';
import { healthAssistApi } from '@/lib/api';
import { normaliseHealthProfile } from '@/lib/health-types';
import { computeTargets } from '@/lib/health-targets';
import { BottomSheet, SheetConfirm, SheetCancel } from './BottomSheet';
import type { HealthPlan, HealthPlanType, HealthProfile } from '@/lib/health-types';

const TYPES: Array<[HealthPlanType, string]> = [
  ['fitness', 'Fitness'], ['meal', 'Meal'], ['combined', 'Combined'],
];
const DURATIONS: Array<[number, string]> = [[1, '1 day'], [3, '3 days'], [7, '1 week']];

/** Mirrors creditsForPlan on the server — stated up front, never discovered
 *  after the fact. Kept in step with packages/web/src/lib/credits-pricing.ts. */
function creditsFor(type: HealthPlanType, days: number): number {
  const perWeek = type === 'combined' ? 10 : 5;
  return Math.max(1, Math.ceil((days * perWeek) / 7));
}

type Phase = 'setup' | 'working' | 'done';

export function GenerateSheet({ token, profile, onAccept, onClose }: {
  token: string | null;
  profile: HealthProfile | null;
  onAccept: (plan: HealthPlan) => void;
  onClose: () => void;
}) {
  useLocale();
  const [type, setType] = useState<HealthPlanType>('combined');
  const [duration, setDuration] = useState(7);
  const [goal, setGoal] = useState('');
  const [phase, setPhase] = useState<Phase>('setup');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof healthAssistApi.plan>> | null>(null);

  const targets = useMemo(() => computeTargets(profile), [profile]);

  // What she is actually going to use. Read back plainly, because a person who
  // can see their own constraints reflected trusts the result — and a person
  // who sees them MISSING knows exactly what to go and fill in.
  const knows = useMemo(() => {
    const bits: Array<{ label: string; value: string }> = [];
    const g = profile?.goals.primary;
    if (g) bits.push({ label: t('generateKnowsGoal'), value: g.replace('_', ' ') });
    const days = profile?.training?.days_per_week;
    if (days) bits.push({ label: t('generateKnowsTraining'), value: `${days}/wk` });
    const inj = profile?.constraints.injuries ?? [];
    if (inj.length) bits.push({ label: t('generateKnowsInjuries'), value: inj.join(', ') });
    const all = profile?.constraints.allergens ?? [];
    if (all.length) bits.push({ label: t('generateKnowsAllergens'), value: all.join(', ') });
    const diet = profile?.constraints.dietary ?? [];
    if (diet.length) bits.push({ label: t('generateKnowsDiet'), value: diet.join(', ') });
    const mins = profile?.kitchen?.minutes_weekday;
    if (mins) bits.push({ label: t('generateKnowsCooking'), value: `${mins} min` });
    if (targets.target_calories) {
      bits.push({ label: t('generateKnowsTarget'), value: `${targets.target_calories} kcal` });
    }
    return bits;
  }, [profile, targets]);

  const cost = creditsFor(type, duration);

  const run = async () => {
    if (!token) { setError(t('generateNeedsAccount')); return; }
    setPhase('working'); setError(null);
    try {
      const res = await healthAssistApi.plan(token, {
        type,
        duration_days: duration,
        goal: goal.trim() || null,
        profile: profile ? normaliseHealthProfile(profile) : undefined,
      });
      setResult(res);
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('generateFailed'));
      setPhase('setup');
    }
  };

  /**
   * Keep it — and say whether it starts.
   *
   * This used to save a draft unconditionally, and a draft has no start date.
   * Nothing without a date can appear on the calendar or in Today, so a plan
   * Ava had just written was invisible everywhere except the Programs list —
   * you got a plan and then could not find it. The choice has to be made here,
   * because it is the only moment anyone is thinking about it.
   */
  const accept = (start: boolean) => {
    if (!result) return;
    onAccept({
      schema_version: 3,
      id: `plan${Date.now()}${Math.floor(Math.random() * 1000)}`,
      type: result.type as HealthPlanType,
      title: result.title,
      goal: result.goal,
      source: 'ava',
      // savePlan stamps today's date on anything activated without one, and
      // archives any other active plan of the same type.
      status: start ? 'active' : 'draft',
      duration_days: result.duration_days,
      start_date: null,
      profile_snapshot: null,
      days: result.days as HealthPlan['days'],
      created_at: null,
      updated_at: null,
    });
    onClose();
  };

  // ── Working ───────────────────────────────────────────────────────────────
  if (phase === 'working') {
    return (
      // busy: generation is charged and server-side, so dismissing does not
      // cancel it — it only loses what was paid for.
      <BottomSheet title={t('generateWorkingTitle')} busy onClose={() => { /* not dismissible */ }}>
        <div className="py-8 text-center">
          {/* Her face, not a generic sparkle. This is the one moment in the
              flow where Ava is doing the work, and a stock icon makes it feel
              like a progress bar rather than a person. The ring pulses; the
              photograph does not, because a throbbing face is unsettling. */}
          <div className="relative w-16 h-16 mx-auto">
            <span className="absolute inset-0 rounded-full border-2 border-ava-purple/50 animate-ping" />
            <div
              className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-ava-purple flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--accent, #a855f7), #6366f1)' }}
            >
              <img
                src="/ava-avatar.jpeg"
                alt="Ava"
                className="w-full h-full object-cover"
                // Degrades to the brand gradient rather than a hole, same as
                // the welcome flow does.
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          </div>
          <div className="mt-4 text-[13px] text-gray-200">{t('generateWorkingLine')}</div>
          <div className="mt-1.5 text-[11px] text-gray-500 leading-relaxed max-w-xs mx-auto">
            {t('generateWorkingHint')}
          </div>
        </div>
      </BottomSheet>
    );
  }

  // ── Done — the proposal ───────────────────────────────────────────────────
  if (phase === 'done' && result) {
    const ex = result.filtering?.excluded ?? {};
    const removed = [
      ex.recipes_allergen ? `${ex.recipes_allergen} ${t('generateRemovedAllergen')}` : null,
      ex.exercises_unsafe ? `${ex.exercises_unsafe} ${t('generateRemovedUnsafe')}` : null,
      ex.recipes_too_slow ? `${ex.recipes_too_slow} ${t('generateRemovedSlow')}` : null,
      ex.recipes_off_diet ? `${ex.recipes_off_diet} ${t('generateRemovedOffDiet')}` : null,
      ex.exercises_no_equipment ? `${ex.exercises_no_equipment} ${t('generateRemovedNoKit')}` : null,
    ].filter(Boolean) as string[];

    const days = result.days as HealthPlan['days'];
    const training = days.filter(d => d.kind === 'training').length;
    const meals = days.reduce((n, d) => n + d.meals.length, 0);

    return (
      <BottomSheet
        title={result.title}
        subtitle={`${result.duration_days} ${t('generateDaysWord')}`}
        onClose={onClose}
        // Two equal halves, both the house style. The old pair was a squashed
        // outline next to a solid purple slab, which read as "the real button
        // and the one you probably don't want" — and rejecting a plan Ava got
        // wrong is a legitimate, equal choice.
        // Starting it is the primary action, because a plan you cannot find is
        // not a plan — and only an ACTIVE plan gets a date, which is what puts
        // it on the calendar and in Today. Saving it for later is right there
        // and quiet.
        footer={
          <div className="space-y-2">
            <SheetConfirm label={t('generateStartToday')} onClick={() => accept(true)} />
            <div className="flex gap-2">
              <div className="flex-1"><SheetCancel label={t('generateAgain')} onClick={() => { setResult(null); setPhase('setup'); }} /></div>
              <div className="flex-1"><SheetCancel label={t('generateSaveDraft')} onClick={() => accept(false)} /></div>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            {training > 0 && <Stat value={String(training)} label={t('generateStatSessions')} />}
            {meals > 0 && <Stat value={String(meals)} label={t('generateStatMeals')} />}
            <Stat value={String(result.credits_charged)} label={t('generateStatCredits')} />
          </div>

          {/* The filtering IS the product. A plan that dropped 245 recipes for a
              shellfish allergy should say so — hiding it throws away the only
              evidence the person has that it worked. */}
          {removed.length > 0 && (
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-wider text-emerald-300/70 mb-1">
                {t('generateFilteredHeading')}
              </div>
              <div className="text-[11px] text-gray-300 leading-relaxed">{removed.join(' · ')}</div>
            </div>
          )}

          {(result.filtering?.unverifiable_allergens.length ?? 0) > 0 && (
            <div className="rounded-md border border-ava-border bg-ava-bg px-2 py-1.5 text-[11px] text-gray-400">
              {t('generateUnverifiable')} {result.filtering!.unverifiable_allergens.join(', ')}
            </div>
          )}

          {/* THE PLAN ITSELF, not a summary of it.
              This showed one line per day with a count — "Day 1, Full Body
              Foundation, 6x 4" — which asks someone to accept work they have
              not been shown. If the answer to "what am I saving?" is a number,
              the screen has not done its job. */}
          <div className="space-y-2">
            {days.map(d => (
              <div key={d.day_index} className="rounded-lg border border-ava-border bg-ava-surface px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] text-white truncate">
                    <span className="text-gray-600 mr-1.5">{t('generateDayWord')} {d.day_index}</span>
                    {d.title || (d.kind === 'rest' ? t('generateRestWord') : '')}
                  </span>
                  {d.meals.length > 0 && (
                    <span className="shrink-0 text-[10px] text-gray-500 tabular-nums">
                      {d.meals.reduce((n, m) => n + (m.calories ?? 0), 0)} kcal
                    </span>
                  )}
                </div>

                {d.training.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {d.training.map(ex => (
                      <li key={ex.id} className="flex items-baseline justify-between gap-2 text-[11px]">
                        <span className="min-w-0 truncate text-gray-300">{ex.name}</span>
                        <span className="shrink-0 font-mono text-[10px] text-gray-600">
                          {[ex.sets ? `${ex.sets}×${ex.reps ?? ''}` : ex.reps, ex.weight].filter(Boolean).join(' · ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {d.meals.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {d.meals.map(m => (
                      <li key={m.id} className="flex items-baseline justify-between gap-2 text-[11px]">
                        <span className="min-w-0 truncate text-gray-300">
                          <span className="font-mono text-[10px] text-gray-600 mr-1">{(m.slot ?? '').slice(0, 2)}</span>
                          {m.name}
                        </span>
                        {m.calories != null && (
                          <span className="shrink-0 font-mono text-[10px] text-gray-600">{Math.round(m.calories)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {d.kind === 'rest' && d.training.length === 0 && d.meals.length === 0 && (
                  <div className="mt-1 text-[11px] italic text-gray-600">{t('generateRestWord')}</div>
                )}
              </div>
            ))}
          </div>

          <div className="text-[10px] text-gray-500">{t('generateEditableHint')}</div>
        </div>
      </BottomSheet>
    );
  }

  // ── Setup ─────────────────────────────────────────────────────────────────
  return (
    <BottomSheet
      title={t('generateTitle')}
      subtitle={t('generateSubtitle')}
      onClose={onClose}
      footer={<SheetConfirm label={`${t('generateGo')} · ${cost} ${t('generateCreditsWord')}`} onClick={run} />}
    >
      <div className="space-y-4">
        <div>
          <Label>{t('plansCreateTypeLabel')}</Label>
          <div className="flex gap-2">
            {TYPES.map(([v, l]) => (
              <button key={v} onClick={() => setType(v)}
                className={`flex-1 rounded-lg border py-2 text-xs ${type === v ? 'border-ava-purple bg-ava-purple/10 text-ava-purple-light' : 'border-ava-border text-gray-400'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>{t('plansCreateDurationLabel')}</Label>
          <div className="flex gap-2">
            {DURATIONS.map(([v, l]) => (
              <button key={v} onClick={() => setDuration(v)}
                className={`flex-1 rounded-lg border py-2 text-xs ${duration === v ? 'border-ava-purple bg-ava-purple/10 text-ava-purple-light' : 'border-ava-border text-gray-400'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>{t('generateGoalLabel')}</Label>
          <input value={goal} onChange={e => setGoal(e.target.value)}
            placeholder={t('generateGoalPlaceholder')}
            className="w-full bg-ava-surface border border-ava-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-ava-purple focus:outline-none" />
        </div>

        {/* What she is working from. The point of this block is that a person
            who can see their own constraints reflected trusts the result — and
            one who sees them missing knows what to go and fill in. */}
        <div className="rounded-lg border border-ava-border bg-ava-surface px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">
            {t('generateKnowsHeading')}
          </div>
          {knows.length === 0 ? (
            <div className="text-[11px] text-gray-500 leading-relaxed">{t('generateKnowsEmpty')}</div>
          ) : (
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {knows.map(k => (
                <span key={k.label} className="text-[11px] text-gray-400">
                  <span className="text-gray-600">{k.label}</span> <span className="text-gray-200 capitalize">{k.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200/90">
            {error}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">{children}</div>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 rounded-lg border border-ava-border bg-ava-surface px-2 py-2 text-center">
      <div className="text-[17px] font-light text-white tabular-nums">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-gray-500">{label}</div>
    </div>
  );
}

export function Sparkle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
    </svg>
  );
}
