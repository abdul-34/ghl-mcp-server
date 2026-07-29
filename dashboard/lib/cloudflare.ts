/**
 * Cloudflare for SaaS — Custom Hostnames.
 *
 * White-label domains are handled by Cloudflare: an agency CNAMEs their domain to
 * our SaaS zone, we register it as a "custom hostname", and Cloudflare issues +
 * renews the TLS cert automatically. We never run ACME ourselves. The agency's
 * traffic is then proxied by Cloudflare to our origin (the DigitalOcean app).
 *
 * Env (server-only):
 *   CLOUDFLARE_API_TOKEN   — token with "SSL and Certificates: Edit" on the zone
 *   CLOUDFLARE_ZONE_ID     — the SaaS zone id
 *   CF_SAAS_CNAME_TARGET   — the hostname agencies CNAME to (your fallback origin)
 */

const CF_API = 'https://api.cloudflare.com/client/v4';

export interface CustomHostnameRecord {
  type: string;
  name: string;
  value: string;
}

export interface CustomHostnameResult {
  id: string;
  status: string; // 'pending' | 'active' | ...
  sslStatus: string; // ssl.status
  /** DNS records the agency must set (CNAME to the SaaS target + any validation records). */
  records: CustomHostnameRecord[];
}

function cfEnv(): { token: string; zoneId: string; cnameTarget: string } {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
  const cnameTarget = process.env.CF_SAAS_CNAME_TARGET?.trim();
  if (!token || !zoneId || !cnameTarget) {
    throw new Error('CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID and CF_SAAS_CNAME_TARGET are required for white-label domains.');
  }
  return { token, zoneId, cnameTarget };
}

async function cfFetch(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const { token } = cfEnv();
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || body.success === false) {
    const errs = Array.isArray(body.errors) ? body.errors : [];
    const msg = errs.map((e) => (e as { message?: string }).message).filter(Boolean).join('; ');
    throw new Error(`Cloudflare API ${res.status}${msg ? `: ${msg}` : ''}`);
  }
  return body;
}

/** Shape a Cloudflare custom_hostname result into what the domains UI needs. */
function shapeResult(result: Record<string, unknown>): CustomHostnameResult {
  const { cnameTarget } = cfEnv();
  const ssl = (result.ssl as Record<string, unknown> | undefined) ?? {};
  const domain = String(result.hostname ?? '');
  const records: CustomHostnameRecord[] = [
    { type: 'CNAME', name: domain, value: cnameTarget },
  ];

  // Ownership verification (pre-validation) record, when present.
  const ownership = result.ownership_verification as Record<string, unknown> | undefined;
  if (ownership && ownership.type && ownership.name && ownership.value) {
    records.push({ type: String(ownership.type).toUpperCase(), name: String(ownership.name), value: String(ownership.value) });
  }
  // SSL (DCV) validation records, when present.
  const validation = Array.isArray(ssl.validation_records) ? (ssl.validation_records as Record<string, unknown>[]) : [];
  for (const v of validation) {
    if (v.txt_name && v.txt_value) {
      records.push({ type: 'TXT', name: String(v.txt_name), value: String(v.txt_value) });
    }
  }

  return {
    id: String(result.id ?? ''),
    status: String(result.status ?? 'pending'),
    sslStatus: String(ssl.status ?? 'pending'),
    records,
  };
}

/** Register a custom hostname; Cloudflare begins issuing a DV certificate for it. */
export async function createCustomHostname(domain: string): Promise<CustomHostnameResult> {
  const { zoneId } = cfEnv();
  const body = await cfFetch(`/zones/${zoneId}/custom_hostnames`, {
    method: 'POST',
    body: JSON.stringify({
      hostname: domain,
      ssl: { method: 'txt', type: 'dv', settings: { min_tls_version: '1.2' } },
    }),
  });
  return shapeResult(body.result as Record<string, unknown>);
}

/** Fetch a custom hostname's current status (poll after the agency sets DNS). */
export async function getCustomHostname(id: string): Promise<CustomHostnameResult> {
  const { zoneId } = cfEnv();
  const body = await cfFetch(`/zones/${zoneId}/custom_hostnames/${id}`, { method: 'GET' });
  return shapeResult(body.result as Record<string, unknown>);
}

/** Remove a custom hostname (stops serving + frees the domain). */
export async function deleteCustomHostname(id: string): Promise<void> {
  const { zoneId } = cfEnv();
  await cfFetch(`/zones/${zoneId}/custom_hostnames/${id}`, { method: 'DELETE' });
}
