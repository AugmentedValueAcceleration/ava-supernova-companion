'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { initI18n } from '@/lib/i18n';
import type { Session } from '@supabase/supabase-js';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import CompanionApp from '@/components/CompanionApp';

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    initI18n();
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
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
  return (
    <ErrorBoundary>
      <CompanionApp
        session={session}
        onSignIn={() => supabase.auth.getSession().then(({ data }) => setSession(data.session))}
        onSignOut={() => { supabase.auth.signOut(); setSession(null); }}
      />
    </ErrorBoundary>
  );
}
