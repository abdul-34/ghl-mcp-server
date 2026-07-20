/**
 * GoHighLevel Webhooks Tools
 * Tools for managing webhooks and event subscriptions
 */

import type { GHLToolClient } from './ghl-tool-client.js';

export class WebhooksTools {
  constructor(private ghlClient: GHLToolClient) {}

  getToolDefinitions() {
    return [
      {
        name: 'get_webhooks',
        description: 'Get all webhooks for a location',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' }
          }
        },
        _meta: {
          labels: {
            category: "webhooks",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'get_webhook',
        description: 'Get a specific webhook by ID',
        inputSchema: {
          type: 'object',
          properties: {
            webhookId: { type: 'string', description: 'Webhook ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['webhookId']
        },
        _meta: {
          labels: {
            category: "webhooks",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'create_webhook',
        description: 'Create a new webhook subscription',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            name: { type: 'string', description: 'Webhook name' },
            url: { type: 'string', description: 'Webhook URL to receive events' },
            events: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Events to subscribe to (e.g., contact.created, opportunity.updated)'
            },
            secret: { type: 'string', description: 'Secret key for webhook signature verification' },
          },
          required: ['name', 'url', 'events']
        },
        _meta: {
          labels: {
            category: "webhooks",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'update_webhook',
        description: 'Update a webhook',
        inputSchema: {
          type: 'object',
          properties: {
            webhookId: { type: 'string', description: 'Webhook ID' },
            locationId: { type: 'string', description: 'Location ID' },
            name: { type: 'string', description: 'Webhook name' },
            url: { type: 'string', description: 'Webhook URL' },
            events: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Events to subscribe to'
            },
            active: { type: 'boolean', description: 'Whether webhook is active' },
          },
          required: ['webhookId']
        },
        _meta: {
          labels: {
            category: "webhooks",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'delete_webhook',
        description: 'Delete a webhook',
        inputSchema: {
          type: 'object',
          properties: {
            webhookId: { type: 'string', description: 'Webhook ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['webhookId']
        },
        _meta: {
          labels: {
            category: "webhooks",
            access: "delete",
            complexity: "simple"
          }
        }
      },
      {
        name: 'get_webhook_events',
        description: 'Get list of all available webhook event types',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        _meta: {
          labels: {
            category: "webhooks",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'get_webhook_logs',
        description: 'Get webhook delivery logs/history',
        inputSchema: {
          type: 'object',
          properties: {
            webhookId: { type: 'string', description: 'Webhook ID' },
            locationId: { type: 'string', description: 'Location ID' },
            limit: { type: 'number', description: 'Max results' },
            offset: { type: 'number', description: 'Pagination offset' },
            status: { type: 'string', enum: ['success', 'failed', 'pending'], description: 'Filter by delivery status' },
          },
          required: ['webhookId']
        },
        _meta: {
          labels: {
            category: "webhooks",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'retry_webhook',
        description: 'Retry a failed webhook delivery',
        inputSchema: {
          type: 'object',
          properties: {
            webhookId: { type: 'string', description: 'Webhook ID' },
            logId: { type: 'string', description: 'Webhook log entry ID to retry' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['webhookId', 'logId']
        },
        _meta: {
          labels: {
            category: "webhooks",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'test_webhook',
        description: 'Send a test event to a webhook',
        inputSchema: {
          type: 'object',
          properties: {
            webhookId: { type: 'string', description: 'Webhook ID' },
            locationId: { type: 'string', description: 'Location ID' },
            eventType: { type: 'string', description: 'Event type to test' },
          },
          required: ['webhookId', 'eventType']
        },
        _meta: {
          labels: {
            category: "webhooks",
            access: "read",
            complexity: "simple"
          }
        }
      }
    ];
  }

  async handleToolCall(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const config = this.ghlClient.getConfig();
    const locationId = (args.locationId as string) || config.locationId;

    switch (toolName) {
      case 'get_webhooks': {
        return this.ghlClient.makeRequest('GET', `/webhooks/?locationId=${locationId}`);
      }
      case 'get_webhook': {
        return this.ghlClient.makeRequest('GET', `/webhooks/${args.webhookId}?locationId=${locationId}`);
      }
      case 'create_webhook': {
        return this.ghlClient.makeRequest('POST', `/webhooks/`, {
          locationId,
          name: args.name,
          url: args.url,
          events: args.events,
          secret: args.secret
        });
      }
      case 'update_webhook': {
        const body: Record<string, unknown> = { locationId };
        if (args.name) body.name = args.name;
        if (args.url) body.url = args.url;
        if (args.events) body.events = args.events;
        if (args.active !== undefined) body.active = args.active;
        return this.ghlClient.makeRequest('PUT', `/webhooks/${args.webhookId}`, body);
      }
      case 'delete_webhook': {
        return this.ghlClient.makeRequest('DELETE', `/webhooks/${args.webhookId}?locationId=${locationId}`);
      }
      case 'get_webhook_events': {
        return this.ghlClient.makeRequest('GET', `/webhooks/events`);
      }
      case 'get_webhook_logs': {
        const params = new URLSearchParams();
        params.append('locationId', locationId);
        if (args.limit) params.append('limit', String(args.limit));
        if (args.offset) params.append('offset', String(args.offset));
        if (args.status) params.append('status', String(args.status));
        return this.ghlClient.makeRequest('GET', `/webhooks/${args.webhookId}/logs?${params.toString()}`);
      }
      case 'retry_webhook': {
        return this.ghlClient.makeRequest('POST', `/webhooks/${args.webhookId}/logs/${args.logId}/retry`, { locationId });
      }
      case 'test_webhook': {
        return this.ghlClient.makeRequest('POST', `/webhooks/${args.webhookId}/test`, {
          locationId,
          eventType: args.eventType
        });
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
