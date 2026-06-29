/**
 * Per-link tool filtering.
 *
 * Each MCP link stores an `enabled_tools` whitelist. We use it to control
 * which tools a given client URL exposes:
 *
 *   - empty list  → expose ALL tools (the agency hasn't restricted this link).
 *   - non-empty   → expose ONLY the listed tools.
 *
 * The account-discovery tools (`list_accounts`, `search_accounts`) are ALWAYS
 * available so the LLM can resolve a locationId regardless of the whitelist.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ACCOUNTS_TOOL_NAMES } from './accounts.js';

const ALWAYS_ALLOWED = new Set<string>(ACCOUNTS_TOOL_NAMES);

/** True if `toolName` may be used given the link's `enabledTools` whitelist. */
export function isToolAllowed(toolName: string, enabledTools: string[]): boolean {
  if (ALWAYS_ALLOWED.has(toolName)) return true;
  if (!enabledTools || enabledTools.length === 0) return true;
  return enabledTools.includes(toolName);
}

/** Filter a tool-definition list down to what the link is allowed to expose. */
export function filterToolsByEnabled(tools: Tool[], enabledTools: string[]): Tool[] {
  if (!enabledTools || enabledTools.length === 0) return tools;
  return tools.filter((t) => isToolAllowed(t.name, enabledTools));
}
