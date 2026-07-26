'use client';

// ─── Week strip ─────────────────────────────────────────────────────────────
//
// The last few days and the next few, with a dot each, tappable.
//
// It exists because Today was hardcoded to today: there was no way to look at
// yesterday, so a dinner you forgot to tick was simply lost. That is closer to
// a bug than to missing polish — the whole product rests on the log meaning
// something, and a log you cannot correct stops meaning anything quite quickly.
//
// This is immediate context, not management. The month grid stays in Plans,
// where placing and moving days belongs. Here you want to see that you missed
// Tuesday and be one tap from fixing it.

import { t } from '@/lib/i18n';
import type { StripDay, StripState } from '@/lib/health-today';

/** One-letter weekday, in the reader's own locale. */
function dayLetter(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { weekday: 'narrow', timeZone: 'UTC' });
}

function dayNumber(iso: string): string {
  return String(Number(iso.slice(8, 10)));
}

/**
 * The dot.
 *
 * Amber for missed rather than red: a missed day is information, not a
 * telling-off, and this screen is looked at by someone who is trying. Future
 * days get a hollow ring — there is nothing to have done yet.
 */
function Dot({ state }: { state: StripState }) {
  const cls: Record<StripState, string> = {
    done:    'bg-emerald-400',
    partial: 'bg-emerald-400/40 ring-1 ring-emerald-400/60',
    pending: 'bg-ava-purple/60',
    missed:  'bg-amber-400/70',
    logged:  'bg-sky-400/60',
    none:    'bg-transparent',
  };
  return <span className={`mt-1 h-1.5 w-1.5 rounded-full ${cls[state]}`} />;
}

export function WeekStrip({ days, selected, onSelect }: {
  days: StripDay[];
  selected: string;
  onSelect: (date: string) => void;
}) {
  return (
    <div className="px-3 py-2 border-b border-ava-border">
      <div className="flex gap-1 justify-between">
        {days.map(d => {
          const on = d.date === selected;
          return (
            <button
              key={d.date}
              onClick={() => onSelect(d.date)}
              // Nothing to log in the future, so those are reachable but plainly
              // secondary rather than disabled — you may still want to look.
              className={`flex-1 flex flex-col items-center rounded-lg py-1.5 transition-colors ${
                on ? 'bg-ava-purple/15' : 'hover:bg-ava-surface'
              } ${d.isFuture ? 'opacity-45' : ''}`}
            >
              <span className={`text-[9px] uppercase ${on ? 'text-ava-purple-light' : 'text-gray-600'}`}>
                {dayLetter(d.date)}
              </span>
              <span className={`text-[13px] tabular-nums leading-tight ${
                on ? 'text-ava-purple-light font-medium' : d.isToday ? 'text-white' : 'text-gray-400'
              }`}>
                {dayNumber(d.date)}
              </span>
              <Dot state={d.state} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The line under the strip when you are not on today.
 *
 * Says where you are and offers one tap back, because the most likely way to
 * end up on the wrong day is by accident and the most likely thing you want
 * next is to return.
 */
export function ViewingBanner({ date, onToday }: { date: string; onToday: () => void }) {
  const label = new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2 bg-ava-purple/10 border-b border-ava-purple/20">
      <span className="text-[11px] text-ava-purple-light truncate">{label}</span>
      <button onClick={onToday} className="text-[11px] text-ava-purple-light underline underline-offset-2 shrink-0">
        {t('weekStripBackToToday')}
      </button>
    </div>
  );
}
