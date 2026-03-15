import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://znhqolmxbfmolatxcbph.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuaHFvbG14YmZtb2xhdHhjYnBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkzMDg2MDYsImV4cCI6MjA1NDg4NDYwNn0.o2MNlXJaZKsBkFSBVJyPK7BsBplnhPb96w1C3ByVnEU';

// Use standard client with localStorage — not @supabase/ssr which uses
// cookies scoped to the domain (doesn't work cross-origin for companion)
let client: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  if (!client) {
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
