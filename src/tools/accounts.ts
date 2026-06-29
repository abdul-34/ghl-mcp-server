/**
 * Account-discovery tools.
 *
 * `list_accounts` and `search_accounts` are special: they operate on the
 * session's CRMClientPool (all sub-accounts the link grants) rather than a
 * single sub-account, so they take no locationId and are dispatched directly
 * by the server with the pool instead of going through a ToolDef handler.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CRMClientPool } from '../crm/pool.js';

export const ACCOUNTS_TOOL_NAMES = ['list_accounts', 'search_accounts'] as const;
export type AccountsToolName = (typeof ACCOUNTS_TOOL_NAMES)[number];

export const accountsToolDefinitions: Tool[] = [
  {
    name: 'list_accounts',
    description:
      'List every CRM sub-account (location) available in this MCP session. ' +
      'Returns { accounts: [{ locationId, name }] }. Call this first to pick which sub-account to act on.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'search_accounts',
    description:
      'Find sub-accounts in this session matching a query (case-insensitive match on locationId or name). ' +
      'Use it to resolve a friendly name like "Acme" into the locationId other tools need.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search string matched against locationId or name. Empty returns all.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
];

export function isAccountsTool(name: string): name is AccountsToolName {
  return (ACCOUNTS_TOOL_NAMES as readonly string[]).includes(name);
}

export function executeAccountsTool(pool: CRMClientPool, name: string, args: Record<string, any>): unknown {
  switch (name) {
    case 'list_accounts':
      return { accounts: pool.listSummaries() };
    case 'search_accounts':
      return { accounts: pool.search(typeof args.query === 'string' ? args.query : '') };
    default:
      throw new Error(`Unknown accounts tool "${name}"`);
  }
}
