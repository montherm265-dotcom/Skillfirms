import { createClient } from '@supabase/supabase-js';

// Deliberately the SAME Supabase project as Talfirms (same VITE_SUPABASE_URL
// / VITE_SUPABASE_ANON_KEY as that app) -- this is how "shared accounts"
// between the two products actually works: signing up here creates a real
// row in the same auth.users + public.profiles tables Talfirms reads, via
// the same handle_new_user() trigger. Skillfirms owns its own tables in a
// separate `skillfirms` schema; it only ever reads public.profiles for
// identity (display name, avatar), never writes to Talfirms' tables.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabaseClient] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
    'Skillfirms has no live backend until these point at the shared Supabase project -- see README.md.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  { auth: { persistSession: true, autoRefreshToken: true } },
);
