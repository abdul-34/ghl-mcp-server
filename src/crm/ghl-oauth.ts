/**
 * GHL Marketplace OAuth — server-side token operations.
 *
 * The dashboard performs the interactive install (authorization-code exchange);
 * the server only needs to KEEP TOKENS FRESH at request time:
 *   - refreshToken(): renew an agency (Company) OR location token via the refresh
 *     grant (the refresh token rotates on every use — persist the new one).
 *   - mintLocationToken(): exchange a live Company token for a Location token (the
 *     "install once on the agency, use any installed sub-account" flow).
 *
 * GHL's token endpoint uses the v3 convention: `Version: v3` header, camelCase
 * form params (clientId/clientSecret/grantType/refreshToken) and camelCase JSON
 * (accessToken/refreshToken/expiresIn). We send BOTH camel and snake param keys
 * and read BOTH response conventions so this is robust across API versions.
 * Credentials come from env; nothing here is ever logged.
 */

const OAUTH_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token';
const LOCATION_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/locationToken';

// Version headers differ per endpoint: /oauth/token is v3, but /oauth/locationToken
// is NOT in v3 (GHL: "use a version before v3") — it runs on the stable 2021-07-28.
const TOKEN_API_VERSION = 'v3';
const LOCATION_TOKEN_API_VERSION = '2021-07-28';

export interface OAuthTokenResult {
  accessToken: string;
  /** Present on the refresh/authorization-code grant (and location tokens on v3). */
  refreshToken?: string;
  /** Seconds until the access token expires (~86400). */
  expiresIn: number;
  scope?: string;
  userType?: string;
  companyId?: string;
  locationId?: string;
}

function oauthCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GHL_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GHL_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error('GHL_OAUTH_CLIENT_ID and GHL_OAUTH_CLIENT_SECRET are required to refresh/mint OAuth tokens.');
  }
  return { clientId, clientSecret };
}

/**
 * Build camelCase-only form params for the v3 token endpoint. GHL's /oauth/token
 * (Version: v3) validates strictly and REJECTS unknown keys — sending snake_case
 * duplicates alongside camelCase trips its validator with a 422. So we send only
 * the camelCase keys the v3 endpoint expects.
 */
export function tokenParams(fields: Record<string, string | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value == null || value === '') continue;
    params.set(key, value);
  }
  return params;
}

function pick(data: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) if (data[k] != null) return data[k];
  return undefined;
}

/** Normalize a token response, reading either camelCase (v3) or snake_case (legacy). */
export function normalizeToken(data: Record<string, unknown>): OAuthTokenResult {
  const accessToken = String(pick(data, 'accessToken', 'access_token') ?? '');
  if (!accessToken) throw new Error('GHL OAuth response contained no access token.');
  const expiresRaw = pick(data, 'expiresIn', 'expires_in');
  const asStr = (v: unknown) => (typeof v === 'string' ? v : undefined);
  return {
    accessToken,
    refreshToken: asStr(pick(data, 'refreshToken', 'refresh_token')),
    expiresIn: typeof expiresRaw === 'number' ? expiresRaw : Number(expiresRaw) || 86400,
    scope: asStr(pick(data, 'scope')),
    userType: asStr(pick(data, 'userType', 'user_type')),
    companyId: asStr(pick(data, 'companyId', 'company_id')),
    locationId: asStr(pick(data, 'locationId', 'location_id')),
  };
}

async function oauthError(res: Response, op: string): Promise<Error> {
  let detail = '';
  try {
    const raw = await res.text();
    try {
      const body = JSON.parse(raw) as Record<string, unknown>;
      const msg = body.message;
      const msgStr = Array.isArray(msg) ? msg.map(String).join('; ') : typeof msg === 'string' ? msg : '';
      const err = typeof body.error === 'string' ? body.error : '';
      const desc = typeof body.error_description === 'string' ? body.error_description : '';
      detail = [msgStr, desc, err].filter(Boolean).join(' — ') || raw;
    } catch {
      detail = raw;
    }
  } catch {
    /* body unreadable */
  }
  return new Error(`GHL OAuth ${op} failed (${res.status})${detail ? `: ${detail.slice(0, 400)}` : ''}`);
}

/**
 * Renew a token via the refresh grant. Works for Company (agency) and Location
 * tokens; pass the matching `userType`. Returns a fresh access token AND a rotated
 * refresh token — persist both.
 */
export async function refreshToken(
  refreshTokenValue: string,
  userType: 'Company' | 'Location' = 'Company'
): Promise<OAuthTokenResult> {
  const { clientId, clientSecret } = oauthCreds();
  const body = tokenParams({
    clientId,
    clientSecret,
    grantType: 'refresh_token',
    refreshToken: refreshTokenValue,
    userType,
  });
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', Version: TOKEN_API_VERSION },
    body,
  });
  if (!res.ok) throw await oauthError(res, 'refresh');
  return normalizeToken((await res.json()) as Record<string, unknown>);
}

/**
 * Exchange a live Company (agency) access token for a Location token. On v3 this
 * may also return a Location refresh token, which the caller should store so the
 * location token can later be renewed via refreshToken() rather than re-minted.
 */
export async function mintLocationToken(
  companyAccessToken: string,
  companyId: string,
  locationId: string
): Promise<OAuthTokenResult> {
  const body = tokenParams({ companyId, locationId });
  const res = await fetch(LOCATION_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${companyAccessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Version: LOCATION_TOKEN_API_VERSION,
    },
    body,
  });
  if (!res.ok) throw await oauthError(res, 'locationToken');
  return normalizeToken((await res.json()) as Record<string, unknown>);
}
