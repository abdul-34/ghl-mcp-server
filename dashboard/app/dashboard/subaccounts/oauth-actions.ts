'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { decryptToken, encryptToken } from '@/lib/crypto';
import { refreshCompanyToken, listInstalledLocations, type InstalledLocation } from '@/lib/ghl-oauth';

const EXPIRY_MARGIN_MS = 120_000;

export type InstallStatus = { connected: boolean; companyId?: string };

/** Whether this agency has connected the GHL Marketplace app. */
export async function getInstallStatus(): Promise<InstallStatus> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { connected: false };

  const { data } = await supabase
    .from('agency_oauth_installs')
    .select('ghl_company_id')
    .eq('owner_id', user.id)
    .maybeSingle();
  return { connected: !!data, companyId: (data?.ghl_company_id as string | undefined) ?? undefined };
}

/** A valid agency access token, refreshing (and persisting the rotation) if near expiry. */
async function freshCompanyToken(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  ownerId: string
): Promise<{ accessToken: string; companyId: string } | { error: string }> {
  const { data, error } = await supabase
    .from('agency_oauth_installs')
    .select('ghl_company_id, access_encrypted_token, refresh_encrypted_token, token_expires_at')
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error || !data) return { error: 'GHL app not connected. Click "Connect GoHighLevel" first.' };

  const companyId = data.ghl_company_id as string;
  const expiresAt = data.token_expires_at ? Date.parse(data.token_expires_at as string) : 0;

  try {
    if (expiresAt - Date.now() > EXPIRY_MARGIN_MS) {
      return { accessToken: decryptToken(data.access_encrypted_token as string), companyId };
    }
    const rotated = await refreshCompanyToken(decryptToken(data.refresh_encrypted_token as string));
    const update: Record<string, unknown> = {
      access_encrypted_token: encryptToken(rotated.accessToken),
      token_expires_at: new Date(Date.now() + rotated.expiresIn * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (rotated.refreshToken) update.refresh_encrypted_token = encryptToken(rotated.refreshToken);
    await supabase.from('agency_oauth_installs').update(update).eq('owner_id', ownerId);
    return { accessToken: rotated.accessToken, companyId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to refresh the agency token.' };
  }
}

export type InstallableResult = { ok: boolean; error?: string; locations?: InstalledLocation[] };

/** Installed sub-accounts not yet added, for the picker. */
export async function listInstallableLocations(): Promise<InstallableResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated.' };

  const tok = await freshCompanyToken(supabase, user.id);
  if ('error' in tok) return { ok: false, error: tok.error };

  let installed: InstalledLocation[];
  try {
    installed = await listInstalledLocations(tok.accessToken, tok.companyId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to list installed locations.' };
  }

  const { data: existing } = await supabase.from('subaccounts').select('location_id').eq('owner_id', user.id);
  const have = new Set((existing ?? []).map((r) => r.location_id as string));

  // Best-effort: cache the full installed set for later reference.
  await supabase
    .from('agency_oauth_installs')
    .update({ installed_locations: installed, installed_synced_at: new Date().toISOString() })
    .eq('owner_id', user.id);

  return { ok: true, locations: installed.filter((l) => !have.has(l.locationId)) };
}

export type ActionResult = { ok: boolean; error?: string };

/** Add an installed sub-account as an OAuth (PIT-less) row; its token is minted on first MCP use. */
export async function addOauthSubaccount(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const locationId = String(formData.get('location_id') || '').trim();
  const name = String(formData.get('name') || '').trim();
  if (!locationId) return { ok: false, error: 'A location id is required.' };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated.' };

  const status = await getInstallStatus();
  if (!status.connected || !status.companyId) {
    return { ok: false, error: 'Connect the GHL Marketplace app first.' };
  }

  const { error } = await supabase.from('subaccounts').insert({
    owner_id: user.id,
    location_id: locationId,
    name: name || null,
    auth_mode: 'oauth',
    oauth_install_type: 'company',
    ghl_company_id: status.companyId,
  });

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'You already added that location ID.' };
    return { ok: false, error: error.message };
  }

  revalidatePath('/dashboard/subaccounts');
  return { ok: true };
}
