import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client (bypasses RLS). Use ONLY in trusted server code
 * that has already authenticated the caller by other means — currently just the
 * OAuth callback route, which resolves the owner from a signed `state` (the GHL
 * redirect may not carry the user's session cookie reliably). Never expose the
 * service-role key to the browser.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the admin client.');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
