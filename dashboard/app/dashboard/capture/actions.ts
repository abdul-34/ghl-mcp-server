'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateLinkSecret, hashUrlToken } from '@/lib/crypto';

export type CreateCaptureTokenResult = {
  ok: boolean;
  error?: string;
  secret?: string;
  serverUrl?: string;
};

function mcpBaseUrl(): string {
  return process.env.NEXT_PUBLIC_MCP_BASE_URL?.trim().replace(/\/+$/, '') || 'http://localhost:8000';
}

export async function createCaptureToken(
  _prev: CreateCaptureTokenResult,
  formData: FormData
): Promise<CreateCaptureTokenResult> {
  const label = String(formData.get('label') || '').trim();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated.' };

  const secret = generateLinkSecret();
  const token_hash = hashUrlToken(secret);

  const { error } = await supabase.from('workflow_capture_tokens').insert({
    owner_id: user.id,
    label: label || null,
    token_hash,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/capture');
  return { ok: true, secret, serverUrl: mcpBaseUrl() };
}

export async function revokeCaptureToken(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from('workflow_capture_tokens').update({ revoked: true }).eq('id', id);
  revalidatePath('/dashboard/capture');
}

export async function deleteCaptureToken(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from('workflow_capture_tokens').delete().eq('id', id);
  revalidatePath('/dashboard/capture');
}
