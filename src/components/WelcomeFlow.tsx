'use client';

// Companion first-run flow.
//
// Renders from the SHARED onboarding model (src/onboarding/flow.ts) — the same
// step ids, path ids and copy keys the IDE and extension use. Previously this
// was a bespoke 4-step flow with hardcoded English, so the three surfaces drifted
// in both content and wording, and the companion's tour was the only one that
// could never be translated.
//
// The companion opts out of two steps via the shared model's `surfaces` field:
// `desktop` (no automation on a phone) and `hours` (no scheduler surface to act
// on). Everything else is shared, so parity holds by construction rather than by
// anyone remembering to mirror a change.
//
// Mobile-specific and deliberately kept:
//   • PWA install hint for iOS / Android users not yet installed.
//   • Consent step retained (the IDE has it, the extension does not) — the
//     companion is a first-touch surface for a lot of users.

import { useState, useEffect } from 'react';
import { Button } from './Button';
import { CustomSelect } from './CustomSelect';
import { t, useLocale, setLanguage, getSupportedLanguages } from '@/lib/i18n';
import { PATHS, BREADTH, stepsFor, pathById, type OnboardingPath } from '@/onboarding/flow';

interface Props {
  userName: string;
  onComplete: () => void;
}

const STEPS = stepsFor('companion'); // consent, identity, path, tailored, breadth, connect, ready

/**
 * Translate a key that comes from the shared flow model.
 *
 * The model stores copy keys as plain strings (it is mirrored across three
 * surfaces with different i18n implementations), while the companion's `t()`
 * is strictly typed to its own key union. The keys DO exist — they were copied
 * from core into all 20 companion locales, and i18n-check verifies every one
 * on every locale. The type system just can't see through the indirection.
 *
 * Cast in one place rather than at a dozen call sites, and keep `t()` strict
 * everywhere else — that strictness is what catches genuine typos.
 */
const tk = (key: string): string => t(key as Parameters<typeof t>[0]);

/**
 * The stored language PREFERENCE, not the resolved locale.
 *
 * getLanguage() returns what we resolved to ('en' when the preference is
 * 'auto'), which would leave the picker unable to ever show "Auto" as the
 * selected option. SettingsView reads the raw preference for the same reason;
 * this matches it.
 */
function languagePreference(): string {
  if (typeof window === 'undefined') return 'auto';
  try { return localStorage.getItem('ava-companion-lang') || 'auto'; } catch { return 'auto'; }
}

function usePwaInstallHint() {
  const [shouldHint, setShouldHint] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod|Android/i.test(ua)) setShouldHint(true);
  }, []);
  return shouldHint;
}

