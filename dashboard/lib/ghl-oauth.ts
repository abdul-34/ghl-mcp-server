/**
 * GHL Marketplace OAuth — dashboard-side acquisition helpers.
 *
 * The dashboard runs the interactive install (build authorize URL → exchange the
 * returned code), lists the agency's installed sub-accounts, and can refresh /
 * mint tokens. The MCP server mirrors the refresh/mint calls (src/crm/ghl-oauth.ts)
 * for request-time upkeep.
 *
 * GHL's token endpoint uses the v3 convention: `Version: v3` header, camelCase
 * form params (clientId/clientSecret/grantType/refreshToken/redirectUri) and
 * camelCase JSON (accessToken/refreshToken/expiresIn). We send BOTH camel and
 * snake keys and read BOTH response conventions for robustness. Never logged.
 */

const CHOOSE_LOCATION_URL = 'https://marketplace.leadconnectorhq.com/oauth/chooselocation';
const OAUTH_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token';
const LOCATION_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/locationToken';
// v3 renamed this to the hyphenated path (camelCase /oauth/installedLocations was removed).
const INSTALLED_LOCATIONS_URL = 'https://services.leadconnectorhq.com/oauth/installed-locations';

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope?: string;
  userType?: string;
  companyId?: string;
  locationId?: string;
}

export interface InstalledLocation {
  locationId: string;
  name?: string;
}

function creds(): { clientId: string; clientSecret: string; redirectUri: string; scopes: string; appId?: string } {
  const clientId = process.env.GHL_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GHL_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GHL_OAUTH_REDIRECT_URI?.trim();
  const scopes = process.env.GHL_OAUTH_SCOPES?.trim() || '';
  const appId = process.env.GHL_APP_ID?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('GHL_OAUTH_CLIENT_ID, GHL_OAUTH_CLIENT_SECRET and GHL_OAUTH_REDIRECT_URI are required.');
  }
  return { clientId, clientSecret, redirectUri, scopes, appId };
}

/** The GHL "choose location" authorize URL the agency admin is redirected to. */
export function buildChooseLocationUrl(state: string): string {
  const { clientId, redirectUri, scopes } = creds();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state,
  });
  return `${CHOOSE_LOCATION_URL}?${params.toString()}`;
}

/**
 * Build camelCase-only form params for the v3 token endpoint. GHL's /oauth/token
 * (Version: v3) validates strictly and REJECTS unknown keys — sending snake_case
 * duplicates alongside camelCase trips its validator with a 422. So we send only
 * the camelCase keys the v3 endpoint expects.
 */
function tokenParams(fields: Record<string, string | undefined>): URLSearchParams {
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

function normalize(data: Record<string, unknown>): OAuthTokens {
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
      // GHL (NestJS) validation errors put the real reason in `message`, often as
      // an array (e.g. ["property client_id should not exist"]). Surface that.
      const msg = body.message;
      const msgStr = Array.isArray(msg) ? msg.map(String).join('; ') : typeof msg === 'string' ? msg : '';
      const err = typeof body.error === 'string' ? body.error : '';
      const desc = typeof body.error_description === 'string' ? body.error_description : '';
      detail = [msgStr, desc, err].filter(Boolean).join(' — ') || raw;
    } catch {
      detail = raw; // non-JSON body
    }
  } catch {
    /* body unreadable */
  }
  return new Error(`GHL OAuth ${op} failed (${res.status})${detail ? `: ${detail.slice(0, 400)}` : ''}`);
}

// /oauth/token is v3; /oauth/locationToken is NOT in v3 (use the stable 2021-07-28).
const TOKEN_API_VERSION = 'v3';
const LOCATION_TOKEN_API_VERSION = '2021-07-28';

async function postToken(body: URLSearchParams, bearer?: string): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
    // locationToken (bearer set) runs on 2021-07-28; the token grant runs on v3.
    Version: bearer ? LOCATION_TOKEN_API_VERSION : TOKEN_API_VERSION,
  };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  return fetch(bearer ? LOCATION_TOKEN_URL : OAUTH_TOKEN_URL, { method: 'POST', headers, body });
}

/** Exchange an authorization code for tokens (install step). */
export async function exchangeCode(code: string): Promise<OAuthTokens> {
  const { clientId, clientSecret, redirectUri } = creds();
  const body = tokenParams({ clientId, clientSecret, grantType: 'authorization_code', code, redirectUri });
  const res = await postToken(body);
  if (!res.ok) throw await oauthError(res, 'code exchange');
  return normalize((await res.json()) as Record<string, unknown>);
}

/** Refresh a Company (agency) token; the refresh token rotates — persist both. */
export async function refreshCompanyToken(refreshToken: string): Promise<OAuthTokens> {
  const { clientId, clientSecret } = creds();
  const body = tokenParams({ clientId, clientSecret, grantType: 'refresh_token', refreshToken, userType: 'Company' });
  const res = await postToken(body);
  if (!res.ok) throw await oauthError(res, 'company refresh');
  return normalize((await res.json()) as Record<string, unknown>);
}

/** Mint a Location token from a live Company token (may also return a location refresh token on v3). */
export async function mintLocationToken(companyAccessToken: string, companyId: string, locationId: string): Promise<OAuthTokens> {
  const res = await postToken(tokenParams({ companyId, locationId }), companyAccessToken);
  if (!res.ok) throw await oauthError(res, 'locationToken');
  return normalize((await res.json()) as Record<string, unknown>);
}

/**
 * List the sub-accounts where the agency has installed the app (v3
 * /oauth/installed-locations). Requires the Agency token + appId, uses
 * pageSize/pageToken pagination, and returns results under `items[]`.
 */
export async function listInstalledLocations(companyAccessToken: string, companyId: string): Promise<InstalledLocation[]> {
  const { appId } = creds();
  if (!appId) throw new Error('GHL_APP_ID is required to list installed locations (v3 /oauth/installed-locations needs appId).');

  const out: InstalledLocation[] = [];
  let pageToken: string | undefined;

  // Bounded loop so a huge agency (or a bad nextPageToken) can't spin forever.
  for (let page = 0; page < 25; page++) {
    const params = new URLSearchParams({ companyId, appId, isInstalled: 'true', pageSize: '100' });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`${INSTALLED_LOCATIONS_URL}?${params.toString()}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${companyAccessToken}`, Accept: 'application/json', Version: 'v3' },
    });
    if (!res.ok) throw await oauthError(res, 'installedLocations');

    const data = (await res.json()) as Record<string, unknown>;
    const items = Array.isArray(data.items) ? data.items : [];
    for (const item of items) {
      const rec = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const locationId = String(rec._id ?? rec.id ?? rec.locationId ?? '');
      if (!locationId || rec.isInstalled === false) continue;
      out.push({ locationId, name: typeof rec.name === 'string' ? rec.name : undefined });
    }

    const pagination = (data.pagination as Record<string, unknown> | undefined) ?? {};
    const next = typeof pagination.nextPageToken === 'string' ? pagination.nextPageToken : '';
    if (pagination.hasNextPage === true && next) pageToken = next;
    else break;
  }

  return out;
}
