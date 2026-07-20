/**
 * Tool gateway (search → invoke).
 *
 * With ~700 tools, shipping every schema on every request wastes context and
 * hurts tool-selection accuracy. In "gateway mode" a link exposes only these
 * three meta-tools instead; the model searches for what it needs, fetches one
 * schema, then invokes it. The full registry stays reachable behind them.
 *
 * Like the account tools, these are pool-level and dispatched specially in
 * callTool (they take no locationId of their own — for invoke_ghl_tool the
 * locationId lives inside `arguments`). Search/schema/invoke all respect the
 * link's enabled-tools whitelist, so a scoped link only ever sees its subset.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const GATEWAY_TOOL_NAMES = ['search_ghl_tools', 'get_ghl_tool_schema', 'invoke_ghl_tool'] as const;
export type GatewayToolName = (typeof GATEWAY_TOOL_NAMES)[number];

export function isGatewayTool(name: string): name is GatewayToolName {
  return (GATEWAY_TOOL_NAMES as readonly string[]).includes(name);
}

export const gatewayToolDefinitions: Tool[] = [
  {
    name: 'search_ghl_tools',
    description:
      'Find the GHL/CRM tools relevant to a task. Returns a slim list of { name, category, description } — ' +
      'NOT full schemas. This server exposes hundreds of tools behind this gateway; search for the operation ' +
      'you need (e.g. "create contact", "send sms", "publish workflow", "get reviews"), then call ' +
      'get_ghl_tool_schema for the exact input schema, then invoke_ghl_tool to run it. ' +
      'Call list_accounts first if you still need a locationId.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'What you want to do, in plain words. Matched against tool names, categories, and descriptions.',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 15, max 50).',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_ghl_tool_schema',
    description:
      'Return the full input schema for one tool by exact name (from search_ghl_tools results). ' +
      'Read this before calling invoke_ghl_tool so you pass the right arguments.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Exact tool name, e.g. "contacts_create_contact".' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'invoke_ghl_tool',
    description:
      'Run a tool by exact name with its arguments. `arguments` must match the schema from get_ghl_tool_schema, ' +
      'including a "locationId" for any sub-account operation (use list_accounts to find one). ' +
      'Returns that tool\'s result directly.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Exact tool name to run, e.g. "contacts_create_contact".' },
        arguments: {
          type: 'object',
          description: 'The arguments object for that tool (as described by its schema). Include locationId when required.',
          additionalProperties: true,
        },
      },
      required: ['name', 'arguments'],
      additionalProperties: false,
    },
  },
];

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface ToolIndexEntry {
  name: string;
  category: string;
  description: string;
}

export interface ToolSearchHit {
  name: string;
  category: string;
  description: string;
  score: number;
}

/** Group label for a tool: the name prefix before the first underscore. */
export function categoryOf(name: string): string {
  const i = name.indexOf('_');
  return i > 0 ? name.slice(0, i) : name;
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function truncate(text: string, max = 180): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Rank the tool index against a free-text query; returns the top `limit` hits. */
export function searchTools(index: ToolIndexEntry[], query: string, limit: number): ToolSearchHit[] {
  const q = query.trim().toLowerCase();
  const tokens = tokenize(query);
  const cap = Math.min(Math.max(Math.floor(limit) || 15, 1), 50);

  const hits: ToolSearchHit[] = [];
  for (const entry of index) {
    const name = entry.name.toLowerCase();
    const category = entry.category.toLowerCase();
    const description = entry.description.toLowerCase();
    const haystack = `${name} ${category} ${description}`;

    let score = 0;
    if (q) {
      if (name === q) score += 1000;
      if (name.includes(q)) score += 300;
      if (category === q) score += 200;
      if (description.includes(q)) score += 120;
      for (const token of tokens) {
        if (name.includes(token)) score += 60;
        if (category.includes(token)) score += 30;
        if (description.includes(token)) score += 12;
      }
    } else {
      score = 1; // empty query → return an arbitrary slice
    }

    if (score > 0) {
      hits.push({ name: entry.name, category: entry.category, description: truncate(entry.description), score });
    }
  }

  hits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return hits.slice(0, cap);
}
