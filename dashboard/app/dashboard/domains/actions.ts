'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { normalizeDomain, isValidDomain, newVerificationToken } from '@/lib/domain-verify';
import { createCustomHostname, getCustomHostname, deleteCustomHostname } from '@/lib/cloudflare';

export type ActionResult = { ok: boolean; error?: string };

/** Map a Cloudflare hostname/ssl status pair to our custom_domains.status. */
function toStatus(cfStatus: string, sslStatus: string): 'pending' | 'verifying' | 'active' | 'failed' {
  if (cfStatus === 'active' && sslStatus === 'active') return 'active';
  if (cfStatus === 'blocked' || sslStatus === 'timed_out' || cfStatus === 'moved' || cfStatus === 'deleted') return 'failed';
  if (cfStatus === 'pending' && sslStatus === 'pending') return 'pending';
  return 'verifying';
}

/** Register a custom domain with Cloudflare for SaaS; store the DNS records to show the agency. */
export async function addDomain(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const domain = normalizeDomain(String(formData.get('domain') || ''));
  if (!domain || !isValidDomain(domain)) return { ok: false, error: 'Enter a valid domain, e.g. mcp.your-agency.com.' };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated.' };

  let cf;
  try {
    cf = await createCustomHostname(domain);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Cloudflare registration failed.' };
  }

  const { error } = await supabase.from('custom_domains').insert({
    owner_id: user.id,
    domain,
    verification_token: newVerificationToken(),
    cf_hostname_id: cf.id,
    cf_verification: cf.records,
    status: toStatus(cf.status, cf.sslStatus),
  });
  if (error) {
    // Roll back the Cloudflare hostname so a retry isn't blocked by a dangling registration.
    try {
      await deleteCustomHostname(cf.id);
    } catch {
      /* best-effort */
    }
    if (error.code === '23505') return { ok: false, error: 'That domain is already registered.' };
    return { ok: false, error: error.message };
  }

  revalidatePath('/dashboard/domains');
  return { ok: true };
}

/** Poll Cloudflare for the hostname's status and update the row (active once the cert is issued). */
export async function verifyDomain(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  if (!id) return;

  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase
    .from('custom_domains')
    .select('cf_hostname_id')
    .eq('id', id)
    .maybeSingle();
  const cfId = row?.cf_hostname_id as string | undefined;
  if (!cfId) return;

  try {
    const cf = await getCustomHostname(cfId);
    const status = toStatus(cf.status, cf.sslStatus);
    await supabase
      .from('custom_domains')
      .update({
        cf_verification: cf.records,
        status,
        verified: status === 'active',
        last_checked_at: new Date().toISOString(),
        verified_at: status === 'active' ? new Date().toISOString() : null,
      })
      .eq('id', id);
  } catch {
    await supabase.from('custom_domains').update({ status: 'failed', last_checked_at: new Date().toISOString() }).eq('id', id);
  }

  revalidatePath('/dashboard/domains');
}

export async function deleteDomain(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase.from('custom_domains').select('cf_hostname_id').eq('id', id).maybeSingle();
  const cfId = row?.cf_hostname_id as string | undefined;
  if (cfId) {
    try {
      await deleteCustomHostname(cfId);
    } catch {
      /* best-effort — still remove our row */
    }
  }
  await supabase.from('custom_domains').delete().eq('id', id);
  revalidatePath('/dashboard/domains');
}
