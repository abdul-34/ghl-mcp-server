/**
 * CRM MCP HTTP server.
 *
 * Self-hosted, multi-sub-account MCP server. Each request carries a per-link
 * URL token that resolves (via Supabase) to a set of sub-accounts and an
 * allowed tool list. A Streamable HTTP session builds one CRMClientPool from
 * that link and serves the link's tools against it.
 */

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';

import { CRMClientPool } from './crm/pool.js';
import { resolveLinkToken, checkSupabase, touchLinkLastUsed, ResolvedLink } from './db/supabase-store.js';
import { listTools, callTool, toolCount } from './tools/index.js';

dotenv.config();

const SERVER_NAME = 'ghl-mcp-server';
const SERVER_VERSION = '1.0.0';

function isInitializeMessage(body: unknown): boolean {
  if (!body) return false;
  if (Array.isArray(body)) {
    return body.some((m) => m && typeof m === 'object' && (m as { method?: unknown }).method === 'initialize');
  }
  if (typeof body === 'object') return (body as { method?: unknown }).method === 'initialize';
  return false;
}

interface McpSession {
  transport: StreamableHTTPServerTransport;
  pool: CRMClientPool;
  link: ResolvedLink;
}

class CRMMcpHttpServer {
  private app: express.Application;
  private sessions: Record<string, McpSession> = {};
  private port: number;

  constructor() {
    this.port = parseInt(process.env.PORT || process.env.MCP_SERVER_PORT || '8000', 10);
    this.app = express();
    this.setupExpress();
    this.setupRoutes();
  }

  private setupExpress(): void {
    this.app.use(
      cors({
        origin: [
          'https://chatgpt.com',
          'https://chat.openai.com',
          'https://claude.ai',
          'https://claude.com',
          /^http:\/\/localhost(:\d+)?$/,
          /^http:\/\/127\.0\.0\.1(:\d+)?$/,
        ],
        methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'Accept',
          'Mcp-Session-Id',
          'mcp-session-id',
          'Mcp-Protocol-Version',
          'mcp-protocol-version',
          'Last-Event-ID',
        ],
        exposedHeaders: ['Mcp-Session-Id', 'mcp-session-id'],
        credentials: true,
      })
    );

    this.app.use(express.json());

