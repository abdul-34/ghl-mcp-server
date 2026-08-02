/**
 * Supabase storage layer.
 *
 * Replaces the old Mongo + marketplace-OAuth design. The MCP server connects
 * to Supabase with the SERVICE ROLE key (bypasses RLS) so it can resolve any
 * client MCP link by its token hash and read the owning agency's sub-accounts.
 *
 * Lookup flow for an incoming request to /mcp/<secret>:
 *   1. sha256(secret) → find the matching row in `mcp_links` (not revoked).
 *   2. scope="location" → load exactly that one sub-account.
 *      scope="agency"   → load every sub-account owned by the link's owner.
 *   3. Decrypt each sub-account's PIT (AES-256-GCM) for use as a Bearer token.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { decryptToken, encryptToken } from '../crypto/pit-crypto.js';
import { WorkflowCredsPatch } from '../crm/workflow-builder-client.js';
import { refreshToken as oauthRefreshToken, mintLocationToken, OAuthTokenResult } from '../crm/ghl-oauth.js';

/** Refresh margin: renew a token this many ms before it actually expires so a
 *  long-running tool call never fires with a token that dies mid-flight. */
const OAUTH_EXPIRY_MARGIN_MS = 120_000;

export type LinkScope = 'agency' | 'location';

export interface ResolvedLink {
  linkId: string;
  ownerId: string;
  scope: LinkScope;
  /** Set only when scope === 'location'. */
  subaccountId?: string;
  /** Tool names this link may expose. Empty array = all tools allowed. */
  enabledTools: string[];
  /** Expose only the account + gateway meta-tools (search/schema/invoke). */
  gatewayMode: boolean;
  label?: string;
}

/**
 * Per-sub-account credentials for the internal workflow-builder API, decrypted
 * from the `subaccounts` row. All optional: a sub-account that hasn't had the
 * capture extension run against it simply has no workflow client.
 */
export interface ResolvedWorkflowCreds {
  firebaseApiKey?: string;
  firebaseRefreshToken?: string;
  /** Builder JWT (marketplace module discovery only). */
  authToken?: string;
  /** Builder refresh token (marketplace module discovery only). */
  refreshToken?: string;
  userId?: string;
  companyId?: string;
  companyAge?: number;
}

export type AuthMode = 'pit' | 'oauth';
export type OAuthInstallType = 'company' | 'location';

export interface ResolvedLocation {
  /** subaccounts.id — the row to persist rotated workflow/OAuth tokens back to. */
  subaccountId: string;
  locationId: string;
  /**
   * Bearer token for CRM API calls. For auth_mode='pit' this is the decrypted,
   * long-lived PIT. For auth_mode='oauth' it is the currently-cached location
   * access token, which may be empty (minted lazily on first use) or expired —
   * always route OAuth access through getOrRefreshLocationToken().
   */
  accessToken: string;
  name?: string;
  /** Decrypted workflow-builder credentials, when captured. */
  workflow?: ResolvedWorkflowCreds;
  /** How this sub-account authenticates to GHL. */
  authMode: AuthMode;
  /** Agency owner — needed to reach the agency OAuth install for token minting. */
  ownerId: string;
  /** GHL company (agency) id — the mint key for OAuth location tokens. */
  ghlCompanyId?: string;
  /** OAuth only: whether creds come from an agency (company) or direct location install. */
  oauthInstallType?: OAuthInstallType;
  /** OAuth location-install only: the location's own refresh token. */
  oauthRefreshToken?: string;
  /** OAuth only: epoch-ms expiry of the cached location access token. */
  oauthExpiresAt?: number;
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. The MCP server reads links + ' +
      'sub-account tokens from Supabase using the service role key.'
    );
  }

  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Lightweight connectivity probe used by /health and startup. */
