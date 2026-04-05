import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Use standard client with localStorage — not @supabase/ssr which uses
// cookies scoped to the domain (doesn't work cross-origin for companion)
let client: ReturnType<typeof createSupabaseClient> | null = null;

/** Returns true if Supabase is configured (env vars present). */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function createClient() {
  if (!client) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('[supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set — auth disabled');
      // Return a placeholder that won't crash but won't authenticate
      // Companion will operate in guest/API-key-only mode
      client = createSupabaseClient('https://placeholder.supabase.co', 'placeholder', {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      return client;
    }
    client = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    });
  }
  return client;
}
