'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { initI18n } from '@/lib/i18n';
import type { Session } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import CompanionApp from '@/components/CompanionApp';

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef<SupabaseClient | null>(null);

  // Lazy-init Supabase on client only — avoids SSG prerender crash
  function getSupabase() {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    return supabaseRef.current;
  }
  const supabase = typeof window !== 'undefined' ? getSupabase() : null;

  useEffect(() => {
    const sb = getSupabase();
    initI18n();
    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-ava-bg">
        <div className="w-8 h-8 border-2 border-ava-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // No auth gate — CompanionApp handles both signed-in and guest modes
  const sb = supabase;
  return (
    <ErrorBoundary>
      <CompanionApp
        session={session}
        onSignIn={() => sb?.auth.getSession().then(({ data }) => setSession(data.session))}
        onSignOut={() => { sb?.auth.signOut(); setSession(null); }}
      />
    </ErrorBoundary>
  );
}
