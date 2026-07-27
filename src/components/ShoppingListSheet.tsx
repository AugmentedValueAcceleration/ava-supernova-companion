'use client';

// ─── Shopping list ──────────────────────────────────────────────────────────
//
// The step that turns a meal plan into food. Everything before this is a
// proposal; this is the bit you take to a shop.
//
// Grouped by aisle and walked in the order of a supermarket, because a list
// sorted by recipe sends you back and forth past the same freezer six times.
// Ticking is the whole interaction — one tap, big target, struck through — and
// the ticks survive leaving the screen, because nobody shops in one sitting.
//
// Two honesty rules it will not bend:
//   - a meal whose ingredients could not be found is named, not hidden. A list
//     that looks complete and isn't sends someone home without dinner.
//   - quantities are never guessed across unit families. "400 g + 2 cloves"
//     is what the recipes said; inventing a single number would be neater and
//     sometimes wrong.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { t, useLocale } from '@/lib/i18n';
import { BottomSheet } from './BottomSheet';
import {
  buildShoppingListAcross, daysInRange, weekBounds, shiftWeek,
  type ShoppingItem, type MissingMeal,
} from '@/lib/health-shopping-list';
import { fillMissingIngredientsMany } from '@/lib/health-shopping-fill';
import { todayIso } from '@/lib/health-day-store';
import { savePlan } from '@/lib/health-plan-store';
import { AISLE_ORDER, type Aisle } from '@/lib/health-aisles';
import type { HealthPlan } from '@/lib/health-types';

function aisleLabel(a: Aisle): string {
  switch (a) {
    case 'produce': return t('shoppingAisleProduce');
    case 'meat_fish': return t('shoppingAisleMeatFish');
    case 'dairy_eggs': return t('shoppingAisleDairyEggs');
    case 'bakery': return t('shoppingAisleBakery');
    case 'cupboard': return t('shoppingAisleCupboard');
    case 'spices': return t('shoppingAisleSpices');
    case 'tins_jars': return t('shoppingAisleTinsJars');
    case 'oils_vinegars': return t('shoppingAisleOilsVinegars');
    case 'frozen': return t('shoppingAisleFrozen');
    default: return t('shoppingAisleOther');
  }
}

/* ------------------------------------------------------------------ ticks - */
// Kept out of the plan on purpose. What you have already put in the trolley is
// a fact about one shopping trip, not about the plan, and it must not travel
// with the plan when it is duplicated, exported or synced.

const tickKey = (planId: string) => `ava-shopping-ticks-${planId}`;

