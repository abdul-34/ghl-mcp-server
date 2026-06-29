import { createBrowserClient } from '@supabase/ssr';

/** Supabase client for Client Components (browser). ANON key + RLS. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
