'use client';

// ─── The little picture on a plan row ───────────────────────────────────────
//
// Small, square, and always the same size whether or not there is an image —
// a thumbnail that collapses when it fails makes every row jump, which is
// worse than no thumbnail at all.
//
// The placeholder is a quiet glyph rather than a broken-image icon or a grey
// void: a free-text exercise someone typed themselves is a legitimate thing to
// have in a plan, and it should not look like an error.

import { useState } from 'react';

type Kind = 'exercise' | 'recipe';

const SIZES = {
  sm: 'w-10 h-10 rounded-md',
  md: 'w-14 h-14 rounded-lg',
  lg: 'w-20 h-20 rounded-xl',
} as const;

export function LibraryThumb({ src, kind, alt, size = 'sm' }: {
  src: string | null;
  kind: Kind;
  alt: string;
  size?: keyof typeof SIZES;
}) {
  // A URL that 404s should fall back to the placeholder, not leave a broken
  // image. Keyed on src so changing the row resets it.
  const [failed, setFailed] = useState(false);
  const box = `${SIZES[size]} shrink-0 overflow-hidden bg-ava-bg border border-ava-border`;

  if (!src || failed) {
    return (
      <div className={`${box} flex items-center justify-center text-gray-700`} aria-hidden>
        {kind === 'exercise' ? <DumbbellGlyph /> : <BowlGlyph />}
      </div>
    );
  }

  return (
    <div className={box}>
      {/* Plain <img>: these are remote Supabase URLs and the companion is a
          static export, so next/image's optimiser is not in play. */}
      <img
        key={src}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

function DumbbellGlyph() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" d="M6.75 8.25v7.5M4.5 9.75v4.5M17.25 8.25v7.5M19.5 9.75v4.5M6.75 12h10.5" />
    </svg>
  );
}

function BowlGlyph() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 11.25h16.5a8.25 8.25 0 0 1-16.5 0ZM8.25 7.5c0-1.5 1.5-1.5 1.5-3M12 7.5c0-1.5 1.5-1.5 1.5-3" />
    </svg>
  );
}
