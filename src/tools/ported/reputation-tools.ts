/**
 * GoHighLevel Reputation/Reviews Tools
 * Tools for managing reviews, reputation, and business listings
 */

import type { GHLToolClient } from './ghl-tool-client.js';

export class ReputationTools {
  constructor(private ghlClient: GHLToolClient) {}

  getToolDefinitions() {
    return [
      // Reviews
      {
        name: 'get_reviews',
        description: 'Get all reviews for a location from various platforms',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            platform: { type: 'string', enum: ['google', 'facebook', 'yelp', 'all'], description: 'Filter by platform' },
            rating: { type: 'number', description: 'Filter by minimum rating (1-5)' },
            status: { type: 'string', enum: ['replied', 'unreplied', 'all'], description: 'Filter by reply status' },
            startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
            endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
            limit: { type: 'number', description: 'Max results' },
            offset: { type: 'number', description: 'Pagination offset' }
          }
        },
        _meta: {
          labels: {
            category: "reputation",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'get_review',
        description: 'Get a specific review by ID',
        inputSchema: {
          type: 'object',
          properties: {
            reviewId: { type: 'string', description: 'Review ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['reviewId']
        },
        _meta: {
          labels: {
            category: "reputation",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'reply_to_review',
        description: 'Reply to a review',
        inputSchema: {
          type: 'object',
          properties: {
            reviewId: { type: 'string', description: 'Review ID' },
            locationId: { type: 'string', description: 'Location ID' },
            reply: { type: 'string', description: 'Reply text' },
          },
          required: ['reviewId', 'reply']
        },
        _meta: {
          labels: {
            category: "reputation",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'update_review_reply',
        description: 'Update a review reply',
        inputSchema: {
          type: 'object',
          properties: {
            reviewId: { type: 'string', description: 'Review ID' },
            locationId: { type: 'string', description: 'Location ID' },
            reply: { type: 'string', description: 'Updated reply text' },
          },
          required: ['reviewId', 'reply']
        },
        _meta: {
          labels: {
            category: "reputation",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'delete_review_reply',
        description: 'Delete a review reply',
        inputSchema: {
          type: 'object',
          properties: {
            reviewId: { type: 'string', description: 'Review ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
          required: ['reviewId']
        },
        _meta: {
          labels: {
            category: "reputation",
            access: "delete",
            complexity: "simple"
          }
        }
      },

      // Review Stats
      {
        name: 'get_review_stats',
        description: 'Get review statistics/summary',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            platform: { type: 'string', enum: ['google', 'facebook', 'yelp', 'all'], description: 'Platform filter' },
            startDate: { type: 'string', description: 'Start date' },
            endDate: { type: 'string', description: 'End date' }
          }
        },
        _meta: {
          labels: {
            category: "reputation",
            access: "read",
            complexity: "simple"
          }
        }
      },

      // Review Requests
      {
        name: 'send_review_request',
        description: 'Send a review request to a contact',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            contactId: { type: 'string', description: 'Contact ID to request review from' },
            platform: { type: 'string', enum: ['google', 'facebook', 'yelp'], description: 'Platform to request review on' },
            method: { type: 'string', enum: ['sms', 'email', 'both'], description: 'Delivery method' },
            message: { type: 'string', description: 'Custom message (optional)' },
          },
          required: ['contactId', 'platform', 'method']
        },
        _meta: {
          labels: {
            category: "reputation",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'get_review_requests',
        description: 'Get sent review requests',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            contactId: { type: 'string', description: 'Filter by contact' },
            status: { type: 'string', enum: ['sent', 'clicked', 'reviewed', 'all'], description: 'Status filter' },
            limit: { type: 'number', description: 'Max results' },
            offset: { type: 'number', description: 'Pagination offset' }
          }
        },
        _meta: {
          labels: {
            category: "reputation",
            access: "read",
            complexity: "simple"
          }
        }
      },

      // Connected Platforms
      {
        name: 'get_connected_review_platforms',
        description: 'Get connected review platforms (Google, Facebook, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' }
          }
        },
        _meta: {
          labels: {
            category: "reputation",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'connect_google_business',
        description: 'Initiate Google Business Profile connection',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' }
          }
        },
        _meta: {
          labels: {
            category: "reputation",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'disconnect_review_platform',
        description: 'Disconnect a review platform',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            platform: { type: 'string', enum: ['google', 'facebook', 'yelp'], description: 'Platform to disconnect' },
          },
          required: ['platform']
        },
        _meta: {
          labels: {
            category: "reputation",
            access: "read",
            complexity: "simple"
          }
        }
      },

      // Review Links
      {
        name: 'get_review_links',
        description: 'Get direct review links for platforms',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' }
          }
        },
        _meta: {
          labels: {
            category: "reputation",
            access: "read",
            complexity: "simple"
          }
        }
      },
      {
        name: 'update_review_links',
        description: 'Update custom review links',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            googleLink: { type: 'string', description: 'Custom Google review link' },
            facebookLink: { type: 'string', description: 'Custom Facebook review link' },
            yelpLink: { type: 'string', description: 'Custom Yelp review link' }
          }
        },
        _meta: {
          labels: {
            category: "reputation",
            access: "write",
            complexity: "simple"
          }
        }
      },

      // Review Widgets
      {
        name: 'get_review_widget_settings',
        description: 'Get review widget embed settings',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' }
          }
        },
        _meta: {
          labels: {
            category: "reputation",
            access: "write",
            complexity: "simple"
          }
        }
      },
      {
        name: 'update_review_widget_settings',
        description: 'Update review widget settings',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string', description: 'Location ID' },
            enabled: { type: 'boolean', description: 'Enable widget' },
            minRating: { type: 'number', description: 'Minimum rating to display' },
            platforms: { type: 'array', items: { type: 'string' }, description: 'Platforms to show' },
            layout: { type: 'string', enum: ['grid', 'carousel', 'list'], description: 'Widget layout' }
          }
        }
      }
    ];
  }

  async handleToolCall(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const config = this.ghlClient.getConfig();
    const locationId = (args.locationId as string) || config.locationId;

    switch (toolName) {
      // Reviews
      case 'get_reviews': {
        const params = new URLSearchParams();
        params.append('locationId', locationId);
        if (args.platform) params.append('platform', String(args.platform));
        if (args.rating) params.append('rating', String(args.rating));
        if (args.status) params.append('status', String(args.status));
        if (args.startDate) params.append('startDate', String(args.startDate));
        if (args.endDate) params.append('endDate', String(args.endDate));
        if (args.limit) params.append('limit', String(args.limit));
        if (args.offset) params.append('offset', String(args.offset));
        return this.ghlClient.makeRequest('GET', `/reputation/reviews?${params.toString()}`);
      }
      case 'get_review': {
        return this.ghlClient.makeRequest('GET', `/reputation/reviews/${args.reviewId}?locationId=${locationId}`);
      }
      case 'reply_to_review': {
        return this.ghlClient.makeRequest('POST', `/reputation/reviews/${args.reviewId}/reply`, {
          locationId,
          reply: args.reply
        });
      }
      case 'update_review_reply': {
        return this.ghlClient.makeRequest('PUT', `/reputation/reviews/${args.reviewId}/reply`, {
          locationId,
          reply: args.reply
        });
      }
      case 'delete_review_reply': {
        return this.ghlClient.makeRequest('DELETE', `/reputation/reviews/${args.reviewId}/reply?locationId=${locationId}`);
      }

      // Stats
      case 'get_review_stats': {
        const params = new URLSearchParams();
        params.append('locationId', locationId);
        if (args.platform) params.append('platform', String(args.platform));
        if (args.startDate) params.append('startDate', String(args.startDate));
        if (args.endDate) params.append('endDate', String(args.endDate));
        return this.ghlClient.makeRequest('GET', `/reputation/stats?${params.toString()}`);
      }

      // Review Requests
      case 'send_review_request': {
        return this.ghlClient.makeRequest('POST', `/reputation/review-requests`, {
          locationId,
          contactId: args.contactId,
          platform: args.platform,
          method: args.method,
          message: args.message
        });
      }
      case 'get_review_requests': {
        const params = new URLSearchParams();
        params.append('locationId', locationId);
        if (args.contactId) params.append('contactId', String(args.contactId));
        if (args.status) params.append('status', String(args.status));
        if (args.limit) params.append('limit', String(args.limit));
        if (args.offset) params.append('offset', String(args.offset));
        return this.ghlClient.makeRequest('GET', `/reputation/review-requests?${params.toString()}`);
      }

      // Platforms
      case 'get_connected_review_platforms': {
        return this.ghlClient.makeRequest('GET', `/reputation/platforms?locationId=${locationId}`);
      }
      case 'connect_google_business': {
        return this.ghlClient.makeRequest('POST', `/reputation/platforms/google/connect`, { locationId });
      }
      case 'disconnect_review_platform': {
        return this.ghlClient.makeRequest('DELETE', `/reputation/platforms/${args.platform}?locationId=${locationId}`);
      }

      // Links
      case 'get_review_links': {
        return this.ghlClient.makeRequest('GET', `/reputation/links?locationId=${locationId}`);
      }
      case 'update_review_links': {
        const body: Record<string, unknown> = { locationId };
        if (args.googleLink) body.googleLink = args.googleLink;
        if (args.facebookLink) body.facebookLink = args.facebookLink;
        if (args.yelpLink) body.yelpLink = args.yelpLink;
        return this.ghlClient.makeRequest('PUT', `/reputation/links`, body);
      }

      // Widgets
      case 'get_review_widget_settings': {
        return this.ghlClient.makeRequest('GET', `/reputation/widget?locationId=${locationId}`);
      }
      case 'update_review_widget_settings': {
        const body: Record<string, unknown> = { locationId };
        if (args.enabled !== undefined) body.enabled = args.enabled;
        if (args.minRating) body.minRating = args.minRating;
        if (args.platforms) body.platforms = args.platforms;
        if (args.layout) body.layout = args.layout;
        return this.ghlClient.makeRequest('PUT', `/reputation/widget`, body);
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
