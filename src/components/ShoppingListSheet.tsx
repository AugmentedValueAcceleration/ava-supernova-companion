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
import { buildShoppingList, type ShoppingItem, type MissingMeal } from '@/lib/health-shopping-list';
import { fillMissingIngredients } from '@/lib/health-shopping-fill';
import { savePlan } from '@/lib/health-plan-store';
import type { Aisle } from '@/lib/health-aisles';
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

/* ------------------------------------------------------------------ sheet - */

export function ShoppingListSheet({ plan, onClose, onPlanFilled }: {
  plan: HealthPlan;
  onClose: () => void;
  /** The fill writes ingredients onto the plan; the builder needs to know so
   *  it is not holding a stale copy. */
  onPlanFilled?: (next: HealthPlan) => void;
}) {
  useLocale();
  const [working, setWorking] = useState<HealthPlan>(plan);
  const [filling, setFilling] = useState(true);
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [week, setWeek] = useState(0);
  const [hideOptional, setHideOptional] = useState(false);
  const [ticks, setTicks] = useState<Set<string>>(() => readTicks(plan.id));

  const weeks = Math.max(1, Math.ceil((working.duration_days || 1) / 7));

  // One look-up per plan, on open. Meals added by hand already carry their
  // ingredients; meals Ava generated only ever carried a slug.
  useEffect(() => {
    let live = true;
    setFilling(true);
    (async () => {
      const { plan: filled, reachedLibrary } = await fillMissingIngredients(plan);
      if (!live) return;
      if (filled) {
        savePlan(filled);
        setWorking(filled);
        onPlanFilled?.(filled);
      }
      setOffline(!reachedLibrary);
      setFilling(false);
    })();
    return () => { live = false; };
    // Deliberately keyed on the plan id alone: re-running because the plan
    // object changed identity would re-fetch on every save, and the fill
    // itself saves. `attempt` is here so Try again can force one.
  }, [plan.id, attempt]);  // eslint-disable-line

  const days = useMemo(() => {
    if (weeks === 1) return working.days;
    return working.days.filter(d => d.day_index > week * 7 && d.day_index <= (week + 1) * 7);
  }, [working, week, weeks]);

  const list = useMemo(
    () => buildShoppingList(days, { excludeOptional: hideOptional }),
    [days, hideOptional],
  );

  const toggle = useCallback((key: string) => {
    setTicks(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      writeTicks(working.id, next);
      return next;
    });
  }, [working.id]);

  const clear = useCallback(() => {
    setTicks(new Set());
    writeTicks(working.id, new Set());
  }, [working.id]);

  const got = list.groups.flatMap(g => g.items).filter(i => ticks.has(i.key)).length;

  return (
    <BottomSheet
      title={t('shoppingListTitle')}
      subtitle={working.title}
      onClose={onClose}
    >
      {filling ? (
        <div className="py-10 text-center text-sm text-gray-500">{t('shoppingListLooking')}</div>
      ) : list.itemCount === 0 && list.missing.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500">{t('shoppingListNoMeals')}</div>
      ) : (
        <>
          {weeks > 1 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-3">
              {Array.from({ length: weeks }, (_, w) => (
                <button key={w} onClick={() => setWeek(w)}
                  className={`shrink-0 rounded-full px-3 py-1 text-[11px] border ${w === week ? 'border-ava-purple/25 bg-ava-purple/15 text-ava-purple' : 'border-ava-border text-gray-400'}`}>
                  {t('shoppingListWeek')} {w + 1}
                </button>
              ))}
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
            {list.groups.map(group => (
              <section key={group.aisle}>
                <div className="mb-1.5 text-[10px] uppercase tracking-wider text-gray-500">
                  {aisleLabel(group.aisle)}
                </div>
                <ul className="space-y-0.5">
                  {group.items.map(item => (
                    <Row key={item.key} item={item} ticked={ticks.has(item.key)} onToggle={() => toggle(item.key)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </BottomSheet>
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
