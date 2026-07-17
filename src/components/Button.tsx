import React from 'react';

/**
 * The one companion button, matching the house button used in the IDE + VS Code
 * extension so the surfaces read as one product.
 *
 * The house style is NOT a solid bright-purple block — it's the accent-tint
 * pill used for the IDE's "New Chat" button and the extension's CTAs:
 *   background: color-mix(var(--accent) 10%, transparent)
 *   border:     1px color-mix(var(--accent) 25%, transparent)
 *   color:      var(--accent)   ← purple text, not white
 *   radius 8 · hover → accent 20%
 * (verified against packages/ide/src/components/DashboardPages.tsx "New Chat".)
 * The companion accent is ava-purple (= the IDE/extension --accent, #a855f7).
 *
 *   primary   → the house accent-tint pill (the default look everywhere)
 *   solid     → solid accent fill, white text — for the one loud CTA on a
 *               screen (rare; the desktop surfaces use it sparingly)
 *   secondary → neutral quiet button (cancel / dismiss)
 *   ghost     → bare, fills on hover
 *   danger    → red-tint, for destructive confirms
 */

type Variant = 'primary' | 'solid' | 'secondary' | 'ghost' | 'danger';
// `lg` is the mobile touch size (taller tap target) for full-width CTAs; `md`
// matches the desktop surfaces' button height.
type Size = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none';

const VARIANTS: Record<Variant, string> = {
  // The house pill: translucent accent fill, accent border, accent text.
  primary: 'rounded-lg border border-ava-purple/25 bg-ava-purple/10 text-ava-purple hover:bg-ava-purple/20',
  solid: 'rounded-lg bg-ava-purple text-white hover:opacity-90',
  secondary: 'rounded-lg border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10',
  ghost: 'rounded-lg text-gray-400 hover:text-white hover:bg-ava-surface',
  danger: 'rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-4 py-3 text-sm',
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Stretch to the container width — common for mobile CTAs. */
  block?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
