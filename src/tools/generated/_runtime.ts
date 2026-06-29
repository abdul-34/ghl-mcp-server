/**
 * Runtime for generated API tools.
 *
 * `apiTool()` turns a compact spec (method, path, param locations, JSON schema)
 * — emitted by scripts/generate-tools.mjs from HighLevel's OpenAPI files — into
 * a ToolDef. The handler maps validated args into the request's path, query, and
 * body, auto-filling location parameters from the session's selected sub-account.
 *
 * DO NOT edit generated files by hand; re-run the generator instead.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CRMClient, HttpMethod } from '../../crm/client.js';
import { ToolDef } from '../types.js';

export interface ApiToolSpec {
  name: string;
  description: string;
  method: HttpMethod;
  /** Path template, e.g. /contacts/{contactId}. */
  path: string;
  /** API `Version` header value for this endpoint, if the spec pins one. */
  version?: string;
  pathParams: string[];
  queryParams: string[];
  /** Top-level request-body field names (inline body mode). */
  bodyParams: string[];
  /** When true, send args.body as the entire request body. */
  rawBody?: boolean;
  inputSchema: Record<string, any>;
}

/** Params that identify a sub-account; auto-filled from the session client. */
const LOCATION_PARAMS = new Set(['locationId', 'location_id', 'altId']);

export function apiTool(spec: ApiToolSpec): ToolDef {
  return {
    tool: {
      name: spec.name,
      description: spec.description,
      inputSchema: spec.inputSchema as Tool['inputSchema'],
    },
    handler: async (client: CRMClient, args: Record<string, any>) => {
      const a = args || {};

      const path = spec.path.replace(/\{([^}]+)\}/g, (_m, key) => {
        let v = a[key];
        if (v === undefined && LOCATION_PARAMS.has(key)) v = client.locationId;
        return encodeURIComponent(String(v ?? ''));
      });

      const params: Record<string, unknown> = {};
      for (const q of spec.queryParams) {
        let v = a[q];
        if (v === undefined && LOCATION_PARAMS.has(q)) v = client.locationId;
        if (v === undefined && q === 'altType') v = 'location';
        if (v !== undefined) params[q] = v;
      }

      let data: unknown;
      if (spec.rawBody) {
        data = a.body;
      } else if (spec.bodyParams.length) {
        const body: Record<string, unknown> = {};
        for (const b of spec.bodyParams) {
          let v = a[b];
          if (v === undefined && LOCATION_PARAMS.has(b)) v = client.locationId;
          if (v === undefined && b === 'altType') v = 'location';
          if (v !== undefined) body[b] = v;
        }
        data = body;
      }

      const headers = spec.version ? { Version: spec.version } : undefined;
      return client.request(spec.method, path, { params, data, headers });
    },
  };
}
