'use client';

import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { MODELS } from '@/lib/api';
import { CustomSelect } from './CustomSelect';

interface Props {
  isGuest: boolean;
  session: Session | null;
  apiKey: string | null;
  selectedModel: string;
  onSelectModel: (id: string) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onClearChat: () => void;
}

type TextSize = 'small' | 'default' | 'large';
type Theme = 'dark' | 'light' | 'system';

export default function SettingsView({
  isGuest, session, apiKey, selectedModel,
  onSelectModel, onSignIn, onSignOut, onClearChat,
}: Props) {
  const [textSize, setTextSize] = useState<TextSize>('default');
  const [theme, setTheme] = useState<Theme>('dark');
  const [taskReminders, setTaskReminders] = useState(true);
  const [journalPrompt, setJournalPrompt] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState<string | null>(null);

  // Load settings from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('ava-companion-settings');
    if (stored) {
      try {
        const s = JSON.parse(stored);
        if (s.textSize) setTextSize(s.textSize);
        if (s.theme) setTheme(s.theme);
        if (s.taskReminders !== undefined) setTaskReminders(s.taskReminders);
        if (s.journalPrompt !== undefined) setJournalPrompt(s.journalPrompt);
      } catch {}
    }
  }, []);

  const saveSetting = (key: string, value: unknown) => {
    const stored = localStorage.getItem('ava-companion-settings');
    const settings = stored ? JSON.parse(stored) : {};
    settings[key] = value;
    localStorage.setItem('ava-companion-settings', JSON.stringify(settings));

    // Apply theme immediately
    if (key === 'theme') {
      if (value === 'light') {
        document.documentElement.classList.add('light');
      } else if (value === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('light', !prefersDark);
      } else {
        document.documentElement.classList.remove('light');
      }
    }

    // Notify CompanionApp of changes
    window.dispatchEvent(new Event('ava-settings-changed'));
  };

  const clearLocalData = (type: string) => {
    if (type === 'chat') {
      onClearChat();
    } else if (type === 'tasks') {
      localStorage.removeItem('ava-companion-tasks');
    } else if (type === 'journal') {
      // Clear all journal entries
      const keys = Object.keys(localStorage).filter(k => k.startsWith('ava-journal-'));
      keys.forEach(k => localStorage.removeItem(k));
    } else if (type === 'all') {
      localStorage.removeItem('ava-companion-tasks');
      const keys = Object.keys(localStorage).filter(k => k.startsWith('ava-journal-'));
      keys.forEach(k => localStorage.removeItem(k));
      onClearChat();
    }
    setShowClearConfirm(null);
  };

  const currentModel = MODELS.find(m => m.id === selectedModel);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-3 border-b border-ava-border">
        <h2 className="font-semibold text-white text-lg">Settings</h2>
      </div>

      <div className="p-4 space-y-5">
        {/* Account */}
        <Section title="ACCOUNT">
          {isGuest ? (
            <div className="bg-ava-surface border border-ava-border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-ava-border flex items-center justify-center text-gray-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Guest</p>
                  <p className="text-xs text-gray-500">Local data only — sign in to sync across devices</p>
                </div>
              </div>
              <button
                onClick={onSignIn}
                className="w-full bg-ava-purple hover:bg-ava-purple-dark text-white font-medium py-2.5 rounded-xl transition text-sm"
              >
                Sign In / Create Account
              </button>
              <a
                href="https://ava-supernova.com/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center text-xs text-ava-purple-light hover:underline"
              >
                View plans &amp; pricing
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-ava-surface border border-ava-border rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-ava-purple flex items-center justify-center text-white font-bold">
                    {(session?.user.user_metadata?.full_name?.[0] || session?.user.email?.[0] || 'A').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{session?.user.user_metadata?.full_name || 'Connected'}</p>
                    <p className="text-xs text-gray-500 truncate">{session?.user.email || (apiKey ? 'Connected via API key' : '')}</p>
                  </div>
                </div>
              </div>

              <div className="bg-ava-surface border border-ava-border rounded-xl p-4 space-y-2">
                <Row label="Memory" value={<SyncBadge />} />
                <Row label="Tasks" value={<SyncBadge />} />
                <Row label="Journal" value={<SyncBadge />} />
              </div>

              <a
                href={`https://ava-supernova.com/pricing${session?.access_token ? `?token=${session.access_token}` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-gradient-to-r from-purple-600 to-purple-500 text-white font-medium py-2.5 rounded-xl text-sm text-center hover:from-purple-700 hover:to-purple-600 transition"
              >
                Upgrade Plan
              </a>

              <button
                onClick={onSignOut}
                className="w-full bg-ava-surface border border-ava-border text-red-400 font-medium py-2.5 rounded-xl hover:bg-red-400/10 transition text-sm"
              >
                {apiKey ? 'Disconnect API Key' : 'Sign Out'}
              </button>
            </div>
          )}
        </Section>

        {/* Model */}
        <Section title="MODEL">
          <div className="bg-ava-surface border border-ava-border rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">Default model</p>
            <CustomSelect
              value={selectedModel}
              onChange={onSelectModel}
              placeholder="Select a model..."
              options={MODELS.filter(m => isGuest ? m.free : true).map(m => ({
                value: m.id,
                label: m.name,
                sublabel: m.provider,
                badge: m.free ? 'FREE' : undefined,
                badgeColor: m.free ? 'text-emerald-400 bg-emerald-400/10' : undefined,
              }))}
            />
          </div>
        </Section>

        {/* Appearance */}
        <Section title="APPEARANCE">
          <div className="bg-ava-surface border border-ava-border rounded-xl divide-y divide-ava-border">
            <div className="p-4">
              <Row
                label="Theme"
                value={
                  <TogglePills
                    options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }]}
                    selected={theme}
                    onChange={v => { setTheme(v as Theme); saveSetting('theme', v); }}
                  />
                }
              />
            </div>
            <div className="p-4">
              <Row
                label="Text size"
                value={
                  <TogglePills
                    options={[
                      { value: 'small', label: 'S' },
                      { value: 'default', label: 'M' },
                      { value: 'large', label: 'L' },
                    ]}
                    selected={textSize}
                    onChange={v => { setTextSize(v as TextSize); saveSetting('textSize', v); }}
                  />
                }
              />
            </div>
          </div>
        </Section>

        {/* Notifications */}
        <Section title="NOTIFICATIONS">
          <div className="bg-ava-surface border border-ava-border rounded-xl divide-y divide-ava-border">
            <div className="p-4">
              <Row
                label="Task reminders"
                subtitle="Get notified about due tasks"
                value={
                  <Toggle checked={taskReminders} onChange={v => { setTaskReminders(v); saveSetting('taskReminders', v); }} />
                }
              />
            </div>
            <div className="p-4">
              <Row
                label="Journal prompt"
                subtitle="Evening reminder to journal"
                value={
                  <Toggle checked={journalPrompt} onChange={v => { setJournalPrompt(v); saveSetting('journalPrompt', v); }} />
                }
              />
            </div>
          </div>
        </Section>

        {/* Data */}
        <Section title="DATA">
          <div className="bg-ava-surface border border-ava-border rounded-xl divide-y divide-ava-border">
            <ClearButton label="Clear chat history" type="chat" showClearConfirm={showClearConfirm} setShowClearConfirm={setShowClearConfirm} onClear={clearLocalData} />
            {isGuest && (
              <>
                <ClearButton label="Clear local tasks" type="tasks" showClearConfirm={showClearConfirm} setShowClearConfirm={setShowClearConfirm} onClear={clearLocalData} />
                <ClearButton label="Clear local journal" type="journal" showClearConfirm={showClearConfirm} setShowClearConfirm={setShowClearConfirm} onClear={clearLocalData} />
              </>
            )}
          </div>
        </Section>



        {/* About */}
        <Section title="ABOUT">
          <div className="bg-ava-surface border border-ava-border rounded-xl divide-y divide-ava-border">
            <div className="p-4">
              <Row label="Version" value={<span className="text-xs text-gray-500">0.1.0</span>} />
            </div>
            <a href="https://github.com/AugmentedValueAcceleration/ava-supernova" target="_blank" rel="noopener noreferrer" className="block p-4 hover:bg-ava-surface-hover transition">
              <Row label="GitHub" value={<ChevronRight />} />
            </a>
            <a href="https://ava-supernova.com" target="_blank" rel="noopener noreferrer" className="block p-4 hover:bg-ava-surface-hover transition">
              <Row label="Website" value={<ChevronRight />} />
            </a>
            <a href="https://ava-supernova.com/terms" target="_blank" rel="noopener noreferrer" className="block p-4 hover:bg-ava-surface-hover transition">
              <Row label="Terms of Service" value={<ChevronRight />} />
            </a>
            <a href="https://ava-supernova.com/privacy" target="_blank" rel="noopener noreferrer" className="block p-4 hover:bg-ava-surface-hover transition">
              <Row label="Privacy Policy" value={<ChevronRight />} />
            </a>
          </div>
          <p className="text-xs text-gray-600 mt-3 text-center leading-relaxed">
            Your data stays yours. Local-first. No telemetry.<br />
            Open source — Apache 2.0
          </p>
        </Section>

        {/* Bottom spacer */}
        <div className="h-4" />
      </div>
    </div>
  );
}

// Helpers
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-bold text-gray-500 tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, subtitle, value }: { label: string; subtitle?: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm text-white">{label}</span>
        {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {value}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition ${checked ? 'bg-ava-purple' : 'bg-ava-border'}`}
    >
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'left-5' : 'left-1'}`} />
    </button>
  );
}

function TogglePills({ options, selected, onChange }: {
  options: Array<{ value: string; label: string }>; selected: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex bg-ava-bg rounded-lg p-0.5 gap-0.5">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition ${
            selected === o.value ? 'bg-ava-purple text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SyncBadge() {
  return (
    <span className="flex items-center gap-1 text-xs text-emerald-400">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
      Synced
    </span>
  );
}

function ClearButton({ label, type, showClearConfirm, setShowClearConfirm, onClear }: {
  label: string; type: string;
  showClearConfirm: string | null; setShowClearConfirm: (v: string | null) => void;
  onClear: (type: string) => void;
}) {
  return (
    <div className="p-4">
      {showClearConfirm === type ? (
        <div className="flex items-center justify-between">
          <span className="text-sm text-red-400">Are you sure?</span>
          <div className="flex gap-2">
            <button onClick={() => onClear(type)} className="text-xs text-red-400 font-medium px-3 py-1 bg-red-400/10 rounded-lg hover:bg-red-400/20 transition">Clear</button>
            <button onClick={() => setShowClearConfirm(null)} className="text-xs text-gray-400 font-medium px-3 py-1 bg-ava-border rounded-lg hover:bg-gray-600 transition">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowClearConfirm(type)} className="w-full text-left">
          <Row label={label} value={<ChevronRight />} />
        </button>
      )}
    </div>
  );
}

function ChevronRight() {
  return (
    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
