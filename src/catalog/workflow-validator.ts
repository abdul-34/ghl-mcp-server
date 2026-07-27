/**
 * Local workflow-graph validation — the safety net GHL's own validate-assets
 * lacks. It catches, before anything is written to a live account:
 *   1. unknown action types (typos / fabricated modules)
 *   2. missing required fields for known modules
 *   3. dangling next/parentKey references (broken graph edges)
 *
 * These are advisory in crm_validate_workflow and blocking (with a force
 * override) in ghl_create_workflow / ghl_update_workflow_actions.
 */

import { lookupNativeModule } from './native-workflow-catalog.js';
import { WorkflowAction, WorkflowTrigger } from '../crm/workflow-builder-client.js';

export interface LocalValidation {
  valid: boolean;
  issues: string[];
}

/** Recursively collect every string under an `id` key — top-level action ids AND
 *  nested branch/transition ids (multipath waits define transitions in attributes). */
function collectIds(node: unknown, into: Set<string>): void {
  if (Array.isArray(node)) {
    for (const n of node) collectIds(n, into);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === 'id' && typeof v === 'string' && v) into.add(v);
      collectIds(v, into);
    }
  }
}

function isDynamicModule(inputs: Array<Record<string, unknown>> | undefined): boolean {
  if (!Array.isArray(inputs)) return false;
  return inputs.some((inp) => {
    if (!inp || typeof inp !== 'object') return false;
    const ft = typeof inp.fieldType === 'string' ? inp.fieldType.toLowerCase() : '';
    return Boolean(inp.dynamicFieldsConfig) || ft.includes('dynamic');
  });
}

/**
 * Validate an action graph locally. Triggers are accepted for signature parity
 * but only actions carry the structure we can check offline.
 */
export function validateWorkflowGraph(
  actions: WorkflowAction[] = [],
  _triggers: WorkflowTrigger[] = [],
  opts: { knownKeys?: Set<string> } = {}
): LocalValidation {
  const issues: string[] = [];
  const ids = new Set<string>();
  collectIds(actions, ids);

  actions.forEach((a, i) => {
    const label = `action[${i}]${a?.type ? ` "${a.type}"` : ''}`;

    if (!a || typeof a !== 'object') {
      issues.push(`${label}: not an object.`);
      return;
    }
    if (typeof a.type !== 'string' || !a.type.trim()) {
      issues.push(`${label}: missing "type".`);
      return;
    }

    // (1) unknown module type — accept the static catalog OR the live module list.
    const mod = lookupNativeModule(a.type, 'action') || lookupNativeModule(a.type);
    if (!mod) {
      // Known via the live list but no static schema → skip field checks (we can't
      // verify required fields without a schema), but it's a valid module.
      if (opts.knownKeys && opts.knownKeys.has(a.type)) {
        // valid key, no static schema to check against
      } else {
        issues.push(
          `${label}: unknown module type — not found in the workflow catalog or live module list. ` +
            `Discover the correct key with crm_search_native_workflow_modules, or pass force:true ` +
            `if this is a freshly-installed marketplace app.`
        );
      }
    } else {
      // (2) required fields (skip dynamic modules — values are resolved live)
      const inputs = (mod.inputs as Array<Record<string, unknown>> | undefined) || [];
      if (!isDynamicModule(inputs)) {
        const attrs = a.attributes && typeof a.attributes === 'object' ? (a.attributes as Record<string, unknown>) : {};
        for (const inp of inputs) {
          if (!inp || inp.required !== true) continue;
          const field = String(inp.field || inp.name || '').trim();
          if (!field) continue;
          const v = attrs[field];
          if (v === undefined || v === null || v === '') {
            issues.push(`${label}: missing required field "${field}".`);
          }
        }
      }
    }

    // (3) dangling graph references
    const refs: string[] = [];
    if (typeof a.next === 'string') refs.push(a.next);
    else if (Array.isArray(a.next)) for (const x of a.next) if (typeof x === 'string') refs.push(x);
    if (typeof a.parentKey === 'string') refs.push(a.parentKey);
    for (const r of refs) {
      if (r && !ids.has(r)) {
        issues.push(
          `${label}: "next"/"parentKey" points to node id "${r}" which no action declares. ` +
            `For branching, give the target action (or transition) an explicit matching "id".`
        );
      }
    }
  });

  return { valid: issues.length === 0, issues };
}
