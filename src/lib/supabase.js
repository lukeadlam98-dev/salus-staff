// Initialises the Supabase client used by the whole app.
// Values come from environment variables set in Vercel (or .env.local for local dev).

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Surface a clear error during development; in production these are baked at build time.
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase environment variables. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel (or in a .env.local file for local dev).'
  );
}

export const supabase = createClient(url || '', anonKey || '', {
  auth: { persistSession: true, autoRefreshToken: true },
});
