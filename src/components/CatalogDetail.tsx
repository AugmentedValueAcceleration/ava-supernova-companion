'use client';

// ─── Catalogue detail (Phase 2.5) ───────────────────────────────────────────
//
// Tap a browse card → full detail, fetched by slug from
// /api/health/exercises/[slug] and /recipes/[slug]. Exercise: how-to steps,
// routine, muscles, equipment, common mistakes. Recipe: overview, ingredients,
// and per-skill-level versions (times, nutrition, steps).

import { useState, useEffect } from 'react';
import { healthCatalogApi } from '@/lib/api';
import type { ExerciseDetail, RecipeDetail, RecipeStep } from '@/lib/health-types';

function useDetail<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true); setError(false);
    load().then(d => { if (live) { setData(d); setLoading(false); } })
          .catch(() => { if (live) { setError(true); setLoading(false); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error, loading };
}

function DetailShell({ onBack, image, title, subtitle, children }: {
  onBack: () => void; image: string | null; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full pb-28">
        <button onClick={onBack} className="sticky top-0 z-10 flex items-center gap-2 w-full px-4 py-3 bg-ava-bg/95 backdrop-blur text-sm text-gray-300 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          Back
        </button>
        <div className="aspect-video bg-black/30 flex items-center justify-center">
          {image
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={image} alt={title} className="w-full h-full object-cover" />
            : <span className="text-ava-purple-light/40 text-4xl">✦</span>}
        </div>
        <div className="px-4 pt-4">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="text-xs text-gray-500 mt-1 capitalize">{subtitle}</p>
        </div>
        <div className="px-4 mt-4 space-y-5">{children}</div>
      </div>
    </div>
  );
}

function StateScreen({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col">
      <button onClick={onBack} className="flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:text-white">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        Back
      </button>
      <div className="flex-1 flex items-center justify-center text-sm text-gray-500">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{title}</h3>
      {children}
    </section>
  );
}

function Tag({ children, primary }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] capitalize border ${primary ? 'border-ava-purple/50 text-ava-purple-light bg-ava-purple/10' : 'border-ava-border text-gray-400'}`}>
      {children}
    </span>
  );
}

// ── Exercise ─────────────────────────────────────────────────────────────────

export function ExerciseDetailView({ slug, onBack }: { slug: string; onBack: () => void }) {
  const { data, error, loading } = useDetail<ExerciseDetail>(
    () => healthCatalogApi.exercise(slug).then(r => r.exercise as ExerciseDetail), [slug]);

  if (loading) return <StateScreen onBack={onBack}><Spinner /></StateScreen>;
  if (error || !data) return <StateScreen onBack={onBack}>Couldn’t load this exercise.</StateScreen>;

  const r = data.routine;
  const routineBits = [
    r.sets != null ? `${r.sets} sets` : null,
    r.reps_target != null ? `${r.reps_target} reps` : null,
    r.rest_seconds != null ? `${r.rest_seconds}s rest` : null,
    r.tempo ? `tempo ${r.tempo}` : null,
    r.frequency_per_week != null ? `${r.frequency_per_week}×/week` : null,
  ].filter(Boolean);

  return (
    <DetailShell
      onBack={onBack}
      image={data.thumbnail_url}
      title={data.name}
      subtitle={[data.workout_type, data.exercise_type, data.difficulty != null ? `level ${data.difficulty}` : null].filter(Boolean).join(' · ')}
    >
      {data.description && <p className="text-sm text-gray-300 leading-relaxed">{data.description}</p>}

      {data.muscles.length > 0 && (
        <Section title="Muscles">
          <div className="flex flex-wrap gap-1.5">
            {data.muscles.map(m => <Tag key={m.slug} primary={m.role === 'primary'}>{m.name}</Tag>)}
          </div>
        </Section>
      )}

      {data.equipment.length > 0 && (
        <Section title="Equipment">
          <div className="flex flex-wrap gap-1.5">
            {data.equipment.map(e => <Tag key={e.slug}>{e.name}</Tag>)}
          </div>
        </Section>
      )}

      {routineBits.length > 0 && (
        <Section title="Routine">
          <p className="text-sm text-gray-300">{routineBits.join(' · ')}</p>
          {r.progression && <p className="text-xs text-gray-500 mt-1">Progression: {r.progression}</p>}
        </Section>
      )}

      {data.steps.length > 0 && (
        <Section title="How to">
          <ol className="space-y-2">
            {data.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-300">
                <span className="shrink-0 text-ava-purple-light font-mono text-xs pt-0.5">{i + 1}</span>
                <span className="leading-relaxed">{s}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {data.common_mistakes && (
        <Section title="Common mistakes">
          <p className="text-sm text-gray-300 leading-relaxed">{data.common_mistakes}</p>
        </Section>
      )}

      {data.demo_video_url && (
        <a href={data.demo_video_url} target="_blank" rel="noopener noreferrer"
           className="inline-block rounded-full border border-ava-border bg-ava-surface px-4 py-2 text-sm text-ava-purple-light">
          Watch demo →
        </a>
      )}
    </DetailShell>
  );
}

// ── Recipe ─────────────────────────────────────────────────────────────────

function fmtStepTime(secs: number | null): string {
  if (secs == null) return '';
  return secs >= 60 ? `~${Math.round(secs / 60)} min` : `~${secs}s`;
}

export function RecipeDetailView({ slug, onBack }: { slug: string; onBack: () => void }) {
  const { data, error, loading } = useDetail<RecipeDetail>(
    () => healthCatalogApi.recipe(slug).then(r => r.recipe as RecipeDetail), [slug]);
  const [levelIdx, setLevelIdx] = useState(0);

  if (loading) return <StateScreen onBack={onBack}><Spinner /></StateScreen>;
  if (error || !data) return <StateScreen onBack={onBack}>Couldn’t load this recipe.</StateScreen>;

  const version = data.versions[levelIdx] ?? data.versions[0] ?? null;
  const timeBits = version ? [
    version.prep_time_minutes != null ? `${version.prep_time_minutes}m prep` : null,
    version.cook_time_minutes != null ? `${version.cook_time_minutes}m cook` : null,
    version.default_servings != null ? `serves ${version.default_servings}` : null,
  ].filter(Boolean) : [];
  const macros = version ? Object.entries(version.nutrition).filter(([, v]) => v != null) : [];

  return (
    <DetailShell
      onBack={onBack}
      image={data.hero_image_url}
      title={data.name}
      subtitle={[data.course, data.cuisine_name ?? data.origin_country].filter(Boolean).join(' · ')}
    >
      {data.overview && <p className="text-sm text-gray-300 leading-relaxed">{data.overview}</p>}

      {data.versions.length > 1 && (
        <div className="flex gap-2">
          {data.versions.map((v, i) => (
            <button key={v.level} onClick={() => setLevelIdx(i)}
              className={`rounded-full px-3 py-1 text-xs capitalize border ${i === levelIdx ? 'bg-ava-purple border-ava-purple text-white' : 'border-ava-border text-gray-400'}`}>
              {v.level}
            </button>
          ))}
        </div>
      )}

      {timeBits.length > 0 && <p className="text-sm text-gray-300">{timeBits.join(' · ')}</p>}

      {macros.length > 0 && (
        <Section title="Nutrition (per serving)">
          <div className="flex flex-wrap gap-1.5">
            {macros.map(([k, v]) => <Tag key={k}>{k.replace(/_/g, ' ').replace(' g', '')}: {v}</Tag>)}
          </div>
        </Section>
      )}

      {data.ingredients.length > 0 && (
        <Section title="Ingredients">
          <ul className="space-y-1.5">
            {data.ingredients.map((ing, i) => (
              <li key={i} className="text-sm text-gray-300 flex gap-2">
                <span className="text-ava-purple-light/60">•</span>
                <span>
                  {[ing.quantity, ing.unit, ing.name].filter(Boolean).join(' ')}
                  {ing.optional && <span className="text-gray-500 text-xs"> (optional)</span>}
                  {ing.notes && <span className="text-gray-500 text-xs"> — {ing.notes}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {version && version.steps.length > 0 && (
        <Section title="Method">
          <ol className="space-y-3">
            {version.steps.map((s, i) => {
              const time = fmtStepTime(s.time_estimate_seconds);
              return (
                <li key={i} className="flex gap-3 text-sm text-gray-300">
                  <span className="shrink-0 text-ava-purple-light font-mono text-xs pt-0.5">{i + 1}</span>
                  <div className="leading-relaxed">
                    <span>{s.action}</span>
                    {s.technique_term && <span className="ml-2 text-[10px] uppercase tracking-wide text-ava-purple-light/70">{s.technique_term}</span>}
                    {s.tricky_flag && <span className="ml-2 text-[10px] text-amber-400/80">tricky</span>}
                    {(s.notes || time) && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {[s.notes, time].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>
      )}

      {data.source_attribution && (
        <p className="text-[10px] text-gray-600 pt-2">Source: {data.source_attribution}</p>
      )}
    </DetailShell>
  );
}

function Spinner() {
  return <div className="h-6 w-6 animate-spin rounded-full border-2 border-ava-purple/30 border-t-ava-purple" />;
}
