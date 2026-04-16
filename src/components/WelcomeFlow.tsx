'use client';

import { useState } from 'react';

interface Props {
  userName: string;
  onComplete: () => void;
}

export default function WelcomeFlow({ userName, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [consentChecked, setConsentChecked] = useState(false);

  const recordConsent = () => {
    const timestamp = new Date().toISOString();
    localStorage.setItem('ava-companion-consent-accepted', timestamp);
    // Record consent server-side if connected
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
    // Step 0: GDPR Consent
    <div key="consent" className="space-y-5">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-white">Before You Begin</h2>
        <p className="text-sm text-gray-400">Please review our terms and privacy policy</p>
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

    // Step 1: Welcome
    <div key="welcome" className="text-center space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Welcome, {userName}!</h1>
        <p className="text-gray-400">You just unlocked the full Ava experience.</p>
      </div>

      <div className="w-20 h-20 mx-auto rounded-full bg-ava-purple/20 border-2 border-ava-purple flex items-center justify-center">
        <svg className="w-10 h-10 text-ava-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
      </div>

      <p className="text-sm text-gray-300 leading-relaxed max-w-xs mx-auto">
        Ava is more than a chatbot. She&apos;s your AI partner with memory, tasks, and a journal — across every device.
      </p>
    </div>,

    // Step 1: What you get
    <div key="features" className="space-y-5">
      <h2 className="text-xl font-bold text-white text-center">What&apos;s included</h2>

      <div className="space-y-3">
        <FeatureCard
          icon="🧠"
          title="Connected Memory"
          desc="Ava remembers everything across sessions. Your VS Code extension, companion app, and dashboard all share the same brain."
        />
        <FeatureCard
          icon="✅"
          title="Task Management"
          desc="Create tasks anywhere — chat, dashboard, or here on mobile. Ava sees your tasks and can help you stay on track."
        />
        <FeatureCard
          icon="📓"
          title="Dual Journal"
          desc="Write your thoughts. Ava writes hers. Two perspectives on every day — work, personal, and mental health."
        />
        <FeatureCard
          icon="📄"
          title="Office Suite"
          desc="Ava creates documents, spreadsheets, and PDFs. Ask her to write a proposal or draft a report."
        />
        <FeatureCard
          icon="🔄"
          title="Everywhere Sync"
          desc="Your data syncs across VS Code, the companion app, and the web dashboard. One Ava, everywhere."
        />
      </div>
    </div>,

    // Step 2: Plans
    <div key="plans" className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white">Choose how you work</h2>
        <p className="text-sm text-gray-400 mt-1">Start free. Upgrade when you&apos;re ready.</p>
      </div>

      <div className="space-y-3">
        <PlanCard
          name="Free"
          price="$0"
          current
          features={[
            '3M free Qwen tokens with account',
            'Qwen Omni Flash + Qwen 3.5 Omni Plus',
            'Memory, tasks, journal, learning, all surfaces',
            'BYOK — use any model with your own API key',
          ]}
        />
        <PlanCard
          name="Pro"
          price="$19/mo"
          highlight
          features={[
            'Qwen Omni Flash + Qwen 3.5 Omni Plus',
            '15M tokens/month',
            'Cloud sync, email support',
          ]}
        />
        <PlanCard
          name="Ultra"
          price="$39/mo"
          features={[
            'Everything in Pro',
            '40M tokens/month',
            'Priority support + early access',
          ]}
        />
        <PlanCard
          name="Enterprise"
          price="$79/mo"
          features={[
            'Everything in Ultra',
            '100M tokens/month',
            '200 req/min, dedicated support',
          ]}
        />
      </div>
    </div>,

    // Step 3: Connect your tools
    <div key="connect" className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white">Connect your tools</h2>
        <p className="text-sm text-gray-400 mt-1">Ava works across all your surfaces.</p>
      </div>

      <div className="space-y-3">
        <ConnectCard
          icon={<VSCodeIcon />}
          title="VS Code Extension"
          desc="61 tools, full agentic coding, memory, tasks, journal — right in your editor."
          action="Search 'Ava Supernova' in VS Code"
          color="text-blue-400"
        />
        <ConnectCard
          icon={<GlobeIcon />}
          title="Web Dashboard"
          desc="Manage your account, view usage, browse memories, and configure providers."
          action="ava-supernova.com/dashboard"
          color="text-emerald-400"
        />
        <ConnectCard
          icon={<PhoneIcon />}
          title="Companion App"
          desc="You're here! Chat with Ava on the go. Your tasks and journal sync automatically."
          color="text-ava-purple-light"
          active
        />
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
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 py-3 rounded-xl border border-ava-border text-gray-400 font-medium text-sm hover:border-gray-500 transition"
            >
              Back
            </button>
          )}
          <button
            onClick={() => {
              if (step === 0) { recordConsent(); setStep(1); }
              else if (step < steps.length - 1) setStep(step + 1);
              else onComplete();
            }}
            disabled={step === 0 && !consentChecked}
            className={`flex-1 py-3 rounded-xl bg-ava-purple text-white font-semibold text-sm transition ${step === 0 && !consentChecked ? 'opacity-30 cursor-not-allowed' : 'hover:bg-ava-purple-dark'}`}
          >
            {step === 0 ? 'I Agree' : step === steps.length - 1 ? "Let's go!" : 'Next'}
          </button>
        </div>
        {/* Skip not available on consent step */}
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

function PlanCard({ name, price, features, highlight, current }: {
  name: string; price: string; features: string[]; highlight?: boolean; current?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 border ${
      highlight ? 'border-ava-purple bg-ava-purple/5' :
      current ? 'border-emerald-500/30 bg-emerald-500/5' :
      'border-ava-border bg-ava-surface'
    }`}>
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-white">{name}</h3>
          {current && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">CURRENT</span>}
          {highlight && <span className="text-[10px] font-bold text-ava-purple-light bg-ava-purple/20 px-1.5 py-0.5 rounded">POPULAR</span>}
        </div>
        <span className="text-lg font-bold text-white">{price}</span>
      </div>
      <ul className="space-y-1.5">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
            <svg className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${highlight ? 'text-ava-purple' : current ? 'text-emerald-400' : 'text-gray-500'}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConnectCard({ icon, title, desc, action, color, active }: {
  icon: React.ReactNode; title: string; desc: string; action?: string; color: string; active?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 border ${active ? 'border-ava-purple bg-ava-purple/5' : 'border-ava-border bg-ava-surface'}`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 ${color}`}>{icon}</div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {active && <span className="text-[10px] font-bold text-ava-purple-light bg-ava-purple/20 px-1.5 py-0.5 rounded">YOU&apos;RE HERE</span>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
          {action && <p className="text-xs text-gray-500 mt-1.5 font-mono">{action}</p>}
        </div>
      </div>
    </div>
  );
}

function VSCodeIcon() {
  return <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M17.583 2.382L12.6 5.972 7.05 2.148 2 4.283v15.436l5.05 2.134 5.548-3.824 4.983 3.59L22 19.718V4.283l-4.417-1.901zM7.05 17.252V6.748l5.548 5.252-5.548 5.252zM17.583 17.252L12.6 12l4.983-5.252v10.504z"/></svg>;
}
function GlobeIcon() {
  return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>;
}
function PhoneIcon() {
  return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>;
}
