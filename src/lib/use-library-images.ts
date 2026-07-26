'use client';

// ─── Pictures for whatever is on screen ─────────────────────────────────────
//
// Plan rows carry a name and a library ref. The picture lives in the library,
// so this fetches it for the slugs currently being rendered — batched into one
// request, and cached for the session so moving between days does not re-ask
// for the same squat photograph.
//
// Deliberately NOT stored on the plan row. An image is presentation, not a
// record of what was chosen: if the library re-shoots an exercise, every plan
// should show the better picture rather than a stale copy of the old one. The
// facts that must survive offline — sets, reps, macros, allergens — are on the
// row already.
//
// Failure is silent by design. A missing photograph draws the placeholder; it
// never blocks or errors the screen it was meant to decorate.

import { useState, useEffect } from 'react';
import { healthCatalogApi } from './api';

/** Session-scoped cache. Survives navigation between Today, Plans and the
 *  builder, which all ask for overlapping sets of the same slugs. */
const cache = { exercises: new Map<string, string>(), recipes: new Map<string, string>() };
/** Slugs already asked about and found to have nothing, so a library entry
 *  with no picture is not re-requested on every render. */
const known = { exercises: new Set<string>(), recipes: new Set<string>() };

export interface LibraryImages {
  exercise: (slug: string | null | undefined) => string | null;
  recipe: (slug: string | null | undefined) => string | null;
}

export function useLibraryImages(
  exerciseSlugs: Array<string | null | undefined>,
  recipeSlugs: Array<string | null | undefined>,
): LibraryImages {
  const [, bump] = useState(0);

  // Keys rather than the arrays themselves: a new array identity every render
  // would re-fire the effect forever.
  const exKey = exerciseSlugs.filter(Boolean).sort().join(',');
  const recKey = recipeSlugs.filter(Boolean).sort().join(',');

  useEffect(() => {
    const wantEx = exKey ? exKey.split(',').filter(s => !known.exercises.has(s)) : [];
    const wantRec = recKey ? recKey.split(',').filter(s => !known.recipes.has(s)) : [];
    if (wantEx.length === 0 && wantRec.length === 0) return;

    let cancelled = false;
    // Marked as asked BEFORE the request so two components mounting together
    // do not both fetch the same set.
    for (const s of wantEx) known.exercises.add(s);
    for (const s of wantRec) known.recipes.add(s);

    healthCatalogApi.images(wantEx, wantRec)
      .then(res => {
        if (cancelled) return;
        for (const [slug, url] of Object.entries(res?.exercises ?? {})) {
          if (typeof url === 'string') cache.exercises.set(slug, url);
        }
        for (const [slug, url] of Object.entries(res?.recipes ?? {})) {
          if (typeof url === 'string') cache.recipes.set(slug, url);
        }
        bump(n => n + 1);
      })
      .catch(() => {
        // Allow a retry on the next mount rather than remembering a failure
        // forever — this is usually a dropped connection, not a missing image.
        for (const s of wantEx) known.exercises.delete(s);
        for (const s of wantRec) known.recipes.delete(s);
      });

    return () => { cancelled = true; };
  }, [exKey, recKey]);

  return {
    exercise: slug => (slug ? cache.exercises.get(slug) ?? null : null),
    recipe: slug => (slug ? cache.recipes.get(slug) ?? null : null),
  };
}