    // Log method + path only — never query strings or bodies (tokens/PII).
    this.app.use((req, _res, next) => {
      console.log(`[HTTP] ${req.method} ${req.path} - ${new Date().toISOString()}`);
      next();
    });
  }

  /** Pull the raw link token from the path, Authorization header, or query. */
  private extractAuthToken(req: express.Request): string | undefined {
    const pathToken = (req.params as Record<string, string | undefined>)?.token;
    if (typeof pathToken === 'string' && pathToken.length > 0) return pathToken;

    const authHeader = req.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length).trim();
    }
    const qp = req.query;
    if (typeof qp.auth_token === 'string') return qp.auth_token;
    if (typeof qp.token === 'string') return qp.token;
    if (typeof qp.auth === 'string') return qp.auth;
    return undefined;
  }

  /** Resolve the link token against Supabase and stash it on res.locals.link. */
  private requireAuth: express.RequestHandler = async (req, res, next) => {
    const provided = this.extractAuthToken(req);
    if (!provided) {
      res.status(401).json({
        error: 'Missing token. Use a link URL like `/mcp/<token>`, or `Authorization: Bearer <token>`.',
      });
      return;
    }
    try {
      const link = await resolveLinkToken(provided);
      if (!link) {
        res.status(401).json({ error: 'Invalid or revoked link token.' });
        return;
      }
      res.locals.link = link;
      next();
    } catch (err) {
      console.error('[AUTH] Supabase lookup failed', err);
      res.status(500).json({ error: 'Auth lookup failed.' });
    }
  };

  /** Build a fresh MCP Server bound to one session's pool + link. */
  private buildMcpServer(pool: CRMClientPool, link: ResolvedLink): Server {
    const server = new Server(
      { name: SERVER_NAME, version: SERVER_VERSION },
      { capabilities: { tools: {} } }
    );
    const enabledTools = link.enabledTools || [];

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: listTools(enabledTools),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        const result = await callTool(pool, name, (args as Record<string, any>) || {}, enabledTools);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error);
        const safe = raw.replace(/Bearer\s+[^\s"']+/gi, 'Bearer ***').replace(/pit-[a-zA-Z0-9-]+/g, 'pit-***');
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${safe}`);
      }
    });

    return server;
  }

  private setupRoutes(): void {
    this.app.get('/health', (_req, res) => {
      res.json({
        status: 'healthy',
        server: SERVER_NAME,
        version: SERVER_VERSION,
        timestamp: new Date().toISOString(),
        tools: toolCount(),
      });
    });

    this.app.get('/tools', this.requireAuth, (req, res) => {
      const link = res.locals.link as ResolvedLink | undefined;
      const tools = listTools(link?.enabledTools || []);
      res.json({ tools, count: tools.length });
    });

    const handleMcpPost = async (req: express.Request, res: express.Response) => {
      try {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && this.sessions[sessionId]) {
          transport = this.sessions[sessionId].transport;
        } else if (!sessionId && isInitializeMessage(req.body)) {
          const link = res.locals.link as ResolvedLink | undefined;
          if (!link) {
            res.status(500).json({
              jsonrpc: '2.0',
              error: { code: -32603, message: 'Auth context lost.' },
              id: null,
            });
            return;
          }

          let pool: CRMClientPool;
          try {
            pool = await CRMClientPool.fromLink(link);
          } catch (err) {
            res.status(503).json({
              jsonrpc: '2.0',
              error: {
                code: -32000,
                message: err instanceof Error ? err.message : 'Could not build the CRM client pool.',
              },
              id: (req.body && typeof req.body === 'object' ? (req.body as { id?: unknown }).id : null) ?? null,
            });
            return;
          }

          const newTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (newId: string) => {
              console.log(
                `[CRM MCP] session ${newId} (link=${link.linkId}, scope=${link.scope}, locations=${pool.size()})`
              );
              this.sessions[newId] = { transport: newTransport, pool, link };
              void touchLinkLastUsed(link.linkId);
            },
          });

          newTransport.onclose = () => {
            const sid = newTransport.sessionId;
            if (sid && this.sessions[sid]) delete this.sessions[sid];
          };

          const server = this.buildMcpServer(pool, link);
          await server.connect(newTransport);
          transport = newTransport;
        } else {
          res.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'No valid session id and not an initialize request.' },
            id: (req.body && typeof req.body === 'object' ? (req.body as { id?: unknown }).id : null) ?? null,
          });
          return;
        }

        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error('[CRM MCP] POST error:', error);
        if (!res.headersSent) {
          res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
        }
      }
    };

    const handleMcpSessionRequest = async (req: express.Request, res: express.Response) => {
      try {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !this.sessions[sessionId]) {
          res.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Invalid or missing Mcp-Session-Id header' },
            id: null,
          });
          return;
        }
        await this.sessions[sessionId].transport.handleRequest(req, res);
      } catch (error) {
        console.error('[CRM MCP] session request error:', error);
        if (!res.headersSent) {
          res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
        }
      }
    };

    // /mcp/<token> and /sse/<token> are the canonical per-link URLs; the bare
    // /mcp and /sse paths read the token from a header/query instead.
    for (const mcpPath of ['/mcp', '/sse']) {
      this.app.post(mcpPath, this.requireAuth, handleMcpPost);
      this.app.get(mcpPath, this.requireAuth, handleMcpSessionRequest);
      this.app.delete(mcpPath, this.requireAuth, handleMcpSessionRequest);

      this.app.post(`${mcpPath}/:token`, this.requireAuth, handleMcpPost);
      this.app.get(`${mcpPath}/:token`, this.requireAuth, handleMcpSessionRequest);
      this.app.delete(`${mcpPath}/:token`, this.requireAuth, handleMcpSessionRequest);
    }

    this.app.get('/', this.requireAuth, (_req, res) => {
      res.json({
        name: 'CRM MCP Server',
        version: SERVER_VERSION,
        status: 'running',
        endpoints: { health: '/health', tools: '/tools', mcp: '/mcp/:token', sse: '/sse/:token' },
        transport: 'streamable-http',
        tools: toolCount(),
      });
    });
  }

  async start(): Promise<void> {
    console.log('Starting CRM MCP HTTP server...');

    const missing: string[] = [];
    if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!process.env.ENCRYPTION_KEY) missing.push('ENCRYPTION_KEY');
    if (missing.length) {
      console.error(
        `Missing required env var(s): ${missing.join(', ')}. ` +
        'The server reads links + encrypted sub-account tokens from Supabase; ' +
        'ENCRYPTION_KEY must match the dashboard.'
      );
      process.exit(1);
    }

    try {
      const ok = await checkSupabase();
      console.log(ok ? '[CRM MCP] Supabase reachable.' : '[CRM MCP] WARNING: Supabase probe failed.');

      this.app.listen(this.port, '0.0.0.0', () => {
        console.log(`CRM MCP HTTP server on http://0.0.0.0:${this.port}`);
        console.log(`MCP endpoint: /mcp/<link-token> (alias: /sse/<link-token>)`);
        console.log(`Tools available: ${toolCount()}`);
      });
    } catch (error) {
      console.error('Failed to start CRM MCP HTTP server:', error);
      process.exit(1);
    }
  }
}

function setupGracefulShutdown(): void {
  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down.`);
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

async function main(): Promise<void> {
  setupGracefulShutdown();
  const server = new CRMMcpHttpServer();
  await server.start();
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
