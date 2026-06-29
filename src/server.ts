/**
 * CRM MCP server — stdio variant for local use (e.g. Claude Desktop).
 *
 * Credentials, checked in order:
 *   1. Single sub-account (no Supabase):
 *        CRM_PIT_TOKEN     — a CRM Private Integration Token
 *        CRM_LOCATION_ID   — the sub-account id that token belongs to
 *        CRM_LOCATION_NAME — (optional) friendly name
 *   2. A dashboard-generated link (parity with the hosted server):
 *        MCP_LINK_TOKEN + SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ENCRYPTION_KEY
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';

import { CRMClientPool } from './crm/pool.js';
import { resolveLinkToken, loadLocationsForLink } from './db/supabase-store.js';
import { listTools, callTool, toolCount } from './tools/index.js';

dotenv.config();

class CRMMcpServer {
  private server: Server;
  private pool!: CRMClientPool;

  constructor() {
    this.server = new Server(
      { name: 'ghl-mcp-server', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: listTools([]),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        const result = await callTool(this.pool, name, (args as Record<string, any>) || {}, []);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error);
        const code = raw.includes('404') ? ErrorCode.InvalidRequest : ErrorCode.InternalError;
        const safe = raw.replace(/Bearer\s+[^\s"']+/gi, 'Bearer ***').replace(/pit-[a-zA-Z0-9-]+/g, 'pit-***');
        throw new McpError(code, `Tool execution failed: ${safe}`);
      }
    });
  }

  async start(): Promise<void> {
    process.stderr.write('Starting CRM MCP server (stdio)...\n');

    const pitToken = process.env.CRM_PIT_TOKEN?.trim();
    const locationId = process.env.CRM_LOCATION_ID?.trim();
    const linkToken = process.env.MCP_LINK_TOKEN?.trim();

    try {
      if (pitToken && locationId) {
        this.pool = CRMClientPool.fromLocations([
          { locationId, accessToken: pitToken, name: process.env.CRM_LOCATION_NAME?.trim() || undefined },
        ]);
      } else if (linkToken) {
        const link = await resolveLinkToken(linkToken);
        if (!link) throw new Error('MCP_LINK_TOKEN did not match any live link in Supabase.');
        const locations = await loadLocationsForLink(link);
        this.pool = CRMClientPool.fromLocations(locations);
      } else {
        throw new Error(
          'No credentials. Set CRM_PIT_TOKEN + CRM_LOCATION_ID for a single sub-account, ' +
          'or MCP_LINK_TOKEN (+ Supabase env) for a dashboard link.'
        );
      }

      process.stderr.write(`[CRM MCP] Pool ready with ${this.pool.size()} location(s)\n`);
      for (const a of this.pool.listSummaries()) {
        process.stderr.write(`[CRM MCP]   - ${a.locationId}${a.name ? ` (${a.name})` : ''}\n`);
      }

      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      process.stderr.write(`[CRM MCP] Ready. ${toolCount()} tools available.\n`);
    } catch (error) {
      console.error('Failed to start CRM MCP server:', error);
      process.exit(1);
    }
  }
}

function setupGracefulShutdown(): void {
  const shutdown = (signal: string) => {
    process.stderr.write(`[CRM MCP] Received ${signal}, shutting down.\n`);
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

async function main(): Promise<void> {
  setupGracefulShutdown();
  const server = new CRMMcpServer();
  await server.start();
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
