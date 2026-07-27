/**
 * Tool framework.
 *
 * A `ToolDef` couples an MCP tool definition with a handler. Handlers receive a
 * `CRMClient` already scoped to the target sub-account, plus the validated args.
 * This keeps every tool a small, self-contained function — no shared mutable
 * client, no AsyncLocalStorage, no proxies.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CRMClient } from '../crm/client.js';

export type ToolHandler = (client: CRMClient, args: Record<string, any>) => Promise<unknown>;

export interface ToolDef {
  tool: Tool;
  handler: ToolHandler;
  /**
   * When false, the tool does not operate on a sub-account: callTool skips the
   * locationId requirement and the pool lookup, and the handler receives no
   * client. Used for local, location-independent tools (e.g. the native catalog).
   */
  requiresLocation?: boolean;
}

type JsonSchema = Record<string, any>;

/** Reusable schema fragment: every operation tool requires a locationId. */
export const locationIdProp: JsonSchema = {
  type: 'string',
  description: 'CRM sub-account (location) ID to act on. Use list_accounts to discover it.',
};

/**
 * Build a ToolDef. `properties`/`required` describe the tool's args (excluding
 * locationId, which is added automatically and always required).
 */
export function defineTool(opts: {
  name: string;
  description: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  handler: ToolHandler;
  /** Default true. Set false for location-independent tools (no locationId, no pool). */
  requiresLocation?: boolean;
}): ToolDef {
  const requiresLocation = opts.requiresLocation !== false;
  const properties = requiresLocation
    ? { locationId: locationIdProp, ...(opts.properties || {}) }
    : { ...(opts.properties || {}) };
  const required = requiresLocation
    ? Array.from(new Set(['locationId', ...(opts.required || [])]))
    : Array.from(new Set(opts.required || []));
  return {
    tool: {
      name: opts.name,
      description: opts.description,
      inputSchema: {
        type: 'object',
        properties,
        required,
        additionalProperties: false,
      },
    },
    handler: opts.handler,
    requiresLocation,
  };
}

/** Helper to pull a string arg. */
export function str(args: Record<string, any>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}
