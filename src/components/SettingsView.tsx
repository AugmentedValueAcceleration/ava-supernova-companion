'use client';

import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { MODELS, apiFetch } from '@/lib/api';
import { CustomSelect } from './CustomSelect';
import { t, setLanguage, getSupportedLanguages } from '@/lib/i18n';
import { loadPersonality } from '@/lib/personality';
import ConfirmDialog from './ConfirmDialog';
import ReleaseNotes from './ReleaseNotes';

interface ProviderKeys {
  deepseek?: string;
  kimi?: string;
  glm?: string;
  qwen?: string;
  mistral?: string;
  anthropic?: string;
}

const PROVIDER_KEY_FIELDS: Array<{ key: keyof ProviderKeys; label: string; placeholder: string }> = [
  { key: 'deepseek', label: 'DeepSeek', placeholder: 'sk-...' },
  { key: 'kimi', label: 'Moonshot / Kimi', placeholder: 'sk-...' },
  { key: 'glm', label: 'Zhipu AI (GLM)', placeholder: '...' },
  { key: 'qwen', label: 'Alibaba Cloud (Qwen)', placeholder: 'sk-...' },
  { key: 'mistral', label: 'Mistral AI', placeholder: '...' },
  { key: 'anthropic', label: 'Anthropic (Claude)', placeholder: 'sk-ant-...' },
];