export default function WelcomeFlow({ userName, onComplete }: Props) {
  const [idx, setIdx] = useState(0);
  const [consentChecked, setConsentChecked] = useState(false);
  const [pathId, setPathId] = useState<string | null>(null);
  const showPwaHint = usePwaInstallHint();
  // Re-renders the whole tour when the language changes, so the picker below
  // can switch in place. Settings has to reload the app to change language;
  // here that would restart the tour, which is exactly what we must avoid.
  useLocale();

  const stepId = STEPS[idx]?.id ?? 'ready';
  const path = pathId ? pathById(pathId) : undefined;
  const isLast = idx === STEPS.length - 1;

  const recordConsent = () => {
    const timestamp = new Date().toISOString();
    localStorage.setItem('ava-companion-consent-accepted', timestamp);
    const key = localStorage.getItem('ava-companion-api-key');
    if (key) {
      fetch('https://ava-supernova.com/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, 'X-Ava-Platform': 'companion' },
        body: JSON.stringify({ platform: 'companion', appVersion: '1.0.0', acceptedAt: timestamp, termsVersion: '1.0', privacyVersion: '1.0' }),
      }).catch(() => { /* non-critical */ });
    }
  };

  // Remember the chosen path so the rest of the app can tailor itself, matching
  // what the IDE persists. Harmless if nothing reads it yet.
  const choosePath = (id: string) => {
    setPathId(id);
    try { localStorage.setItem('ava-companion-onboarding-path', id); } catch { /* non-fatal */ }
  };

  const next = () => {
    if (stepId === 'consent') recordConsent();
    if (isLast) { onComplete(); return; }
    setIdx(idx + 1);
  };

  // Can't advance past consent unticked, or past the path fork with no pick.
  const canNext = (stepId !== 'consent' || consentChecked) && (stepId !== 'path' || !!pathId);

  return (
    <div className="fixed inset-0 z-50 bg-ava-bg flex flex-col">
      {/* Language picker — parity with the IDE and extension, which both put
          one in the tour header. Without it the tour is locked to whatever the
          browser was detected as, and a non-English user has no way out: the
          Settings picker is on the other side of an onboarding gate they
          cannot pass in a language they may not read.

          Switches IN PLACE via useLocale() above — no reload, so the tour does
          not restart. */}
      <div className="shrink-0 px-5 pt-4 flex items-center gap-3">
        <div className="w-44">
          <CustomSelect
            value={languagePreference()}
            onChange={(v) => { void setLanguage(v); }}
            options={getSupportedLanguages().map((l) => ({ value: l.code, label: l.name }))}
            placeholder={t('language')}
          />
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 pt-4 pb-4">
        {STEPS.map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-6 bg-ava-purple' : i < idx ? 'w-1.5 bg-ava-purple/50' : 'w-1.5 bg-ava-border'}`} />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="max-w-sm mx-auto">
          {stepId === 'consent' && <ConsentStep checked={consentChecked} onCheck={setConsentChecked} />}
          {stepId === 'identity' && <IdentityStep userName={userName} />}
          {stepId === 'path' && <PathStep selected={pathId} onPick={choosePath} />}
          {stepId === 'tailored' && path && <TailoredStep path={path} />}
          {stepId === 'breadth' && <BreadthStep />}
          {stepId === 'connect' && <ConnectStep showPwaHint={showPwaHint} />}
          {stepId === 'ready' && <ReadyStep path={path} />}
        </div>
      </div>

      <div className="shrink-0 px-5 pb-6 pt-3 max-w-sm mx-auto w-full">
        <div className="flex gap-3">
          {idx > 0 && (
            <Button onClick={() => setIdx(idx - 1)} variant="secondary" size="lg" className="flex-1">
              {t('onboarding.back')}
            </Button>
          )}
          <Button onClick={next} disabled={!canNext} size="lg" className="flex-1">
            {stepId === 'consent' ? t('onboarding.agree') : isLast ? t('onboarding.ready.go') : t('onboarding.next')}
          </Button>
        </div>
        {stepId !== 'consent' && !isLast && (
          <button onClick={onComplete} className="w-full mt-2 text-xs text-gray-600 hover:text-gray-400 transition">
            {t('onboarding.skip')}
          </button>
        )}
      </div>
    </div>
  );
}

function ConsentStep({ checked, onCheck }: { checked: boolean; onCheck: (v: boolean) => void }) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-white">{t('onboarding.consent.title')}</h2>
        <p className="text-sm text-gray-400">{t('onboarding.consent.body')}</p>
      </div>

      <div className="bg-ava-surface border border-ava-border rounded-xl p-4">
        <ul className="list-disc pl-4 space-y-1.5 text-xs text-gray-400 leading-relaxed">
          <li>{t('onboarding.consent.local')}</li>
          <li>{t('onboarding.consent.sync')}</li>
          <li>{t('onboarding.consent.train')}</li>
          <li>{t('onboarding.consent.keys')}</li>
          <li>{t('onboarding.consent.track')}</li>
        </ul>
      </div>

      <div className="flex justify-center gap-4 text-xs">
        <a href="https://ava-supernova.com/terms" target="_blank" rel="noopener" className="text-ava-purple hover:text-ava-purple-light transition">{t('termsOfService')}</a>
        <span className="text-gray-600">|</span>
        <a href="https://ava-supernova.com/privacy" target="_blank" rel="noopener" className="text-ava-purple hover:text-ava-purple-light transition">{t('privacyPolicy')}</a>
      </div>

      <label className={`flex items-start gap-3 rounded-xl p-3 cursor-pointer transition border ${checked ? 'border-ava-purple bg-ava-purple/10' : 'border-ava-border bg-ava-surface'}`}>
        <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} className="mt-0.5 accent-purple-500" />
        <span className="text-xs text-gray-300 leading-relaxed">{t('onboarding.consent.agree')}</span>
      </label>
    </div>
  );
}

function IdentityStep({ userName }: { userName: string }) {
  return (
    <div className="text-center space-y-6 py-4">
      {/* Ava's headshot — same asset and treatment as the IDE and extension
          identity step. The gradient sits behind the image so a failed load
          degrades to the brand fill rather than a hole. */}
      <div
        className="w-24 h-24 mx-auto rounded-full overflow-hidden flex items-center justify-center border-2 border-ava-purple"
        style={{ background: 'linear-gradient(135deg, var(--accent, #a855f7), #6366f1)' }}
      >
        <img
          src="/ava-avatar.jpeg"
          alt="Ava"
          className="w-full h-full object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-white">
          {t('onboarding.identity.title')}
          {userName ? ` ${userName}.` : ''}
        </h1>
        <p className="text-sm text-gray-300 leading-relaxed">{t('onboarding.identity.body')}</p>
      </div>
    </div>
  );
}

