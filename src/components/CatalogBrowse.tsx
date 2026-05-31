'use client';

// ─── Catalogue browse (Phase 2) ─────────────────────────────────────────────
//
// Paginated, searchable, filterable browse of the exercise + recipe libraries,
// read from the public /api/health/exercises and /recipes endpoints. One
// generic <CatalogBrowse> drives both; WorkoutsBrowse / RecipesBrowse wire in
// their endpoint, filters, and card.
//
// Pagination is offset-based with a "Load more" control — the API returns
// `total`, so we keep loading 24 at a time until we've got them all.

import { useState, useEffect, useCallback, useRef } from 'react';
import { t, useLocale } from '@/lib/i18n';
import { healthCatalogApi } from '@/lib/api';
import type { ExerciseCard, RecipeCard } from '@/lib/health-types';
import { ExerciseDetailView, RecipeDetailView } from './CatalogDetail';

const PAGE_SIZE = 24;

const WORKOUT_TYPES = ['strength', 'hypertrophy', 'conditioning', 'mobility', 'hybrid', 'yoga', 'pilates', 'running', 'cycling', 'recovery', 'hiit'];
const RECIPE_COURSES = ['breakfast', 'starter', 'main', 'side', 'dessert', 'snack', 'beverage', 'sauce', 'bread'];

interface PageResult<T> { items: T[]; total: number }

function CatalogBrowse<T extends { id: string }>({
  title,
  searchPlaceholder,
  categories,
  fetchPage,
  renderCard,
  onSelect,
}: {
  title: string;
  searchPlaceholder: string;
  categories: string[];
  fetchPage: (o: { offset: number; q: string; category: string | null }) => Promise<PageResult<T>>;
  renderCard: (item: T) => React.ReactNode;
  onSelect: (item: T) => void;
}) {
  useLocale();
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async (offset: number, replace: boolean) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const { items: page, total: t } = await fetchPage({ offset, q, category });
      if (id !== reqId.current) return; // a newer request superseded this one
      setTotal(t);
      setItems(prev => (replace ? page : [...prev, ...page]));
    } catch {
      if (id === reqId.current) setError(t('catalogBrowseLoadError'));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [fetchPage, q, category]);

  // Reload from the top whenever the query or filter changes (debounced so
  // typing doesn't fire a request per keystroke).
  useEffect(() => {
    const h = setTimeout(() => load(0, true), 250);
    return () => clearTimeout(h);
  }, [load]);

  const canLoadMore = !loading && items.length < total;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full pb-28">
        <div className="px-4 py-3 border-b border-ava-border sticky top-0 bg-ava-bg/95 backdrop-blur z-10">
          <h2 className="font-semibold text-white text-lg mb-3">{title}</h2>
          {/* Search */}
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-ava-surface border border-ava-border rounded-full px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-ava-purple focus:outline-none"
          />
          {/* Filter chips */}
          <div className="flex gap-2 overflow-x-auto mt-3 -mx-1 px-1 pb-1 no-scrollbar">
            <Chip label={t('catalogFilterAll')} active={category === null} onClick={() => setCategory(null)} />
            {categories.map(c => (
              <Chip key={c} label={c} active={category === c} onClick={() => setCategory(c)} />
            ))}
          </div>
        </div>

        <div className="px-4 py-4">
          {error && items.length === 0 ? (
            <button onClick={() => load(0, true)} className="w-full text-center text-sm text-red-300 py-10">{error}</button>
          ) : items.length === 0 && !loading ? (
            <p className="text-center text-sm text-gray-500 py-10">{t('catalogBrowseEmptyState')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {items.map(item => (
                <button key={item.id} onClick={() => onSelect(item)} className="text-left h-full active:scale-[0.98] transition">
                  {renderCard(item)}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-ava-purple/30 border-t-ava-purple" />
            </div>
          )}

          {canLoadMore && (
            <button
              onClick={() => load(items.length, false)}
              className="mt-4 w-full rounded-full border border-ava-border bg-ava-surface py-2.5 text-sm text-gray-300 hover:border-ava-purple/50 transition"
            >
              {t('catalogBrowseLoadMore')} · {items.length} / {total}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1 text-xs capitalize transition border ${
        active
          ? 'bg-ava-purple border-ava-purple text-white'
          : 'bg-transparent border-ava-border text-gray-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

function CardShell({ image, title, meta }: { image: string | null; title: string; meta: string }) {
  return (
    <div className="rounded-2xl border border-ava-border bg-ava-surface overflow-hidden h-full">
      <div className="aspect-[4/3] bg-black/30 flex items-center justify-center">
        {image
          ? <img src={image} alt={title} className="w-full h-full object-cover" loading="lazy" />
          : <span className="text-ava-purple-light/40 text-2xl">✦</span>}
      </div>
      <div className="p-2.5">
        <div className="text-[13px] text-white leading-tight line-clamp-2">{title}</div>
        <div className="text-[10px] text-gray-500 mt-1 capitalize">{meta}</div>
      </div>
    </div>
  );
}

export function WorkoutsBrowse() {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const fetchPage = useCallback(
    async ({ offset, q, category }: { offset: number; q: string; category: string | null }) => {
      const r = await healthCatalogApi.exercises({ offset, limit: PAGE_SIZE, q, workoutType: category });
      return { items: (r.exercises ?? []) as ExerciseCard[], total: r.total ?? 0 };
    },
    [],
  );
  if (openSlug) return <ExerciseDetailView slug={openSlug} onBack={() => setOpenSlug(null)} />;
  return (
    <CatalogBrowse<ExerciseCard>
      title={t('catalogWorkoutsTitle')}
      searchPlaceholder={t('catalogWorkoutsSearchPlaceholder')}
      categories={WORKOUT_TYPES}
      fetchPage={fetchPage}
      onSelect={(e) => setOpenSlug(e.slug)}
      renderCard={(e) => (
        <CardShell
          image={e.thumbnail_url}
          title={e.name}
          meta={[e.workout_type, e.difficulty != null ? `level ${e.difficulty}` : null].filter(Boolean).join(' · ')}
        />
      )}
    />
  );
}

export function RecipesBrowse() {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const fetchPage = useCallback(
    async ({ offset, q, category }: { offset: number; q: string; category: string | null }) => {
      const r = await healthCatalogApi.recipes({ offset, limit: PAGE_SIZE, q, course: category });
      return { items: (r.recipes ?? []) as RecipeCard[], total: r.total ?? 0 };
    },
    [],
  );
  if (openSlug) return <RecipeDetailView slug={openSlug} onBack={() => setOpenSlug(null)} />;
  return (
    <CatalogBrowse<RecipeCard>
      title={t('catalogRecipesTitle')}
      searchPlaceholder={t('catalogRecipesSearchPlaceholder')}
      categories={RECIPE_COURSES}
      fetchPage={fetchPage}
      onSelect={(r) => setOpenSlug(r.slug)}
      renderCard={(r) => (
        <CardShell
          image={r.hero_image_url}
          title={r.name}
          meta={[r.course, r.origin_country].filter(Boolean).join(' · ')}
        />
      )}
    />
  );
}
