'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { API_BASE } from '@/lib/api';

type AuthTab = 'email' | 'api-key';

export default function AuthPage({ onSignIn, onApiKeyConnect }: {
  onSignIn: () => void;
  onApiKeyConnect?: (apiKey: string) => void;
}) {
  const [tab, setTab] = useState<AuthTab>('email');
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { error: err } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name } },
        });
        if (err) throw err;
        setError('Check your email for a confirmation link.');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        onSignIn();
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleGitHub = async () => {
    setError('');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (err) throw err;
    } catch (err: any) {
      setError(err.message || 'GitHub sign in failed');
      setLoading(false);
    }
  };

  const handleApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!apiKey.trim().startsWith('sk-ava-')) {
      setError('API key must start with sk-ava-');
      return;
    }
    setLoading(true);
    try {
      // Validate the API key against the memories endpoint (lightweight GET)
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

  return (
    <div className="bg-ava-bg rounded-2xl border border-ava-border p-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white">Ava</h1>
        <p className="text-ava-purple text-xs font-medium tracking-[0.2em] uppercase mt-1">Companion</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-ava-surface rounded-lg p-1 mb-5">
        <button
          onClick={() => { setTab('email'); setError(''); }}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition ${tab === 'email' ? 'bg-ava-purple text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Email / GitHub
        </button>
        <button
          onClick={() => { setTab('api-key'); setError(''); }}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition ${tab === 'api-key' ? 'bg-ava-purple text-white' : 'text-gray-400 hover:text-white'}`}
        >
          API Key
        </button>
      </div>

      {tab === 'email' ? (
        <>
          {/* GitHub button */}
          <button
            onClick={handleGitHub}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#24292e] hover:bg-[#2f363d] text-white font-medium py-3 rounded-xl transition disabled:opacity-50 mb-4"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            Continue with GitHub
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-ava-border" />
            <span className="text-xs text-gray-500">or</span>
            <div className="flex-1 h-px bg-ava-border" />
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {isSignUp && (
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-ava-surface border border-ava-border rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:border-ava-purple focus:outline-none transition"
              />
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-ava-surface border border-ava-border rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:border-ava-purple focus:outline-none transition"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-ava-surface border border-ava-border rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:border-ava-purple focus:outline-none transition"
            />

            {error && (
              <p className={`text-xs ${error.includes('Check your email') ? 'text-green-400' : 'text-red-400'}`}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ava-purple hover:bg-ava-purple-dark text-white font-semibold py-2.5 rounded-xl transition disabled:opacity-50 text-sm"
            >
              {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>

            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="w-full text-ava-purple-light text-xs hover:underline"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </form>
        </>
      ) : (
        <form onSubmit={handleApiKey} className="space-y-3">
          <p className="text-xs text-gray-400 leading-relaxed">
            Connect with your API key from the Ava | Supernova platform.
            Same memory, tasks, and journal — no account sign-in needed.
          </p>

          <input
            type="password"
            placeholder="sk-ava-..."
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            required
            className="w-full bg-ava-surface border border-ava-border rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:border-ava-purple focus:outline-none transition font-mono"
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !apiKey.trim()}
            className="w-full bg-ava-purple hover:bg-ava-purple-dark text-white font-semibold py-2.5 rounded-xl transition disabled:opacity-50 text-sm"
          >
            {loading ? 'Validating...' : 'Connect'}
          </button>

          <p className="text-[11px] text-gray-600 text-center">
            Find your API key at ava-supernova.com → Dashboard → API Keys
          </p>
        </form>
      )}
    </div>
  );
}
