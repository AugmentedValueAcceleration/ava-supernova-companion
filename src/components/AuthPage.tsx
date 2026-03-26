'use client';

import { useState } from 'react';
import { API_BASE } from '@/lib/api';

export default function AuthPage({ onApiKeyConnect }: {
  onApiKeyConnect?: (apiKey: string) => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleApiKey = async (e: React.FormEvent) => {
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

  return (
    <div className="bg-ava-bg rounded-2xl border border-ava-border p-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white">Ava</h1>
        <p className="text-ava-purple text-xs font-medium tracking-[0.2em] uppercase mt-1">Companion</p>
      </div>

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
          Find your API key at{' '}
          <a href="https://ava-supernova.com/dashboard/keys" target="_blank" rel="noopener noreferrer" className="text-ava-purple-light hover:underline">
            ava-supernova.com
          </a>
          {' '}&rarr; Dashboard &rarr; API Keys
        </p>

        <div className="flex items-center gap-3 mt-4">
          <div className="flex-1 h-px bg-ava-border" />
          <span className="text-xs text-gray-500">or</span>
          <div className="flex-1 h-px bg-ava-border" />
        </div>

        <a
          href="https://ava-supernova.com/auth/login"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center text-ava-purple-light text-xs hover:underline mt-2"
        >
          Don't have an account? Sign up at ava-supernova.com
        </a>
      </form>
    </div>
  );
}
