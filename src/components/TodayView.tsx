'use client';

// ─── Today dashboard (Phase 3b) ─────────────────────────────────────────────
//
// The daily surface: Ava's morning brief, readiness/nutrition/training reads,
// and one-tap logging (meals / water / sleep / mood). Mirrors the extension's
// HealthDashboard — same compute logic, same honest empty states. The brief is
// generated server-side (1 credit); everything else is local + offline.

import { useState, useCallback, useMemo } from 'react';
import { t, useLocale } from '@/lib/i18n';
import { loadProfile } from '@/lib/health-profile-store';
import { loadDay, saveDay, todayIso, logId, nowHHMM } from '@/lib/health-day-store';
import { briefApi } from '@/lib/api';
import type { HealthProfile, HealthDailyPlan, HealthDailyLog } from '@/lib/health-types';

export function TodayView({ token }: { token?: string | null }) {
  useLocale();
  const today = todayIso();
  const [profile] = useState<HealthProfile | null>(() => loadProfile());
  const [plan, setPlan] = useState<HealthDailyPlan>(() => loadDay(today));
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefErr, setBriefErr] = useState<string | null>(null);

  const profileEmpty = !profile || (profile.body.weight_kg == null && profile.body.height_cm == null && profile.goals.primary == null);

  const commit = useCallback((mutate: (log: HealthDailyLog) => HealthDailyLog) => {
    setPlan(prev => saveDay({ ...prev, log: mutate(prev.log) }));
  }, []);

  const generateBrief = useCallback(async () => {
    if (!token) { setBriefErr('Sign in to let Ava write your brief.'); return; }
    setBriefBusy(true); setBriefErr(null);
    try {
      const res = await briefApi.generate(token, { date: today, profile, log: plan.log });
      if (res?.brief) setPlan(prev => saveDay({ ...prev, morning_brief: res.brief }));
      else setBriefErr(res?.error ?? 'Couldn’t write the brief.');
    } catch (e) {
      setBriefErr(e instanceof Error ? e.message : 'Couldn’t write the brief.');
    } finally {
      setBriefBusy(false);
    }
  }, [token, today, profile, plan.log]);

  const readiness = useMemo(() => computeReadiness(profile, plan), [profile, plan]);
  const nutrition = useMemo(() => computeNutrition(profile, plan), [profile, plan]);
  const training = useMemo(() => computeTraining(plan), [plan]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full px-4 py-5 pb-28">
        <div className="text-[11px] uppercase tracking-wider text-gray-500">{longDate()}</div>
        <h1 className="mt-1 text-xl font-light text-white">{greeting()}.</h1>

        {profileEmpty && (
          <div className="mt-5 rounded-lg border border-ava-purple/30 bg-ava-purple/5 px-4 py-3 text-[12px] text-gray-300">
            {t('todayProfileSetupHint')}
          </div>
        )}

        {/* Morning brief */}
        <section className="mt-6">
          <h2 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{t('todayMorningBriefLabel')}</h2>
          {plan.morning_brief
            ? <p className="text-[15px] leading-relaxed text-white font-light">{plan.morning_brief}</p>
            : <p className="rounded-lg border border-ava-border px-4 py-4 text-[12px] text-gray-500 italic">{t('todayNoBriefEmpty')}</p>}
          {briefErr && <p className="mt-2 text-[12px] text-red-300">{briefErr}</p>}
          <button
            onClick={generateBrief}
            disabled={briefBusy || profileEmpty}
            className="mt-3 rounded-full border border-ava-purple/40 bg-ava-purple/10 px-4 py-1.5 text-[12px] text-ava-purple-light hover:bg-ava-purple/20 transition disabled:opacity-40"
          >
            {briefBusy ? t('todayBriefGeneratingButton') : plan.morning_brief ? t('todayBriefRewriteButton') : t('todayBriefCreateButton')}
          </button>
        </section>

        {/* Status */}
        <section className="mt-7">
          <h2 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{t('todayStatusLabel')}</h2>
          <div className="grid grid-cols-3 gap-2.5">
            <Tile label={t('todayReadinessTile')} value={readiness.value} hint={readiness.hint} />
            <Tile label={t('todayNutritionTile')} value={nutrition.value} hint={nutrition.hint} />
            <Tile label={t('todayTrainingTile')} value={training.value} hint={training.hint} />
          </div>
        </section>

        {/* Quick log */}
        <section className="mt-7">
          <h2 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{t('todayQuickLogLabel')}</h2>
          <QuickLog log={plan.log} commit={commit} />
        </section>
      </div>
    </div>
  );
}

// ── Status tiles ─────────────────────────────────────────────────────────────

interface Figure { value: string; hint: string }

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-ava-border bg-ava-surface px-3 py-3">
      <div className="text-[9px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 text-[17px] font-light text-white">{value}</div>
      <div className="mt-1 text-[10px] text-gray-500 leading-snug">{hint}</div>
    </div>
  );
}

