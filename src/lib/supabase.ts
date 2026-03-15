import { createBrowserClient } from '@supabase/ssr';

const SUPABASE_URL = 'https://znhqolmxbfmolatxcbph.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuaHFvbG14YmZtb2xhdHhjYnBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkzMDg2MDYsImV4cCI6MjA1NDg4NDYwNn0.o2MNlXJaZKsBkFSBVJyPK7BsBplnhPb96w1C3ByVnEU';

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
