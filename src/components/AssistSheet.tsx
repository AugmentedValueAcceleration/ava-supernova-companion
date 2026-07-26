'use client';

// ─── Ask Ava — help with THIS day ───────────────────────────────────────────
//
// The hybrid the whole builder is for. Not "AI writes it all", not "you are on
// your own": you drive, and Ava is there for exactly the parts you want.
//
// Three rules shape this screen.
//
//   1. It PROPOSES. Nothing is saved until you accept. The current day is
//      shown next to the suggestion so you can see precisely what changed
//      before it touches your work.
//   2. It says what it did, in a sentence, in Ava's voice. A change you cannot
//      see the reasoning for is a change you cannot trust.
//   3. It is honest about the wait. This takes the better part of a minute, so
//      the screen says so rather than showing a spinner and hoping.

import { useState } from 'react';
import { t, useLocale } from '@/lib/i18n';
import { healthAssistApi } from '@/lib/api';
import { normaliseHealthProfile } from '@/lib/health-types';
import { Button } from './Button';
import type { HealthPlan, HealthPlanDay, HealthProfile } from '@/lib/health-types';

/** Openers for the things people actually want, so nobody faces a blank box.
 *  Each is a real sentence they can then edit, not a mode. */
const PROMPTS: Array<{ key: string; forType: Array<'fitness' | 'meal' | 'combined'>; text: () => string }> = [
  { key: 'fill',     forType: ['fitness', 'meal', 'combined'], text: () => t('assistPromptFill') },
  { key: 'finisher', forType: ['fitness', 'combined'],         text: () => t('assistPromptFinisher') },
  { key: 'warmup',   forType: ['fitness', 'combined'],         text: () => t('assistPromptWarmup') },
  { key: 'easier',   forType: ['fitness', 'combined'],         text: () => t('assistPromptEasier') },
  { key: 'protein',  forType: ['meal', 'combined'],            text: () => t('assistPromptProtein') },
  { key: 'quicker',  forType: ['meal', 'combined'],            text: () => t('assistPromptQuicker') },
];

interface Proposal { day: HealthPlanDay; note: string; credits: number; unverifiable: string[] }

