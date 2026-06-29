/**
 * Tool registry.
 *
 * Aggregates every operation ToolDef into one Map and exposes a single dispatch
 * entry point used by both the HTTP and stdio servers:
 *
 *   listTools(enabledTools)            → Tool[] visible to the client (filtered)
 *   callTool(pool, name, args, enabled) → run a tool against the right sub-account
 *
 * Account-discovery tools (list_accounts/search_accounts) are handled here too,
 * operating on the pool rather than a single client.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CRMClientPool } from '../crm/pool.js';
import { ToolDef } from './types.js';
import { GENERATED_TOOLS } from './generated/index.js';
import {
  accountsToolDefinitions,
  executeAccountsTool,
  isAccountsTool,
} from './accounts.js';
import { isToolAllowed } from './tool-filter.js';

const OPERATION_DEFS: ToolDef[] = [...GENERATED_TOOLS];

const REGISTRY = new Map<string, ToolDef>();
for (const def of OPERATION_DEFS) {
  if (REGISTRY.has(def.tool.name)) {
    throw new Error(`Duplicate tool name in registry: ${def.tool.name}`);
  }
  REGISTRY.set(def.tool.name, def);
}

/** All tool definitions (account discovery first, then operations). */
export function allToolDefinitions(): Tool[] {
  return [...accountsToolDefinitions, ...OPERATION_DEFS.map((d) => d.tool)];
}

/** Tools this link may expose, after applying its enabled-tools whitelist. */
export function listTools(enabledTools: string[]): Tool[] {
  return allToolDefinitions().filter((t) => isToolAllowed(t.name, enabledTools));
}

export function toolCount(): number {
  return REGISTRY.size + accountsToolDefinitions.length;
}

/**
 * Execute a tool by name. Enforces the link's whitelist, resolves the target
 * sub-account from args.locationId, and runs the handler against that client.
 */
export async function callTool(
  pool: CRMClientPool,
  name: string,
  args: Record<string, any>,
  enabledTools: string[]
): Promise<unknown> {
  if (!isToolAllowed(name, enabledTools)) {
    throw new Error(`Tool "${name}" is not enabled for this link.`);
  }

  if (isAccountsTool(name)) {
    return executeAccountsTool(pool, name, args);
  }

  const def = REGISTRY.get(name);
  if (!def) throw new Error(`Unknown tool "${name}".`);

  const locationId = typeof args.locationId === 'string' ? args.locationId : undefined;
  if (!locationId) {
    throw new Error(`Tool "${name}" requires a "locationId". Call list_accounts to find one.`);
  }
  if (!pool.has(locationId)) {
    throw new Error(`This link does not grant access to locationId "${locationId}".`);
  }

  const client = pool.get(locationId);
  return def.handler(client, args);
}
