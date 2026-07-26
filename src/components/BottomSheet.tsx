'use client';

// ─── Bottom sheet ───────────────────────────────────────────────────────────
//
// Quick Log used to expand INLINE under whichever button you pressed. Three
// problems, all of them worse on the device this is actually used on: the panel
// was cramped, it shoved the rest of the page down as it opened, and on a phone
// the keyboard covered the field you had just been given. Meanwhile the meal
// sheet next to it already used a bottom sheet — two interaction models inside
// one section of one screen.
//
// This is the one model. Anchored to the bottom, so the keyboard pushes it up
// instead of over it; the content scrolls inside rather than moving the page;
// and it closes on the backdrop, on Escape, and on its own confirm.

import { useEffect, useRef } from 'react';
import { Button } from './Button';

export function BottomSheet({ title, subtitle, onClose, children, footer }: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);

    // Focus the first field so the keyboard opens on the thing you came to
    // fill in. Without this, opening a sheet to log a meal costs an extra tap
    // every single time.
    const first = panel.current?.querySelector<HTMLElement>(
      'input:not([type=hidden]), textarea, select',
    );
    first?.focus();

    // Stop the page behind from scrolling under the sheet, which on iOS reads
    // as the sheet itself failing to scroll.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        ref={panel}
        onClick={e => e.stopPropagation()}
        className="bg-ava-bg border-t border-ava-border rounded-t-2xl max-h-[85vh] flex flex-col"
      >
        <div className="shrink-0 px-4 pt-3 pb-2 border-b border-ava-border">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ava-border" />
          <div className="text-white text-sm font-medium">{title}</div>
          {subtitle && <div className="text-[11px] text-gray-500 mt-0.5">{subtitle}</div>}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>

        {footer && (
          // pb accounts for the home indicator on a phone, so the confirm is
          // never half-hidden behind it.
          <div className="shrink-0 border-t border-ava-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The single confirm every sheet ends with. One action, always in the same
 * place, so the gesture is learned once.
 *
 * Uses the HOUSE button rather than a hand-rolled one. Button.tsx says it
 * outright — "the house style is NOT a solid bright-purple block" — and every
 * sheet added this week ignored that and shipped a solid purple slab with white
 * text. The house pill is an accent TINT with accent text, and it is what the
 * IDE and the extension use, which is the whole point of having one.
 */
export function SheetConfirm({ label, onClick, disabled }: {
  label: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <Button variant="primary" size="lg" block onClick={onClick} disabled={disabled}>
      {label}
    </Button>
  );
}

/** The quiet half of a two-button footer — discard, cancel, try again. */
export function SheetCancel({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="secondary" size="lg" block onClick={onClick}>
      {label}
    </Button>
  );
}
