/**
 * Workflow-builder tools (internal GHL API).
 *
 * End-to-end workflow management the public API can't do: create, update,
 * publish, clone and delete workflows with full action/trigger graphs, plus
 * native + marketplace module discovery. Each tool reaches the sub-account's
 * internal-API client via `client.workflowBuilder()` — credentials are resolved
 * dynamically per sub-account from Supabase (see pool.getWorkflowClient).
 *
 * defineTool auto-injects the required `locationId`; callTool resolves it to the
 * right sub-account before the handler runs.
 */

import { ToolDef, defineTool } from './types.js';
import { WorkflowAction, WorkflowTrigger } from '../crm/workflow-builder-client.js';
import {
  getNativeWorkflowModule,
  listNativeWorkflowSections,
  searchNativeWorkflowModules,
} from '../catalog/native-workflow-catalog.js';
import {
  findMarketplaceModuleByKey,
  slimMarketplaceSearchResults,
} from '../catalog/marketplace-module-slim.js';

const WORKFLOW_ACTION_SCHEMA: Record<string, any> = {
  type: 'object',
  properties: {
    type: { type: 'string', description: 'Exact action key/type returned by a workflow catalog search' },
    name: { type: 'string', description: 'Display name shown in the workflow builder' },
    attributes: { type: 'object', description: 'Action-specific values matching the catalog inputs schema' },
    id: { type: 'string', description: 'Optional UUID; generated when omitted' },
    order: { type: 'number', description: 'Optional position hint; generated sequentially when omitted' },
    next: {
      description: 'Next step ID, array of branch IDs, or null. Linear actions are linked automatically when omitted.',
      oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }, { type: 'null' }],
    },
    parentKey: { type: ['string', 'null'], description: 'Previous graph step ID; linked automatically when omitted' },
    parent: { type: ['string', 'null'], description: 'Logical branch/container parent when applicable' },
    sibling: { type: ['array', 'null'], items: { type: 'string' } },
    cat: { type: 'string' },
    nodeType: { type: 'string' },
    workflowsActionType: { type: 'string' },
  },
  required: ['type', 'name'],
  additionalProperties: true,
};

const WORKFLOW_TRIGGER_SCHEMA: Record<string, any> = {
  type: 'object',
  properties: {
    type: { type: 'string', description: 'Exact trigger key/type returned by a workflow catalog search' },
    name: { type: 'string', description: 'Trigger display name' },
    status: { type: 'string', enum: ['draft', 'published'] },
    schedule_config: { type: 'object' },
    conditions: {
      type: 'array',
      description: 'Trigger filter rows using the exact fields/operators required by this trigger type',
      items: { type: 'object' },
    },
    masterType: {
      type: 'string',
      description: 'Usually highlevel for native triggers; use the catalog/captured value for app triggers',
    },
    actions: {
      type: 'array',
      description: 'Optional raw trigger actions; defaults to add_to_workflow for this workflow',
      items: { type: 'object' },
    },
    active: { type: 'boolean', description: 'Whether the trigger is active; defaults true' },
  },
  required: ['type'],
  additionalProperties: true,
};

const APP_URL = 'https://app.gohighlevel.com/v2/location';

