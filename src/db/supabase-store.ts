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
import { decryptToken } from '../crypto/pit-crypto.js';

export type LinkScope = 'agency' | 'location';

export interface ResolvedLink {
  linkId: string;
  ownerId: string;
  scope: LinkScope;
  /** Set only when scope === 'location'. */
  subaccountId?: string;
  /** Tool names this link may expose. Empty array = all tools allowed. */
  enabledTools: string[];
  label?: string;
}

export interface ResolvedLocation {
  locationId: string;
  /** Decrypted PIT — used as the Bearer token for CRM API calls. */
  accessToken: string;
  name?: string;
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
    .select('id, owner_id, scope, subaccount_id, enabled_tools, revoked, label')
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
    .select('location_id, name, pit_token_encrypted')
    .eq('owner_id', link.ownerId);

  if (link.scope === 'location') {
    if (!link.subaccountId) return [];
    query = query.eq('id', link.subaccountId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const out: ResolvedLocation[] = [];
  for (const row of data) {
    const locationId = row.location_id as string;
    const encrypted = row.pit_token_encrypted as string;
    if (!locationId || !encrypted) continue;
    try {
      out.push({
        locationId,
        accessToken: decryptToken(encrypted),
        name: (row.name as string | null) ?? undefined,
      });
    } catch (err) {
      console.error(`[supabase-store] Failed to decrypt PIT for location ${locationId}:`, err);
    }
  }
  return out;
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
