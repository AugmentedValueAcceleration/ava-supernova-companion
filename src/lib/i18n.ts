/**
 * Companion i18n — per-locale files under src/locales/*.ts.
 * Key set defined by en.ts (StringKey); every other locale must mirror it
 * (enforced by Record<StringKey, string> + scripts/i18n-check.mjs).
 *
 * English strings bundled inline; other locales loaded dynamically on demand
 * so the initial bundle stays small.
 */

import { useEffect, useState } from 'react';
import { enStrings, type StringKey } from '../locales/en';

export type { StringKey };

const translations: Record<string, Record<string, string>> = {
  en: enStrings,
};

/** Dynamic locale loaders — Next.js code-splits each chunk. */
const localeImports: Record<string, () => Promise<Record<string, Record<string, string>>>> = {
  ar: () => import('../locales/ar'),
  de: () => import('../locales/de'),
  es: () => import('../locales/es'),
  fr: () => import('../locales/fr'),
  hi: () => import('../locales/hi'),
  id: () => import('../locales/id'),
  it: () => import('../locales/it'),
  ja: () => import('../locales/ja'),
  ko: () => import('../locales/ko'),
  nl: () => import('../locales/nl'),
  pl: () => import('../locales/pl'),
  pt: () => import('../locales/pt'),
  ru: () => import('../locales/ru'),
  th: () => import('../locales/th'),
  tr: () => import('../locales/tr'),
  uk: () => import('../locales/uk'),
  vi: () => import('../locales/vi'),
  'zh-CN': () => import('../locales/zh-CN'),
  'zh-TW': () => import('../locales/zh-TW'),
};

const SUPPORTED_LANGS = Object.keys(localeImports).concat(['en']);

function detectBrowserLanguage(): string {
  if (typeof window === 'undefined') return 'en';
  const browserLang = navigator.language || 'en';
  if (SUPPORTED_LANGS.includes(browserLang)) return browserLang;
  const base = browserLang.split('-')[0];
  if (SUPPORTED_LANGS.includes(base)) return base;
  if (browserLang.startsWith('zh')) return browserLang.toLowerCase().includes('tw') ? 'zh-TW' : 'zh-CN';
  return 'en';
}

function detectLanguage(): string {
  if (typeof window === 'undefined') return 'en';
  const saved = localStorage.getItem('ava-companion-lang');
  if (saved === 'auto' || !saved) return detectBrowserLanguage();
  if (SUPPORTED_LANGS.includes(saved)) return saved;
  return detectBrowserLanguage();
}

let currentLang = 'en';
let langVersion = 0;
const LOCALE_CHANGED_EVENT = 'ava-companion-locale-changed';

/** Load the active locale's strings. Safe to call on client only. */
async function ensureLoaded(lang: string): Promise<void> {
  if (lang === 'en' || translations[lang]) return;
  const loader = localeImports[lang];
  if (!loader) return;
  try {
    const mod = await loader();
    const exportName = Object.keys(mod).find((k) => k.endsWith('Strings'));
    if (exportName && mod[exportName]) {
      translations[lang] = mod[exportName] as unknown as Record<string, string>;
      langVersion++;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(LOCALE_CHANGED_EVENT));
      }
    }
  } catch {
    // Missing file — fall back to English
  }
}

export async function initI18n(): Promise<void> {
  currentLang = detectLanguage();
  await ensureLoaded(currentLang);
}

export async function setLanguage(lang: string): Promise<void> {
  const resolved = lang === 'auto' ? detectBrowserLanguage() : lang;
  await ensureLoaded(resolved);
  currentLang = resolved;
  langVersion++;
  if (typeof window !== 'undefined') {
    localStorage.setItem('ava-companion-lang', lang);
    window.dispatchEvent(new CustomEvent(LOCALE_CHANGED_EVENT));
  }
}

/**
 * React hook — re-renders when the active locale changes (or finishes loading).
 * Returns the current locale code.
 */
export function useLocale(): string {
  const [, setVersion] = useState(langVersion);
  useEffect(() => {
    const handler = () => setVersion(++langVersion);
    window.addEventListener(LOCALE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(LOCALE_CHANGED_EVENT, handler);
  }, []);
  return currentLang;
}

export function getLanguage(): string {
  return currentLang;
}

/**
 * Translate a key. Falls back to English if the active locale's file hasn't
 * loaded yet (first render before ensureLoaded resolves). Key lookups are
 * statically checked via StringKey.
 */
export function t(key: StringKey): string {
  return (
    translations[currentLang]?.[key] ??
    translations.en[key] ??
    key
  );
}

export function getSupportedLanguages(): Array<{ code: string; name: string }> {
  const names: Record<string, string> = {
    en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch',
    ja: '日本語', ko: '한국어', 'zh-CN': '中文（简体）', 'zh-TW': '中文（繁體）',
    pt: 'Português', it: 'Italiano', ar: 'العربية', hi: 'हिन्दी',
    ru: 'Русский', tr: 'Türkçe', pl: 'Polski', uk: 'Українська',
    nl: 'Nederlands', id: 'Bahasa Indonesia', vi: 'Tiếng Việt', th: 'ไทย',
  };
  return [
    { code: 'auto', name: 'Auto (Browser)' },
    ...SUPPORTED_LANGS.sort().map((code) => ({ code, name: names[code] || code })),
  ];
}
