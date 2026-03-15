'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function AuthPage({ onSignIn }: { onSignIn: () => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
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

  return (
    <div className="h-dvh flex items-center justify-center bg-ava-bg px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white">Ava</h1>
          <p className="text-ava-purple text-lg font-medium mt-1 tracking-widest uppercase text-sm">Companion</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-ava-surface border border-ava-border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-ava-purple focus:outline-none transition"
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-ava-surface border border-ava-border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-ava-purple focus:outline-none transition"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full bg-ava-surface border border-ava-border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-ava-purple focus:outline-none transition"
          />

          {error && (
            <p className={`text-sm ${error.includes('Check your email') ? 'text-green-400' : 'text-red-400'}`}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ava-purple hover:bg-ava-purple-dark text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
          >
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            className="w-full text-ava-purple-light text-sm hover:underline"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </form>

        <p className="text-center text-gray-600 text-xs mt-10">
          Sign in with your Ava | Supernova platform account
        </p>
      </div>
    </div>
  );
}
