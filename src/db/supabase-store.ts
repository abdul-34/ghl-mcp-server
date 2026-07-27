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

export interface ResolvedLocation {
  /** subaccounts.id — the row to persist rotated workflow tokens back to. */
  subaccountId: string;
  locationId: string;
  /** Decrypted PIT — used as the Bearer token for CRM API calls. */
  accessToken: string;
  name?: string;
  /** Decrypted workflow-builder credentials, when captured. */
  workflow?: ResolvedWorkflowCreds;
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
    .select('id, location_id, name, pit_token_encrypted, base_api_key, base_refresh_token, auth_encrypted_token, auth_encrypted_refresh_token, ghl_user_id, ghl_company_id, ghl_company_age')
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
    const encrypted = row.pit_token_encrypted as string;
    if (!locationId || !encrypted) continue;
    try {
      out.push({
        subaccountId,
        locationId,
        accessToken: decryptToken(encrypted),
        name: (row.name as string | null) ?? undefined,
        workflow: decryptWorkflowCreds(row, locationId),
      });
    } catch (err) {
      console.error(`[supabase-store] Failed to decrypt PIT for location ${locationId}:`, err);
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

/** The agency-wide builder JWT (+ optional refresh token), decrypted. */
export interface AgencyBuilderToken {
  authToken?: string;
  refreshToken?: string;
}

/** Load and decrypt the agency-level builder token for an owner. */
export async function loadAgencyBuilderToken(ownerId: string): Promise<AgencyBuilderToken | undefined> {
  const { data, error } = await getSupabase()
    .from('agency_builder_tokens')
    .select('auth_encrypted_token, auth_encrypted_refresh_token')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error || !data) return undefined;
  const authToken = tryDecrypt(data.auth_encrypted_token, 'agency builder token', ownerId);
  const refreshToken = tryDecrypt(data.auth_encrypted_refresh_token, 'agency builder refresh token', ownerId);
  if (!authToken && !refreshToken) return undefined;
  return { authToken, refreshToken };
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