function computeReadiness(profile: HealthProfile | null, plan: HealthDailyPlan): Figure {
  const sleep = plan.log.sleep_hours;
  const mood = plan.log.mood;
  if (sleep == null && mood == null) return { value: '—', hint: t('todayReadinessEmptyHint') };
  const target = targetSleepHours(profile);
  let score = 0, weight = 0;
  if (sleep != null) { score += Math.min(sleep / target, 1) * 0.6; weight += 0.6; }
  if (mood != null) { score += (mood / 5) * 0.4; weight += 0.4; }
  const pct = Math.round((score / weight) * 100);
  const word = pct >= 80 ? t('todayReadinessStrong') : pct >= 60 ? t('todayReadinessGood') : pct >= 40 ? t('todayReadinessFair') : t('todayReadinessLow');
  const bits: string[] = [];
  if (sleep != null) bits.push(`${fmtH(sleep)}/${fmtH(target)} ${t('todayReadinessSleepLabel')}`);
  if (mood != null) bits.push(`${t('todayReadinessMoodLabel')} ${mood}/5`);
  return { value: word, hint: bits.join(' · ') };
}

function computeNutrition(profile: HealthProfile | null, plan: HealthDailyPlan): Figure {
  const meals = plan.log.meals;
  const water = plan.log.water_ml;
  if (meals.length === 0 && water === 0) return { value: '—', hint: t('todayNutritionEmptyHint') };
  const protein = meals.reduce((a, m) => a + (m.protein_g ?? 0), 0);
  const kcal = meals.reduce((a, m) => a + (m.calories ?? 0), 0);
  const target = proteinTarget(profile);
  const bits: string[] = [];
  if (protein > 0) bits.push(target != null ? `${Math.round(protein)}/${target}g P` : `${Math.round(protein)}g P`);
  if (kcal > 0) bits.push(`${kcal} kcal`);
  bits.push(`${fmtWater(water)} ${t('todayNutritionWaterLabel')}`);
  return { value: meals.length === 0 ? '—' : `${meals.length} ${t('todayNutritionMealsValue')}`, hint: bits.join(' · ') };
}

function computeTraining(plan: HealthDailyPlan): Figure {
  const training = plan.items.filter(i => i.kind === 'workout' || i.kind === 'mobility');
  if (training.length === 0) return { value: t('todayTrainingRestValue'), hint: t('todayTrainingNoSessionHint') };
  const done = training.filter(i => i.status === 'done').length;
  return { value: `${done}/${training.length}`, hint: t('todayTrainingSessionsHint') };
}

// ── Quick log ────────────────────────────────────────────────────────────────

type LogKind = 'meal' | 'water' | 'sleep' | 'mood';
const MOOD_FACE: Record<number, string> = { 1: '😔', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };

