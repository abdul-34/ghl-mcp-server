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

import { lookupNativeModule, isIntegrationKey } from './native-workflow-catalog.js';
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

/** Structural builder constructs that are always valid even if not in the catalog. */
const STRUCTURAL_TYPES = new Set([
  'goto', 'if_else', 'condition', 'branch', 'transition', 'filter', 'fork', 'join', 'end', 'wait',
]);

/** Point the caller at the right discovery tool based on how the key looks. */
function discoveryHint(type: string): string {
  return isIntegrationKey(type)
    ? 'crm_search_workflow_modules (installed marketplace app)'
    : 'crm_search_native_workflow_modules';
}

/** True if `type` is a valid module of the given kind (static catalog or live list). */
function isKnownModule(type: string, kind: 'action' | 'trigger', knownKeys?: Set<string>): boolean {
  if (lookupNativeModule(type, kind) || lookupNativeModule(type)) return true;
  return Boolean(knownKeys && knownKeys.has(type));
}

/**
 * Validate a workflow graph locally — the checks GHL's validate-assets skips.
 * Actions: type existence, required fields, dangling next/parentKey, goto targets,
 * duplicate ids. Triggers: type existence and condition-operator legality.
 */
export function validateWorkflowGraph(
  actions: WorkflowAction[] = [],
  triggers: WorkflowTrigger[] = [],
  opts: { knownKeys?: Set<string> } = {}
): LocalValidation {
  const issues: string[] = [];
  const ids = new Set<string>();
  collectIds(actions, ids);

  // Duplicate top-level action ids — every node id must be unique.
  const seenIds = new Set<string>();
  for (const a of actions) {
    if (a && typeof a.id === 'string' && a.id) {
      if (seenIds.has(a.id)) issues.push(`Duplicate action id "${a.id}" — every node id must be unique.`);
      seenIds.add(a.id);
    }
  }

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

    // (1) unknown module type — accept the static catalog, live list, or a structural type.
    const mod = lookupNativeModule(a.type, 'action') || lookupNativeModule(a.type);
    if (!mod) {
      if (!STRUCTURAL_TYPES.has(a.type) && !(opts.knownKeys && opts.knownKeys.has(a.type))) {
        issues.push(
          `${label}: unknown module type — not found in the workflow catalog or live module list. ` +
            `Discover the correct key with ${discoveryHint(a.type)}, or pass force:true if this is a ` +
            `freshly-installed marketplace app.`
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

    // (3) dangling graph references (next/parentKey)
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

    // (4) goto target must resolve to a real node (back-edges allowed, existence required)
    if (a.type === 'goto') {
      const attrs = a.attributes && typeof a.attributes === 'object' ? (a.attributes as Record<string, unknown>) : {};
      const target = attrs.targetNodeId ?? attrs.targetStepId ?? attrs.nodeId;
      if (typeof target !== 'string' || !target) {
        issues.push(`${label}: goto is missing attributes.targetNodeId.`);
      } else if (!ids.has(target)) {
        issues.push(`${label}: goto.targetNodeId "${target}" points to a node no action declares.`);
      }
    }
  });

  // ── Triggers ────────────────────────────────────────────
  triggers.forEach((t, i) => {
    const label = `trigger[${i}]${t?.type ? ` "${t.type}"` : ''}`;
    if (!t || typeof t !== 'object') {
      issues.push(`${label}: not an object.`);
      return;
    }
    if (typeof t.type !== 'string' || !t.type.trim()) {
      issues.push(`${label}: missing "type".`);
      return;
    }

    // (1) unknown trigger type — same check as actions, applied to triggers.
    if (!isKnownModule(t.type, 'trigger', opts.knownKeys)) {
      issues.push(
        `${label}: unknown trigger type — a workflow with this trigger can never fire. ` +
          `Discover the correct key with ${discoveryHint(t.type)}.`
      );
      return;
    }

    // (2) condition operators must be legal for the field (when the module schema is known).
    const mod = lookupNativeModule(t.type, 'trigger') || lookupNativeModule(t.type);
    const filters = (mod?.filters as Array<Record<string, unknown>> | undefined) || [];
    if (!filters.length || !Array.isArray(t.conditions)) return;
    t.conditions.forEach((c, ci) => {
      if (!c || typeof c !== 'object') return;
      const cond = c as Record<string, unknown>;
      const field = String(cond.field ?? cond.key ?? cond.id ?? '').trim();
      const op = cond.operator ?? cond.op ?? cond.operatorValue;
      if (!field || op == null) return;
      const filt = filters.find((f) => String(f.field ?? f.name ?? '').trim() === field);
      const allowed = filt && Array.isArray(filt.allowedOperators) ? (filt.allowedOperators as unknown[]) : null;
      if (allowed && allowed.length && !allowed.includes(op)) {
        issues.push(
          `${label} condition[${ci}]: operator "${String(op)}" is not allowed for field "${field}" ` +
            `(allowed: ${allowed.map(String).join(', ')}).`
        );
      }
    });
  });

  return { valid: issues.length === 0, issues };
}
