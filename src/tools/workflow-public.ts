/**
 * Public-API workflow tools.
 *
 * These use the documented GHL v2 API (services.leadconnectorhq.com/workflows)
 * via the per-sub-account CRMClient. They cover list/get/status/trigger/
 * executions. For full action/trigger structure, cloning, or when these 401,
 * use the ghl_*_workflow_full / ghl_create_workflow tools (internal builder API).
 */

import { ToolDef, defineTool } from './types.js';

export const workflowPublicTools: ToolDef[] = [
  defineTool({
    name: 'ghl_get_workflows',
    description:
      'PUBLIC API list of workflows for a location (limited metadata). Requires a private integration token with ' +
      'workflows.readonly. For full action/trigger structure, cloning, or when this returns 401, use ' +
      'ghl_list_workflows_full instead (internal builder auth).',
    handler: async (client, args) => {
      return client.get('/workflows/', { locationId: args.locationId });
    },
  }),

  defineTool({
    name: 'ghl_list_workflows',
    description:
      'PUBLIC API list alias for ghl_get_workflows. Limited metadata only. If you need triggers/actions or get a ' +
      '401 Unauthorized, call ghl_list_workflows_full (internal builder API).',
    properties: {
      status: { type: 'string', enum: ['active', 'inactive', 'draft'], description: 'Filter workflows by status' },
      limit: { type: 'number', description: 'Maximum number of workflows to return (default: 50)' },
      skip: { type: 'number', description: 'Number of records to skip for pagination' },
    },
    handler: async (client, args) => {
      const params: Record<string, unknown> = { locationId: args.locationId };
      if (args.status) params.status = args.status;
      if (args.limit !== undefined) params.limit = args.limit;
      if (args.skip !== undefined) params.skip = args.skip;
      return client.get('/workflows/', params);
    },
  }),

  defineTool({
    name: 'ghl_get_workflow',
    description:
      'PUBLIC API get-by-id. Often incomplete and may 401 without workflows.readonly. For clone/analyze/edit, ' +
      'ALWAYS use ghl_get_workflow_full instead (returns workflowData.templates + triggers via the builder API).',
    properties: {
      workflowId: { type: 'string', description: 'The unique ID of the workflow to retrieve' },
    },
    required: ['workflowId'],
    handler: async (client, args) => {
      return client.get(`/workflows/${args.workflowId}`, { locationId: args.locationId });
    },
  }),

  defineTool({
    name: 'ghl_update_workflow_status',
    description: 'Enable or disable a workflow. Active workflows process contacts; inactive ones are paused.',
    properties: {
      workflowId: { type: 'string', description: 'The unique ID of the workflow to update' },
      status: { type: 'string', enum: ['active', 'inactive'], description: 'New status for the workflow' },
    },
    required: ['workflowId', 'status'],
    handler: async (client, args) => {
      return client.request('PATCH', `/workflows/${args.workflowId}`, {
        data: { status: args.status, locationId: args.locationId },
      });
    },
  }),

  defineTool({
    name: 'ghl_trigger_workflow',
    description:
      'Manually trigger a workflow for a specific contact. Useful for testing workflows or manually enrolling contacts.',
    properties: {
      workflowId: { type: 'string', description: 'The unique ID of the workflow to trigger' },
      contactId: { type: 'string', description: 'The ID of the contact to enroll in the workflow' },
    },
    required: ['workflowId', 'contactId'],
    handler: async (client, args) => {
      return client.post(`/workflows/${args.workflowId}/trigger`, {
        contactId: args.contactId,
        locationId: args.locationId,
      });
    },
  }),

  defineTool({
    name: 'ghl_get_workflow_executions',
    description:
      'Get execution history for a workflow showing which contacts have run through it, their current step, and ' +
      'completion status.',
    properties: {
      workflowId: { type: 'string', description: 'The unique ID of the workflow to get executions for' },
      contactId: { type: 'string', description: 'Filter executions by a specific contact ID' },
      status: { type: 'string', enum: ['active', 'completed', 'cancelled', 'failed'], description: 'Filter by execution status' },
      startDate: { type: 'string', description: 'Start date filter (YYYY-MM-DD)' },
      endDate: { type: 'string', description: 'End date filter (YYYY-MM-DD)' },
      limit: { type: 'number', description: 'Maximum number of execution records to return (default: 20)' },
      skip: { type: 'number', description: 'Records to skip for pagination' },
    },
    required: ['workflowId'],
    handler: async (client, args) => {
      const params: Record<string, unknown> = { locationId: args.locationId };
      for (const key of ['contactId', 'status', 'startDate', 'endDate', 'limit', 'skip']) {
        if (args[key] !== undefined && args[key] !== null && args[key] !== '') params[key] = args[key];
      }
      return client.get(`/workflows/${args.workflowId}/executions`, params);
    },
  }),
];
