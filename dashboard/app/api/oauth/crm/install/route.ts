import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { buildChooseLocationUrl } from '@/lib/ghl-oauth';
import { signState, newNonce, OAUTH_NONCE_COOKIE } from '@/lib/oauth-state';

/**
 * Start the GHL Marketplace install: authenticate the dashboard user, bind a
 * signed state to their owner id + a fresh nonce (also set as an httpOnly
 * cookie), and redirect to GHL's chooselocation screen.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  }

  const nonce = newNonce();
  const state = signState(user.id, nonce);

  const res = NextResponse.redirect(buildChooseLocationUrl(state));
  res.cookies.set(OAUTH_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes to complete the install
  });
  return res;
}