export function AssistSheet({ plan, day, token, profile, onApply, onClose }: {
  plan: HealthPlan;
  day: HealthPlanDay;
  token: string | null;
  profile: HealthProfile | null;
  onApply: (day: HealthPlanDay) => void;
  onClose: () => void;
}) {
  useLocale();
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);

  const type = plan.type === 'combined' ? 'combined' : plan.type === 'meal' ? 'meal' : 'fitness';
  const prompts = PROMPTS.filter(p => p.forType.includes(type));

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!token) { setError(t('assistNeedsAccount')); return; }
    setBusy(true); setError(null); setProposal(null);
    try {
      // The whole week goes with it so the day is balanced against its
      // neighbours rather than written in isolation.
      const week = plan.days.filter(d =>
        Math.floor((d.day_index - 1) / 7) === Math.floor((day.day_index - 1) / 7));
      const res = await healthAssistApi.day(token, {
        type,
        goal: plan.goal,
        profile: profile ? normaliseHealthProfile(profile) : undefined,
        day,
        week,
        instruction: trimmed,
      });
      setProposal({
        day: res.day as HealthPlanDay,
        note: res.note,
        credits: res.credits_charged,
        unverifiable: res.unverifiable_allergens ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('assistFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div className="bg-ava-bg border-t border-ava-border rounded-t-2xl max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="shrink-0 px-4 pt-3 pb-2 border-b border-ava-border">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ava-border" />
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500">{t('assistTitle')}</div>
              <div className="text-white text-sm font-medium">{t('assistDayWord')} {day.day_index}</div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">{t('assistClose')}</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {!proposal && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {prompts.map(p => (
                  <button key={p.key} disabled={busy}
                    onClick={() => { setInstruction(p.text()); ask(p.text()); }}
                    className="rounded-full border border-ava-border px-3 py-1.5 text-[11px] text-gray-300 hover:border-ava-purple/40 hover:text-white disabled:opacity-40">
                    {p.text()}
                  </button>
                ))}
              </div>

              <div>
                <textarea
                  value={instruction}
                  onChange={e => setInstruction(e.target.value)}
                  disabled={busy}
                  rows={3}
                  placeholder={t('assistPlaceholder')}
                  className="w-full bg-ava-surface border border-ava-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-ava-purple focus:outline-none resize-none disabled:opacity-50"
                />
                <div className="mt-1 text-[10px] text-gray-500">{t('assistKeepsYourWork')}</div>
              </div>
            </>
          )}

          {busy && (
            <div className="rounded-lg border border-ava-border bg-ava-surface px-3 py-4 text-center">
              <div className="text-[12px] text-gray-300">{t('assistThinking')}</div>
              {/* Said plainly. It genuinely takes about a minute, and a bare
                  spinner for that long reads as broken. */}
              <div className="mt-1 text-[10px] text-gray-500">{t('assistThinkingHint')}</div>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200/90">
              {error}
            </div>
          )}

          {proposal && (
            <>
              <div className="rounded-lg border border-ava-purple/30 bg-ava-purple/5 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-ava-purple-light/70 mb-1">{t('assistAvaSays')}</div>
                <div className="text-[12px] text-gray-200 leading-snug">{proposal.note || t('assistNoNote')}</div>
              </div>

              {proposal.unverifiable.length > 0 && (
                <div className="rounded-md border border-ava-border bg-ava-bg px-2 py-1.5 text-[11px] text-gray-400">
                  {t('assistUnverifiable')} {proposal.unverifiable.join(', ')}
                </div>
              )}

              <Diff before={day} after={proposal.day} />
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-ava-border px-4 py-3">
          {proposal ? (
            <div className="flex gap-2">
              <Button variant="secondary" size="lg" block onClick={() => { setProposal(null); setInstruction(''); }}>
                {t('assistDiscard')}
              </Button>
              <Button variant="primary" size="lg" block onClick={() => { onApply(proposal.day); onClose(); }}>
                {t('assistUseThis')}
              </Button>
            </div>
          ) : (
            <Button variant="primary" size="lg" block onClick={() => ask(instruction)} disabled={busy || !instruction.trim()}>
              {busy ? t('assistThinkingShort') : t('assistAsk')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * What actually changed, item by item.
 *
 * Matched by name rather than id, because the model returns fresh ids for
 * everything — so an untouched exercise would otherwise read as "removed, then
 * added", which is exactly the alarm this is meant to prevent.
 */
function Diff({ before, after }: { before: HealthPlanDay; after: HealthPlanDay }) {
  const key = (s: string) => s.trim().toLowerCase();

  const rows = (d: HealthPlanDay) => [
    ...d.training.map(e => ({ kind: 'training' as const, name: e.name, detail: `${e.sets ?? '?'}×${e.reps ?? '?'}${e.weight ? ` @ ${e.weight}` : ''}` })),
    ...d.meals.map(m => ({ kind: 'meal' as const, name: m.name, detail: `${m.slot}${m.calories ? ` · ${Math.round(m.calories)} kcal` : ''}` })),
  ];

  const b = rows(before);
  const a = rows(after);
  const bNames = new Set(b.map(x => key(x.name)));
  const aNames = new Set(a.map(x => key(x.name)));

  const added = a.filter(x => !bNames.has(key(x.name)));
  const removed = b.filter(x => !aNames.has(key(x.name)));
  const kept = a.filter(x => bNames.has(key(x.name)));

  return (
    <section className="space-y-2">
      <h3 className="text-[10px] uppercase tracking-wider text-gray-500">{t('assistWhatChanged')}</h3>

      {added.length === 0 && removed.length === 0 && (
        <div className="text-[11px] text-gray-500 italic">{t('assistNothingChanged')}</div>
      )}

      {added.map((x, i) => (
        <Line key={`a${i}`} tone="add" name={x.name} detail={x.detail} />
      ))}
      {removed.map((x, i) => (
        <Line key={`r${i}`} tone="remove" name={x.name} detail={x.detail} />
      ))}

      {kept.length > 0 && (
        <details className="mt-1">
          <summary className="text-[10px] text-gray-500 cursor-pointer">
            {kept.length} {t('assistUnchangedSuffix')}
          </summary>
          <div className="mt-1.5 space-y-1">
            {kept.map((x, i) => <Line key={`k${i}`} tone="keep" name={x.name} detail={x.detail} />)}
          </div>
        </details>
      )}
    </section>
  );
}

function Line({ tone, name, detail }: { tone: 'add' | 'remove' | 'keep'; name: string; detail: string }) {
  const cls = tone === 'add'
    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-100/90'
    : tone === 'remove'
      ? 'border-amber-500/30 bg-amber-500/5 text-amber-100/80 line-through decoration-amber-300/40'
      : 'border-ava-border bg-ava-bg text-gray-400';
  const mark = tone === 'add' ? '+' : tone === 'remove' ? '−' : '·';
  return (
    <div className={`flex items-baseline gap-2 rounded-md border px-2 py-1.5 text-[11px] ${cls}`}>
      <span className="opacity-60 w-2 shrink-0">{mark}</span>
      <span className="flex-1 truncate">{name}</span>
      <span className="opacity-60 shrink-0 tabular-nums">{detail}</span>
    </div>
  );
}
