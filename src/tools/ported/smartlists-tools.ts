/**
 * GoHighLevel Smart Lists Tools
 * Tools for managing smart lists (saved contact segments)
 */

import type { GHLToolClient } from './ghl-tool-client.js';

export class SmartListsTools {
  constructor(private ghlClient: GHLToolClient) {}

  getToolDefinitions() {
    return [
      {
        name: 'get_smart_lists',
        description: 'Get all smart lists (saved contact filters/segments)',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            limit: { type: 'number', description: 'Max results' },
            offset: { type: 'number', description: 'Pagination offset' }
          }
        },
        _meta: {
          labels: {
            category: "smartlists",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'get_smart_list',
        description: 'Get a specific smart list by ID',
        inputSchema: {
          type: 'object',
          properties: {
            smartListId: { type: 'string', description: 'Smart List ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['smartListId']
        },
        _meta: {
          labels: {
            category: "smartlists",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'create_smart_list',
        description: 'Create a new smart list with filter criteria',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            name: { type: 'string', description: 'Smart list name' },
            filters: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', description: 'Field to filter on' },
                  operator: { type: 'string', description: 'Comparison operator (equals, contains, etc.)' },
                  value: { type: 'string', description: 'Filter value' }
                },
              },
              description: 'Filter conditions'
            },
            filterOperator: { type: 'string', enum: ['AND', 'OR'], description: 'How to combine filters' }
          },
          required: ['name', 'filters']
        },
        _meta: {
          labels: {
            category: "smartlists",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'update_smart_list',
        description: 'Update a smart list',
        inputSchema: {
          type: 'object',
          properties: {
            smartListId: { type: 'string', description: 'Smart List ID' },
            locationId: { type: 'string', description: 'Location ID' },
            name: { type: 'string', description: 'Smart list name' },
            filters: { type: 'array', description: 'Filter conditions' },
            filterOperator: { type: 'string', enum: ['AND', 'OR'], description: 'How to combine filters' },
          },
          required: ['smartListId']
        },
        _meta: {
          labels: {
            category: "smartlists",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'delete_smart_list',
        description: 'Delete a smart list',
        inputSchema: {
          type: 'object',
          properties: {
            smartListId: { type: 'string', description: 'Smart List ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['smartListId']
        },
        _meta: {
          labels: {
            category: "smartlists",
            access: "delete",
            complexity: "simple"
          }
        }
      },
      {
        name: 'get_smart_list_contacts',
        description: 'Get contacts that match a smart list\'s criteria',
        inputSchema: {
          type: 'object',
          properties: {
            smartListId: { type: 'string', description: 'Smart List ID' },
            locationId: { type: 'string', description: 'Location ID' },
            limit: { type: 'number', description: 'Max results' },
            offset: { type: 'number', description: 'Pagination offset' },
          },
          required: ['smartListId']
        },
        _meta: {
          labels: {
            category: "smartlists",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'get_smart_list_count',
        description: 'Get the count of contacts matching a smart list',
        inputSchema: {
          type: 'object',
          properties: {
            smartListId: { type: 'string', description: 'Smart List ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['smartListId']
        },
        _meta: {
          labels: {
            category: "smartlists",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'duplicate_smart_list',
        description: 'Duplicate/clone a smart list',
        inputSchema: {
          type: 'object',
          properties: {
            smartListId: { type: 'string', description: 'Smart List ID to duplicate' },
            locationId: { type: 'string', description: 'Location ID' },
            name: { type: 'string', description: 'Name for the duplicate' },
          },
          required: ['smartListId']
        },
        _meta: {
          labels: {
            category: "smartlists",
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
      case 'get_smart_lists': {
        const params = new URLSearchParams();
        params.append('locationId', locationId);
        if (args.limit) params.append('limit', String(args.limit));
        if (args.offset) params.append('offset', String(args.offset));
        return this.ghlClient.makeRequest('GET', `/contacts/smart-lists?${params.toString()}`);
      }
      case 'get_smart_list': {
        return this.ghlClient.makeRequest('GET', `/contacts/smart-lists/${args.smartListId}?locationId=${locationId}`);
      }
      case 'create_smart_list': {
        return this.ghlClient.makeRequest('POST', `/contacts/smart-lists`, {
          locationId,
          name: args.name,
          filters: args.filters,
          filterOperator: args.filterOperator || 'AND'
        });
      }
      case 'update_smart_list': {
        const body: Record<string, unknown> = { locationId };
        if (args.name) body.name = args.name;
        if (args.filters) body.filters = args.filters;
        if (args.filterOperator) body.filterOperator = args.filterOperator;
        return this.ghlClient.makeRequest('PUT', `/contacts/smart-lists/${args.smartListId}`, body);
      }
      case 'delete_smart_list': {
        return this.ghlClient.makeRequest('DELETE', `/contacts/smart-lists/${args.smartListId}?locationId=${locationId}`);
      }
      case 'get_smart_list_contacts': {
        const params = new URLSearchParams();
        params.append('locationId', locationId);
        if (args.limit) params.append('limit', String(args.limit));
        if (args.offset) params.append('offset', String(args.offset));
        return this.ghlClient.makeRequest('GET', `/contacts/smart-lists/${args.smartListId}/contacts?${params.toString()}`);
      }
      case 'get_smart_list_count': {
        return this.ghlClient.makeRequest('GET', `/contacts/smart-lists/${args.smartListId}/count?locationId=${locationId}`);
      }
      case 'duplicate_smart_list': {
        return this.ghlClient.makeRequest('POST', `/contacts/smart-lists/${args.smartListId}/duplicate`, {
          locationId,
          name: args.name
        });
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
