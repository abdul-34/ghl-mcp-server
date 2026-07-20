/**
 * GoHighLevel Templates Tools
 * Tools for managing SMS, Email, and other message templates
 */

import type { GHLToolClient } from './ghl-tool-client.js';

export class TemplatesTools {
  constructor(private ghlClient: GHLToolClient) {}

  getToolDefinitions() {
    return [
      // SMS Templates
      {
        name: 'get_sms_templates',
        description: 'Get all SMS templates',
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
            category: "templates",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'get_sms_template',
        description: 'Get a specific SMS template',
        inputSchema: {
          type: 'object',
          properties: {
            templateId: { type: 'string', description: 'SMS Template ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['templateId']
        },
        _meta: {
          labels: {
            category: "templates",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'create_sms_template',
        description: 'Create a new SMS template',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            name: { type: 'string', description: 'Template name' },
            body: { type: 'string', description: 'SMS message body (can include merge fields like {{contact.first_name}})' },
          },
          required: ['name', 'body']
        },
        _meta: {
          labels: {
            category: "templates",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'update_sms_template',
        description: 'Update an SMS template',
        inputSchema: {
          type: 'object',
          properties: {
            templateId: { type: 'string', description: 'SMS Template ID' },
            locationId: { type: 'string', description: 'Location ID' },
            name: { type: 'string', description: 'Template name' },
            body: { type: 'string', description: 'SMS message body' },
          },
          required: ['templateId']
        },
        _meta: {
          labels: {
            category: "templates",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'delete_sms_template',
        description: 'Delete an SMS template',
        inputSchema: {
          type: 'object',
          properties: {
            templateId: { type: 'string', description: 'SMS Template ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['templateId']
        },
        _meta: {
          labels: {
            category: "templates",
            access: "delete",
            complexity: "simple"
          }
        }
      },

      // Voicemail Drop Templates
      {
        name: 'get_voicemail_templates',
        description: 'Get all voicemail drop templates',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' }
          }
        },
        _meta: {
          labels: {
            category: "templates",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'create_voicemail_template',
        description: 'Create a voicemail drop template',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            name: { type: 'string', description: 'Template name' },
            audioUrl: { type: 'string', description: 'URL to audio file' },
          },
          required: ['name', 'audioUrl']
        },
        _meta: {
          labels: {
            category: "templates",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'delete_voicemail_template',
        description: 'Delete a voicemail template',
        inputSchema: {
          type: 'object',
          properties: {
            templateId: { type: 'string', description: 'Template ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['templateId']
        },
        _meta: {
          labels: {
            category: "templates",
            access: "delete",
            complexity: "simple"
          }
        }
      },

      // Social Templates
      {
        name: 'get_social_templates',
        description: 'Get social media post templates',
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
            category: "templates",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'create_social_template',
        description: 'Create a social media post template',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            name: { type: 'string', description: 'Template name' },
            content: { type: 'string', description: 'Post content' },
            mediaUrls: { type: 'array', items: { type: 'string' }, description: 'Media URLs' },
            platforms: { type: 'array', items: { type: 'string' }, description: 'Target platforms' },
          },
          required: ['name', 'content']
        },
        _meta: {
          labels: {
            category: "templates",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'delete_social_template',
        description: 'Delete a social template',
        inputSchema: {
          type: 'object',
          properties: {
            templateId: { type: 'string', description: 'Template ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['templateId']
        },
        _meta: {
          labels: {
            category: "templates",
            access: "delete",
            complexity: "simple"
          }
        }
      },

      // WhatsApp Templates
      {
        name: 'get_whatsapp_templates',
        description: 'Get WhatsApp message templates (must be pre-approved)',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            status: { type: 'string', enum: ['approved', 'pending', 'rejected', 'all'], description: 'Template status' }
          }
        },
        _meta: {
          labels: {
            category: "templates",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'create_whatsapp_template',
        description: 'Create a WhatsApp template (submits for approval)',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            name: { type: 'string', description: 'Template name' },
            category: { type: 'string', enum: ['marketing', 'utility', 'authentication'], description: 'Template category' },
            language: { type: 'string', description: 'Language code (e.g., en_US)' },
            components: { type: 'array', description: 'Template components (header, body, footer, buttons)' },
          },
          required: ['name', 'category', 'language', 'components']
        },
        _meta: {
          labels: {
            category: "templates",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'delete_whatsapp_template',
        description: 'Delete a WhatsApp template',
        inputSchema: {
          type: 'object',
          properties: {
            templateId: { type: 'string', description: 'Template ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['templateId']
        },
        _meta: {
          labels: {
            category: "templates",
            access: "delete",
            complexity: "simple"
          }
        }
      },

      // Snippet/Canned Response Templates
      {
        name: 'get_snippets',
        description: 'Get canned response snippets',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            type: { type: 'string', enum: ['sms', 'email', 'all'], description: 'Snippet type' }
          }
        },
        _meta: {
          labels: {
            category: "templates",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'create_snippet',
        description: 'Create a canned response snippet',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            name: { type: 'string', description: 'Snippet name' },
            shortcut: { type: 'string', description: 'Keyboard shortcut (e.g., /thanks)' },
            content: { type: 'string', description: 'Snippet content' },
            type: { type: 'string', enum: ['sms', 'email', 'both'], description: 'Snippet type' },
          },
          required: ['name', 'content']
        },
        _meta: {
          labels: {
            category: "templates",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'update_snippet',
        description: 'Update a snippet',
        inputSchema: {
          type: 'object',
          properties: {
            snippetId: { type: 'string', description: 'Snippet ID' },
            locationId: { type: 'string', description: 'Location ID' },
            name: { type: 'string', description: 'Snippet name' },
            shortcut: { type: 'string', description: 'Keyboard shortcut' },
            content: { type: 'string', description: 'Snippet content' },
          },
          required: ['snippetId']
        },
        _meta: {
          labels: {
            category: "templates",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'delete_snippet',
        description: 'Delete a snippet',
        inputSchema: {
          type: 'object',
          properties: {
            snippetId: { type: 'string', description: 'Snippet ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['snippetId']
        },
        _meta: {
          labels: {
            category: "templates",
            access: "delete",
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
      // SMS Templates
      case 'get_sms_templates': {
        const params = new URLSearchParams();
        params.append('locationId', locationId);
        if (args.limit) params.append('limit', String(args.limit));
        if (args.offset) params.append('offset', String(args.offset));
        return this.ghlClient.makeRequest('GET', `/templates/sms?${params.toString()}`);
      }
      case 'get_sms_template': {
        return this.ghlClient.makeRequest('GET', `/templates/sms/${args.templateId}?locationId=${locationId}`);
      }
      case 'create_sms_template': {
        return this.ghlClient.makeRequest('POST', `/templates/sms`, {
          locationId,
          name: args.name,
          body: args.body
        });
      }
      case 'update_sms_template': {
        const body: Record<string, unknown> = { locationId };
        if (args.name) body.name = args.name;
        if (args.body) body.body = args.body;
        return this.ghlClient.makeRequest('PUT', `/templates/sms/${args.templateId}`, body);
      }
      case 'delete_sms_template': {
        return this.ghlClient.makeRequest('DELETE', `/templates/sms/${args.templateId}?locationId=${locationId}`);
      }

      // Voicemail Templates
      case 'get_voicemail_templates': {
        return this.ghlClient.makeRequest('GET', `/templates/voicemail?locationId=${locationId}`);
      }
      case 'create_voicemail_template': {
        return this.ghlClient.makeRequest('POST', `/templates/voicemail`, {
          locationId,
          name: args.name,
          audioUrl: args.audioUrl
        });
      }
      case 'delete_voicemail_template': {
        return this.ghlClient.makeRequest('DELETE', `/templates/voicemail/${args.templateId}?locationId=${locationId}`);
      }

      // Social Templates
      case 'get_social_templates': {
        const params = new URLSearchParams();
        params.append('locationId', locationId);
        if (args.limit) params.append('limit', String(args.limit));
        if (args.offset) params.append('offset', String(args.offset));
        return this.ghlClient.makeRequest('GET', `/templates/social?${params.toString()}`);
      }
      case 'create_social_template': {
        return this.ghlClient.makeRequest('POST', `/templates/social`, {
          locationId,
          name: args.name,
          content: args.content,
          mediaUrls: args.mediaUrls,
          platforms: args.platforms
        });
      }
      case 'delete_social_template': {
        return this.ghlClient.makeRequest('DELETE', `/templates/social/${args.templateId}?locationId=${locationId}`);
      }

      // WhatsApp Templates
      case 'get_whatsapp_templates': {
        const params = new URLSearchParams();
        params.append('locationId', locationId);
        if (args.status) params.append('status', String(args.status));
        return this.ghlClient.makeRequest('GET', `/templates/whatsapp?${params.toString()}`);
      }
      case 'create_whatsapp_template': {
        return this.ghlClient.makeRequest('POST', `/templates/whatsapp`, {
          locationId,
          name: args.name,
          category: args.category,
          language: args.language,
          components: args.components
        });
      }
      case 'delete_whatsapp_template': {
        return this.ghlClient.makeRequest('DELETE', `/templates/whatsapp/${args.templateId}?locationId=${locationId}`);
      }

      // Snippets
      case 'get_snippets': {
        const params = new URLSearchParams();
        params.append('locationId', locationId);
        if (args.type) params.append('type', String(args.type));
        return this.ghlClient.makeRequest('GET', `/templates/snippets?${params.toString()}`);
      }
      case 'create_snippet': {
        return this.ghlClient.makeRequest('POST', `/templates/snippets`, {
          locationId,
          name: args.name,
          shortcut: args.shortcut,
          content: args.content,
          type: args.type
        });
      }
      case 'update_snippet': {
        const body: Record<string, unknown> = { locationId };
        if (args.name) body.name = args.name;
        if (args.shortcut) body.shortcut = args.shortcut;
        if (args.content) body.content = args.content;
        return this.ghlClient.makeRequest('PUT', `/templates/snippets/${args.snippetId}`, body);
      }
      case 'delete_snippet': {
        return this.ghlClient.makeRequest('DELETE', `/templates/snippets/${args.snippetId}?locationId=${locationId}`);
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