export function loadProviderKeys(): ProviderKeys {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem('ava-companion-provider-keys');
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

export function getActiveProviderKey(model: string): string | null {
  const keys = loadProviderKeys();
  const m = MODELS.find(mod => mod.id === model);
  if (!m) return null;
  const provider = m.provider.toLowerCase();
  if (provider.includes('deepseek')) return keys.deepseek || null;
  if (provider.includes('moonshot')) return keys.kimi || null;
  if (provider.includes('zhipu')) return keys.glm || null;
  if (provider.includes('alibaba')) return keys.qwen || null;
  if (provider.includes('mistral')) return keys.mistral || null;
  if (provider.includes('anthropic')) return keys.anthropic || null;
  return null;
}

interface Props {
  isGuest: boolean;
  session: Session | null;
  apiKey: string | null;
  selectedModel: string;
  onSelectModel: (id: string) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onClearChat: () => void;
  onNavigatePersonality?: () => void;
}

type TextSize = 'small' | 'default' | 'large';
type Theme = 'dark' | 'light' | 'system';

export default function SettingsView({
  isGuest, session, apiKey, selectedModel,
  onSelectModel, onSignIn, onSignOut, onClearChat, onNavigatePersonality,
}: Props) {
  const [textSize, setTextSize] = useState<TextSize>('default');
  const [theme, setTheme] = useState<Theme>('dark');
  // Future: notification preferences (Capacitor)
  // const [taskReminders, setTaskReminders] = useState(true);
  // const [journalPrompt, setJournalPrompt] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState<string | null>(null);
  const [language, setLang] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ava-companion-lang') || 'auto';
    }
    return 'auto';
  });

  const [providerKeys, setProviderKeys] = useState<ProviderKeys>(() => loadProviderKeys());

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string;
    confirmLabel?: string; cancelLabel?: string;
    destructive?: boolean; onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  // Usage state
  const [usage, setUsage] = useState<{
    tokensUsed: number; tokensLimit: number;
    requestsUsed: number; requestsLimit: number;
    plan: string;
  } | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  // Sync state
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [personalitySyncStatus, setPersonalitySyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  // Release notes view
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  // Fetch usage for connected users
  useEffect(() => {
    if (!session?.access_token) return;
    setUsageLoading(true);
    apiFetch('/usage', {}, session.access_token)
      .then(r => r.json())
      .then(data => {
        setUsage({
          tokensUsed: data.tokens_used ?? data.tokensUsed ?? 0,
          tokensLimit: data.tokens_limit ?? data.tokensLimit ?? 0,
          requestsUsed: data.requests_used ?? data.requestsUsed ?? 0,
          requestsLimit: data.requests_limit ?? data.requestsLimit ?? 0,
          plan: data.plan || data.plan_name || 'Free',
        });
      })
      .catch(() => setUsage(null))
      .finally(() => setUsageLoading(false));
  }, [session?.access_token]);

  const handleSyncConversations = async () => {
    if (!session?.access_token) return;
    setSyncStatus('syncing');
    try {
      const stored = localStorage.getItem('ava-companion-conversations');
      const conversations = stored ? JSON.parse(stored) : [];
      await apiFetch('/history/sync', {
        method: 'POST',
        body: JSON.stringify({ conversations }),
      }, session.access_token);
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const handleSyncPersonality = async () => {
    if (!session?.access_token) return;
    setPersonalitySyncStatus('syncing');
    try {
      const personality = loadPersonality();
      await apiFetch('/settings/sync', {
        method: 'POST',
        body: JSON.stringify({ personality }),
      }, session.access_token);
      setPersonalitySyncStatus('success');
      setTimeout(() => setPersonalitySyncStatus('idle'), 3000);
    } catch {
      setPersonalitySyncStatus('error');
      setTimeout(() => setPersonalitySyncStatus('idle'), 3000);
    }
  };

  const saveProviderKey = (key: keyof ProviderKeys, value: string) => {
    const updated = { ...providerKeys, [key]: value.trim() || undefined };
    // Remove empty keys
    Object.keys(updated).forEach(k => { if (!updated[k as keyof ProviderKeys]) delete updated[k as keyof ProviderKeys]; });
    setProviderKeys(updated);
    localStorage.setItem('ava-companion-provider-keys', JSON.stringify(updated));
  };

  // Load settings from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('ava-companion-settings');
    if (stored) {
      try {
        const s = JSON.parse(stored);
        if (s.textSize) setTextSize(s.textSize);
        if (s.theme) setTheme(s.theme);
        // taskReminders and journalPrompt loaded when Capacitor notifications ship
      } catch { /* parse error */ }
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

  // const currentModel = MODELS.find(m => m.id === selectedModel);

  // Show release notes sub-view
  if (showReleaseNotes) {
    return <ReleaseNotes onBack={() => setShowReleaseNotes(false)} />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-3 border-b border-ava-border">
        <h2 className="font-semibold text-white text-lg">{t('settings')}</h2>
      </div>

      <div className="p-4 space-y-5">
        {/* Account */}
        <Section title={t('account')}>
          {isGuest ? (
            <div className="bg-ava-surface border border-ava-border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-ava-border flex items-center justify-center text-gray-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{t('guest')}</p>
                  <p className="text-xs text-gray-500">{t('guestSubtitle')}</p>
                </div>
              </div>
              <button
                onClick={onSignIn}
                className="w-full bg-ava-purple hover:bg-ava-purple-dark text-white font-medium py-2.5 rounded-xl transition text-sm"
              >
                {t('signIn')}
              </button>
              <a
                href="https://ava-supernova.com/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center text-xs text-ava-purple-light hover:underline"
              >
                {t('viewPlans')}
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
                <Row label={t('memory')} value={<span className="text-xs text-emerald-400">Connected</span>} />
                <Row label={t('tasks')} value={<span className="text-xs text-emerald-400">Connected</span>} />
                <Row label={t('journal')} value={<span className="text-xs text-emerald-400">Connected</span>} />
              </div>

              <a
                href="https://ava-supernova.com/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-gradient-to-r from-purple-600 to-purple-500 text-white font-medium py-2.5 rounded-xl text-sm text-center hover:from-purple-700 hover:to-purple-600 transition"
              >
                {t('upgradePlan')}
              </a>

              <button
                onClick={() => setConfirmDialog({
                  open: true,
                  title: t('confirmSignOut'),
                  message: t('confirmSignOutMsg'),
                  confirmLabel: t('signOut'),
                  destructive: true,
                  onConfirm: () => {
                    setConfirmDialog(prev => ({ ...prev, open: false }));
                    localStorage.removeItem('ava-companion-api-key');
                    localStorage.removeItem('ava-companion-provider-keys');
                    onSignOut();
                  },
                })}
                className="w-full bg-ava-surface border border-ava-border text-red-400 font-medium py-2.5 rounded-xl hover:bg-red-400/10 transition text-sm"
              >
                {apiKey ? t('disconnectKey') : t('signOut')}
              </button>
            </div>
          )}
        </Section>

        {/* Usage — connected users only */}
        {session && (
          <Section title={t('usage')}>
            <div className="bg-ava-surface border border-ava-border rounded-xl p-4 space-y-3">
              {usageLoading ? (
                <div className="text-center text-gray-500 py-2 text-sm">Loading...</div>
              ) : usage ? (
                <>
                  <Row label="Plan" value={<span className="text-xs text-ava-purple-light font-medium">{usage.plan}</span>} />
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">{t('tokensUsed')}</span>
                      <span className="text-xs text-gray-500">{usage.tokensUsed.toLocaleString()} / {usage.tokensLimit.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-ava-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-ava-purple rounded-full transition-all"
                        style={{ width: `${usage.tokensLimit > 0 ? Math.min(100, (usage.tokensUsed / usage.tokensLimit) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">{t('requestsUsed')}</span>
                      <span className="text-xs text-gray-500">{usage.requestsUsed.toLocaleString()} / {usage.requestsLimit.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-ava-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-ava-purple rounded-full transition-all"
                        style={{ width: `${usage.requestsLimit > 0 ? Math.min(100, (usage.requestsUsed / usage.requestsLimit) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-500 text-center">Usage data unavailable</p>
              )}
            </div>
          </Section>
        )}

        {/* Sync — connected users only */}
        {session && (
          <Section title="SYNC">
            <div className="bg-ava-surface border border-ava-border rounded-xl p-4">
              <button
                onClick={handleSyncConversations}
                disabled={syncStatus === 'syncing'}
                className="w-full bg-ava-purple hover:bg-ava-purple-dark disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition text-sm"
              >
                {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'success' ? 'Synced!' : syncStatus === 'error' ? 'Sync failed — try again' : t('syncConversations')}
              </button>
              <p className="text-[11px] text-gray-500 mt-2 text-center">Upload your local chat history to the cloud</p>

              <div className="mt-3 pt-3 border-t border-ava-border">
                <button
                  onClick={handleSyncPersonality}
                  disabled={personalitySyncStatus === 'syncing'}
                  className="w-full bg-ava-surface border border-ava-border hover:border-ava-purple disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition text-sm"
                >
                  {personalitySyncStatus === 'syncing' ? 'Syncing...' : personalitySyncStatus === 'success' ? 'Personality Synced!' : personalitySyncStatus === 'error' ? 'Sync failed — try again' : 'Sync Personality'}
                </button>
                <p className="text-[11px] text-gray-500 mt-2 text-center">Push your personality settings to the cloud</p>
              </div>
            </div>
          </Section>
        )}

        {/* Model */}
        <Section title={t('model')}>
          <div className="bg-ava-surface border border-ava-border rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">{t('defaultModel')}</p>
            <CustomSelect
              value={selectedModel}
              onChange={onSelectModel}
              placeholder="Select a model..."
              options={MODELS.filter(m => isGuest ? (m.free || !!getActiveProviderKey(m.id)) : true).map(m => ({
                value: m.id,
                label: m.name,
                sublabel: m.provider,
                badge: m.free ? 'FREE' : undefined,
                badgeColor: m.free ? 'text-emerald-400 bg-emerald-400/10' : undefined,
              }))}
            />
          </div>
        </Section>

        {/* Provider API Keys (BYOK) */}
        <Section title="API KEYS (BYOK)">
          <div className="bg-ava-surface border border-ava-border rounded-xl divide-y divide-ava-border">
            <div className="p-4">
              <p className="text-xs text-gray-500 mb-3">
                Add your own API keys to use any model without a platform account. Keys are stored locally on your device.
              </p>
            </div>
            {PROVIDER_KEY_FIELDS.map(f => (
              <div key={f.key} className="p-4">
                <label className="text-xs text-gray-400 mb-1 block">{f.label}</label>
                <input
                  type="password"
                  value={providerKeys[f.key] || ''}
                  onChange={e => saveProviderKey(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full bg-ava-bg border border-ava-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-ava-purple transition"
                />
              </div>
            ))}
          </div>
        </Section>

        {/* Appearance */}
        <Section title={t('appearance')}>
          <div className="bg-ava-surface border border-ava-border rounded-xl divide-y divide-ava-border">
            <div className="p-4">
              <Row
                label={t('theme')}
                value={
                  <TogglePills
                    options={[{ value: 'dark', label: t('dark') }, { value: 'light', label: t('light') }, { value: 'system', label: t('system') }]}
                    selected={theme}
                    onChange={v => { setTheme(v as Theme); saveSetting('theme', v); }}
                  />
                }
              />
            </div>
            <div className="p-4">
              <Row
                label={t('textSize')}
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

        {/* Language */}
        <Section title={t('language')}>
          <div className="bg-ava-surface border border-ava-border rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">{t('language')}</p>
            <CustomSelect
              value={language}
              onChange={(v) => { setLang(v); setLanguage(v); window.location.reload(); }}
              placeholder="Select language..."
              options={getSupportedLanguages().map(l => ({
                value: l.code,
                label: l.name,
              }))}
            />
          </div>
        </Section>

        {/* Personality */}
        <Section title={t('personality')}>
          <div className="bg-ava-surface border border-ava-border rounded-xl">
            <button onClick={onNavigatePersonality} className="w-full block p-4 hover:bg-ava-surface-hover transition text-left">
              <Row label={t('designYourAI')} subtitle={t('designSubtitle')} value={<ChevronRight />} />
            </button>
          </div>
        </Section>

        {/* Notifications — only shown in native app (Capacitor) */}

        {/* Data */}
        <Section title={t('data')}>
          <div className="bg-ava-surface border border-ava-border rounded-xl divide-y divide-ava-border">
            <ClearButton label={t('clearChat')} type="chat" showClearConfirm={showClearConfirm} setShowClearConfirm={setShowClearConfirm} onClear={clearLocalData} />
            {isGuest && (
              <>
                <ClearButton label={t('clearTasks')} type="tasks" showClearConfirm={showClearConfirm} setShowClearConfirm={setShowClearConfirm} onClear={clearLocalData} />
                <ClearButton label={t('clearJournal')} type="journal" showClearConfirm={showClearConfirm} setShowClearConfirm={setShowClearConfirm} onClear={clearLocalData} />
              </>
            )}
          </div>
        </Section>



        {/* About */}
        <Section title={t('about')}>
          <div className="bg-ava-surface border border-ava-border rounded-xl divide-y divide-ava-border">
            <div className="p-4">
              <Row label={t('version')} value={<span className="text-xs text-gray-500">0.1.1</span>} />
            </div>
            <button onClick={() => setShowReleaseNotes(true)} className="w-full block p-4 hover:bg-ava-surface-hover transition text-left">
              <Row label={t('releaseNotes')} value={<ChevronRight />} />
            </button>
            <a href="https://github.com/AugmentedValueAcceleration/ava-supernova" target="_blank" rel="noopener noreferrer" className="block p-4 hover:bg-ava-surface-hover transition">
              <Row label="GitHub" value={<ChevronRight />} />
            </a>
            <a href="https://ava-supernova.com" target="_blank" rel="noopener noreferrer" className="block p-4 hover:bg-ava-surface-hover transition">
              <Row label={t('website')} value={<ChevronRight />} />
            </a>
            <a href="https://ava-supernova.com/terms" target="_blank" rel="noopener noreferrer" className="block p-4 hover:bg-ava-surface-hover transition">
              <Row label={t('termsOfService')} value={<ChevronRight />} />
            </a>
            <a href="https://ava-supernova.com/privacy" target="_blank" rel="noopener noreferrer" className="block p-4 hover:bg-ava-surface-hover transition">
              <Row label={t('privacyPolicy')} value={<ChevronRight />} />
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

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel={confirmDialog.cancelLabel}
        destructive={confirmDialog.destructive}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
          <span className="text-sm text-red-400">{t('areYouSure')}</span>
          <div className="flex gap-2">
            <button onClick={() => onClear(type)} className="text-xs text-red-400 font-medium px-3 py-1 bg-red-400/10 rounded-lg hover:bg-red-400/20 transition">{t('clear')}</button>
            <button onClick={() => setShowClearConfirm(null)} className="text-xs text-gray-400 font-medium px-3 py-1 bg-ava-border rounded-lg hover:bg-gray-600 transition">{t('cancel')}</button>
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