export async function checkSupabase(): Promise<boolean> {
  try {
    const { error } = await getSupabase().from('mcp_links').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

export function hashUrlToken(rawSecret: string): string {
  return createHash('sha256').update(rawSecret, 'utf8').digest('hex');
}

/**
 * Resolve a raw URL secret to its link row. Returns null if no live (non-revoked)
 * link matches.
 */
export async function resolveLinkToken(rawSecret: string): Promise<ResolvedLink | null> {
  if (!rawSecret) return null;

  const hash = hashUrlToken(rawSecret);
  const { data, error } = await getSupabase()
    .from('mcp_links')
    .select('id, owner_id, scope, subaccount_id, enabled_tools, revoked, label, gateway_mode')
    .eq('url_token_hash', hash)
    .eq('revoked', false)
    .maybeSingle();

  if (error || !data) return null;

  return {
    linkId: data.id as string,
    ownerId: data.owner_id as string,
    scope: data.scope as LinkScope,
    subaccountId: (data.subaccount_id as string | null) ?? undefined,
    enabledTools: (data.enabled_tools as string[] | null) ?? [],
    gatewayMode: (data.gateway_mode as boolean | null) ?? false,
    label: (data.label as string | null) ?? undefined,
  };
}

/**
 * Load and decrypt the sub-account(s) a link grants access to:
 *   - location scope → the single referenced sub-account.
 *   - agency scope   → every sub-account owned by the link's owner.
 */
export async function loadLocationsForLink(link: ResolvedLink): Promise<ResolvedLocation[]> {
  const supabase = getSupabase();

  let query = supabase
    .from('subaccounts')
    .select('id, location_id, name, pit_token_encrypted, base_api_key, base_refresh_token, auth_encrypted_token, auth_encrypted_refresh_token, ghl_user_id, ghl_company_id, ghl_company_age, auth_mode, oauth_access_encrypted_token, oauth_refresh_encrypted_token, oauth_token_expires_at, oauth_install_type')
    .eq('owner_id', link.ownerId);

  if (link.scope === 'location') {
    if (!link.subaccountId) return [];
    query = query.eq('id', link.subaccountId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const out: ResolvedLocation[] = [];
  for (const row of data) {
    const subaccountId = row.id as string;
    const locationId = row.location_id as string;
    if (!locationId) continue;
    const authMode: AuthMode = (row.auth_mode as AuthMode | null) === 'oauth' ? 'oauth' : 'pit';

    try {
      if (authMode === 'pit') {
        const encrypted = row.pit_token_encrypted as string | null;
        if (!encrypted) continue; // pit row without a token is unusable
        out.push({
          subaccountId,
          locationId,
          accessToken: decryptToken(encrypted),
          name: (row.name as string | null) ?? undefined,
          workflow: decryptWorkflowCreds(row, locationId),
          authMode,
          ownerId: link.ownerId,
        });
      } else {
        // OAuth: the access token is minted/refreshed on demand; it may be empty here.
        const cachedAccess = tryDecrypt(row.oauth_access_encrypted_token, 'oauth access token', locationId) ?? '';
        const oauthRefresh = tryDecrypt(row.oauth_refresh_encrypted_token, 'oauth refresh token', locationId);
        const expRaw = row.oauth_token_expires_at as string | null;
        out.push({
          subaccountId,
          locationId,
          accessToken: cachedAccess,
          name: (row.name as string | null) ?? undefined,
          workflow: decryptWorkflowCreds(row, locationId),
          authMode,
          ownerId: link.ownerId,
          ghlCompanyId: (row.ghl_company_id as string | null) ?? undefined,
          oauthInstallType: (row.oauth_install_type as OAuthInstallType | null) ?? 'company',
          oauthRefreshToken: oauthRefresh,
          oauthExpiresAt: expRaw ? Date.parse(expRaw) : undefined,
        });
      }
    } catch (err) {
      console.error(`[supabase-store] Failed to resolve credentials for location ${locationId}:`, err);
    }
  }
  return out;
}

/** Best-effort decrypt of an encrypted column; returns undefined on absence/failure. */
function tryDecrypt(value: unknown, label: string, locationId: string): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  try {
    return decryptToken(value);
  } catch (err) {
    console.error(`[supabase-store] Failed to decrypt ${label} for location ${locationId}:`, err);
    return undefined;
  }
}

/** Map a subaccounts row's workflow columns to decrypted credentials, or undefined. */
function decryptWorkflowCreds(
  row: Record<string, unknown>,
  locationId: string
): ResolvedWorkflowCreds | undefined {
  const firebaseApiKey = (row.base_api_key as string | null) ?? undefined;
  const firebaseRefreshToken = tryDecrypt(row.base_refresh_token, 'firebase refresh token', locationId);
  const authToken = tryDecrypt(row.auth_encrypted_token, 'builder auth token', locationId);
  const refreshToken = tryDecrypt(row.auth_encrypted_refresh_token, 'builder refresh token', locationId);
  const userId = (row.ghl_user_id as string | null) ?? undefined;
  const companyId = (row.ghl_company_id as string | null) ?? undefined;
  const companyAgeRaw = row.ghl_company_age;
  const companyAge = typeof companyAgeRaw === 'number' ? companyAgeRaw : undefined;

  // No workflow credentials at all → no workflow client for this sub-account.
  if (!firebaseApiKey && !firebaseRefreshToken && !authToken && !refreshToken) {
    return undefined;
  }

  return { firebaseApiKey, firebaseRefreshToken, authToken, refreshToken, userId, companyId, companyAge };
}

/**
 * Persist rotated workflow tokens back to a sub-account row. Called by the
 * WorkflowBuilderClient's `persist` callback after a Firebase / builder-JWT
 * refresh grant rotates a token. Best-effort; failures are logged, not thrown.
 */
export async function updateWorkflowCreds(subaccountId: string, patch: WorkflowCredsPatch): Promise<void> {
  const update: Record<string, unknown> = { workflow_creds_updated_at: new Date().toISOString() };
  if (patch.firebaseRefreshToken) update.base_refresh_token = encryptToken(patch.firebaseRefreshToken);
  if (patch.refreshToken) update.auth_encrypted_refresh_token = encryptToken(patch.refreshToken);
  if (patch.authToken) update.auth_encrypted_token = encryptToken(patch.authToken);
  // Resolved context ids are low-sensitivity — stored plaintext.
  if (patch.companyId) update.ghl_company_id = patch.companyId;
  if (patch.userId) update.ghl_user_id = patch.userId;

  const { error } = await getSupabase().from('subaccounts').update(update).eq('id', subaccountId);
  if (error) {
    console.error(`[supabase-store] Failed to persist rotated workflow creds for ${subaccountId}:`, error.message);
  }
}

/**
 * Agency-wide workflow credentials (one row per owner), decrypted: the builder JWT
 * (marketplace discovery) AND the Firebase session creds (workflow CRUD). Firebase
 * creds are the logged-in user's session — identical across all the owner's
 * sub-accounts — so they're captured once and shared here.
 */
export interface AgencyBuilderToken {
  authToken?: string;
  refreshToken?: string;
  firebaseApiKey?: string;
  firebaseRefreshToken?: string;
  companyId?: string;
  userId?: string;
}

/** Load and decrypt the agency-level builder JWT + Firebase creds for an owner. */
export async function loadAgencyBuilderToken(ownerId: string): Promise<AgencyBuilderToken | undefined> {
  const { data, error } = await getSupabase()
    .from('agency_builder_tokens')
    .select('auth_encrypted_token, auth_encrypted_refresh_token, firebase_api_key, firebase_refresh_encrypted, ghl_company_id, ghl_user_id')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error || !data) return undefined;
  const authToken = tryDecrypt(data.auth_encrypted_token, 'agency builder token', ownerId);
  const refreshToken = tryDecrypt(data.auth_encrypted_refresh_token, 'agency builder refresh token', ownerId);
  const firebaseApiKey = (data.firebase_api_key as string | null) ?? undefined;
  const firebaseRefreshToken = tryDecrypt(data.firebase_refresh_encrypted, 'agency firebase refresh token', ownerId);
  const companyId = (data.ghl_company_id as string | null) ?? undefined;
  const userId = (data.ghl_user_id as string | null) ?? undefined;
  if (!authToken && !refreshToken && !firebaseApiKey && !firebaseRefreshToken) return undefined;
  return { authToken, refreshToken, firebaseApiKey, firebaseRefreshToken, companyId, userId };
}

/** Upsert agency-wide Firebase creds (captured once, shared across sub-accounts). */
export async function storeAgencyFirebaseCreds(
  ownerId: string,
  patch: { firebaseApiKey?: string; firebaseRefreshToken?: string; companyId?: string; userId?: string }
): Promise<{ ok: boolean; error?: string }> {
  const row: Record<string, unknown> = { owner_id: ownerId, firebase_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  if (patch.firebaseApiKey) row.firebase_api_key = patch.firebaseApiKey;
  if (patch.firebaseRefreshToken) row.firebase_refresh_encrypted = encryptToken(patch.firebaseRefreshToken);
  if (patch.companyId) row.ghl_company_id = patch.companyId;
  if (patch.userId) row.ghl_user_id = patch.userId;

  const { error } = await getSupabase().from('agency_builder_tokens').upsert(row, { onConflict: 'owner_id' });
  if (error) {
    console.error(`[supabase-store] Failed to store agency Firebase creds for ${ownerId}:`, error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Upsert the agency-level builder token (encrypted). Only overwrites fields present in `patch`. */
export async function storeAgencyBuilderToken(
  ownerId: string,
  patch: { authToken?: string; refreshToken?: string }
): Promise<{ ok: boolean; error?: string }> {
  const row: Record<string, unknown> = { owner_id: ownerId, updated_at: new Date().toISOString() };
  if (patch.authToken) row.auth_encrypted_token = encryptToken(patch.authToken);
  if (patch.refreshToken) row.auth_encrypted_refresh_token = encryptToken(patch.refreshToken);

  const { error } = await getSupabase()
    .from('agency_builder_tokens')
    .upsert(row, { onConflict: 'owner_id' });
  if (error) {
    console.error(`[supabase-store] Failed to store agency builder token for ${ownerId}:`, error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ─── Marketplace OAuth token lifecycle ──────────────────────────────────────

export interface AgencyOAuthInstall {
  ownerId: string;
  ghlCompanyId: string;
  accessToken: string;
  refreshToken: string;
  /** epoch ms; 0 = treat as expired. */
  expiresAt: number;
}

/**
 * The agency's GHL company id from its OAuth install — written at the OAuth
 * callback and therefore the most reliable company-id source for OAuth
 * sub-accounts (independent of token decryption or the Firebase capture).
 */
export async function loadAgencyCompanyId(ownerId: string): Promise<string | undefined> {
  const { data, error } = await getSupabase()
    .from('agency_oauth_installs')
    .select('ghl_company_id')
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error || !data) return undefined;
  return (data.ghl_company_id as string | null) ?? undefined;
}

/** Load and decrypt the agency-level Company OAuth install for an owner. */
export async function loadAgencyOAuthInstall(ownerId: string): Promise<AgencyOAuthInstall | undefined> {
  const { data, error } = await getSupabase()
    .from('agency_oauth_installs')
    .select('ghl_company_id, access_encrypted_token, refresh_encrypted_token, token_expires_at')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error || !data) return undefined;
  const accessToken = tryDecrypt(data.access_encrypted_token, 'agency oauth access token', ownerId);
  const refreshToken = tryDecrypt(data.refresh_encrypted_token, 'agency oauth refresh token', ownerId);
  const ghlCompanyId = (data.ghl_company_id as string | null) ?? undefined;
  const expRaw = data.token_expires_at as string | null;
  if (!accessToken || !refreshToken || !ghlCompanyId) return undefined;
  return { ownerId, ghlCompanyId, accessToken, refreshToken, expiresAt: expRaw ? Date.parse(expRaw) : 0 };
}

/** Persist a rotated agency Company token (access + rotated refresh + expiry) and release the lease. */
async function persistAgencyOAuthToken(ownerId: string, tok: OAuthTokenResult): Promise<void> {
  const update: Record<string, unknown> = {
    access_encrypted_token: encryptToken(tok.accessToken),
    token_expires_at: new Date(Date.now() + tok.expiresIn * 1000).toISOString(),
    refresh_locked_at: null, // release the cross-instance refresh lease
    updated_at: new Date().toISOString(),
  };
  if (tok.refreshToken) update.refresh_encrypted_token = encryptToken(tok.refreshToken);
  const { error } = await getSupabase().from('agency_oauth_installs').update(update).eq('owner_id', ownerId);
  if (error) {
    console.error(`[supabase-store] Failed to persist rotated agency OAuth token for ${ownerId}:`, error.message);
  }
}

/** Release the refresh lease without changing tokens (e.g. after a failed refresh). */
async function clearAgencyRefreshLock(ownerId: string): Promise<void> {
  try {
    await getSupabase().from('agency_oauth_installs').update({ refresh_locked_at: null }).eq('owner_id', ownerId);
  } catch {
    /* the lease also expires on its own — non-fatal */
  }
}

/**
 * Atomically claim the refresh lease for an owner. The conditional UPDATE only
 * matches when the lease is free or stale (older than leaseMs), so under
 * concurrency Postgres serializes the writes and exactly one instance wins.
 * Returns true iff this instance now holds the lease.
 */
async function claimAgencyRefreshLease(ownerId: string, leaseMs: number): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const staleCutoff = new Date(Date.now() - leaseMs).toISOString();
  const { data, error } = await getSupabase()
    .from('agency_oauth_installs')
    .update({ refresh_locked_at: nowIso })
    .eq('owner_id', ownerId)
    .or(`refresh_locked_at.is.null,refresh_locked_at.lt.${staleCutoff}`)
    .select('owner_id');
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// In-process single-flight: dedupes concurrent refreshes WITHIN one instance
// before any DB work. Cross-INSTANCE coordination is handled by the DB lease
// (refresh_locked_at) inside refreshAgencyTokenCrossInstance.
const agencyRefreshInFlight = new Map<string, Promise<string>>();

const AGENCY_REFRESH_LEASE_MS = 30_000; // a refresh holds the lease at most this long
const AGENCY_REFRESH_DEADLINE_MS = 60_000; // give up waiting for a peer after this
const AGENCY_REFRESH_POLL_MS = 500;

/**
 * Refresh the agency token with cross-instance coordination. The instance that
 * claims the DB lease performs the GHL refresh and persists the rotation; other
 * instances poll for the freshly-persisted token instead of refreshing in
 * parallel (which would rotate — and invalidate — the shared refresh token).
 * If the lease holder dies, the stale lease is reclaimable after the timeout.
 */
async function refreshAgencyTokenCrossInstance(ownerId: string, initial: AgencyOAuthInstall): Promise<string> {
  const deadline = Date.now() + AGENCY_REFRESH_DEADLINE_MS;
  let install = initial;

  while (true) {
    if (install.expiresAt - Date.now() > OAUTH_EXPIRY_MARGIN_MS) return install.accessToken;

    if (await claimAgencyRefreshLease(ownerId, AGENCY_REFRESH_LEASE_MS)) {
      try {
        const rotated = await oauthRefreshToken(install.refreshToken, 'Company');
        await persistAgencyOAuthToken(ownerId, rotated); // also releases the lease
        return rotated.accessToken;
      } catch (err) {
        await clearAgencyRefreshLock(ownerId);
        throw err;
      }
    }

    // A peer holds the lease — wait for it to publish the new token.
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for a peer to refresh the agency OAuth token.');
    }
    await sleep(AGENCY_REFRESH_POLL_MS);
    const fresh = await loadAgencyOAuthInstall(ownerId);
    if (!fresh) {
      throw new Error('No GHL OAuth install found for this agency. Reconnect the marketplace app in the dashboard.');
    }
    install = fresh;
  }
}

/** A valid agency Company access token, refreshing (and persisting the rotation) if near expiry. */
export async function getOrRefreshAgencyToken(ownerId: string): Promise<string> {
  const existing = agencyRefreshInFlight.get(ownerId);
  if (existing) return existing;

  const run = (async (): Promise<string> => {
    const install = await loadAgencyOAuthInstall(ownerId);
    if (!install) {
      throw new Error('No GHL OAuth install found for this agency. Reconnect the marketplace app in the dashboard.');
    }
    if (install.expiresAt - Date.now() > OAUTH_EXPIRY_MARGIN_MS) return install.accessToken;
    return refreshAgencyTokenCrossInstance(ownerId, install);
  })();

  agencyRefreshInFlight.set(ownerId, run);
  try {
    return await run;
  } finally {
    agencyRefreshInFlight.delete(ownerId);
  }
}

/** Persist a sub-account's OAuth location token (access + optional refresh + expiry), encrypted. */
async function persistLocationOAuthToken(subaccountId: string, tok: OAuthTokenResult): Promise<void> {
  const update: Record<string, unknown> = {
    oauth_access_encrypted_token: encryptToken(tok.accessToken),
    oauth_token_expires_at: new Date(Date.now() + tok.expiresIn * 1000).toISOString(),
  };
  if (tok.refreshToken) update.oauth_refresh_encrypted_token = encryptToken(tok.refreshToken);
  const { error } = await getSupabase().from('subaccounts').update(update).eq('id', subaccountId);
  if (error) {
    console.error(`[supabase-store] Failed to persist OAuth location token for ${subaccountId}:`, error.message);
  }
}

/**
 * The current Bearer token for a sub-account. For PIT this is the static PIT. For
 * OAuth it returns a cached location token while valid; otherwise:
 *   - if the sub-account has a Location refresh token → renew it via /oauth/token
 *     (the durable path — a location token, once minted, carries its own rotating
 *     refresh token, so we don't lean on the agency token every cycle);
 *   - else (company install, no location refresh yet) → mint one from the freshly
 *     refreshed agency token, capturing whatever refresh token it returns.
 * Mutates the passed `loc`'s cached token/refresh/expiry so repeated calls within
 * a session reuse the fresh value.
 */
export async function getOrRefreshLocationToken(loc: ResolvedLocation): Promise<string> {
  if (loc.authMode === 'pit') return loc.accessToken;

  if (loc.accessToken && loc.oauthExpiresAt && loc.oauthExpiresAt - Date.now() > OAUTH_EXPIRY_MARGIN_MS) {
    return loc.accessToken;
  }

  let tok: OAuthTokenResult;
  if (loc.oauthRefreshToken) {
    // Preferred: renew the location's own refresh token.
    tok = await oauthRefreshToken(loc.oauthRefreshToken, 'Location');
  } else if (loc.oauthInstallType === 'location') {
    throw new Error(`OAuth location "${loc.locationId}" has no refresh token. Reconnect the app for this sub-account.`);
  } else {
    // Company install, first use: mint from the agency token.
    if (!loc.ghlCompanyId) {
      throw new Error(`OAuth sub-account "${loc.locationId}" is missing its company id; cannot mint a location token.`);
    }
    const agencyAccess = await getOrRefreshAgencyToken(loc.ownerId);
    tok = await mintLocationToken(agencyAccess, loc.ghlCompanyId, loc.locationId);
  }

  await persistLocationOAuthToken(loc.subaccountId, tok);
  loc.accessToken = tok.accessToken;
  if (tok.refreshToken) loc.oauthRefreshToken = tok.refreshToken;
  loc.oauthExpiresAt = Date.now() + tok.expiresIn * 1000;
  return tok.accessToken;
}

/** Resolve a raw capture-token secret to its owner. Returns null if no live match. */
export async function resolveCaptureToken(rawSecret: string): Promise<{ tokenId: string; ownerId: string } | null> {
  if (!rawSecret) return null;
  const hash = hashUrlToken(rawSecret);
  const { data, error } = await getSupabase()
    .from('workflow_capture_tokens')
    .select('id, owner_id')
    .eq('token_hash', hash)
    .eq('revoked', false)
    .maybeSingle();

  if (error || !data) return null;
  return { tokenId: data.id as string, ownerId: data.owner_id as string };
}

export interface CapturedWorkflowCreds {
  locationId: string;
  firebaseApiKey?: string;
  firebaseRefreshToken?: string;
  /** Optional builder JWT sniffed by the extension (short-lived). */
  authToken?: string;
  companyId?: string;
  userId?: string;
}

/**
 * Store Firebase credentials harvested by the capture extension onto the owner's
 * matching sub-account row. The sub-account (with its PIT) must already exist —
 * we never create one here, since the PIT can't be harvested from the browser.
 */
export async function storeCapturedWorkflowCreds(
  ownerId: string,
  creds: CapturedWorkflowCreds
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  const { data: rows, error: findErr } = await supabase
    .from('subaccounts')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('location_id', creds.locationId)
    .limit(1);

  if (findErr) return { ok: false, error: findErr.message };
  const row = rows?.[0];
  if (!row) {
    return {
      ok: false,
      error: `No sub-account with location "${creds.locationId}" found for this agency. Add it (with its PIT) in the dashboard first.`,
    };
  }

  const update: Record<string, unknown> = { workflow_creds_updated_at: new Date().toISOString() };
  if (creds.firebaseApiKey) update.base_api_key = creds.firebaseApiKey;
  if (creds.firebaseRefreshToken) update.base_refresh_token = encryptToken(creds.firebaseRefreshToken);
  if (creds.authToken) update.auth_encrypted_token = encryptToken(creds.authToken);
  if (creds.companyId) update.ghl_company_id = creds.companyId;
  if (creds.userId) update.ghl_user_id = creds.userId;

  const { error: updErr } = await supabase.from('subaccounts').update(update).eq('id', row.id as string);
  if (updErr) return { ok: false, error: updErr.message };
  return { ok: true };
}

/** Best-effort touch of a capture token's last_used_at. */
export async function touchCaptureTokenUsed(tokenId: string): Promise<void> {
  try {
    await getSupabase()
      .from('workflow_capture_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tokenId);
  } catch {
    /* non-fatal */
  }
}

/** Best-effort touch of last_used_at; failures are non-fatal. */
export async function touchLinkLastUsed(linkId: string): Promise<void> {
  try {
    await getSupabase()
      .from('mcp_links')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', linkId);
  } catch {
    /* non-fatal */
  }
}
