/**
 * GoHighLevel Triggers Tools
 * Tools for managing automation triggers
 */

import type { GHLToolClient } from './ghl-tool-client.js';

export class TriggersTools {
  constructor(private ghlClient: GHLToolClient) {}

  getToolDefinitions() {
    return [
      {
        name: 'get_triggers',
        description: 'Get all automation triggers for a location',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            type: { type: 'string', description: 'Filter by trigger type' },
            status: { type: 'string', enum: ['active', 'inactive', 'all'], description: 'Status filter' },
            limit: { type: 'number', description: 'Max results' },
            offset: { type: 'number', description: 'Pagination offset' }
          }
        },
        _meta: {
          labels: {
            category: "triggers",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'get_trigger',
        description: 'Get a specific trigger by ID',
        inputSchema: {
          type: 'object',
          properties: {
            triggerId: { type: 'string', description: 'Trigger ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['triggerId']
        },
        _meta: {
          labels: {
            category: "triggers",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'create_trigger',
        description: 'Create a new automation trigger',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            name: { type: 'string', description: 'Trigger name' },
            type: {
              type: 'string',
              enum: [
                'contact_created', 'contact_tag_added', 'contact_tag_removed',
                'form_submitted', 'appointment_booked', 'appointment_cancelled',
                'opportunity_created', 'opportunity_status_changed', 'opportunity_stage_changed',
                'invoice_paid', 'order_placed', 'call_completed', 'email_opened',
                'email_clicked', 'sms_received', 'webhook'
              ],
              description: 'Trigger type/event'
            },
            filters: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', description: 'Field to filter' },
                  operator: { type: 'string', description: 'Comparison operator' },
                  value: { type: 'string', description: 'Filter value' }
                },
              },
              description: 'Conditions that must be met'
            },
            actions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', description: 'Action type' },
                  config: { type: 'object', description: 'Action configuration' }
                }
              },
              description: 'Actions to perform when triggered'
            }
          },
          required: ['name', 'type']
        },
        _meta: {
          labels: {
            category: "triggers",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'update_trigger',
        description: 'Update an existing trigger',
        inputSchema: {
          type: 'object',
          properties: {
            triggerId: { type: 'string', description: 'Trigger ID' },
            locationId: { type: 'string', description: 'Location ID' },
            name: { type: 'string', description: 'Trigger name' },
            filters: { type: 'array', description: 'Filter conditions' },
            actions: { type: 'array', description: 'Actions to perform' },
            status: { type: 'string', enum: ['active', 'inactive'], description: 'Trigger status' },
          },
          required: ['triggerId']
        },
        _meta: {
          labels: {
            category: "triggers",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'delete_trigger',
        description: 'Delete a trigger',
        inputSchema: {
          type: 'object',
          properties: {
            triggerId: { type: 'string', description: 'Trigger ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['triggerId']
        },
        _meta: {
          labels: {
            category: "triggers",
            access: "delete",
            complexity: "simple"
          }
        }
      },
      {
        name: 'enable_trigger',
        description: 'Enable/activate a trigger',
        inputSchema: {
          type: 'object',
          properties: {
            triggerId: { type: 'string', description: 'Trigger ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['triggerId']
        },
        _meta: {
          labels: {
            category: "triggers",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'disable_trigger',
        description: 'Disable/deactivate a trigger',
        inputSchema: {
          type: 'object',
          properties: {
            triggerId: { type: 'string', description: 'Trigger ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['triggerId']
        },
        _meta: {
          labels: {
            category: "triggers",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'get_trigger_types',
        description: 'Get all available trigger types and their configurations',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' }
          }
        },
        _meta: {
          labels: {
            category: "triggers",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'get_trigger_logs',
        description: 'Get execution logs for a trigger',
        inputSchema: {
          type: 'object',
          properties: {
            triggerId: { type: 'string', description: 'Trigger ID' },
            locationId: { type: 'string', description: 'Location ID' },
            status: { type: 'string', enum: ['success', 'failed', 'all'], description: 'Execution status filter' },
            startDate: { type: 'string', description: 'Start date' },
            endDate: { type: 'string', description: 'End date' },
            limit: { type: 'number', description: 'Max results' },
            offset: { type: 'number', description: 'Pagination offset' },
          },
          required: ['triggerId']
        },
        _meta: {
          labels: {
            category: "triggers",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'test_trigger',
        description: 'Test a trigger with sample data',
        inputSchema: {
          type: 'object',
          properties: {
            triggerId: { type: 'string', description: 'Trigger ID' },
            locationId: { type: 'string', description: 'Location ID' },
            testData: { type: 'object', description: 'Sample data to test with' },
          },
          required: ['triggerId']
        },
        _meta: {
          labels: {
            category: "triggers",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'duplicate_trigger',
        description: 'Duplicate/clone a trigger',
        inputSchema: {
          type: 'object',
          properties: {
            triggerId: { type: 'string', description: 'Trigger ID to duplicate' },
            locationId: { type: 'string', description: 'Location ID' },
            name: { type: 'string', description: 'Name for the duplicate' },
          },
          required: ['triggerId']
        },
        _meta: {
          labels: {
            category: "triggers",
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
      case 'get_triggers': {
        const params = new URLSearchParams();
        params.append('locationId', locationId);
        if (args.type) params.append('type', String(args.type));
        if (args.status) params.append('status', String(args.status));
        if (args.limit) params.append('limit', String(args.limit));
        if (args.offset) params.append('offset', String(args.offset));
        return this.ghlClient.makeRequest('GET', `/triggers/?${params.toString()}`);
      }
      case 'get_trigger': {
        return this.ghlClient.makeRequest('GET', `/triggers/${args.triggerId}?locationId=${locationId}`);
      }
      case 'create_trigger': {
        return this.ghlClient.makeRequest('POST', `/triggers/`, {
          locationId,
          name: args.name,
          type: args.type,
          filters: args.filters,
          actions: args.actions
        });
      }
      case 'update_trigger': {
        const body: Record<string, unknown> = { locationId };
        if (args.name) body.name = args.name;
        if (args.filters) body.filters = args.filters;
        if (args.actions) body.actions = args.actions;
        if (args.status) body.status = args.status;
        return this.ghlClient.makeRequest('PUT', `/triggers/${args.triggerId}`, body);
      }
      case 'delete_trigger': {
        return this.ghlClient.makeRequest('DELETE', `/triggers/${args.triggerId}?locationId=${locationId}`);
      }
      case 'enable_trigger': {
        return this.ghlClient.makeRequest('POST', `/triggers/${args.triggerId}/enable`, { locationId });
      }
      case 'disable_trigger': {
        return this.ghlClient.makeRequest('POST', `/triggers/${args.triggerId}/disable`, { locationId });
      }
      case 'get_trigger_types': {
        return this.ghlClient.makeRequest('GET', `/triggers/types?locationId=${locationId}`);
      }
      case 'get_trigger_logs': {
        const params = new URLSearchParams();
        params.append('locationId', locationId);
        if (args.status) params.append('status', String(args.status));
        if (args.startDate) params.append('startDate', String(args.startDate));
        if (args.endDate) params.append('endDate', String(args.endDate));
        if (args.limit) params.append('limit', String(args.limit));
        if (args.offset) params.append('offset', String(args.offset));
        return this.ghlClient.makeRequest('GET', `/triggers/${args.triggerId}/logs?${params.toString()}`);
      }
      case 'test_trigger': {
        return this.ghlClient.makeRequest('POST', `/triggers/${args.triggerId}/test`, {
          locationId,
          testData: args.testData
        });
      }
      case 'duplicate_trigger': {
        return this.ghlClient.makeRequest('POST', `/triggers/${args.triggerId}/duplicate`, {
          locationId,
          name: args.name
        });
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
