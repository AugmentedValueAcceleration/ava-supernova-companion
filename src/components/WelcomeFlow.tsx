'use client';

// Companion first-run flow (Priority 3 onboarding).
//
// Change vs previous version:
//   • Plans step removed — plans belong contextually (e.g. when the
//     user hits ~5 messages, or from Settings), not as a mandatory
//     onboarding gate. Showing pricing before they've sent a single
//     message framed Ava as "sign up to unlock" when the actual
//     promise is "free to start, every model included."
//   • Features step gets the extension's tighter "memory-that-learns"
//     framing so Companion + Extension + IDE all say the same thing.
//   • Connect step doubles as a quick UI tour — points at the three
//     things the user should try first on mobile (chat, tasks, memory).
//   • iOS / Android users without a PWA install see a one-line hint
//     about adding to the home screen for the real "app on my phone"
//     experience.

import { useState, useEffect } from 'react';
import { Button } from './Button';

interface Props {
  userName: string;
  onComplete: () => void;
}

function usePwaInstallHint() {
  const [shouldHint, setShouldHint] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;
    const ua = navigator.userAgent || '';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
    if (isMobile) setShouldHint(true);
  }, []);
  return shouldHint;
}

export default function WelcomeFlow({ userName, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [consentChecked, setConsentChecked] = useState(false);
  const showPwaHint = usePwaInstallHint();

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

  const steps = [
    // ── Step 0: GDPR Consent ──────────────────────────────────────
    <div key="consent" className="space-y-5">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-white">Before you begin</h2>
        <p className="text-sm text-gray-400">A quick note on your data.</p>
      </div>

      <div className="bg-ava-surface border border-ava-border rounded-xl p-4">
        <div className="text-xs text-gray-300 leading-relaxed space-y-2">
          <p>Ava is built by <span className="text-white font-medium">Augmented Value Acceleration Ltd</span>, registered in England and Wales.</p>
          <ul className="list-disc pl-4 space-y-1 text-gray-400">
            <li>All data is <span className="text-emerald-400">stored locally</span> on your device by default</li>
            <li>Cloud sync is <span className="text-emerald-400">opt-in only</span></li>
            <li>Your data is <span className="text-emerald-400">never used to train AI models</span></li>
            <li>No third-party analytics or tracking</li>
          </ul>
          <p className="text-gray-500">You can exercise your UK GDPR rights at any time in Settings.</p>
        </div>
      </div>

      <div className="flex justify-center gap-4 text-xs">
        <a href="https://ava-supernova.com/terms" target="_blank" rel="noopener" className="text-ava-purple hover:text-ava-purple-light transition">Terms of Service</a>
        <span className="text-gray-600">|</span>
        <a href="https://ava-supernova.com/privacy" target="_blank" rel="noopener" className="text-ava-purple hover:text-ava-purple-light transition">Privacy Policy</a>
      </div>

      <label className={`flex items-start gap-3 rounded-xl p-3 cursor-pointer transition border ${consentChecked ? 'border-ava-purple bg-ava-purple/10' : 'border-ava-border bg-ava-surface'}`}>
        <input type="checkbox" checked={consentChecked} onChange={e => setConsentChecked(e.target.checked)} className="mt-0.5 accent-purple-500" />
        <span className="text-xs text-gray-300 leading-relaxed">
          I have read and agree to the <span className="text-white font-medium">Terms of Service</span> and <span className="text-white font-medium">Privacy Policy</span>
        </span>
      </label>
    </div>,

    // ── Step 1: Welcome ───────────────────────────────────────────
    <div key="welcome" className="text-center space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">You&rsquo;re in{userName ? `, ${userName}` : ''}.</h1>
        <p className="text-gray-400">Ava on your phone. Same brain as your desktop.</p>
      </div>

      {/* Ava's headshot — the same asset and the same treatment the IDE and
          extension use on their identity step (WelcomeOverlay.tsx). This was a
          generic sparkle SVG, so the one screen whose job is introducing Ava
          was the one screen that didn't show her. The gradient sits behind the
          image so a failed load degrades to the brand fill rather than a hole. */}
      <div
        className="w-20 h-20 mx-auto rounded-full overflow-hidden flex items-center justify-center border-2 border-ava-purple"
        style={{ background: 'linear-gradient(135deg, var(--accent, #a855f7), #6366f1)' }}
      >
        <img
          src="/ava-avatar.jpeg"
          alt="Ava"
          className="w-full h-full object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      <p className="text-sm text-gray-300 leading-relaxed max-w-xs mx-auto">
        Chat, capture thoughts, manage your day — your memory and tasks follow you between phone, laptop, and desktop.
      </p>
    </div>,

    // ── Step 2: What you can do on mobile ─────────────────────────
    <div key="features" className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white">What to do on mobile</h2>
        <p className="text-sm text-gray-400 mt-1">Different from the extension — shorter sessions, same memory.</p>
      </div>

      <div className="space-y-3">
        <FeatureCard
          icon="💬"
          title="Chat anywhere"
          desc="Quick questions, drafts, brainstorms. She remembers what you discussed on your desktop this morning."
        />
        <FeatureCard
          icon="✅"
          title="Tasks that sync"
          desc="Say &ldquo;remind me to fix auth tomorrow.&rdquo; Shows up in your VS Code task panel next time you open it."
        />
        <FeatureCard
          icon="📓"
          title="Journal on the go"
          desc="Dual journal — yours and Ava&rsquo;s. Capture a thought in a minute; see patterns over weeks."
        />
        <FeatureCard
          icon="🧠"
          title="Memory that learns you"
          desc="Stored locally by default. Turn on cloud sync in Settings when you want it across devices."
        />
      </div>
    </div>,

    // ── Step 3: Try this + install hint ───────────────────────────
    <div key="try" className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white">Try this first</h2>
        <p className="text-sm text-gray-400 mt-1">One tap to feel what Ava does.</p>
      </div>

      <div className="rounded-xl border border-ava-purple/40 bg-ava-purple/10 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ava-purple-light mb-2">
          Send this as your first message
        </p>
        <p className="text-sm font-medium text-white leading-relaxed">
          &ldquo;What&rsquo;s the most important thing on my plate today?&rdquo;
        </p>
      </div>

      <div className="space-y-2">
        <TryRow label="💬 Chat tab" hint="That prompt goes here. The composer is at the bottom." />
        <TryRow label="✅ Tasks & Journal" hint="Swipe from the right edge or tap the menu." />
        <TryRow label="🧠 Memory" hint="View what Ava&rsquo;s learned about you in Settings → Memory." />
      </div>

      {showPwaHint && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 mb-1">Pro tip</p>
          <p className="text-xs text-gray-300 leading-relaxed">
            Add to your home screen for a one-tap Ava.
            <span className="block mt-1 text-gray-500">
              iPhone: Share → Add to Home Screen · Android: menu → Install app
            </span>
          </p>
        </div>
      )}

      <div className="flex gap-2 text-center">
        <a
          href="https://ava-supernova.com/meet-ava"
          target="_blank"
          rel="noopener"
          className="flex-1 rounded-lg border border-ava-border bg-ava-surface px-3 py-2 text-xs text-gray-300 hover:border-ava-purple/40 transition"
        >
          Meet Ava
        </a>
        <a
          href="https://ava-supernova.com/documentation"
          target="_blank"
          rel="noopener"
          className="flex-1 rounded-lg border border-ava-border bg-ava-surface px-3 py-2 text-xs text-gray-300 hover:border-ava-purple/40 transition"
        >
          Read the docs
        </a>
      </div>
    </div>,
  ];

  return (
    <div className="fixed inset-0 z-50 bg-ava-bg flex flex-col">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 pt-6 pb-4">
        {steps.map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-ava-purple' : i < step ? 'w-1.5 bg-ava-purple/50' : 'w-1.5 bg-ava-border'}`} />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="max-w-sm mx-auto">
          {steps[step]}
        </div>
      </div>

      {/* Footer buttons */}
      <div className="shrink-0 px-5 pb-6 pt-3 max-w-sm mx-auto w-full">
        <div className="flex gap-3">
          {step > 1 && (
            <Button onClick={() => setStep(step - 1)} variant="secondary" size="lg" className="flex-1">
              Back
            </Button>
          )}
          <Button
            onClick={() => {
              if (step === 0) { recordConsent(); setStep(1); }
              else if (step < steps.length - 1) setStep(step + 1);
              else onComplete();
            }}
            disabled={step === 0 && !consentChecked}
            size="lg"
            className="flex-1"
          >
            {step === 0 ? 'I Agree' : step === steps.length - 1 ? "Let\u2019s go" : 'Next'}
          </Button>
        </div>
        {step > 0 && step < steps.length - 1 && (
          <button onClick={onComplete} className="w-full mt-2 text-xs text-gray-600 hover:text-gray-400 transition">
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex gap-3 bg-ava-surface border border-ava-border rounded-xl p-3">
      <span className="text-2xl shrink-0">{icon}</span>
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function TryRow({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-ava-border bg-ava-surface p-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-white">{label}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{hint}</p>
      </div>
    </div>
  );
}
