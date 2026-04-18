import type { StringKey } from './en.js';

/**
 * Keys whose English value is intentionally preserved across all locales.
 * Used by scripts/i18n-check.mjs to skip English-leak warnings on these keys.
 */
export const KEEP_ENGLISH: ReadonlySet<StringKey> = new Set<StringKey>([
  // Add brand / proper-noun / placeholder-only keys here as needed
] as StringKey[]);
