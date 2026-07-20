/**
 * Adapter that exposes the source project's GHLToolClient surface on top of the
 * target's per-sub-account CRMClient. This lets tool classes ported from
 * Go-High-Level-MCP-2026 (which call `makeRequest` + `getConfig`) run unchanged
 * against the dynamic, DB-resolved client — no global config, no env.
 */

import { CRMClient } from '../../crm/client.js';
import { GHLToolClient, GHLToolConfig, GHLToolResponse, HttpMethod } from './ghl-tool-client.js';

export class GHLToolAdapter implements GHLToolClient {
  constructor(private readonly client: CRMClient) {}

  getConfig(): Readonly<GHLToolConfig> {
    return { locationId: this.client.locationId };
  }

  async makeRequest<T = any>(
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>,
    options?: { version?: string }
  ): Promise<GHLToolResponse<T>> {
    // CRMClient.request throws on HTTP error (matching GHLApiClient.makeRequest),
    // so a resolved value always means success.
    const data = await this.client.request<T>(method, path, {
      data: body,
      headers: options?.version ? { Version: options.version } : undefined,
    });
    return { success: true, data };
  }
}
