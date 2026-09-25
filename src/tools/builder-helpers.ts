/**
 * Helpers shared by the internal-builder tool sets (forms, surveys).
 */

import { CRMClient } from '../crm/client.js';
import type { CustomFieldRecord } from '../catalog/form-fields.js';

/** Location custom-field registry (public API). Undefined when it can't be loaded. */
export async function loadCustomFields(client: CRMClient): Promise<Map<string, CustomFieldRecord> | undefined> {
  try {
    const res = await client.get<{ customFields?: CustomFieldRecord[] }>(`/locations/${client.locationId}/customFields`);
    const list = Array.isArray(res?.customFields) ? res.customFields : [];
    return new Map(list.filter((f) => f && f.id).map((f) => [f.id, f]));
  } catch {
    return undefined;
  }
}

export function deepMerge(target: Record<string, any>, patch: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...(target || {}) };
  for (const [k, v] of Object.entries(patch || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object'
      ? deepMerge(out[k], v)
      : v;
  }
  return out;
}

export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stableStringify((v as any)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}
