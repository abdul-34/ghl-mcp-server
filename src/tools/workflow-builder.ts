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
  isIntegrationKey,
} from '../catalog/native-workflow-catalog.js';

/** locationId as an OPTIONAL arg: pass it to fold in the complete live module list. */
const OPTIONAL_LOCATION = {
  locationId: {
    type: 'string',
    description:
      'Optional. Pass the sub-account id to merge the COMPLETE live module list (all valid keys for that ' +
      'account, e.g. add_contact_tag, if_else) on top of the static catalog. Omit for static-only results.',
  },
} as const;
import {
  findMarketplaceModuleByKey,
  slimMarketplaceSearchResults,
} from '../catalog/marketplace-module-slim.js';
import { validateWorkflowGraph } from '../catalog/workflow-validator.js';

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
      'create and verify each trigger separately, then optionally publish. ' +
      'Resolution chain for building valid actions: (1) crm_search_native_workflow_modules → crm_get_native_workflow_module ' +
      'for native modules, or crm_search_workflow_modules → crm_get_workflow_module for installed apps; ' +
      '(2) if the module has dynamic fields or no static schema, call crm_find_workflow_examples for a real payload; ' +
      '(3) optionally crm_validate_workflow to dry-run before creating. ' +
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
      force: { type: 'boolean', description: 'Skip local validation (unknown types / missing required fields / broken graph). Use only for freshly-installed marketplace apps not yet in the catalog.' },
    },
    required: ['name'],
    handler: async (client, args) => {
      const wf = client.workflowBuilder();
      const name = args.name as string;
      if (!name) throw new Error('name is required');

      const rawActions = args.actions as WorkflowAction[] | undefined;

      // Validate BEFORE creating the draft so we never persist a broken graph.
      if (rawActions && rawActions.length && args.force !== true) {
        let knownKeys: Set<string> | undefined;
        try { knownKeys = await wf.getKnownModuleKeys(); } catch { /* live list optional */ }
        const local = validateWorkflowGraph(rawActions, [], { knownKeys });
        if (!local.valid) {
          throw new Error(
            `Workflow not created — local validation failed:\n- ${local.issues.join('\n- ')}\n` +
              `Fix these (use crm_get_native_workflow_module / crm_find_workflow_examples), or pass force:true to override.`
          );
        }
      }

      const { id } = await wf.createWorkflow(name);

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
      ...OPTIONAL_LOCATION,
    },
    requiresLocation: false,
    handler: async (client, args) => {
      const type = (args.type as 'actions' | 'triggers' | 'both' | undefined) || 'both';
      if (type !== 'actions' && type !== 'triggers' && type !== 'both') {
        throw new Error('type must be actions, triggers, or both');
      }
      if (args.listSections === true) return listNativeWorkflowSections(type);

      const limit = Math.min(Math.max(Number(args.limit ?? 15), 1), 50);
      const query = (args.query as string | undefined) || '';
      const staticRes = searchNativeWorkflowModules({
        query,
        type,
        section: args.section as string | undefined,
        limit: limit * 2,
      });
      let results: any[] = staticRes.results;
      let source = staticRes.source;

      // Merge the complete LIVE module list when a client is available. The static
      // catalog only has ~239 actions; the live list has all ~381 (add_contact_tag,
      // if_else, …). Live-only entries have a label but no static schema.
      if (client && !args.section) {
        try {
          const wf = client.workflowBuilder();
          const listed = await wf.fetchModuleList();
          const live = type === 'triggers' ? listed.triggers : type === 'actions' ? listed.actions : [...listed.actions, ...listed.triggers];
          const staticKeys = new Set(results.map((r) => r.key));
          const q = query.trim().toLowerCase();
          const tokens = q.split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
          const scoreLive = (value: string, label: string): number => {
            const k = value.toLowerCase();
            const l = label.toLowerCase();
            if (!q) return 1;
            let s = 0;
            if (k === q || l === q) s += 1000;
            if (k.includes(q)) s += 400;
            if (l.includes(q)) s += 350;
            let all = tokens.length > 0;
            for (const t of tokens) {
              const inK = k.includes(t);
              const inL = l.includes(t);
              if (inK) s += 60;
              if (inL) s += 55;
              if (!inK && !inL) all = false;
            }
            if (all) s += 200;
            if (!isIntegrationKey(value)) s += 300; // native boost
            return s;
          };
          const liveHits = live
            .filter((m) => !staticKeys.has(m.value))
            .map((m) => ({ key: m.value, name: m.label, section: 'live', source: 'live-list', hasSchema: false, score: scoreLive(m.value, m.label) }))
            .filter((h) => !q || h.score > 1);
          results = [...results, ...liveHits].sort((a, b) => (b.score || 0) - (a.score || 0));
          source = 'static-catalog + live-module-list';
        } catch {
          /* live list unavailable — static-only */
        }
      }

      results = results.slice(0, limit);
      return {
        source,
        resultCount: results.length,
        results,
        note:
          'Entries with hasSchema:false come from the live module list (valid key + label, no static input ' +
          'schema) — call crm_find_workflow_examples for a real payload. Others have full inputs via ' +
          'crm_get_native_workflow_module.',
      };
    },
  }),

  defineTool({
    name: 'crm_get_native_workflow_module',
    description:
      'Load ONE native CRM workflow module by exact key from the local catalog ' +
      '(examples: contact_created, appointment, customer_appointment, opportunity_created, ' +
      'opportunity_status_changed, opportunity_decay, email, sms, wait, create_update_contact, find_contact). ' +
      'Returns inputs/filters plus exampleAttributes / exampleAttributesVariants / exampleTrigger / exampleNodes. ' +
      'Use after crm_search_native_workflow_modules. Runtime code blobs are omitted. ' +
      'If the response includes `dynamicFields` or a `resolution` hint (dynamic-value or schema-less module), ' +
      'call crm_find_workflow_examples with this key to get a real payload instead of guessing values.',
    properties: {
      key: { type: 'string', description: 'Exact module key, for example am-add-lead or asana_ia_asana_create_task' },
      type: { type: 'string', enum: ['actions', 'triggers', 'both'], description: 'Optional kind filter when the same key might exist in both catalogs' },
      ...OPTIONAL_LOCATION,
    },
    required: ['key'],
    requiresLocation: false,
    handler: async (client, args) => {
      const key = args.key as string;
      if (!key) throw new Error('key is required');
      const type = (args.type as 'actions' | 'triggers' | 'both' | undefined) || 'both';
      if (type !== 'actions' && type !== 'triggers' && type !== 'both') {
        throw new Error('type must be actions, triggers, or both');
      }
      const result = getNativeWorkflowModule({ key, type });

      // Static miss but a client is available → check the live module list. The key
      // may be a real module (e.g. add_contact_tag) whose schema just isn't bundled.
      if (!result.found && client) {
        try {
          const wf = client.workflowBuilder();
          const listed = await wf.fetchModuleList();
          const hit = [...listed.actions, ...listed.triggers].find((m) => m.value === key);
          if (hit) {
            return {
              source: 'live-module-list',
              found: true,
              key,
              label: hit.label,
              hasStaticSchema: false,
              resolution:
                `"${hit.label}" is a valid module, but its input schema isn't in the static catalog. ` +
                `Call crm_find_workflow_examples with key "${key}" to get a real payload from your workflows.`,
              note: 'Resolved from the live module list (no bundled input schema).',
            };
          }
        } catch {
          /* live list unavailable — return the static miss */
        }
      }
      return result;
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

  // ─── EXAMPLE MINING (ground truth for dynamic/stub schemas) ─
  defineTool({
    name: 'crm_find_workflow_examples',
    description:
      'Return REAL example payloads for an action/trigger type, mined from this sub-account\'s own live ' +
      'workflows. Use this when a native module has dynamic fields (values generated live by GHL), is a ' +
      'third-party app stub, or you want the exact attributes/conditions shape before building. This is the ' +
      'ground-truth source the static catalog can\'t provide. Pass the exact catalog key (from ' +
      'crm_search_native_workflow_modules) as `type`. Returns the actual attributes/conditions used, with the ' +
      'source workflow. Scans a bounded set of workflows once per session (cached).',
    properties: {
      type: { type: 'string', description: 'Exact action/trigger key (module key), e.g. "send_sms" or "contact_created".' },
      kind: { type: 'string', enum: ['action', 'trigger'], description: 'Restrict to action or trigger examples (optional).' },
      limit: { type: 'number', minimum: 1, maximum: 20, description: 'Max distinct examples to return (default 3).' },
      maxWorkflows: { type: 'number', minimum: 1, maximum: 100, description: 'Max workflows to scan when building the index (default 25).' },
      refresh: { type: 'boolean', description: 'Rebuild the example index instead of using the cached one.' },
    },
    required: ['type'],
    handler: async (client, args) => {
      const wf = client.workflowBuilder();
      const type = args.type as string;
      if (!type) throw new Error('type is required');
      const result = await wf.findExamples({
        type,
        kind: args.kind as 'action' | 'trigger' | undefined,
        limit: args.limit as number | undefined,
        maxWorkflows: args.maxWorkflows as number | undefined,
        refresh: args.refresh as boolean | undefined,
      });
      return {
        type: result.type,
        workflowsScanned: result.workflowsScanned,
        exampleCount: result.examples.length,
        examples: result.examples,
        note: result.examples.length
          ? 'These are real payloads from your workflows. Copy the attributes/conditions shape when building.'
          : `No workflow in the scanned set uses "${type}". Try a higher maxWorkflows, or build from the module schema / crm_get_workflow_module.`,
      };
    },
  }),

  // ─── VALIDATE (dry-run) ─────────────────────────────────────
  defineTool({
    name: 'crm_validate_workflow',
    description:
      'Dry-run a workflow graph through the CRM builder\'s validate-assets preflight WITHOUT creating or ' +
      'modifying anything. Returns whether the actions/triggers are valid and any issues found, so you can ' +
      'fix attributes before calling ghl_create_workflow / ghl_update_workflow_actions. Recommended after ' +
      'building actions from a module schema, especially for dynamic-field modules.',
    properties: {
      actions: {
        type: 'array',
        description: 'Action graph to validate. Same shape as ghl_create_workflow.',
        items: WORKFLOW_ACTION_SCHEMA,
      },
      triggers: {
        type: 'array',
        description: 'Triggers to validate alongside the actions (optional).',
        items: WORKFLOW_TRIGGER_SCHEMA,
      },
    },
    handler: async (client, args) => {
      const wf = client.workflowBuilder();
      const actions = (args.actions as WorkflowAction[] | undefined) || [];
      const triggers = (args.triggers as WorkflowTrigger[] | undefined) || [];

      // Local checks (unknown types, required fields, graph integrity) that GHL's
      // own validate-assets does NOT perform. Accept keys from the live module list.
      let knownKeys: Set<string> | undefined;
      try { knownKeys = await wf.getKnownModuleKeys(); } catch { /* live list optional */ }
      const local = validateWorkflowGraph(actions, triggers, { knownKeys });

      // Server preflight (GHL's own rules). Tolerate failures so local issues
      // still surface if the server call errors.
      let serverValid = true;
      let serverIssues: string[] = [];
      try {
        const server = await wf.validateWorkflow(actions, triggers);
        serverValid = server.valid;
        serverIssues = server.issues;
      } catch (err: any) {
        serverValid = false;
        serverIssues = [`validate-assets call failed: ${err.message}`];
      }

      const issues = [...local.issues, ...serverIssues];
      const valid = local.valid && serverValid;
      return {
        valid,
        localIssues: local.issues,
        serverIssues,
        issues,
        note: valid
          ? 'No issues found (local checks + GHL validate-assets) — safe to create/update.'
          : 'Fix the issues above before creating. For correct attribute values use crm_find_workflow_examples; for the right module key use crm_search_native_workflow_modules.',
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
      'For correct attribute values on dynamic/third-party modules, use crm_find_workflow_examples; ' +
      'dry-run with crm_validate_workflow before committing. Validation failures are returned with details. ' +
      'If CRM returns a pending-commit 422 after retries, wait 2–3 minutes or save once in the builder — do not rapid-retry. ' +
      'Can also update workflow name and status.',
    properties: {
      workflowId: { type: 'string', description: 'The workflow ID to update' },
      name: { type: 'string', description: 'New workflow name (optional)' },
      actions: { type: 'array', description: 'New actions array — replaces all existing actions', items: WORKFLOW_ACTION_SCHEMA },
      triggers: { type: 'array', description: 'New triggers — replaces existing trigger records through dedicated trigger CRUD', items: WORKFLOW_TRIGGER_SCHEMA },
      status: { type: 'string', enum: ['draft', 'published'], description: 'Set workflow status' },
      force: { type: 'boolean', description: 'Skip local validation (unknown types / missing required fields / broken graph).' },
    },
    required: ['workflowId'],
    handler: async (client, args) => {
      const wf = client.workflowBuilder();
      const workflowId = args.workflowId as string;
      if (!workflowId) throw new Error('workflowId is required');

      const newActions = args.actions as WorkflowAction[] | undefined;
      if (newActions && newActions.length && args.force !== true) {
        let knownKeys: Set<string> | undefined;
        try { knownKeys = await wf.getKnownModuleKeys(); } catch { /* live list optional */ }
        const local = validateWorkflowGraph(newActions, [], { knownKeys });
        if (!local.valid) {
          throw new Error(
            `Workflow not updated — local validation failed:\n- ${local.issues.join('\n- ')}\n` +
              `Fix these, or pass force:true to override.`
          );
        }
      }

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
