import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { encryptToken } from '@/lib/crypto';
import { exchangeCode } from '@/lib/ghl-oauth';
import { verifyState, OAUTH_NONCE_COOKIE } from '@/lib/oauth-state';

/**
 * GHL OAuth callback. The GHL redirect may not carry the dashboard session
 * cookie, so we resolve the owner from the SIGNED state (verified against the
 * httpOnly nonce cookie) and write with the service-role admin client.
 *
 *   userType 'Company'  → store the agency install (agency_oauth_installs).
 *   userType 'Location' → store a PIT-less oauth sub-account directly.
 */
export async function GET(req: NextRequest) {
  // Keep redirects on the current host even if NEXT_PUBLIC_APP_URL is unset.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || req.nextUrl.origin;
  const fail = (msg: string) =>
    NextResponse.redirect(new URL(`/dashboard/subaccounts?oauth_error=${encodeURIComponent(msg)}`, appUrl));

  // Everything runs inside try/catch so a misconfiguration (e.g. a missing env
  // var) surfaces as a readable ?oauth_error= message instead of an opaque 500.
  try {
    const code = req.nextUrl.searchParams.get('code');
    const state = req.nextUrl.searchParams.get('state');
    if (!code || !state) return fail('Missing code or state.');

    const parsed = verifyState(state);
    if (!parsed) return fail('Invalid state signature.');

    const cookieNonce = req.cookies.get(OAUTH_NONCE_COOKIE)?.value;
    if (!cookieNonce || cookieNonce !== parsed.nonce) return fail('State/nonce mismatch.');

    const tokens = await exchangeCode(code);

    const supabase = createSupabaseAdminClient();
    const ownerId = parsed.ownerId;
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();

    if (tokens.userType === 'Location' && tokens.locationId) {
      // Direct sub-account install: store a PIT-less oauth subaccount row.
      if (!tokens.refreshToken) return fail('Location install returned no refresh token.');
      const { error } = await supabase.from('subaccounts').upsert(
        {
          owner_id: ownerId,
          location_id: tokens.locationId,
          auth_mode: 'oauth',
          oauth_install_type: 'location',
          ghl_company_id: tokens.companyId ?? null,
          oauth_access_encrypted_token: encryptToken(tokens.accessToken),
          oauth_refresh_encrypted_token: encryptToken(tokens.refreshToken),
          oauth_token_expires_at: expiresAt,
        },
        { onConflict: 'owner_id,location_id' }
      );
      if (error) return fail(`DB (subaccounts): ${error.message}`);
    } else {
      // Agency (Company) install: store the durable agency token.
      if (!tokens.companyId || !tokens.refreshToken) return fail('Agency install missing companyId or refresh token.');
      const { error } = await supabase.from('agency_oauth_installs').upsert(
        {
          owner_id: ownerId,
          ghl_company_id: tokens.companyId,
          app_id: process.env.GHL_APP_ID ?? null,
          user_type: tokens.userType ?? 'Company',
          scope: tokens.scope ?? null,
          access_encrypted_token: encryptToken(tokens.accessToken),
          refresh_encrypted_token: encryptToken(tokens.refreshToken),
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'owner_id' }
      );
      if (error) return fail(`DB (agency_oauth_installs): ${error.message}`);
    }

    const res = NextResponse.redirect(new URL('/dashboard/subaccounts?connected=1', appUrl));
    res.cookies.delete(OAUTH_NONCE_COOKIE);
    return res;
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'OAuth callback failed.');
  }
}
