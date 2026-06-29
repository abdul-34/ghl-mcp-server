'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateLinkSecret, hashUrlToken } from '@/lib/crypto';
import { ALL_TOOL_NAMES } from '@/lib/tools-catalog';

export type CreateLinkResult = {
  ok: boolean;
  error?: string;
  secret?: string;
  url?: string;
};

function mcpBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MCP_BASE_URL?.trim().replace(/\/+$/, '') ||
    'http://localhost:8000'
  );
}

export async function createLink(
  _prev: CreateLinkResult,
  formData: FormData
): Promise<CreateLinkResult> {
  const label = String(formData.get('label') || '').trim();
  const scope = String(formData.get('scope') || '');
  const subaccountId = String(formData.get('subaccount_id') || '').trim();
  const selected = formData.getAll('tools').map(String).filter(Boolean);
  // "all tools" is represented by an empty whitelist.
  const enabledTools = selected.filter((t) => ALL_TOOL_NAMES.includes(t));

  if (scope !== 'agency' && scope !== 'location') {
    return { ok: false, error: 'Choose a valid scope.' };
  }
  if (scope === 'location' && !subaccountId) {
    return { ok: false, error: 'Pick a sub-account for a location-scoped link.' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated.' };

  const secret = generateLinkSecret();
  const url_token_hash = hashUrlToken(secret);

  const { error } = await supabase.from('mcp_links').insert({
    owner_id: user.id,
    label: label || null,
    scope,
    subaccount_id: scope === 'location' ? subaccountId : null,
    url_token_hash,
    enabled_tools: enabledTools,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/links');
  return { ok: true, secret, url: `${mcpBaseUrl()}/mcp/${secret}` };
}

export async function revokeLink(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from('mcp_links').update({ revoked: true }).eq('id', id);
  revalidatePath('/dashboard/links');
}

export async function deleteLink(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from('mcp_links').delete().eq('id', id);
  revalidatePath('/dashboard/links');
}
