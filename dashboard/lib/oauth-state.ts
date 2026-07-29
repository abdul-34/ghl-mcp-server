import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Signed OAuth `state` for CSRF protection. The state binds the initiating owner
 * id + a random nonce and is HMAC-signed with a server secret. The callback
 * verifies the signature AND matches the nonce against an httpOnly cookie set at
 * install time, so a forged/replayed callback can't attach an install to another
 * account. Signing key: OAUTH_STATE_SECRET, falling back to ENCRYPTION_KEY.
 */

export const OAUTH_NONCE_COOKIE = 'ghl_oauth_nonce';

function stateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET?.trim() || process.env.ENCRYPTION_KEY?.trim();
  if (!secret) throw new Error('OAUTH_STATE_SECRET or ENCRYPTION_KEY is required to sign OAuth state.');
  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', stateSecret()).update(payload).digest('base64url');
}

export function newNonce(): string {
  return randomBytes(16).toString('base64url');
}

/** Build a signed state string binding ownerId + nonce. */
export function signState(ownerId: string, nonce: string): string {
  const payload = `${ownerId}.${nonce}`;
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`;
}

/** Verify a signed state; returns the ownerId + nonce, or null if tampered. */
export function verifyState(state: string): { ownerId: string; nonce: string } | null {
  const parts = state.split('.');
  if (parts.length !== 2) return null;
  const [encPayload, sig] = parts;
  let payload: string;
  try {
    payload = Buffer.from(encPayload, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const dot = payload.indexOf('.');
  if (dot < 0) return null;
  return { ownerId: payload.slice(0, dot), nonce: payload.slice(dot + 1) };
}
