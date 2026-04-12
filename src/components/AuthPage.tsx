'use client';

/**
 * AuthPage — companion sign-in screen (v0.37.0).
 *
 * Four options matching the VS Code extension's sign-in UI:
 *   1. Continue with GitHub (primary)
 *   2. Sign in with email (secondary)
 *   3. Continue without an account (free chat, no sync)
 *   4. Have an API key? Paste it instead (30-day fallback)
 *
 * The companion is a web app, so the OAuth flow uses redirect-back instead
 * of URI schemes: we open the auth page in the same window, the server
 * redirects back to the companion's URL with code + state in the query
 * string, and the companion processes the code on mount.
 */

import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';

const WEB_ORIGIN = API_BASE.replace('/api', ''); // https://ava-supernova.com

interface AuthPageProps {
  /** Called when the user successfully connects via OAuth or API key */
  onApiKeyConnect?: (apiKey: string) => void;
  /** Called when the user chooses to continue without an account */
  onSkip?: () => void;
}

function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = localStorage.getItem('ava-companion-device-id');
  if (!id) {
    id = crypto.randomUUID().slice(0, 16);
    localStorage.setItem('ava-companion-device-id', id);
  }
  return id;
}

function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

export default function AuthPage({ onApiKeyConnect, onSkip }: AuthPageProps) {
  const [showManualKey, setShowManualKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [exchanging, setExchanging] = useState(false);

  // ── Check for OAuth callback on mount ──────────────────────────────────
  // After the user authorizes on the website, the server redirects back to
  // the companion's URL with ?code=X&state=Y in the query string. Detect
  // this on mount, exchange the code, and connect.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const savedState = sessionStorage.getItem('ava-signin-state');

    if (code && state && savedState === state) {
      // Clean the URL immediately so refreshing doesn't re-process
      window.history.replaceState({}, '', window.location.pathname);
      sessionStorage.removeItem('ava-signin-state');
      exchangeCode(code, state);
    }
  }, []);

  async function exchangeCode(code: string, state: string) {
    setExchanging(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/extension/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          device_id: getDeviceId(),
          state,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Exchange failed' }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.key) {
        onApiKeyConnect?.(data.key);
      } else {
        setError('No platform key returned. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code exchange failed');
    } finally {
      setExchanging(false);
    }
  }

  function startSignIn(method: 'github' | 'email') {
    const state = generateState();
    sessionStorage.setItem('ava-signin-state', state);

    const url = new URL('/auth/extension', WEB_ORIGIN);
    url.searchParams.set('state', state);
    url.searchParams.set('device_id', getDeviceId());
    url.searchParams.set('platform', 'companion');
    url.searchParams.set('hint', method);
    // Tell the server to redirect back to this page instead of using
    // a URI scheme (companion is a web app, not a native app)
    url.searchParams.set('callback_url', window.location.origin + window.location.pathname);

    // Navigate in the same window — the server will redirect back after auth
    window.location.href = url.toString();
  }

  const handleManualKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!apiKey.trim().startsWith('sk-ava-')) {
      setError('API key must start with sk-ava-');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/memories?limit=1`, {
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
      });
      if (!res.ok) throw new Error('Invalid API key');
      onApiKeyConnect?.(apiKey.trim());
    } catch {
      setError('Invalid API key. Check your key in the platform dashboard.');
    } finally {
      setLoading(false);
    }
  };

  // ── Exchanging state (processing OAuth callback) ──────────────────────
  if (exchanging) {
    return (
      <div className="bg-ava-bg rounded-2xl border border-ava-border p-6">
        <div className="text-center">
          <div className="relative mx-auto mb-4 h-12 w-12">
            <div className="absolute inset-0 rounded-full border-2 border-purple-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-500 animate-spin" />
          </div>
          <p className="text-sm text-gray-400">Signing you in...</p>
        </div>
      </div>
    );
  }

  // ── Main sign-in screen ───────────────────────────────────────────────
  return (
    <div className="bg-ava-bg rounded-2xl border border-ava-border p-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white">Ava</h1>
        <p className="text-ava-purple text-xs font-medium tracking-[0.2em] uppercase mt-1">Companion</p>
        <p className="text-xs text-gray-500 mt-3">
          Sign in to sync memory, tasks, and journal across every device.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Primary: GitHub */}
      <button
        onClick={() => startSignIn('github')}
        className="w-full mb-3 flex items-center justify-center gap-3 bg-[#24292e] hover:bg-[#32383f] border border-[#6e7681]/40 text-white font-medium py-2.5 rounded-xl transition text-sm"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
        Continue with GitHub
      </button>

      {/* Secondary: Email */}
      <button
        onClick={() => startSignIn('email')}
        className="w-full mb-5 flex items-center justify-center gap-3 bg-transparent border border-ava-purple/35 text-white font-medium py-2.5 rounded-xl transition hover:bg-ava-purple/10 text-sm"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
        Sign in with email
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-ava-border" />
        <span className="text-xs text-gray-500">or</span>
        <div className="flex-1 h-px bg-ava-border" />
      </div>

      {/* Tertiary: Continue without account */}
      {onSkip && (
        <button
          onClick={onSkip}
          className="w-full mb-3 text-sm text-gray-400 hover:text-white transition py-2"
        >
          Continue without an account
        </button>
      )}

      {/* Fallback: paste API key (30-day sunset) */}
      {!showManualKey ? (
        <button
          onClick={() => setShowManualKey(true)}
          className="w-full text-center text-xs text-gray-600 hover:text-gray-400 transition"
        >
          Have an API key? Paste it instead
        </button>
      ) : (
        <form onSubmit={handleManualKey} className="space-y-3 mt-3 p-4 bg-ava-surface rounded-xl border border-ava-border">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Manual API key</p>
            <button
              type="button"
              onClick={() => { setShowManualKey(false); setApiKey(''); setError(''); }}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Hide
            </button>
          </div>
          <input
            type="password"
            placeholder="sk-ava-..."
            value={apiKey}
            onChange={e => { setApiKey(e.target.value); setError(''); }}
            required
            className="w-full bg-ava-bg border border-ava-border rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:border-ava-purple focus:outline-none transition font-mono"
          />
          <button
            type="submit"
            disabled={loading || !apiKey.trim()}
            className="w-full bg-ava-purple hover:bg-ava-purple-dark text-white font-semibold py-2.5 rounded-xl transition disabled:opacity-50 text-sm"
          >
            {loading ? 'Validating...' : 'Connect'}
          </button>
          <p className="text-[10px] text-gray-600">
            Manual API key entry will be deprecated — please sign in with GitHub or email when possible.
          </p>
        </form>
      )}

      <p className="text-[10px] text-gray-600 text-center mt-4">
        Local-first always. Your data stays on your device unless you explicitly sync it.
      </p>
    </div>
  );
}
