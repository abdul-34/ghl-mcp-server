/**
 * Ported tool categories (additive).
 *
 * Tool classes from Go-High-Level-MCP-2026 that use the generic
 * makeRequest/getConfig contract are bridged into the target's ToolDef shape.
 * Each runs against a per-sub-account CRMClient via GHLToolAdapter, so they are
 * fully dynamic (no env / global config). These extend the generated public-API
 * tools and never replace them — the registry's duplicate-name guard enforces
 * that at load time.
 *
 * Categories: reputation, reporting, templates, voice AI, smart lists,
 * webhooks, triggers, notes, users, phone.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CRMClient } from '../../crm/client.js';
import { ToolDef, locationIdProp } from '../types.js';
import { GHLToolAdapter } from './ghl-adapter.js';

import { ReputationTools } from './reputation-tools.js';
import { ReportingTools } from './reporting-tools.js';
import { TemplatesTools } from './templates-tools.js';
import { VoiceAITools } from './voice-ai-tools.js';
import { SmartListsTools } from './smartlists-tools.js';
import { WebhooksTools } from './webhooks-tools.js';
import { TriggersTools } from './triggers-tools.js';
import { NotesTools } from './notes-tools.js';
import { UsersTools } from './users-tools.js';
import { PhoneTools } from './phone-tools.js';

/**
 * Minimal shape shared by every ported tool class. getToolDefinitions is typed
 * loosely (any[]) because the source schemas infer `type: string` rather than
 * the SDK's `"object"` literal; ensureLocationId normalizes them to Tool.
 */
interface SourceToolClass {
  getToolDefinitions(): any[];
  handleToolCall(name: string, args: Record<string, any>): Promise<unknown>;
}

type ClassCtor = new (client: GHLToolAdapter) => SourceToolClass;

/** Ensure a source tool schema requires locationId (callTool needs it). */
function ensureLocationId(raw: any): Tool {
  const schema: any = raw.inputSchema ? { ...raw.inputSchema } : { type: 'object' };
  const properties = { ...(schema.properties || {}) };
  if (!properties.locationId) properties.locationId = locationIdProp;
  const required = Array.from(new Set(['locationId', ...((schema.required as string[]) || [])]));
  return { ...raw, inputSchema: { ...schema, type: 'object', properties, required } } as Tool;
}

/**
 * Bridge one source tool class into ToolDefs. Definitions are read once (they
 * don't touch the client); each call binds a fresh, sub-account-scoped adapter.
 */
function bridge(Klass: ClassCtor): ToolDef[] {
  // getToolDefinitions never uses the client, so a null adapter is safe here.
  const defs = new Klass(null as unknown as GHLToolAdapter).getToolDefinitions();
  return defs.map((raw) => {
    const tool = ensureLocationId(raw);
    return {
      tool,
      handler: (client: CRMClient, args: Record<string, any>) =>
        new Klass(new GHLToolAdapter(client)).handleToolCall(tool.name, args),
    };
  });
}

export const portedTools: ToolDef[] = [
  ...bridge(ReputationTools),
  ...bridge(ReportingTools),
  ...bridge(TemplatesTools),
  ...bridge(VoiceAITools),
  ...bridge(SmartListsTools),
  ...bridge(WebhooksTools),
  ...bridge(TriggersTools),
  ...bridge(NotesTools),
  ...bridge(UsersTools),
  ...bridge(PhoneTools),
];