export const workflowBuilderTools: ToolDef[] = [
  // ─── CREATE ────────────────────────────────────────────────
  defineTool({
    name: 'ghl_create_workflow',
    description:
      'Create a complete CRM workflow using the internal builder flow: create the draft, validate-assets + PUT the action graph, ' +
      'create and verify each trigger separately, then optionally publish. Before calling this tool, discover schemas with ' +
      'crm_search_native_workflow_modules / crm_get_native_workflow_module for native CRM modules, or ' +
      'crm_search_workflow_modules then crm_get_workflow_module for installed marketplace apps. ' +
      'Action fields must match the selected module inputs. Linear actions are chained automatically.',
    properties: {
      name: { type: 'string', description: 'Workflow name (required)' },
      trigger: { ...WORKFLOW_TRIGGER_SCHEMA, description: 'Deprecated single-trigger form. Prefer triggers[].' },
      triggers: {
        type: 'array',
        description: 'Triggers to create through the dedicated trigger endpoint and verify after creation',
        items: WORKFLOW_TRIGGER_SCHEMA,
      },
      actions: {
        type: 'array',
        description: 'Action graph. Each attributes object must satisfy the selected module input schema.',
        items: WORKFLOW_ACTION_SCHEMA,
      },
      publish: { type: 'boolean', description: 'If true, publish the workflow immediately after creation (default: draft)' },
    },
    required: ['name'],
    handler: async (client, args) => {
      const wf = client.workflowBuilder();
      const name = args.name as string;
      if (!name) throw new Error('name is required');

      const { id } = await wf.createWorkflow(name);

      const rawActions = args.actions as WorkflowAction[] | undefined;
      const singleTrigger = args.trigger as WorkflowTrigger | undefined;
      const triggers = args.triggers as WorkflowTrigger[] | undefined;
      const requestedTriggers = triggers || (singleTrigger ? [singleTrigger] : []);
      const publish = args.publish as boolean | undefined;

      try {
        if (rawActions) await wf.saveWorkflowBody(id, rawActions);
        for (const trigger of requestedTriggers) await wf.createWorkflowTrigger(id, trigger);
        if (publish) await wf.publishWorkflow(id);
      } catch (err: any) {
        throw new Error(`Workflow ${id} was created as a draft, but configuration failed: ${err.message}`);
      }

      const workflow = await wf.getWorkflow(id);
      const savedTriggers = await wf.listWorkflowTriggers(id);
      return {
        message: `Workflow "${name}" created successfully`,
        workflow: {
          id: workflow._id,
          name: workflow.name,
          status: workflow.status,
          version: workflow.version,
          actionCount: workflow.workflowData?.templates?.length || 0,
          triggerCount: savedTriggers.length,
          actions: (workflow.workflowData?.templates || []).map((t, i) => ({ order: i, type: t.type, name: t.name, id: t.id })),
          triggers: savedTriggers,
          url: `${APP_URL}/${wf.getLocationId()}/automation/workflow/${workflow._id}`,
        },
      };
    },
  }),

  // ─── NATIVE STATIC MODULE DISCOVERY ────────────────────────
  defineTool({
    name: 'crm_search_native_workflow_modules',
    description:
      'Search the LOCAL native CRM workflow catalog JSON for built-in actions/triggers ' +
      '(contact_created, create_update_contact, find_contact, add_notes, dnd_contact, update_contact_field, ' +
      'remove_assigned_user, appointment, customer_appointment, opportunity_created, opportunity_updated, ' +
      'opportunity_status_changed, opportunity_decay, opportunity_stage_changed, email, sms, wait, if/else, etc.). ' +
      'Returns slim matches: key, section, required fields, exampleAttributes flags. ' +
      'After picking a key, call crm_get_native_workflow_module. ' +
      'This is NOT the marketplace search. For installed apps use crm_search_workflow_modules.',
    properties: {
      query: { type: 'string', description: 'Search text, for example SMS, wait, contact changed, Asana, or create task' },
      type: { type: 'string', enum: ['actions', 'triggers', 'both'], description: 'Module kind to search (default both)' },
      section: { type: 'string', description: 'Optional section/app filter, for example Asana, Calendly, or affiliate' },
      limit: { type: 'number', minimum: 1, maximum: 50, description: 'Max matches to return (default 15)' },
      listSections: { type: 'boolean', description: 'If true, return available catalog sections instead of module matches' },
    },
    handler: async (_client, args) => {
      const type = (args.type as 'actions' | 'triggers' | 'both' | undefined) || 'both';
      if (type !== 'actions' && type !== 'triggers' && type !== 'both') {
        throw new Error('type must be actions, triggers, or both');
      }
      if (args.listSections === true) return listNativeWorkflowSections(type);
      return searchNativeWorkflowModules({
        query: args.query as string | undefined,
        type,
        section: args.section as string | undefined,
        limit: args.limit as number | undefined,
      });
    },
  }),

  defineTool({
    name: 'crm_get_native_workflow_module',
    description:
      'Load ONE native CRM workflow module by exact key from the local catalog ' +
      '(examples: contact_created, appointment, customer_appointment, opportunity_created, ' +
      'opportunity_status_changed, opportunity_decay, email, sms, wait, create_update_contact, find_contact). ' +
      'Returns inputs/filters plus exampleAttributes / exampleAttributesVariants / exampleTrigger / exampleNodes. ' +
      'Use after crm_search_native_workflow_modules. Runtime code blobs are omitted.',
    properties: {
      key: { type: 'string', description: 'Exact module key, for example am-add-lead or asana_ia_asana_create_task' },
      type: { type: 'string', enum: ['actions', 'triggers', 'both'], description: 'Optional kind filter when the same key might exist in both catalogs' },
    },
    required: ['key'],
    handler: async (_client, args) => {
      const key = args.key as string;
      if (!key) throw new Error('key is required');
      const type = (args.type as 'actions' | 'triggers' | 'both' | undefined) || 'both';
      if (type !== 'actions' && type !== 'triggers' && type !== 'both') {
        throw new Error('type must be actions, triggers, or both');
      }
      return getNativeWorkflowModule({ key, type });
    },
  }),

  // ─── LIVE MARKETPLACE MODULE DISCOVERY ─────────────────────
  defineTool({
    name: 'crm_search_workflow_modules',
    description:
      'Search the live CRM marketplace for installed app workflow actions or triggers. ' +
      'Returns a SLIM list only: app name, module key, required field names, and input/filter names. ' +
      'Does NOT return full schemas (those exceed tool limits). ' +
      'After picking a moduleKey, call crm_get_workflow_module for that one schema. ' +
      'Native CRM modules are not here — use crm_search_native_workflow_modules.',
    properties: {
      type: { type: 'string', enum: ['actions', 'triggers'], description: 'Module kind to search' },
      query: { type: 'string', description: 'App or module search text, for example Zoom, meeting, or create task' },
      isInstalled: { type: 'boolean', description: 'Return only modules installed for this subaccount (default true)' },
      skip: { type: 'number', minimum: 0, description: 'Pagination offset (default 0)' },
      limit: { type: 'number', minimum: 1, maximum: 25, description: 'Maximum apps to request from the API (default 8; keep small)' },
      maxModules: { type: 'number', minimum: 1, maximum: 50, description: 'Maximum slim module hits to return after flattening apps (default 15)' },
    },
    required: ['type'],
    handler: async (client, args) => {
      const wf = client.workflowBuilder();
      const type = args.type as 'actions' | 'triggers';
      if (type !== 'actions' && type !== 'triggers') throw new Error('type must be actions or triggers');

      const limit = Math.min(Math.max(Number(args.limit ?? 8), 1), 25);
      const maxModules = Math.min(Math.max(Number(args.maxModules ?? 15), 1), 50);
      const apps = await wf.searchMarketplaceModules({
        type,
        query: args.query as string | undefined,
        isInstalled: args.isInstalled as boolean | undefined,
        skip: args.skip as number | undefined,
        limit,
      });

      const slim = slimMarketplaceSearchResults(apps, type === 'actions' ? 'action' : 'trigger', { maxModules });
      return {
        source: 'live-marketplace-module-search',
        type,
        appCount: slim.appCount,
        moduleCount: slim.moduleCount,
        results: slim.results,
        note: 'These are slim hits only. Call crm_get_workflow_module with moduleKey + type to load one full input schema.',
      };
    },
  }),

  defineTool({
    name: 'crm_get_workflow_module',
    description:
      'Load ONE marketplace app module schema by exact module key. ' +
      'Call after crm_search_workflow_modules. Returns inputs/filters/options needed to build attributes, ' +
      'with runtime code and customGenerator blobs stripped. Prefer this over asking search for full schemas.',
    properties: {
      key: { type: 'string', description: 'Exact module key from search results, for example zoom_create_meeting' },
      type: { type: 'string', enum: ['actions', 'triggers'], description: 'Module kind (required)' },
      query: { type: 'string', description: 'Optional search hint if the key alone is too generic. Defaults to the key. Example: Zoom' },
      isInstalled: { type: 'boolean', description: 'Search installed apps only (default true)' },
    },
    required: ['key', 'type'],
    handler: async (client, args) => {
      const wf = client.workflowBuilder();
      const key = args.key as string;
      const type = args.type as 'actions' | 'triggers';
      if (!key) throw new Error('key is required');
      if (type !== 'actions' && type !== 'triggers') throw new Error('type must be actions or triggers');

      const query = (args.query as string | undefined)?.trim() || key;
      const apps = await wf.searchMarketplaceModules({
        type,
        query,
        isInstalled: args.isInstalled as boolean | undefined,
        skip: 0,
        limit: 15,
      });

      const found = findMarketplaceModuleByKey(apps, key, type === 'actions' ? 'action' : 'trigger');
      if (!found.found) {
        return {
          source: 'live-marketplace-module-search',
          found: false,
          key,
          type,
          matches: found.matches || [],
          note: `No exact module for key "${key}". Use a match from matches[] or refine crm_search_workflow_modules.`,
        };
      }
      return {
        source: 'live-marketplace-module-search',
        found: true,
        key,
        type,
        module: found.module,
        note: 'Populate workflow attributes/conditions from inputs or filters. Runtime code blobs are stripped.',
      };
    },
  }),

  // ─── LIST / GET FULL ───────────────────────────────────────
  defineTool({
    name: 'ghl_list_workflows_full',
    description:
      'List all workflows with names, IDs, and statuses via the INTERNAL builder API (Firebase token-id auth). ' +
      'Prefer this over ghl_list_workflows / ghl_get_workflows when analyzing or cloning. ' +
      'Does not use the public /workflows endpoint.',
    properties: {
      limit: { type: 'number', description: 'Max workflows to return (default 50)' },
      offset: { type: 'number', description: 'Pagination offset (default 0)' },
      sortBy: { type: 'string', description: 'Sort field: name, createdAt, updatedAt (default name)' },
      sortOrder: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order (default asc)' },
    },
    handler: async (client, args) => {
      const wf = client.workflowBuilder();
      const result = await wf.listWorkflows({
        limit: args.limit as number | undefined,
        offset: args.offset as number | undefined,
        sortBy: args.sortBy as string | undefined,
        sortOrder: args.sortOrder as 'asc' | 'desc' | undefined,
      });
      return {
        total: result.total,
        count: result.rows.length,
        workflows: result.rows.map((w) => ({
          id: w._id,
          name: w.name,
          status: w.status,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
        })),
      };
    },
  }),

  defineTool({
    name: 'ghl_get_workflow_full',
    description:
      'Get a single workflow with FULL detail via the INTERNAL builder API: workflowData.templates (actions), ' +
      'triggers, version, status. Use this for analyze/clone/edit. Prefer over ghl_get_workflow (public API). ' +
      'Auth: Firebase credentials captured for this sub-account — not GHL_API_KEY scopes.',
    properties: {
      workflowId: { type: 'string', description: 'The workflow ID to retrieve' },
    },
    required: ['workflowId'],
    handler: async (client, args) => {
      const wf = client.workflowBuilder();
      const workflowId = args.workflowId as string;
      if (!workflowId) throw new Error('workflowId is required');
      const workflow = await wf.getWorkflow(workflowId);
      const triggers = await wf.listWorkflowTriggers(workflowId);
      return {
        id: workflow._id,
        name: workflow.name,
        status: workflow.status,
        version: workflow.version,
        actionCount: workflow.workflowData?.templates?.length || 0,
        actions: workflow.workflowData?.templates || [],
        triggers,
        url: `${APP_URL}/${wf.getLocationId()}/automation/workflow/${workflow._id}`,
      };
    },
  }),

  // ─── UPDATE ACTIONS ────────────────────────────────────────
  defineTool({
    name: 'ghl_update_workflow_actions',
    description:
      'Add or replace actions (and optionally triggers) in an existing workflow. ' +
      'Commits the same way as the CRM builder: validate-assets, then PUT (reuses autoSaveSessionId; retries commit-lock 422s). ' +
      'Actions are auto-chained unless explicit next/parentKey is provided for branching. ' +
      'If CRM returns a pending-commit 422 after retries, wait 2–3 minutes or save once in the builder — do not rapid-retry. ' +
      'Can also update workflow name and status.',
    properties: {
      workflowId: { type: 'string', description: 'The workflow ID to update' },
      name: { type: 'string', description: 'New workflow name (optional)' },
      actions: { type: 'array', description: 'New actions array — replaces all existing actions', items: WORKFLOW_ACTION_SCHEMA },
      triggers: { type: 'array', description: 'New triggers — replaces existing trigger records through dedicated trigger CRUD', items: WORKFLOW_TRIGGER_SCHEMA },
      status: { type: 'string', enum: ['draft', 'published'], description: 'Set workflow status' },
    },
    required: ['workflowId'],
    handler: async (client, args) => {
      const wf = client.workflowBuilder();
      const workflowId = args.workflowId as string;
      if (!workflowId) throw new Error('workflowId is required');
      const workflow = await wf.updateWorkflow(workflowId, {
        name: args.name as string | undefined,
        actions: args.actions as WorkflowAction[] | undefined,
        triggers: args.triggers as WorkflowTrigger[] | undefined,
        status: args.status as 'draft' | 'published' | undefined,
      });
      return {
        message: `Workflow "${workflow.name}" updated successfully`,
        id: workflow._id,
        name: workflow.name,
        status: workflow.status,
        version: workflow.version,
        actionCount: workflow.workflowData?.templates?.length || 0,
        actions: (workflow.workflowData?.templates || []).map((t, i) => ({ order: i, type: t.type, name: t.name, id: t.id })),
      };
    },
  }),

  // ─── DELETE ────────────────────────────────────────────────
  defineTool({
    name: 'ghl_delete_workflow',
    description: 'Permanently delete a workflow by ID. This cannot be undone. Returns confirmation of deletion.',
    properties: {
      workflowId: { type: 'string', description: 'The workflow ID to delete' },
    },
    required: ['workflowId'],
    handler: async (client, args) => {
      const wf = client.workflowBuilder();
      const workflowId = args.workflowId as string;
      if (!workflowId) throw new Error('workflowId is required');
      await wf.deleteWorkflow(workflowId);
      return { message: `Workflow ${workflowId} deleted successfully`, workflowId };
    },
  }),

  // ─── PUBLISH ───────────────────────────────────────────────
  defineTool({
    name: 'ghl_publish_workflow',
    description:
      'Publish a draft workflow, making it active and able to be triggered. ' +
      'Equivalent to flipping status from "draft" to "published". Returns the updated workflow state.',
    properties: {
      workflowId: { type: 'string', description: 'The workflow ID to publish' },
    },
    required: ['workflowId'],
    handler: async (client, args) => {
      const wf = client.workflowBuilder();
      const workflowId = args.workflowId as string;
      if (!workflowId) throw new Error('workflowId is required');
      const workflow = await wf.publishWorkflow(workflowId);
      return {
        message: `Workflow "${workflow.name}" published successfully`,
        id: workflow._id,
        name: workflow.name,
        status: workflow.status,
        version: workflow.version,
      };
    },
  }),

  // ─── CLONE ─────────────────────────────────────────────────
  defineTool({
    name: 'ghl_clone_workflow',
    description:
      'Duplicate an existing workflow with a new name. Clones all actions and triggers ' +
      'with remapped IDs. The clone starts as a draft. Returns the new workflow with its ID and full action data.',
    properties: {
      workflowId: { type: 'string', description: 'The source workflow ID to clone' },
      newName: { type: 'string', description: 'Name for the cloned workflow (default: "{original name} (copy)")' },
    },
    required: ['workflowId'],
    handler: async (client, args) => {
      const wf = client.workflowBuilder();
      const workflowId = args.workflowId as string;
      if (!workflowId) throw new Error('workflowId is required');
      const workflow = await wf.cloneWorkflow(workflowId, args.newName as string | undefined);
      return {
        message: `Workflow cloned as "${workflow.name}"`,
        sourceId: workflowId,
        newWorkflow: {
          id: workflow._id,
          name: workflow.name,
          status: workflow.status,
          version: workflow.version,
          actionCount: workflow.workflowData?.templates?.length || 0,
          url: `${APP_URL}/${wf.getLocationId()}/automation/workflow/${workflow._id}`,
        },
      };
    },
  }),
];
