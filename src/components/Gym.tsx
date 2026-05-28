'use client';

// ─── Gym ────────────────────────────────────────────────────────────────────
//
// One-page gym timer. Tap the circle to start / pause / resume. Four modes:
// Stopwatch (count up), Countdown (held positions), Sets (work+rest × N),
// Tabata (20/10 × 8). On Finished, swap to the tick-list panel if there's a
// planned workout for today. Week strip at the foot.

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { t, useLocale } from '@/lib/i18n';
import { listPlans, getPlan } from '@/lib/health-plan-store';
import {
  listSessions,
  saveSession,
  GYM_SESSIONS_CHANGED_EVENT,
} from '@/lib/gym-session-store';
import { freshGymSession, gymExerciseFromPlan } from '@/lib/gym-types';
import { todayIso } from '@/lib/health-day-store';
import type { GymSession } from '@/lib/gym-types';
import type { HealthPlan, HealthPlanDay, HealthPlanExercise } from '@/lib/health-types';

type Mode = 'stopwatch' | 'countdown' | 'sets' | 'tabata';
type Phase = 'idle' | 'running' | 'paused' | 'finished';
type SubPhase = 'work' | 'rest';

// ── Audio + haptic helpers ──────────────────────────────────────────────────
function beep(freq: number, duration = 120, volume = 0.18) {
  try {
    const AudioCtxCtor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AudioCtxCtor) return;
    const ctx = new AudioCtxCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close().catch(() => {}); }, duration);
  } catch { /* ignore */ }
}
function vibrate(pattern: number | number[]) {
  try { (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate?.(pattern); } catch { /* ignore */ }
}

// ── Countdown presets per mode ──────────────────────────────────────────────
const STOPWATCH_TARGETS = [30, 45, 60, 90] as const; // minutes
const COUNTDOWN_PRESETS = [
  { label: '30s',  sec: 30  },
  { label: '45s',  sec: 45  },
  { label: '1m',   sec: 60  },
  { label: '2m',   sec: 120 },
  { label: '5m',   sec: 300 },
] as const;
const ROUNDS_CYCLE = [3, 4, 5, 6, 8, 10];
const WORK_CYCLE   = [20, 30, 40, 45, 60, 75, 90, 120];
const REST_CYCLE   = [15, 30, 45, 60, 75, 90, 120, 180];
const TABATA = { work: 20, rest: 10, rounds: 8 };

export function GymView() {
  useLocale();
  const today = todayIso();

  const [sessions, setSessions] = useState<GymSession[]>(() => listSessions());
  useEffect(() => {
    const refresh = () => setSessions(listSessions());
    window.addEventListener(GYM_SESSIONS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(GYM_SESSIONS_CHANGED_EVENT, refresh);
  }, []);

  const planSummary = listPlans().find(p => p.status === 'active');
  const plan = planSummary ? getPlan(planSummary.id) : null;
  const planDay = plan ? planDayForDate(plan, today) : null;
  const plannedExercises: HealthPlanExercise[] = planDay?.training ?? [];

  // ── Timer state
  const [mode, setMode] = useState<Mode>('stopwatch');
  const [phase, setPhase] = useState<Phase>('idle');
  const [subphase, setSubphase] = useState<SubPhase>('work');
  const [round, setRound] = useState<number>(1);

  // Stopwatch target & countdown duration (seconds).
  const [stopwatchTargetMin, setStopwatchTargetMin] = useState<number>(60);
  const [countdownSec, setCountdownSec] = useState<number>(60);
  const [setsRounds, setSetsRounds] = useState<number>(5);
  const [setsWork, setSetsWork] = useState<number>(60);
  const [setsRest, setSetsRest] = useState<number>(90);

  // The single elapsed-since-last-resume counter (resets at each subphase change for sets/tabata).
  const [seconds, setSeconds] = useState(0);
  // Total banked time across completed subphases — ref so it doesn't churn the tick effect.
  const totalElapsedRef = useRef<number>(0);
  // Snapshot of total elapsed at the moment we finish (drives FinishedPanel).
  const [finalElapsed, setFinalElapsed] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const accumulatedRef = useRef<number>(0);

  // The duration of the current "phase" depends on mode + subphase.
  const currentDuration = useMemo(() => {
    if (mode === 'stopwatch')   return stopwatchTargetMin * 60;
    if (mode === 'countdown')   return countdownSec;
    if (mode === 'sets')        return subphase === 'work' ? setsWork : setsRest;
    /* tabata */                return subphase === 'work' ? TABATA.work : TABATA.rest;
  }, [mode, subphase, stopwatchTargetMin, countdownSec, setsWork, setsRest]);

  const totalRounds = mode === 'sets' ? setsRounds : mode === 'tabata' ? TABATA.rounds : 1;

  // Reset internal counters whenever mode changes (or user resets).
  const reset = useCallback(() => {
    startedAtRef.current = null;
    accumulatedRef.current = 0;
    totalElapsedRef.current = 0;
    setSeconds(0);
    setFinalElapsed(0);
    setRound(1);
    setSubphase('work');
    setPhase('idle');
  }, []);

  // Switch modes: reset.
  const changeMode = (m: Mode) => {
    if (phase !== 'idle') return; // can't switch mid-session
    setMode(m);
    reset();
  };

  // ── Tick loop
  useEffect(() => {
    if (phase !== 'running') return;
    const tick = () => {
      const startedAt = startedAtRef.current ?? Date.now();
      const live = (Date.now() - startedAt) / 1000;
      const elapsed = accumulatedRef.current + live;
      setSeconds(elapsed);

      // Stopwatch never auto-transitions; user taps Finished.
      if (mode === 'stopwatch') return;

      // Other modes transition when the current subphase's duration runs out.
      if (elapsed >= currentDuration - 0.05) {
        // Bank the completed subphase into the total.
        totalElapsedRef.current += currentDuration;

        if (mode === 'countdown') {
          beep(660, 220);
          vibrate([220, 90, 220]);
          startedAtRef.current = null;
          accumulatedRef.current = 0;
          setSeconds(0);
          setFinalElapsed(totalElapsedRef.current);
          setPhase('finished');
          return;
        }

        // Sets / Tabata: alternate work↔rest, increment round at rest→work boundary.
        if (subphase === 'work') {
          beep(440, 150);
          vibrate(120);
          accumulatedRef.current = 0;
          startedAtRef.current = Date.now();
          setSeconds(0);
          setSubphase('rest');
        } else {
          if (round >= totalRounds) {
            beep(880, 260);
            vibrate([220, 90, 220]);
            startedAtRef.current = null;
            accumulatedRef.current = 0;
            setSeconds(0);
            setFinalElapsed(totalElapsedRef.current);
            setPhase('finished');
          } else {
            beep(660, 150);
            vibrate(120);
            accumulatedRef.current = 0;
            startedAtRef.current = Date.now();
            setSeconds(0);
            setSubphase('work');
            setRound(r => r + 1);
          }
        }
      }
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [phase, mode, subphase, round, currentDuration, totalRounds]);

  // ── Tap handlers
  const tapTimer = () => {
    if (phase === 'idle') {
      startedAtRef.current = Date.now();
      accumulatedRef.current = 0;
      setSeconds(0);
      setSubphase('work');
      setRound(1);
      setPhase('running');
      beep(880, 90);
    } else if (phase === 'running') {
      if (startedAtRef.current != null) {
        accumulatedRef.current += (Date.now() - startedAtRef.current) / 1000;
        startedAtRef.current = null;
      }
      setPhase('paused');
    } else if (phase === 'paused') {
      startedAtRef.current = Date.now();
      setPhase('running');
    }
  };

  const finish = () => {
    if (phase === 'running' && startedAtRef.current != null) {
      accumulatedRef.current += (Date.now() - startedAtRef.current) / 1000;
      startedAtRef.current = null;
    }
    const live = accumulatedRef.current;
    const final = mode === 'stopwatch'
      ? live
      : totalElapsedRef.current + Math.min(live, currentDuration);
    setFinalElapsed(final);
    // If there's a plan for today, surface the overlay so the user can tick
    // off what they did. Otherwise just save & reset — no overlay needed.
    if (plannedExercises.length > 0) {
      setPhase('finished');
    } else {
      saveCompletedSession(final, []);
      reset();
    }
  };

  // Shared save path used by both the overlay's Save button and the no-plan
  // direct-finish branch.
  const saveCompletedSession = (durationSec: number, tickedIds: string[]) => {
    const finalSec = Math.round(durationSec);
    const s = freshGymSession({
      date: today,
      source: planDay ? 'plan' : 'freestyle',
      plan_id: plan?.id ?? null,
      day_index: planDay?.day_index ?? null,
      title: planDay?.title || (planDay ? `Day ${planDay.day_index}` : 'Freestyle'),
    });
    const tickedSet = new Set(tickedIds);
    s.exercises = plannedExercises.filter(ex => tickedSet.has(ex.id)).map(gymExerciseFromPlan);
    s.status = 'completed';
    s.started_at = new Date(Date.now() - finalSec * 1000).toISOString();
    s.completed_at = new Date().toISOString();
    s.notes = `Mode: ${mode} · Duration: ${formatTime(finalSec)}`;
    saveSession(s);
  };

  // ── Tick list (finished panel) state
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const toggleTick = (id: string) => {
    setTicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const saveAndDone = () => {
    saveCompletedSession(finalElapsed, Array.from(ticked));
    setTicked(new Set());
    reset();
  };

  const todayCompleted = sessions.some(s => s.date === today && s.status === 'completed');

  return (
    <div className="flex-1 overflow-hidden relative">
      <div className="max-w-3xl mx-auto w-full px-4 py-4 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-gray-500">{longDate()}</div>
            <h1 className="mt-0.5 text-xl font-light text-white">{t('gymHeading')}</h1>
          </div>
          {todayCompleted && phase === 'idle' && (
            <div className="text-[10px] uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {t('gymDoneTodayBadge')}
            </div>
          )}
        </div>

        <ModePills mode={mode} disabled={phase !== 'idle'} onChange={changeMode} />
        <ModeParams
          mode={mode}
          phase={phase}
          stopwatchTargetMin={stopwatchTargetMin}
          countdownSec={countdownSec}
          setsRounds={setsRounds}
          setsWork={setsWork}
          setsRest={setsRest}
          onSetStopwatchTarget={setStopwatchTargetMin}
          onSetCountdown={setCountdownSec}
          onCycleRounds={() => setSetsRounds(cycle(ROUNDS_CYCLE, setsRounds))}
          onCycleWork={() => setSetsWork(cycle(WORK_CYCLE, setsWork))}
          onCycleRest={() => setSetsRest(cycle(REST_CYCLE, setsRest))}
        />

        <div className="mt-3 flex-1 min-h-0">
          <TimerHero
            mode={mode}
            phase={phase === 'finished' ? 'paused' : phase}
            subphase={subphase}
            seconds={seconds}
            currentDuration={currentDuration}
            round={round}
            totalRounds={totalRounds}
            onTap={tapTimer}
            onReset={reset}
            onFinish={finish}
          />
        </div>
      </div>

      {/* Finished overlay — shown only when there's a planned workout to tick off */}
      {phase === 'finished' && (
        <FinishedOverlay
          elapsed={Math.round(finalElapsed)}
          mode={mode}
          plannedExercises={plannedExercises}
          ticked={ticked}
          onToggle={toggleTick}
          onCancel={reset}
          onSave={saveAndDone}
        />
      )}
    </div>
  );
}

function cycle<T>(arr: readonly T[], current: T): T {
  const idx = arr.indexOf(current);
  return arr[(idx + 1) % arr.length];
}

// ── Mode pills ──────────────────────────────────────────────────────────────

function modeLabel(m: Mode): string {
  switch (m) {
    case 'stopwatch': return t('gymModeStopwatch');
    case 'countdown': return t('gymModeCountdown');
    case 'sets':      return t('gymModeSets');
    case 'tabata':    return t('gymModeTabata');
  }
}

const ALL_MODES: Mode[] = ['stopwatch', 'countdown', 'sets', 'tabata'];

function ModePills({ mode, disabled, onChange }: { mode: Mode; disabled: boolean; onChange: (m: Mode) => void }) {
  return (
    <div className="mt-3 grid grid-cols-4 gap-1.5">
      {ALL_MODES.map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          disabled={disabled}
          className={`rounded-full py-1.5 text-[11px] uppercase tracking-wider transition disabled:opacity-50 ${
            m === mode
              ? 'bg-ava-purple/25 border border-ava-purple/60 text-white'
              : 'bg-ava-surface border border-ava-border text-gray-400 hover:text-white'
          }`}
        >
          {modeLabel(m)}
        </button>
      ))}
    </div>
  );
}

// ── Mode params row ─────────────────────────────────────────────────────────

function ModeParams({
  mode, phase, stopwatchTargetMin, countdownSec,
  setsRounds, setsWork, setsRest,
  onSetStopwatchTarget, onSetCountdown,
  onCycleRounds, onCycleWork, onCycleRest,
}: {
  mode: Mode;
  phase: Phase;
  stopwatchTargetMin: number;
  countdownSec: number;
  setsRounds: number;
  setsWork: number;
  setsRest: number;
  onSetStopwatchTarget: (m: number) => void;
  onSetCountdown: (s: number) => void;
  onCycleRounds: () => void;
  onCycleWork: () => void;
  onCycleRest: () => void;
}) {
  const locked = phase !== 'idle';
  const wrap = 'mt-2 flex items-center justify-center gap-1.5';

  if (mode === 'stopwatch') {
    return (
      <div className={wrap}>
        {STOPWATCH_TARGETS.map(m => (
          <button
            key={m}
            disabled={locked}
            onClick={() => onSetStopwatchTarget(m)}
            className={`rounded-full px-3 py-1 text-[11px] tabular-nums transition disabled:opacity-50 ${
              m === stopwatchTargetMin
                ? 'bg-emerald-500/15 border border-emerald-400/50 text-emerald-200'
                : 'border border-ava-border text-gray-400 hover:text-gray-200'
            }`}
          >
            {m}m
          </button>
        ))}
      </div>
    );
  }

  if (mode === 'countdown') {
    return (
      <div className={wrap}>
        {COUNTDOWN_PRESETS.map(p => (
          <button
            key={p.sec}
            disabled={locked}
            onClick={() => onSetCountdown(p.sec)}
            className={`rounded-full px-3 py-1 text-[11px] tabular-nums transition disabled:opacity-50 ${
              p.sec === countdownSec
                ? 'bg-emerald-500/15 border border-emerald-400/50 text-emerald-200'
                : 'border border-ava-border text-gray-400 hover:text-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    );
  }

  if (mode === 'sets') {
    return (
      <div className={wrap}>
        <ParamPill label={t('gymParamRounds')} value={String(setsRounds)} disabled={locked} onClick={onCycleRounds} />
        <ParamPill label={t('gymParamWork')}   value={`${setsWork}s`}     disabled={locked} onClick={onCycleWork} />
        <ParamPill label={t('gymParamRest')}   value={`${setsRest}s`}     disabled={locked} onClick={onCycleRest} />
      </div>
    );
  }

  // tabata
  return (
    <div className="mt-2 flex items-center justify-center">
      <div className="rounded-full border border-ava-border bg-ava-surface px-3 py-1 text-[11px] tabular-nums text-gray-400">
        {t('gymTabataPresetLabel')}
      </div>
    </div>
  );
}

function ParamPill({ label, value, disabled, onClick }: { label: string; value: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-ava-border bg-ava-surface px-3 py-1 text-[11px] tabular-nums text-gray-300 hover:text-white hover:border-ava-purple/40 disabled:opacity-50 transition"
    >
      <span className="text-gray-500 mr-1">{label}</span>{value}
    </button>
  );
}

// ── Timer hero ──────────────────────────────────────────────────────────────

function TimerHero({
  mode, phase, subphase, seconds, currentDuration, round, totalRounds, onTap, onReset, onFinish,
}: {
  mode: Mode;
  phase: Exclude<Phase, 'finished'>;
  subphase: SubPhase;
  seconds: number;
  currentDuration: number;
  round: number;
  totalRounds: number;
  onTap: () => void;
  onReset: () => void;
  onFinish: () => void;
}) {
  // Display number depends on mode:
  // - stopwatch: count up (seconds)
  // - countdown: time remaining
  // - sets/tabata: time remaining in current subphase
  const display = mode === 'stopwatch'
    ? Math.floor(seconds)
    : Math.max(0, Math.ceil(currentDuration - seconds));

  // Ring fill: for stopwatch, elapsed/target; for others, elapsed/duration.
  const pct = currentDuration > 0
    ? Math.min(1, seconds / currentDuration)
    : 0;

  // Phase + subphase combined drives palette.
  const palette = paletteFor(phase, mode, subphase);

  const hint =
    phase === 'idle'    ? t('gymTimerHintStart')
  : phase === 'running' ? t('gymTimerHintPause')
  : t('gymTimerHintResume');

  const showRounds = mode === 'sets' || mode === 'tabata';
  const subphaseLabel = mode === 'sets' || mode === 'tabata'
    ? (phase === 'idle' ? null : subphase === 'work' ? t('gymParamWork').toUpperCase() : t('gymParamRest').toUpperCase())
    : null;

  return (
    <div
      className="h-full rounded-3xl border bg-gradient-to-b from-ava-surface to-black/40 p-4 flex flex-col items-center justify-center relative overflow-hidden transition-shadow"
      style={{ borderColor: palette.borderRgba, boxShadow: palette.glow }}
    >
      {/* Status chip */}
      <div className={`absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider ${palette.chipBg} ${palette.chipText} ${palette.chipBorder}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${palette.dotBg} ${palette.dotPulse ? 'animate-pulse' : ''}`} />
        {subphaseLabel ?? palette.label}
      </div>

      {/* Round counter (sets/tabata) */}
      {showRounds && (
        <div className="absolute top-3 right-3 text-[10px] uppercase tracking-wider text-gray-400 tabular-nums">
          {t('gymRoundLabel')} <span className="text-white">{round}</span> / {totalRounds}
        </div>
      )}

      {/* Tappable timer circle */}
      <button
        onClick={onTap}
        className="relative w-[250px] h-[250px] max-w-[68vw] max-h-[40vh] aspect-square flex items-center justify-center group focus:outline-none"
        aria-label={hint}
      >
        <Ring color={palette.ringColor} trackColor="rgba(255,255,255,0.06)" pct={pct} pulsing={phase === 'running'} />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div
            className={`text-[60px] leading-none font-mono tabular-nums transition ${palette.numberText}`}
            style={{ textShadow: phase === 'running' ? palette.numberGlow : 'none' }}
          >
            {formatTime(display)}
          </div>
          <div className={`mt-2 text-[10px] uppercase tracking-wider transition ${palette.hintText}`}>
            {hint}
          </div>
        </div>
      </button>

      {/* Secondary actions */}
      <div className="mt-3 flex items-center gap-6">
        <button
          onClick={onReset}
          disabled={phase === 'idle'}
          className="text-[11px] uppercase tracking-wider text-gray-500 hover:text-red-300 disabled:opacity-30 transition"
        >
          {t('gymButtonReset')}
        </button>
        <button
          onClick={onFinish}
          disabled={phase === 'idle'}
          className="rounded-full bg-ava-purple disabled:bg-ava-purple/30 disabled:text-gray-500 px-5 py-1.5 text-[12px] font-semibold text-white hover:bg-ava-purple-dark transition shadow-[0_4px_14px_rgba(168,85,247,0.3)]"
        >
          {t('gymButtonFinished')}
        </button>
      </div>
    </div>
  );
}

// ── Palette computation ────────────────────────────────────────────────────

interface Palette {
  label: string;
  ringColor: string;
  glow: string;
  borderRgba: string;
  chipBg: string;
  chipText: string;
  chipBorder: string;
  dotBg: string;
  dotPulse: boolean;
  numberText: string;
  numberGlow: string;
  hintText: string;
}

function paletteFor(phase: Phase, mode: Mode, subphase: SubPhase): Palette {
  // Idle = green (Tap to start)
  if (phase === 'idle') {
    return {
      label: t('gymPaletteReady'),
      ringColor: 'rgb(52, 211, 153)',
      glow: '0 0 28px rgba(52, 211, 153, 0.18)',
      borderRgba: 'rgba(52, 211, 153, 0.25)',
      chipBg: 'bg-emerald-900/25',
      chipText: 'text-emerald-300',
      chipBorder: 'border-emerald-700/50',
      dotBg: 'bg-emerald-400',
      dotPulse: false,
      numberText: 'text-emerald-50',
      numberGlow: '',
      hintText: 'text-emerald-300/80',
    };
  }
  // Paused = amber
  if (phase === 'paused') {
    return {
      label: t('gymPalettePaused'),
      ringColor: 'rgb(251, 191, 36)',
      glow: '0 0 24px rgba(251, 191, 36, 0.22)',
      borderRgba: 'rgba(251, 191, 36, 0.25)',
      chipBg: 'bg-amber-900/25',
      chipText: 'text-amber-300',
      chipBorder: 'border-amber-700/50',
      dotBg: 'bg-amber-400',
      dotPulse: false,
      numberText: 'text-amber-100',
      numberGlow: '',
      hintText: 'text-amber-300/80',
    };
  }
  // Running: depends on mode + subphase
  // Rest subphase (sets/tabata) = amber-ish but with pulse
  if ((mode === 'sets' || mode === 'tabata') && subphase === 'rest') {
    return {
      label: t('gymPaletteRest'),
      ringColor: 'rgb(251, 191, 36)',
      glow: '0 0 28px rgba(251, 191, 36, 0.3)',
      borderRgba: 'rgba(251, 191, 36, 0.3)',
      chipBg: 'bg-amber-900/30',
      chipText: 'text-amber-200',
      chipBorder: 'border-amber-600/50',
      dotBg: 'bg-amber-400',
      dotPulse: true,
      numberText: 'text-amber-100',
      numberGlow: '0 0 24px rgba(251, 191, 36, 0.35)',
      hintText: 'text-amber-300/70',
    };
  }
  // Default running (stopwatch, countdown, work subphase) = purple
  return {
    label: t('gymPaletteWorking'),
    ringColor: 'rgb(168, 85, 247)',
    glow: '0 0 32px rgba(168, 85, 247, 0.35)',
    borderRgba: 'rgba(168, 85, 247, 0.3)',
    chipBg: 'bg-ava-purple/20',
    chipText: 'text-ava-purple-light',
    chipBorder: 'border-ava-purple/50',
    dotBg: 'bg-ava-purple-light',
    dotPulse: true,
    numberText: 'text-white',
    numberGlow: '0 0 28px rgba(168, 85, 247, 0.45)',
    hintText: 'text-ava-purple-light/70',
  };
}

// ── Ring (SVG) ──────────────────────────────────────────────────────────────

function Ring({ color, trackColor, pct, pulsing }: { color: string; trackColor: string; pct: number; pulsing: boolean }) {
  const r = 110;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 240 240" className={`w-full h-full -rotate-90 ${pulsing ? 'animate-[pulse_3s_ease-in-out_infinite]' : ''}`}>
      <circle cx="120" cy="120" r={r} fill="none" stroke={trackColor} strokeWidth="6" />
      <circle
        cx="120" cy="120" r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(pct, 1))}
        style={{ transition: 'stroke-dashoffset 400ms linear, stroke 400ms ease' }}
      />
    </svg>
  );
}

// ── Finished overlay (modal) ────────────────────────────────────────────────

function FinishedOverlay({
  elapsed, mode, plannedExercises, ticked, onToggle, onCancel, onSave,
}: {
  elapsed: number;
  mode: Mode;
  plannedExercises: HealthPlanExercise[];
  ticked: Set<string>;
  onToggle: (id: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_180ms_ease-out]">
      <div
        className="w-full max-w-md max-h-full rounded-3xl border border-emerald-600/40 bg-gradient-to-b from-emerald-900/20 to-ava-surface p-5 flex flex-col relative overflow-hidden"
        style={{ boxShadow: '0 0 48px rgba(52, 211, 153, 0.35), 0 8px 32px rgba(0,0,0,0.5)' }}
      >
        <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-600/50 bg-emerald-900/30 px-2.5 py-1 text-[10px] uppercase tracking-wider text-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {t('gymFinishedOverlayBadge')}
        </div>
        <button onClick={onCancel} aria-label={t('cancel')} className="absolute top-3 right-3 text-[11px] text-gray-500 hover:text-red-300">×</button>

        <div className="mt-8 text-center">
          <div className="text-[10px] uppercase tracking-wider text-emerald-300/80">{modeLabel(mode)} · {t('gymFinishedSessionLength')}</div>
          <div className="mt-1 text-5xl font-mono tabular-nums text-white" style={{ textShadow: '0 0 28px rgba(52, 211, 153, 0.4)' }}>
            {formatTime(elapsed)}
          </div>
        </div>

        <div className="mt-4 text-[11px] uppercase tracking-wider text-gray-400">{t('gymFinishedTickOffPrompt')}</div>
        <ul className="mt-2 flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
          {plannedExercises.map(ex => {
            const on = ticked.has(ex.id);
            return (
              <li key={ex.id}>
                <button
                  onClick={() => onToggle(ex.id)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    on
                      ? 'bg-emerald-900/30 border border-emerald-500/60'
                      : 'bg-black/30 border border-ava-border hover:border-emerald-700/40'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[12px] shrink-0 transition ${
                    on ? 'bg-emerald-500 text-black' : 'border border-ava-border text-transparent'
                  }`}>
                    {on ? '✓' : ''}
                  </span>
                  <span className="flex-1 min-w-0 text-[13px] text-white truncate">{ex.name}</span>
                  <span className="text-[10px] text-gray-500 tabular-nums shrink-0">
                    {[ex.sets != null ? `${ex.sets}×${ex.reps ?? ''}`.replace(/×$/, '') : null, ex.weight].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <button
          onClick={onSave}
          className="mt-4 w-full rounded-full bg-emerald-500 hover:bg-emerald-400 py-3 text-sm font-semibold text-black transition shadow-[0_4px_18px_rgba(52,211,153,0.35)]"
        >
          {t('gymFinishedSaveButton')}
        </button>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function planDayForDate(plan: HealthPlan, date: string): HealthPlanDay | null {
  if (!plan.start_date) return null;
  const start = new Date(`${plan.start_date}T00:00:00`).getTime();
  const sel = new Date(`${date}T00:00:00`).getTime();
  if (isNaN(start) || isNaN(sel)) return null;
  const idx = Math.floor((sel - start) / 86400000) + 1;
  if (idx < 1 || idx > plan.duration_days) return null;
  return plan.days.find(d => d.day_index === idx) ?? null;
}

function formatTime(s: number): string {
  const v = Math.max(0, Math.floor(s));
  const h = Math.floor(v / 3600);
  const m = Math.floor((v % 3600) / 60);
  const sec = v % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function longDate(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}