function PathStep({ selected, onPick }: { selected: string | null; onPick: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-white">{t('onboarding.path.title')}</h2>
        <p className="text-xs text-gray-400 leading-relaxed">{t('onboarding.path.subtitle')}</p>
      </div>
      <div className="space-y-2">
        {PATHS.map((p) => (
          <button
            key={p.id}
            onClick={() => onPick(p.id)}
            className={`w-full flex items-start gap-3 rounded-xl border p-3 text-left transition ${
              selected === p.id ? 'border-ava-purple bg-ava-purple/10' : 'border-ava-border bg-ava-surface hover:border-ava-purple/40'
            }`}
          >
            <span className="text-2xl shrink-0">{p.icon}</span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white">{tk(p.labelKey)}</h3>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{tk(p.blurbKey)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function TailoredStep({ path }: { path: OnboardingPath }) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-white">{tk(path.labelKey)}</h2>
        <p className="text-xs text-gray-400">{t('onboarding.try_this')}</p>
      </div>
      <div className="space-y-3">
        {path.tailoredKeys.map((base) => (
          <div key={base} className="rounded-xl border border-ava-border bg-ava-surface p-3">
            <h3 className="text-sm font-semibold text-white">{tk(`${base}.title`)}</h3>
            <p className="mt-1.5 rounded-lg border border-ava-purple/30 bg-ava-purple/10 px-3 py-2 text-xs text-gray-200 leading-relaxed">
              {tk(`${base}.example`)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BreadthStep() {
  // `surfaces` filtering is what keeps the desktop-automation group off the
  // phone without this component knowing anything about it.
  const groups = BREADTH.filter((g) => g.surfaces.includes('companion'));
  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-white">{t('onboarding.breadth.title')}</h2>
        <p className="text-xs text-gray-400 leading-relaxed">{t('onboarding.breadth.subtitle')}</p>
      </div>
      {groups.map((g) => (
        <div key={g.titleKey} className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ava-purple-light">{tk(g.titleKey)}</p>
          <div className="space-y-2">
            {g.items.map((item) => (
              <div key={item.labelKey} className="flex gap-3 rounded-xl border border-ava-border bg-ava-surface p-3">
                <span className="text-xl shrink-0">{item.icon}</span>
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold text-white">{tk(item.labelKey)}</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{tk(item.blurbKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConnectStep({ showPwaHint }: { showPwaHint: boolean }) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-white">{t('onboarding.connect.title')}</h2>
        <p className="text-xs text-gray-400">{t('onboarding.connect.subtitle')}</p>
      </div>

      <div className="rounded-xl border border-ava-border bg-ava-surface p-4">
        <p className="text-xs text-gray-300 leading-relaxed">{t('onboarding.connect.body')}</p>
      </div>

      {/* Mobile-only: the "app on my phone" experience needs a home-screen
          install, and most users never discover it unprompted. */}
      {showPwaHint && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 mb-1">{t('proTip')}</p>
          <p className="text-xs text-gray-300 leading-relaxed">{t('pwaInstallHint')}</p>
        </div>
      )}
    </div>
  );
}

function ReadyStep({ path }: { path: OnboardingPath | undefined }) {
  const label = path ? tk(path.labelKey) : '';
  return (
    <div className="text-center space-y-5 py-4">
      <h2 className="text-2xl font-bold text-white">{t('onboarding.ready.title')}</h2>
      <p className="text-sm text-gray-300 leading-relaxed">
        {t('onboarding.ready.body').replace('{path}', label)}
      </p>
      <div className="space-y-2 text-left">
        <ReadyRow title={t('onboarding.ready.docs')} desc={t('onboarding.ready.docs_desc')} />
        <ReadyRow title={t('onboarding.ready.create')} desc={t('onboarding.ready.create_desc')} />
        <ReadyRow title={t('onboarding.ready.settings')} desc={t('onboarding.ready.settings_desc')} />
      </div>
    </div>
  );
}

function ReadyRow({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-ava-border bg-ava-surface p-3">
      <p className="text-xs font-semibold text-white">{title}</p>
      <p className="text-[11px] text-gray-400 mt-0.5">{desc}</p>
    </div>
  );
}
