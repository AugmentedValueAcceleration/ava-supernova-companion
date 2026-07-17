import React from 'react';

/**
 * The one companion button, matching the house style used in the IDE + VS Code
 * extension so the surfaces read as one product. Ported from the extension's
 * dashboard buttons:
 *   - primary   → solid accent fill, white text (`bg-[var(--accent)] text-white
 *                 rounded-lg hover:opacity-90`)
 *   - secondary → accent-tint pill (`border accent 30% · bg accent 10% ·
 *                 text accent`), the "New Chat" / badge style
 *   - ghost     → quiet icon/text button that fills on hover
 * The companion's accent is ava-purple (= the extension's --accent).
 *
 * Before this, every button re-declared its own inline Tailwind, which is why
 * the companion drifted to a generic look — some solid, some grey, some
 * bordered. Route buttons through here for consistency; keep nav tabs and
 * selected-state toggles on their own styling (those aren't CTAs).
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
// `lg` is the mobile touch size (taller tap target) for full-width CTAs; `md`
// matches the desktop surfaces' button height.
type Size = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ava-purple text-white rounded-lg hover:opacity-90',
  secondary:
    'rounded-lg border border-ava-purple/30 bg-ava-purple/10 text-ava-purple hover:bg-ava-purple/20',
  ghost: 'rounded-lg text-gray-400 hover:text-white hover:bg-ava-surface',
  danger:
    'rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20',
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
