/**
 * GoHighLevel Users Tools
 * Tools for managing users and team members
 */

import type { GHLToolClient } from './ghl-tool-client.js';

export class UsersTools {
  private resolvedCompanyId: string | undefined;

  constructor(private ghlClient: GHLToolClient) {}

  getToolDefinitions() {
    return [
      {
        name: 'get_users',
        description:
          'Get users/team members for a location via GET /users/search. ' +
          'CRM requires companyId (auto-resolved from args, GHL_COMPANY_ID, or the location). ' +
          'Location private tokens also need locationId (defaulted from config).',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
            companyId: {
              type: 'string',
              description: 'Company/Agency ID (required by /users/search; auto-resolved when omitted)'
            },
            skip: {
              type: 'number',
              description: 'Number of records to skip for pagination'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of users to return (default: 25, max: 100)'
            },
            type: {
              type: 'string',
              description: 'Filter by user type'
            },
            role: {
              type: 'string',
              description: 'Filter by role (e.g., "admin", "user")'
            },
            ids: {
              type: 'string',
              description: 'Comma-separated list of user IDs to filter'
            },
            sort: {
              type: 'string',
              description: 'Sort field'
            },
            sortDirection: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'Sort direction'
            },
            enabled2waySync: {
              type: 'boolean',
              description: 'Filter by two-way sync status'
            }
          }
        },
        _meta: {
          labels: {
            category: "users",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'get_user',
        description: 'Get a specific user by their ID',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'The user ID to retrieve'
            },
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
          },
          required: ['userId']
        },
        _meta: {
          labels: {
            category: "users",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'create_user',
        description: 'Create a new user/team member for a location',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
            firstName: {
              type: 'string',
              description: 'User first name'
            },
            lastName: {
              type: 'string',
              description: 'User last name'
            },
            email: {
              type: 'string',
              description: 'User email address'
            },
            phone: {
              type: 'string',
              description: 'User phone number'
            },
            twilioPhone: {
              type: 'string',
              description: 'Twilio phone number assigned to the user'
            },
            password: {
              type: 'string',
              description: 'User password'
            },
            companyId: {
              type: 'string',
              description: 'Company/Agency ID'
            },
            locationIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Location IDs assigned to the user'
            },
            type: {
              type: 'string',
              description: 'User type (e.g., "account")'
            },
            role: {
              type: 'string',
              description: 'User role (e.g., "admin", "user")'
            },
            permissions: {
              type: 'object',
              description: 'User permissions object'
            },
            scopes: {
              type: 'array',
              items: { type: 'string' },
              description: 'OAuth scopes for the user'
            },
            scopesAssignedToOnly: {
              type: 'array',
              items: { type: 'string' },
              description: 'Scopes only assigned to this user'
            },
            profilePhoto: {
              type: 'string',
              description: 'Profile photo URL'
            },
            platformLanguage: {
              type: 'string',
              description: 'Platform language preference'
            },
          },
          required: ['firstName', 'lastName', 'email']
        },
        _meta: {
          labels: {
            category: "users",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'update_user',
        description: 'Update an existing user/team member',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'The user ID to update'
            },
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
            firstName: {
              type: 'string',
              description: 'User first name'
            },
            lastName: {
              type: 'string',
              description: 'User last name'
            },
            email: {
              type: 'string',
              description: 'User email address'
            },
            phone: {
              type: 'string',
              description: 'User phone number'
            },
            twilioPhone: {
              type: 'string',
              description: 'Twilio phone number assigned to the user'
            },
            password: {
              type: 'string',
              description: 'User password'
            },
            companyId: {
              type: 'string',
              description: 'Company/Agency ID'
            },
            locationIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Location IDs assigned to the user'
            },
            type: {
              type: 'string',
              description: 'User type'
            },
            role: {
              type: 'string',
              description: 'User role'
            },
            permissions: {
              type: 'object',
              description: 'User permissions object'
            },
            scopes: {
              type: 'array',
              items: { type: 'string' },
              description: 'OAuth scopes for the user'
            },
            scopesAssignedToOnly: {
              type: 'array',
              items: { type: 'string' },
              description: 'Scopes only assigned to this user'
            },
            profilePhoto: {
              type: 'string',
              description: 'Profile photo URL'
            },
            platformLanguage: {
              type: 'string',
              description: 'Platform language preference'
            },
          },
          required: ['userId']
        },
        _meta: {
          labels: {
            category: "users",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'delete_user',
        description: 'Delete a user/team member from a location',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'The user ID to delete'
            },
            locationId: {
              type: 'string',
              description: 'Location ID (uses default if not provided)'
            },
          },
          required: ['userId']
        },
        _meta: {
          labels: {
            category: "users",
            access: "delete",
            complexity: "simple"
          }
        }
      },
      {
        name: 'search_users',
        description:
          'Search users via GET /users/search. Requires companyId (auto-resolved when omitted). ' +
          'Location private tokens should also include locationId (defaulted from config).',
        inputSchema: {
          type: 'object',
          properties: {
            companyId: {
              type: 'string',
              description: 'Company ID to search within (auto-resolved when omitted)'
            },
            locationId: {
              type: 'string',
              description: 'Location ID — needed for location-scoped private tokens (uses default if not provided)'
            },
            query: {
              type: 'string',
              description: 'Search query string (name, email, or phone)'
            },
            skip: {
              type: 'number',
              description: 'Records to skip'
            },
            limit: {
              type: 'number',
              description: 'Max records to return'
            },
            type: {
              type: 'string',
              description: 'Filter by user type'
            },
            role: {
              type: 'string',
              description: 'Filter by role'
            }
          }
        },
        _meta: {
          labels: {
            category: "users",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'filter_users_by_email',
        description:
          'Filter users by email (POST /users/search/filter-by-email). Requires companyId. ' +
          'Some location-scoped private tokens return 401 on this agency-scoped endpoint.',
        inputSchema: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              description: 'Email address to search for'
            },
            emails: {
              oneOf: [
                { type: 'array', items: { type: 'string' } },
                { type: 'string' }
              ],
              description: 'One or more email addresses. Comma-separated strings are accepted.'
            },
            companyId: {
              type: 'string',
              description: 'Company ID (required by CRM; auto-resolved when omitted)'
            },
            deleted: {
              type: 'boolean',
              description: 'Whether to include deleted users'
            },
            locationId: {
              type: 'string',
              description: 'Location ID used only to resolve companyId when omitted'
            }
          },
          required: []
        },
        _meta: {
          labels: {
            category: "users",
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
      case 'get_users': {
        const companyId = await this.resolveCompanyId(args, locationId);
        const params = new URLSearchParams();
        params.append('companyId', companyId);
        params.append('locationId', locationId);
        if (args.query) params.append('query', String(args.query));
        if (args.skip !== undefined) params.append('skip', String(args.skip));
        if (args.limit !== undefined) params.append('limit', String(args.limit));
        if (args.type) params.append('type', String(args.type));
        if (args.role) params.append('role', String(args.role));
        if (Array.isArray(args.ids)) {
          for (const id of args.ids) params.append('ids', String(id));
        } else if (args.ids) {
          params.append('ids', String(args.ids));
        }
        if (args.sort) params.append('sort', String(args.sort));
        if (args.sortDirection) params.append('sortDirection', String(args.sortDirection));
        if (args.enabled2waySync !== undefined) params.append('enabled2waySync', String(args.enabled2waySync));

        return this.ghlClient.makeRequest('GET', `/users/search?${params.toString()}`);
      }

      case 'get_user': {
        const userId = args.userId as string;
        return this.ghlClient.makeRequest('GET', `/users/${userId}`);
      }

      case 'create_user': {
        const body: Record<string, unknown> = {
          locationId,
          firstName: args.firstName,
          lastName: args.lastName,
          email: args.email
        };
        if (args.companyId) body.companyId = args.companyId;
        if (args.password) body.password = args.password;
        if (args.phone) body.phone = args.phone;
        if (args.twilioPhone) body.twilioPhone = args.twilioPhone;
        if (args.type) body.type = args.type;
        if (args.role) body.role = args.role;
        if (args.locationIds) body.locationIds = args.locationIds;
        if (args.permissions) body.permissions = args.permissions;
        if (args.scopes) body.scopes = args.scopes;
        if (args.scopesAssignedToOnly) body.scopesAssignedToOnly = args.scopesAssignedToOnly;
        if (args.profilePhoto) body.profilePhoto = args.profilePhoto;
        if (args.platformLanguage) body.platformLanguage = args.platformLanguage;
        
        return this.ghlClient.makeRequest('POST', `/users/`, body);
      }

      case 'update_user': {
        const userId = args.userId as string;
        const body: Record<string, unknown> = {};
        if (args.firstName) body.firstName = args.firstName;
        if (args.lastName) body.lastName = args.lastName;
        if (args.email) body.email = args.email;
        if (args.companyId) body.companyId = args.companyId;
        if (args.password) body.password = args.password;
        if (args.phone) body.phone = args.phone;
        if (args.twilioPhone) body.twilioPhone = args.twilioPhone;
        if (args.type) body.type = args.type;
        if (args.role) body.role = args.role;
        if (args.locationIds) body.locationIds = args.locationIds;
        if (args.permissions) body.permissions = args.permissions;
        if (args.scopes) body.scopes = args.scopes;
        if (args.scopesAssignedToOnly) body.scopesAssignedToOnly = args.scopesAssignedToOnly;
        if (args.profilePhoto) body.profilePhoto = args.profilePhoto;
        if (args.platformLanguage) body.platformLanguage = args.platformLanguage;
        
        return this.ghlClient.makeRequest('PUT', `/users/${userId}`, body);
      }

      case 'delete_user': {
        const userId = args.userId as string;
        return this.ghlClient.makeRequest('DELETE', `/users/${userId}`);
      }

      case 'search_users': {
        const companyId = await this.resolveCompanyId(args, locationId);
        const params = new URLSearchParams();
        params.append('companyId', companyId);
        params.append('locationId', locationId);
        if (args.query) params.append('query', String(args.query));
        if (args.skip !== undefined) params.append('skip', String(args.skip));
        if (args.limit !== undefined) params.append('limit', String(args.limit));
        if (args.type) params.append('type', String(args.type));
        if (args.role) params.append('role', String(args.role));

        return this.ghlClient.makeRequest('GET', `/users/search?${params.toString()}`);
      }

      case 'filter_users_by_email': {
        const emails = Array.isArray(args.emails)
          ? args.emails.map(String)
          : args.emails
            ? String(args.emails).split(',').map((item) => item.trim()).filter(Boolean)
            : args.email
              ? [String(args.email)]
              : [];
        const companyId = await this.resolveCompanyId(args, locationId);
        const body: Record<string, unknown> = {
          companyId,
          deleted: args.deleted ?? false,
          emails
        };
        return this.ghlClient.makeRequest('POST', `/users/search/filter-by-email`, body);
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * GET /users/search requires companyId. Location private tokens also need locationId.
   * Resolve companyId from args → config → env → GET /locations/{id}.
   */
  private async resolveCompanyId(
    args: Record<string, unknown>,
    locationId: string
  ): Promise<string> {
    if (typeof args.companyId === 'string' && args.companyId.trim()) {
      return args.companyId.trim();
    }

    const config = this.ghlClient.getConfig();
    if (typeof config.companyId === 'string' && config.companyId.trim()) {
      return config.companyId.trim();
    }

    const fromEnv = process.env.GHL_COMPANY_ID?.trim();
    if (fromEnv) return fromEnv;

    if (this.resolvedCompanyId) return this.resolvedCompanyId;

    const response = await this.ghlClient.makeRequest<{
      location?: { companyId?: string };
      companyId?: string;
    }>('GET', `/locations/${encodeURIComponent(locationId)}`);

    const companyId =
      response.data?.location?.companyId ||
      response.data?.companyId;

    if (!companyId) {
      throw new Error(
        'companyId is required for user search. Set GHL_COMPANY_ID or pass companyId, ' +
          `and ensure GET /locations/${locationId} returns location.companyId.`
      );
    }

    this.resolvedCompanyId = companyId;
    return companyId;
  }
}
