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
import { CRMClient } from '../crm/client.js';
import { ToolDef } from './types.js';
import { GENERATED_TOOLS } from './generated/index.js';
import {
  accountsToolDefinitions,
  executeAccountsTool,
  isAccountsTool,
} from './accounts.js';
import { workflowBuilderTools } from './workflow-builder.js';
import { workflowPublicTools } from './workflow-public.js';
import { workflowInsightsTools } from './workflow-insights.js';
import { portedTools } from './ported/index.js';
import { formsBuilderTools } from './forms-builder.js';
import { surveysBuilderTools } from './surveys-builder.js';
import {
  gatewayToolDefinitions,
  isGatewayTool,
  searchTools,
  categoryOf,
  ToolIndexEntry,
} from './gateway.js';
import { isToolAllowed } from './tool-filter.js';

// Hand-written tools are additive: they extend the generated public-API tools
// and never replace them. The registry throws on any duplicate name below, so a
// collision surfaces as a build-time error rather than a silent overwrite.
const OPERATION_DEFS: ToolDef[] = [
  ...GENERATED_TOOLS,
  ...workflowBuilderTools,
  ...workflowPublicTools,
  ...workflowInsightsTools,
  ...portedTools,
  ...formsBuilderTools,
  ...surveysBuilderTools,
];

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

export interface ListOptions {
  /** Gateway mode: expose only the account + gateway meta-tools, not the full list. */
  gateway?: boolean;
}

/**
 * Tools this link exposes. In gateway mode only the account-discovery tools and
 * the three gateway meta-tools are returned (the ~700 operation tools stay
 * reachable behind search_ghl_tools / invoke_ghl_tool). Otherwise the full list
 * is returned, filtered by the link's enabled-tools whitelist.
 */
export function listTools(enabledTools: string[], options: ListOptions = {}): Tool[] {
  if (options.gateway) {
    return [...accountsToolDefinitions, ...gatewayToolDefinitions];
  }
  return allToolDefinitions().filter((t) => isToolAllowed(t.name, enabledTools));
}

export function toolCount(): number {
  return REGISTRY.size + accountsToolDefinitions.length;
}

/** Build the searchable index for the gateway, honoring the link's whitelist. */
function buildToolIndex(enabledTools: string[]): ToolIndexEntry[] {
  const index: ToolIndexEntry[] = [];
  for (const t of accountsToolDefinitions) {
    index.push({ name: t.name, category: 'accounts', description: t.description || '' });
  }
  for (const def of OPERATION_DEFS) {
    if (!isToolAllowed(def.tool.name, enabledTools)) continue;
    index.push({
      name: def.tool.name,
      category: categoryOf(def.tool.name),
      description: def.tool.description || '',
    });
  }
  return index;
}

export interface CallOptions {
  /** Gateway mode: allow the search/schema/invoke meta-tools. */
  gateway?: boolean;
}

/**
 * Execute a tool by name. In gateway mode the three meta-tools are handled here;
 * everything else (including invoke_ghl_tool's target) goes through dispatchTool,
 * which enforces the whitelist, resolves the sub-account, and runs the handler.
 */
export async function callTool(
  pool: CRMClientPool,
  name: string,
  args: Record<string, any>,
  enabledTools: string[],
  options: CallOptions = {}
): Promise<unknown> {
  if (options.gateway && isGatewayTool(name)) {
    return executeGatewayTool(pool, name, args, enabledTools);
  }
  return dispatchTool(pool, name, args, enabledTools);
}

/** The core per-tool dispatch: whitelist → accounts shortcut → registry handler. */
async function dispatchTool(
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

  // Location-independent tools (e.g. the native catalog) don't need a sub-account,
  // but if a valid locationId IS supplied they still get a client so they can merge
  // live data (e.g. the complete module list).
  if (def.requiresLocation === false) {
    const loc = typeof args.locationId === 'string' ? args.locationId : undefined;
    const client = loc && pool.has(loc) ? pool.get(loc) : (undefined as unknown as CRMClient);
    return def.handler(client, args);
  }

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

/** Resolve a tool definition for schema lookup (operation, account, or gateway). */
function findTool(name: string): Tool | undefined {
  return (
    REGISTRY.get(name)?.tool ||
    accountsToolDefinitions.find((t) => t.name === name) ||
    gatewayToolDefinitions.find((t) => t.name === name)
  );
}

/** Handle the gateway meta-tools: search, schema lookup, and invoke. */
async function executeGatewayTool(
  pool: CRMClientPool,
  name: string,
  args: Record<string, any>,
  enabledTools: string[]
): Promise<unknown> {
  switch (name) {
    case 'search_ghl_tools': {
      const query = typeof args.query === 'string' ? args.query : '';
      const limit = typeof args.limit === 'number' ? args.limit : 15;
      const results = searchTools(buildToolIndex(enabledTools), query, limit);
      return { query, count: results.length, results: results.map(({ score, ...r }) => r) };
    }

    case 'get_ghl_tool_schema': {
      const target = typeof args.name === 'string' ? args.name : '';
      if (!target) throw new Error('get_ghl_tool_schema requires a "name".');
      if (!isAccountsTool(target) && !isGatewayTool(target) && !isToolAllowed(target, enabledTools)) {
        throw new Error(`Tool "${target}" is not enabled for this link.`);
      }
      const tool = findTool(target);
      if (!tool) throw new Error(`Unknown tool "${target}". Use search_ghl_tools to find valid names.`);
      return { name: tool.name, description: tool.description, inputSchema: tool.inputSchema };
    }

    case 'invoke_ghl_tool': {
      const target = typeof args.name === 'string' ? args.name : '';
      if (!target) throw new Error('invoke_ghl_tool requires a "name".');
      if (isGatewayTool(target)) {
        throw new Error('Cannot invoke a gateway meta-tool. Pass an operation tool name instead.');
      }
      const targetArgs =
        args.arguments && typeof args.arguments === 'object' && !Array.isArray(args.arguments)
          ? (args.arguments as Record<string, any>)
          : {};
      return dispatchTool(pool, target, targetArgs, enabledTools);
    }

    default:
      throw new Error(`Unknown gateway tool "${name}".`);
  }
}
