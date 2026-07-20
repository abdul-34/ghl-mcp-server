/**
 * GoHighLevel Phone System Tools
 * Tools for managing phone numbers, call settings, and IVR
 */

import type { GHLToolClient } from './ghl-tool-client.js';

export class PhoneTools {
  constructor(private ghlClient: GHLToolClient) {}

  getToolDefinitions() {
    return [
      // Phone Numbers
      {
        name: 'get_phone_numbers',
        description: 'Get all phone numbers for a location',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' }
          }
        },
        _meta: {
          labels: {
            category: "phone-numbers",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'get_phone_number',
        description: 'Get a specific phone number by ID',
        inputSchema: {
          type: 'object',
          properties: {
            phoneNumberId: { type: 'string', description: 'Phone Number ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['phoneNumberId']
        },
        _meta: {
          labels: {
            category: "phone-numbers",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'search_available_numbers',
        description: 'Search for available phone numbers to purchase',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            country: { type: 'string', description: 'Country code (e.g., US, CA)' },
            areaCode: { type: 'string', description: 'Area code to search' },
            contains: { type: 'string', description: 'Number pattern to search for' },
            type: { type: 'string', enum: ['local', 'tollfree', 'mobile'], description: 'Number type' },
          },
          required: ['country']
        },
        _meta: {
          labels: {
            category: "phone-numbers",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'purchase_phone_number',
        description: 'Purchase a phone number',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            phoneNumber: { type: 'string', description: 'Phone number to purchase' },
            name: { type: 'string', description: 'Friendly name for the number' },
          },
          required: ['phoneNumber']
        },
        _meta: {
          labels: {
            category: "phone-numbers",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'update_phone_number',
        description: 'Update phone number settings',
        inputSchema: {
          type: 'object',
          properties: {
            phoneNumberId: { type: 'string', description: 'Phone Number ID' },
            locationId: { type: 'string', description: 'Location ID' },
            name: { type: 'string', description: 'Friendly name' },
            forwardingNumber: { type: 'string', description: 'Number to forward calls to' },
            callRecording: { type: 'boolean', description: 'Enable call recording' },
            whisperMessage: { type: 'string', description: 'Whisper message played to agent' },
          },
          required: ['phoneNumberId']
        },
        _meta: {
          labels: {
            category: "phone-numbers",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'release_phone_number',
        description: 'Release/delete a phone number',
        inputSchema: {
          type: 'object',
          properties: {
            phoneNumberId: { type: 'string', description: 'Phone Number ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['phoneNumberId']
        },
        _meta: {
          labels: {
            category: "phone-numbers",
            access: "read",
            complexity: "simple"
          }
        }
      },

      // Call Forwarding
      {
        name: 'get_call_forwarding_settings',
        description: 'Get call forwarding configuration',
        inputSchema: {
          type: 'object',
          properties: {
            phoneNumberId: { type: 'string', description: 'Phone Number ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['phoneNumberId']
        },
        _meta: {
          labels: {
            category: "phone-numbers",
            access: "write",
            complexity: "batch"
          }
        }
      },
      {
        name: 'update_call_forwarding',
        description: 'Update call forwarding settings',
        inputSchema: {
          type: 'object',
          properties: {
            phoneNumberId: { type: 'string', description: 'Phone Number ID' },
            locationId: { type: 'string', description: 'Location ID' },
            enabled: { type: 'boolean', description: 'Enable forwarding' },
            forwardTo: { type: 'string', description: 'Number to forward to' },
            ringTimeout: { type: 'number', description: 'Ring timeout in seconds' },
            voicemailEnabled: { type: 'boolean', description: 'Enable voicemail on no answer' },
          },
          required: ['phoneNumberId']
        },
        _meta: {
          labels: {
            category: "phone-numbers",
            access: "write",
            complexity: "batch"
          }
        }
      },

      // IVR/Call Menu
      {
        name: 'get_ivr_menus',
        description: 'Get all IVR/call menus',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' }
          }
        },
        _meta: {
          labels: {
            category: "phone-numbers",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'create_ivr_menu',
        description: 'Create an IVR/call menu',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            name: { type: 'string', description: 'Menu name' },
            greeting: { type: 'string', description: 'Greeting message (text or URL)' },
            options: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  digit: { type: 'string', description: 'Digit to press (0-9, *, #)' },
                  action: { type: 'string', description: 'Action type' },
                  destination: { type: 'string', description: 'Action destination' }
                },
              },
              description: 'Menu options'
            }
          },
          required: ['name', 'greeting']
        },
        _meta: {
          labels: {
            category: "phone-numbers",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'update_ivr_menu',
        description: 'Update an IVR menu',
        inputSchema: {
          type: 'object',
          properties: {
            menuId: { type: 'string', description: 'IVR Menu ID' },
            locationId: { type: 'string', description: 'Location ID' },
            name: { type: 'string', description: 'Menu name' },
            greeting: { type: 'string', description: 'Greeting message' },
            options: { type: 'array', description: 'Menu options' },
          },
          required: ['menuId']
        },
        _meta: {
          labels: {
            category: "phone-numbers",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'delete_ivr_menu',
        description: 'Delete an IVR menu',
        inputSchema: {
          type: 'object',
          properties: {
            menuId: { type: 'string', description: 'IVR Menu ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['menuId']
        },
        _meta: {
          labels: {
            category: "phone-numbers",
            access: "delete",
            complexity: "simple"
          }
        }
      },

      // Voicemail
      {
        name: 'get_voicemail_settings',
        description: 'Get voicemail settings',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' }
          }
        },
        _meta: {
          labels: {
            category: "phone-numbers",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'update_voicemail_settings',
        description: 'Update voicemail settings',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            enabled: { type: 'boolean', description: 'Enable voicemail' },
            greeting: { type: 'string', description: 'Voicemail greeting (text or URL)' },
            transcriptionEnabled: { type: 'boolean', description: 'Enable transcription' },
            notificationEmail: { type: 'string', description: 'Email for voicemail notifications' }
          }
        },
        _meta: {
          labels: {
            category: "phone-numbers",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'get_voicemails',
        description: 'Get voicemail messages',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            phoneNumberId: { type: 'string', description: 'Filter by phone number' },
            status: { type: 'string', enum: ['new', 'read', 'archived'], description: 'Filter by status' },
            limit: { type: 'number', description: 'Max results' },
            offset: { type: 'number', description: 'Pagination offset' }
          }
        },
        _meta: {
          labels: {
            category: "phone-numbers",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'delete_voicemail',
        description: 'Delete a voicemail message',
        inputSchema: {
          type: 'object',
          properties: {
            voicemailId: { type: 'string', description: 'Voicemail ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['voicemailId']
        },
        _meta: {
          labels: {
            category: "phone-numbers",
            access: "delete",
            complexity: "simple"
          }
        }
      },

      // Caller ID
      {
        name: 'get_caller_ids',
        description: 'Get verified caller IDs',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' }
          }
        },
        _meta: {
          labels: {
            category: "phone-numbers",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'add_caller_id',
        description: 'Add a caller ID for verification',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            phoneNumber: { type: 'string', description: 'Phone number to verify' },
            name: { type: 'string', description: 'Friendly name' },
          },
          required: ['phoneNumber']
        },
        _meta: {
          labels: {
            category: "phone-numbers",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'verify_caller_id',
        description: 'Submit verification code for caller ID',
        inputSchema: {
          type: 'object',
          properties: {
            callerIdId: { type: 'string', description: 'Caller ID record ID' },
            locationId: { type: 'string', description: 'Location ID' },
            code: { type: 'string', description: 'Verification code' },
          },
          required: ['callerIdId', 'code']
        },
        _meta: {
          labels: {
            category: "phone-numbers",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'delete_caller_id',
        description: 'Delete a caller ID',
        inputSchema: {
          type: 'object',
          properties: {
            callerIdId: { type: 'string', description: 'Caller ID record ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['callerIdId']
        },
        _meta: {
          labels: {
            category: "phone-numbers",
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
      // Phone Numbers
      case 'get_phone_numbers': {
        return this.ghlClient.makeRequest('GET', `/phone-numbers/?locationId=${locationId}`);
      }
      case 'get_phone_number': {
        return this.ghlClient.makeRequest('GET', `/phone-numbers/${args.phoneNumberId}?locationId=${locationId}`);
      }
      case 'search_available_numbers': {
        const params = new URLSearchParams();
        params.append('locationId', locationId);
        params.append('country', String(args.country));
        if (args.areaCode) params.append('areaCode', String(args.areaCode));
        if (args.contains) params.append('contains', String(args.contains));
        if (args.type) params.append('type', String(args.type));
        return this.ghlClient.makeRequest('GET', `/phone-numbers/available?${params.toString()}`);
      }
      case 'purchase_phone_number': {
        return this.ghlClient.makeRequest('POST', `/phone-numbers/`, {
          locationId,
          phoneNumber: args.phoneNumber,
          name: args.name
        });
      }
      case 'update_phone_number': {
        const body: Record<string, unknown> = { locationId };
        if (args.name) body.name = args.name;
        if (args.forwardingNumber) body.forwardingNumber = args.forwardingNumber;
        if (args.callRecording !== undefined) body.callRecording = args.callRecording;
        if (args.whisperMessage) body.whisperMessage = args.whisperMessage;
        return this.ghlClient.makeRequest('PUT', `/phone-numbers/${args.phoneNumberId}`, body);
      }
      case 'release_phone_number': {
        return this.ghlClient.makeRequest('DELETE', `/phone-numbers/${args.phoneNumberId}?locationId=${locationId}`);
      }

      // Call Forwarding
      case 'get_call_forwarding_settings': {
        return this.ghlClient.makeRequest('GET', `/phone-numbers/${args.phoneNumberId}/forwarding?locationId=${locationId}`);
      }
      case 'update_call_forwarding': {
        const body: Record<string, unknown> = { locationId };
        if (args.enabled !== undefined) body.enabled = args.enabled;
        if (args.forwardTo) body.forwardTo = args.forwardTo;
        if (args.ringTimeout) body.ringTimeout = args.ringTimeout;
        if (args.voicemailEnabled !== undefined) body.voicemailEnabled = args.voicemailEnabled;
        return this.ghlClient.makeRequest('PUT', `/phone-numbers/${args.phoneNumberId}/forwarding`, body);
      }

      // IVR
      case 'get_ivr_menus': {
        return this.ghlClient.makeRequest('GET', `/phone-numbers/ivr?locationId=${locationId}`);
      }
      case 'create_ivr_menu': {
        return this.ghlClient.makeRequest('POST', `/phone-numbers/ivr`, {
          locationId,
          name: args.name,
          greeting: args.greeting,
          options: args.options
        });
      }
      case 'update_ivr_menu': {
        const body: Record<string, unknown> = { locationId };
        if (args.name) body.name = args.name;
        if (args.greeting) body.greeting = args.greeting;
        if (args.options) body.options = args.options;
        return this.ghlClient.makeRequest('PUT', `/phone-numbers/ivr/${args.menuId}`, body);
      }
      case 'delete_ivr_menu': {
        return this.ghlClient.makeRequest('DELETE', `/phone-numbers/ivr/${args.menuId}?locationId=${locationId}`);
      }

      // Voicemail
      case 'get_voicemail_settings': {
        return this.ghlClient.makeRequest('GET', `/phone-numbers/voicemail/settings?locationId=${locationId}`);
      }
      case 'update_voicemail_settings': {
        const body: Record<string, unknown> = { locationId };
        if (args.enabled !== undefined) body.enabled = args.enabled;
        if (args.greeting) body.greeting = args.greeting;
        if (args.transcriptionEnabled !== undefined) body.transcriptionEnabled = args.transcriptionEnabled;
        if (args.notificationEmail) body.notificationEmail = args.notificationEmail;
        return this.ghlClient.makeRequest('PUT', `/phone-numbers/voicemail/settings`, body);
      }
      case 'get_voicemails': {
        const params = new URLSearchParams();
        params.append('locationId', locationId);
        if (args.phoneNumberId) params.append('phoneNumberId', String(args.phoneNumberId));
        if (args.status) params.append('status', String(args.status));
        if (args.limit) params.append('limit', String(args.limit));
        if (args.offset) params.append('offset', String(args.offset));
        return this.ghlClient.makeRequest('GET', `/phone-numbers/voicemail?${params.toString()}`);
      }
      case 'delete_voicemail': {
        return this.ghlClient.makeRequest('DELETE', `/phone-numbers/voicemail/${args.voicemailId}?locationId=${locationId}`);
      }

      // Caller ID
      case 'get_caller_ids': {
        return this.ghlClient.makeRequest('GET', `/phone-numbers/caller-id?locationId=${locationId}`);
      }
      case 'add_caller_id': {
        return this.ghlClient.makeRequest('POST', `/phone-numbers/caller-id`, {
          locationId,
          phoneNumber: args.phoneNumber,
          name: args.name
        });
      }
      case 'verify_caller_id': {
        return this.ghlClient.makeRequest('POST', `/phone-numbers/caller-id/${args.callerIdId}/verify`, {
          locationId,
          code: args.code
        });
      }
      case 'delete_caller_id': {
        return this.ghlClient.makeRequest('DELETE', `/phone-numbers/caller-id/${args.callerIdId}?locationId=${locationId}`);
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