function QuickLog({ log, commit }: { log: HealthDailyLog; commit: (m: (l: HealthDailyLog) => HealthDailyLog) => void }) {
  const [open, setOpen] = useState<LogKind | null>(null);
  const toggle = (k: LogKind) => setOpen(o => (o === k ? null : k));
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <LogBtn label={log.meals.length > 0 ? `${log.meals.length} ${t('todayLogMealsButton')}` : t('todayLogAddMealButton')} active={open === 'meal'} onClick={() => toggle('meal')} />
        <LogBtn label={log.water_ml > 0 ? fmtWater(log.water_ml) : t('todayLogWaterButton')} active={open === 'water'} onClick={() => toggle('water')} />
        <LogBtn label={log.sleep_hours != null ? fmtH(log.sleep_hours) : t('todayLogSleepButton')} active={open === 'sleep'} onClick={() => toggle('sleep')} />
        <LogBtn label={log.mood != null ? MOOD_FACE[log.mood] : t('todayLogMoodButton')} active={open === 'mood'} onClick={() => toggle('mood')} />
      </div>
      {open && (
        <div className="mt-2 rounded-lg border border-ava-purple/30 bg-ava-purple/5 px-4 py-3">
          {open === 'meal' && <MealEditor log={log} commit={commit} />}
          {open === 'water' && (
            <Chips>
              {[250, 500].map(ml => <Chip key={ml} onClick={() => commit(l => ({ ...l, water_ml: Math.max(0, l.water_ml + ml) }))}>+{ml}ml</Chip>)}
              <Chip onClick={() => commit(l => ({ ...l, water_ml: Math.max(0, l.water_ml - 250) }))} disabled={log.water_ml <= 0}>−250ml</Chip>
              <Chip onClick={() => commit(l => ({ ...l, water_ml: 0 }))} disabled={log.water_ml <= 0}>{t('todayLogWaterReset')}</Chip>
            </Chips>
          )}
          {open === 'sleep' && (
            <Chips>
              <Chip onClick={() => commit(l => ({ ...l, sleep_hours: Math.max(0, round1((l.sleep_hours ?? 7.5) - 0.5)) }))}>−30m</Chip>
              <span className="min-w-[3.5rem] text-center text-[13px] text-white">{fmtH(log.sleep_hours ?? 7.5)}</span>
              <Chip onClick={() => commit(l => ({ ...l, sleep_hours: Math.min(14, round1((l.sleep_hours ?? 7.5) + 0.5)) }))}>+30m</Chip>
              {log.sleep_hours != null && <Chip onClick={() => commit(l => ({ ...l, sleep_hours: null }))}>{t('todayLogSleepClear')}</Chip>}
            </Chips>
          )}
          {open === 'mood' && (
            <div className="flex gap-2">
              {([1, 2, 3, 4, 5] as const).map(m => (
                <button key={m} onClick={() => commit(l => ({ ...l, mood: m }))}
                  className={`flex-1 rounded-lg border py-2 text-[18px] transition ${log.mood === m ? 'border-ava-purple/60 bg-ava-purple/10' : 'border-ava-border'}`}>
                  {MOOD_FACE[m]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LogBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-lg border px-3 py-2 text-[12px] transition ${active ? 'border-ava-purple/60 bg-ava-purple/10 text-ava-purple-light' : 'border-ava-border text-gray-300'}`}>
      {label}
    </button>
  );
}

function Chips({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}
function Chip({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className="rounded-md border border-ava-border bg-ava-surface px-2.5 py-1 text-[11px] text-gray-300 disabled:opacity-40">{children}</button>;
}

function MealEditor({ log, commit }: { log: HealthDailyLog; commit: (m: (l: HealthDailyLog) => HealthDailyLog) => void }) {
  const [desc, setDesc] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const numOrNull = (s: string) => { const n = Number(s); return s.trim() && Number.isFinite(n) && n > 0 ? Math.round(n) : null; };
  const add = () => {
    if (!desc.trim()) return;
    commit(l => ({ ...l, meals: [...l.meals, { id: logId(), time: nowHHMM(), description: desc.trim(), calories: numOrNull(kcal), protein_g: numOrNull(protein) }] }));
    setDesc(''); setKcal(''); setProtein('');
  };
  const fc = 'rounded-md border border-ava-border bg-ava-surface px-3 py-1.5 text-[12px] text-white placeholder-gray-500 focus:border-ava-purple focus:outline-none';
  return (
    <div>
      {log.meals.length > 0 && (
        <ul className="mb-3 space-y-1">
          {log.meals.map(m => (
            <li key={m.id} className="flex items-baseline justify-between gap-2 text-[12px]">
              <span className="truncate text-white"><span className="font-mono text-[10px] text-gray-500">{m.time}</span> {m.description}</span>
              <button onClick={() => commit(l => ({ ...l, meals: l.meals.filter(x => x.id !== m.id) }))} className="text-gray-500 hover:text-red-300">×</button>
            </li>
          ))}
        </ul>
      )}
      <input value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder={t('todayLogMealPlaceholder')} className={`w-full ${fc}`} />
      <div className="mt-2 flex gap-2">
        <input value={kcal} onChange={e => setKcal(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder={t('todayLogMealKcalPlaceholder')} className={`min-w-0 flex-1 ${fc}`} />
        <input value={protein} onChange={e => setProtein(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder={t('todayLogMealProteinPlaceholder')} className={`min-w-0 flex-1 ${fc}`} />
        <button onClick={add} disabled={!desc.trim()} className="shrink-0 rounded-md border border-ava-purple/40 bg-ava-purple/10 px-4 py-1.5 text-[12px] text-ava-purple-light disabled:opacity-40">{t('todayLogMealAddButton')}</button>
      </div>
    </div>
  );
}

// ── utils ────────────────────────────────────────────────────────────────────

function targetSleepHours(profile: HealthProfile | null): number {
  const bed = parseHHMM(profile?.schedule.sleep_target.bedtime ?? null);
  const wake = parseHHMM(profile?.schedule.sleep_target.wake ?? null);
  if (bed == null || wake == null) return 8;
  let mins = wake - bed;
  if (mins <= 0) mins += 24 * 60;
  return mins / 60;
}
function proteinTarget(profile: HealthProfile | null): number | null {
  const kg = profile?.body.weight_kg;
  if (kg == null) return null;
  const goal = profile?.goals.primary;
  const factor = goal === 'muscle_gain' || goal === 'athletic' ? 2.0 : goal === 'fat_loss' ? 1.8 : 1.6;
  return Math.round(kg * factor);
}
function parseHHMM(s: string | null): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}
function fmtH(h: number): string { return `${Number(h.toFixed(1))}h`; }
function fmtWater(ml: number): string { return ml >= 1000 ? `${Number((ml / 1000).toFixed(1))}L` : `${ml}ml`; }
function round1(n: number): number { return Math.round(n * 10) / 10; }
function longDate(): string { return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }); }
function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Late one';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Winding down';
}
