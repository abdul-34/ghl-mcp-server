'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { encryptToken } from '@/lib/crypto';

export type ActionResult = { ok: boolean; error?: string };

export async function addSubaccount(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get('name') || '').trim();
  const locationId = String(formData.get('location_id') || '').trim();
  const pit = String(formData.get('pit_token') || '').trim();

  if (!locationId || !pit) {
    return { ok: false, error: 'Location ID and Private Integration Token are required.' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated.' };

  let encrypted: string;
  try {
    encrypted = encryptToken(pit);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Encryption failed.' };
  }

  const { error } = await supabase.from('subaccounts').insert({
    owner_id: user.id,
    location_id: locationId,
    name: name || null,
    pit_token_encrypted: encrypted,
  });

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'You already added that location ID.' };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath('/dashboard/subaccounts');
  return { ok: true };
}

export async function deleteSubaccount(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from('subaccounts').delete().eq('id', id);
  revalidatePath('/dashboard/subaccounts');
}
