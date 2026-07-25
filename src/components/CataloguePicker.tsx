'use client';

// ─── Catalogue picker ───────────────────────────────────────────────────────
//
// Search the exercise or recipe library and pick one. Lifted out of
// PlanBuilder unchanged so the meal flow can reuse it for swaps — the same
// picker, whether you're composing a plan or replacing tonight's dinner with
// what you actually ate.

import { useState, useCallback, useEffect } from 'react';
import { t } from '@/lib/i18n';
import { healthCatalogApi } from '@/lib/api';
import type { ExerciseCard, RecipeCard } from '@/lib/health-types';

export function CataloguePicker({ kind, onClose, onPick }: {
  kind: 'exercise' | 'recipe';
  onClose: () => void;
  onPick: (item: ExerciseCard | RecipeCard) => void;
}) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<(ExerciseCard | RecipeCard)[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string) => {
    setLoading(true);
    try {
      if (kind === 'exercise') {
        const r = await healthCatalogApi.exercises({ q: query, limit: 30 });
        setItems((r.exercises ?? []) as ExerciseCard[]);
      } else {
        const r = await healthCatalogApi.recipes({ q: query, limit: 30 });
        setItems((r.recipes ?? []) as RecipeCard[]);
      }
    } catch { /* keep prior */ } finally { setLoading(false); }
  }, [kind]);

  // Debounced search on query change (and initial load).
  useEffect(() => { const h = setTimeout(() => search(q), 250); return () => clearTimeout(h); }, [q, search]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-ava-bg">
      <div className="px-4 py-3 border-b border-ava-border flex items-center gap-3">
        <button onClick={onClose} className="text-gray-300 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <input
          autoFocus value={q} onChange={e => setQ(e.target.value)}
          placeholder={kind === 'exercise' ? t('planBuilderPickerExercisePlaceholder') : t('planBuilderPickerRecipePlaceholder')}
          className="flex-1 bg-ava-surface border border-ava-border rounded-full px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-ava-purple focus:outline-none"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading && items.length === 0 && <div className="py-8 text-center text-sm text-gray-500">Searching…</div>}
        {items.map(it => (
          <button
            key={it.id} onClick={() => onPick(it)}
            className="w-full text-left px-3 py-3 rounded-lg hover:bg-ava-surface transition flex items-center justify-between gap-2"
          >
            <span className="text-sm text-white truncate">{it.name}</span>
            <span className="text-ava-purple-light text-lg leading-none">+</span>
          </button>
        ))}
      </div>
    </div>
  );
}