function readTicks(planId: string): Set<string> {
  try {
    const raw = localStorage.getItem(tickKey(planId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}

function writeTicks(planId: string, ticks: Set<string>): void {
  try { localStorage.setItem(tickKey(planId), JSON.stringify([...ticks])); } catch { /* private mode */ }
}

/* --------------------------------------------------------------- collapse - */
// Which aisles are folded away. Remembered for the same reason ticks are: a
// shop happens over time, and an aisle you closed because you had everything
// in it should stay closed when you come back to the list.

const foldKey = (scope: string) => `ava-shopping-folded-${scope}`;

/**
 * Everything starts folded.
 *
 * A week across several plans runs to thirty-odd rows, and opening onto all of
 * them is a wall. Folded, the aisle headers and their counts are a summary you
 * can read at a glance — and you open the one you are standing in.
 *
 * Returns null when nothing has been stored yet, so "never touched" can be
 * told apart from "deliberately opened everything". Without that distinction
 * the default would fight the user: unfold every aisle, come back, and it
 * would helpfully fold them all again.
 */
function readFolded(scope: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(foldKey(scope));
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch { return null; }
}

const allFolded = () => new Set<string>(AISLE_ORDER);

function writeFolded(scope: string, folded: Set<string>): void {
  try { localStorage.setItem(foldKey(scope), JSON.stringify([...folded])); } catch { /* private mode */ }
}

/* ------------------------------------------------------------------ sheet - */

/**
 * What is being shopped for.
 *
 * A plan when you are looking at one, a week when you are not. The week case
 * is not a nicety: activation only archives other active plans of the SAME
 * type, so a meal plan and a combined plan can both be live across the same
 * seven days — and you make one trip to the shop, not one per plan.
 */
export type ShoppingSource =
  | { kind: 'plan'; plan: HealthPlan }
  | { kind: 'week'; plans: HealthPlan[] };

export function ShoppingListSheet({ source, onClose, onPlanFilled }: {
  source: ShoppingSource;
  onClose: () => void;
  /** The fill writes ingredients onto the plans; whoever opened this needs to
   *  know so it is not left holding a stale copy. */
  onPlanFilled?: (next: HealthPlan) => void;
}) {
  useLocale();
  const single = source.kind === 'plan' ? source.plan : null;
  const [working, setWorking] = useState<HealthPlan[]>(
    () => (source.kind === 'plan' ? [source.plan] : source.plans),
  );
  const [filling, setFilling] = useState(true);
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [week, setWeek] = useState(0);
  const [hideOptional, setHideOptional] = useState(false);

  // A week's ticks belong to that week, not to a plan: the same onion is a
  // different errand next Tuesday. A plan's ticks stay keyed to the plan, so
  // nothing already ticked is lost.
  const bounds = useMemo(() => shiftWeek(weekBounds(todayIso()), week), [week]);
  const tickScope = single ? single.id : `week-${bounds.from}`;
  const [ticks, setTicks] = useState<Set<string>>(() => readTicks(tickScope));
  const [folded, setFolded] = useState<Set<string>>(() => readFolded(tickScope) ?? allFolded());
  useEffect(() => {
    setTicks(readTicks(tickScope));
    setFolded(readFolded(tickScope) ?? allFolded());
  }, [tickScope]);

  const planWeeks = single ? Math.max(1, Math.ceil((single.duration_days || 1) / 7)) : 0;

  // One look-up on open, batched across every plan in scope — asking per plan
  // would fetch the same recipe twice when two plans share a meal.
  useEffect(() => {
    let live = true;
    setFilling(true);
    (async () => {
      const { plans: filled, reachedLibrary } = await fillMissingIngredientsMany(
        source.kind === 'plan' ? [source.plan] : source.plans,
      );
      if (!live) return;
      for (const p of filled) { savePlan(p); onPlanFilled?.(p); }
      if (filled.length) {
        setWorking(prev => prev.map(p => filled.find(f => f.id === p.id) ?? p));
      }
      setOffline(!reachedLibrary);
      setFilling(false);
    })();
    return () => { live = false; };
    // Keyed on identity of the scope, not the plan objects: re-running because
    // a plan changed identity would re-fetch on every save, and the fill saves.
  }, [single?.id, source.kind, attempt]);  // eslint-disable-line

  const sources = useMemo(() => {
    if (single) {
      const days = planWeeks === 1
        ? working[0].days
        : working[0].days.filter(d => d.day_index > week * 7 && d.day_index <= (week + 1) * 7);
      return days.map(day => ({ day }));
    }
    return daysInRange(working, bounds.from, bounds.to);
  }, [working, week, planWeeks, single, bounds]);

  const list = useMemo(
    () => buildShoppingListAcross(sources, { excludeOptional: hideOptional }),
    [sources, hideOptional],
  );

  const toggle = useCallback((key: string) => {
    setTicks(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      writeTicks(tickScope, next);
      return next;
    });
  }, [tickScope]);

  const clear = useCallback(() => {
    setTicks(new Set());
    writeTicks(tickScope, new Set());
  }, [tickScope]);

  const fold = useCallback((aisle: string) => {
    setFolded(prev => {
      const next = new Set(prev);
      if (next.has(aisle)) next.delete(aisle); else next.add(aisle);
      writeFolded(tickScope, next);
      return next;
    });
  }, [tickScope]);

  const got = list.groups.flatMap(g => g.items).filter(i => ticks.has(i.key)).length;

  return (
    <BottomSheet
      title={t('shoppingListTitle')}
      subtitle={single ? single.title : rangeLabel(bounds.from, bounds.to)}
      onClose={onClose}
    >
      {filling ? (
        <div className="py-10 text-center text-sm text-gray-500">{t('shoppingListLooking')}</div>
      ) : list.itemCount === 0 && list.missing.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500">
          {single ? t('shoppingListNoMeals') : t('shoppingListNoMealsWeek')}
        </div>
      ) : (
        <>
          {/* A plan's own weeks are numbered; a calendar week is a date, and
              you can walk forwards to shop ahead or back to check what you
              already bought. */}
          {single ? planWeeks > 1 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-3">
              {Array.from({ length: planWeeks }, (_, w) => (
                <button key={w} onClick={() => setWeek(w)}
                  className={`shrink-0 rounded-full px-3 py-1 text-[11px] border ${w === week ? 'border-ava-purple/25 bg-ava-purple/15 text-ava-purple' : 'border-ava-border text-gray-400'}`}>
                  {t('shoppingListWeek')} {w + 1}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between mb-3">
              <Step dir="prev" onClick={() => setWeek(w => w - 1)} />
              <button
                onClick={() => setWeek(0)}
                className={`text-[11px] ${week === 0 ? 'text-gray-500' : 'text-ava-purple'}`}
              >
                {week === 0 ? t('shoppingListThisWeek') : t('shoppingListBackToThisWeek')}
              </button>
              <Step dir="next" onClick={() => setWeek(w => w + 1)} />
            </div>
          )}

          <div className="flex items-center justify-between gap-3 mb-3 text-[11px]">
            <div className="text-gray-500">
              {got}/{list.itemCount} · {list.mealCount} {t('shoppingListMeals')}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setHideOptional(v => !v)}
                className={hideOptional ? 'text-ava-purple' : 'text-gray-500'}>
                {t('shoppingListHideOptional')}
              </button>
              {got > 0 && (
                <button onClick={clear} className="text-gray-500">{t('shoppingListReset')}</button>
              )}
            </div>
          </div>

          {/* Named, never hidden — and the two reasons are kept apart, because
              one is worth retrying and the other can only be fixed by swapping
              the meal for a real recipe. */}
          <Gap
            meals={list.missing.filter(m => m.reason === 'lookup_failed')}
            message={offline ? t('shoppingListOffline') : t('shoppingListIncomplete')}
            onRetry={() => setAttempt(n => n + 1)}
          />
          <Gap
            meals={list.missing.filter(m => m.reason === 'not_in_library')}
            message={t('shoppingListNotInLibrary')}
          />

          <div className="space-y-4">
            {list.groups.map(group => {
              const done = group.items.filter(i => ticks.has(i.key)).length;
              const shut = folded.has(group.aisle);
              return (
                <section key={group.aisle}>
                  {/* The whole header is the target — a 10px chevron is not
                      something to aim at one-handed in a supermarket. */}
                  <button
                    onClick={() => fold(group.aisle)}
                    aria-expanded={!shut}
                    className="w-full flex items-center gap-1.5 mb-1.5 text-left active:opacity-60"
                  >
                    <svg
                      className={`w-3 h-3 shrink-0 text-gray-500 transition-transform ${shut ? '' : 'rotate-90'}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                    <span className="text-[10px] uppercase tracking-wider text-gray-500">
                      {aisleLabel(group.aisle)}
                    </span>
                    {/* Kept on the header so a folded aisle still says where
                        you are in it, instead of going quiet. */}
                    <span className={`ml-auto text-[10px] ${
                      done === group.items.length ? 'text-emerald-400/70' : 'text-gray-600'
                    }`}>
                      {done}/{group.items.length}
                    </span>
                  </button>
                  {!shut && (
                    <ul className="space-y-0.5">
                      {group.items.map(item => (
                        <Row key={item.key} item={item} ticked={ticks.has(item.key)} onToggle={() => toggle(item.key)} />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </BottomSheet>
  );
}

/** "27 Jul – 2 Aug", in the reader's own conventions. Uses Intl rather than a
 *  translated template so it needs no key in twenty locales to say a date. */
function rangeLabel(from: string, to: string): string {
  try {
    const fmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return `${fmt.format(new Date(`${from}T00:00:00Z`))} – ${fmt.format(new Date(`${to}T00:00:00Z`))}`;
  } catch { return `${from} – ${to}`; }
}

function Step({ dir, onClick }: { dir: 'prev' | 'next'; onClick: () => void }) {
  return (
    <button onClick={onClick} className="p-1.5 text-gray-400 active:scale-90" aria-label={dir}>
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d={dir === 'prev' ? 'M15.75 19.5L8.25 12l7.5-7.5' : 'M8.25 4.5l7.5 7.5-7.5 7.5'} />
      </svg>
    </button>
  );
}

/** What the list could not cover, and what can be done about it. Renders
 *  nothing when there is no gap — an empty warning box is worse than none. */
function Gap({ meals, message, onRetry }: {
  meals: MissingMeal[]; message: string; onRetry?: () => void;
}) {
  if (!meals.length) return null;
  return (
    <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
      <div className="text-[11px] text-amber-300/90">{message}</div>
      <div className="mt-1 text-[11px] text-gray-400">{meals.map(m => m.name).join(', ')}</div>
      {onRetry && (
        <button onClick={onRetry} className="mt-1.5 text-[11px] text-ava-purple">
          {t('shoppingListRetry')}
        </button>
      )}
    </div>
  );
}

function Row({ item, ticked, onToggle }: {
  item: ShoppingItem; ticked: boolean; onToggle: () => void;
}) {
  // Amounts are joined with "+" rather than summed: two unit families on one
  // item means the recipes measured it two ways, and that is worth showing.
  const amount = item.amounts
    .map(a => `${a.qty}${a.unit ? ` ${a.unit}` : ''}`)
    .join(' + ');

  const notes = [
    item.looseLines > 0 ? t('shoppingListToTaste') : null,
    item.optional ? t('shoppingListOptional') : null,
  ].filter(Boolean).join(' · ');

  return (
    <li>
      <button onClick={onToggle} className="w-full flex items-start gap-2.5 py-1.5 text-left active:opacity-60">
        <span className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
          ticked ? 'border-ava-purple bg-ava-purple/20' : 'border-ava-border'
        }`}>
          {ticked && (
            <svg className="w-3 h-3 text-ava-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm first-letter:uppercase ${ticked ? 'text-gray-600 line-through' : 'text-gray-200'}`}>
            {item.name}
          </span>
          {(amount || notes) && (
            <span className={`block text-[11px] ${ticked ? 'text-gray-700' : 'text-gray-500'}`}>
              {amount}{amount && notes ? ' · ' : ''}{notes}
            </span>
          )}
          {/* Only when two plans want the same thing — the case a per-plan
              list hid, and the one where "why do I need this much" matters. */}
          {item.plans.length > 1 && (
            <span className={`block text-[10px] ${ticked ? 'text-gray-700' : 'text-ava-purple/70'}`}>
              {item.plans.join(' + ')}
            </span>
          )}
        </span>
        {item.meals.length > 1 && (
          <span className={`shrink-0 text-[10px] mt-0.5 ${ticked ? 'text-gray-700' : 'text-gray-600'}`}>
            ×{item.meals.length}
          </span>
        )}
      </button>
    </li>
  );
}
