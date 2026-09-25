/**
 * Typed mutations over a form's fields array.
 *
 * The forms API replaces formData wholesale, so the model never authors the whole
 * document: it describes a change (add / remove / move / update) and these pure
 * functions apply it to a deep copy of the current document.
 */

import type { FormField } from '../crm/forms-builder-client.js';
import {
  buildStandardField,
  buildCustomField,
  CustomFieldRecord,
  FieldOverrides,
  DEFAULT_SUBMIT_FIELD,
} from './form-fields.js';

/** Describes one form element to build. Exactly one of `tag` / `customFieldId`. */
export interface FieldSpec extends FieldOverrides {
  /** Standard palette tag (first_name, email, html, button, ...). */
  tag?: string;
  /** Id of an existing custom field in the location's registry. */
  customFieldId?: string;
  /** Render a NUMERICAL custom field as a Score element. */
  displayAs?: 'score';
}

/** Target an existing element by tag (first match) or by 0-based index. */
export interface FieldRef {
  tag?: string;
  index?: number;
}

export type FieldMutation =
  | { op: 'add'; field: FieldSpec; index?: number }
  | { op: 'remove'; ref: FieldRef }
  | { op: 'move'; ref: FieldRef; index: number }
  | { op: 'update'; ref: FieldRef; changes: FieldOverrides };

export interface BuildContext {
  locationId: string;
  /** Custom-field registry, keyed by id. Required only when a spec uses customFieldId. */
  customFields?: Map<string, CustomFieldRecord>;
}

export function buildField(spec: FieldSpec, ctx: BuildContext): FormField {
  if (!spec || typeof spec !== 'object') throw new Error('Field spec must be an object.');
  const hasTag = typeof spec.tag === 'string' && spec.tag.length > 0;
  const hasCustom = typeof spec.customFieldId === 'string' && spec.customFieldId.length > 0;
  if (hasTag === hasCustom) {
    throw new Error('Each field spec needs exactly one of "tag" (standard element) or "customFieldId" (custom field).');
  }
  const { tag, customFieldId, displayAs, ...overrides } = spec;
  if (hasTag) {
    if (displayAs) throw new Error('displayAs applies only to custom fields.');
    return buildStandardField(tag!, overrides);
  }
  if (!ctx.customFields) {
    throw new Error('The custom-field registry could not be loaded for this location, so custom fields cannot be added.');
  }
  const record = ctx.customFields.get(customFieldId!);
  if (!record) {
    throw new Error(
      `Custom field "${customFieldId}" does not exist in this location. Create it first with ` +
        'locations_create_custom_field, or list ids with locations_get_custom_fields.'
    );
  }
  return buildCustomField(record, ctx.locationId, { ...overrides, displayAs });
}

/** Build a new form's fields list; appends a default submit button when none is given. */
export function buildFieldList(specs: FieldSpec[], ctx: BuildContext): FormField[] {
  if (!Array.isArray(specs) || specs.length === 0) throw new Error('fields must be a non-empty array.');
  const fields = specs.map((s, i) => {
    try {
      return buildField(s, ctx);
    } catch (err) {
      throw new Error(`fields[${i}]: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  if (!fields.some((f) => f.type === 'submit')) fields.push(structuredClone(DEFAULT_SUBMIT_FIELD));
  return fields;
}

export function resolveRef(fields: FormField[], ref: FieldRef, at: string): number {
  if (!ref || typeof ref !== 'object') throw new Error(`${at}: ref must be { tag } or { index }.`);
  if (typeof ref.index === 'number') {
    if (!Number.isInteger(ref.index) || ref.index < 0 || ref.index >= fields.length) {
      throw new Error(`${at}: index ${ref.index} is out of range (form has ${fields.length} elements).`);
    }
    if (ref.tag && fields[ref.index].tag !== ref.tag) {
      throw new Error(`${at}: element at index ${ref.index} has tag "${fields[ref.index].tag}", not "${ref.tag}".`);
    }
    return ref.index;
  }
  if (typeof ref.tag === 'string') {
    const matches = fields.map((f, i) => (f.tag === ref.tag ? i : -1)).filter((i) => i >= 0);
    if (matches.length === 0) {
      throw new Error(`${at}: no element with tag "${ref.tag}". Present: ${fields.map((f) => f.tag).join(', ')}.`);
    }
    if (matches.length > 1) {
      throw new Error(`${at}: tag "${ref.tag}" appears ${matches.length} times (indexes ${matches.join(', ')}); target it by index.`);
    }
    return matches[0];
  }
  throw new Error(`${at}: ref must include a tag or an index.`);
}

const IDENTITY_KEYS = new Set(['tag', 'id', 'type', 'dataType', 'fieldKey']);

/** Apply mutations in order to a copy of `fields`; returns the new array plus removed tags. */
export function applyFieldMutations(
  fields: FormField[],
  mutations: FieldMutation[],
  ctx: BuildContext
): { fields: FormField[]; removedTags: string[] } {
  if (!Array.isArray(mutations) || mutations.length === 0) throw new Error('mutations must be a non-empty array.');
  const out = structuredClone(fields);
  const removedTags: string[] = [];

  mutations.forEach((m, i) => {
    const at = `mutations[${i}]`;
    switch (m?.op) {
      case 'add': {
        const field = buildField(m.field, ctx);
        const idx = m.index === undefined ? defaultInsertIndex(out) : clampIndex(m.index, out.length, at);
        out.splice(idx, 0, field);
        break;
      }
      case 'remove': {
        const idx = resolveRef(out, m.ref, at);
        removedTags.push(out[idx].tag);
        out.splice(idx, 1);
        break;
      }
      case 'move': {
        const from = resolveRef(out, m.ref, at);
        const [el] = out.splice(from, 1);
        out.splice(clampIndex(m.index, out.length, at), 0, el);
        break;
      }
      case 'update': {
        const idx = resolveRef(out, m.ref, at);
        const changes = m.changes || {};
        const target = out[idx] as Record<string, unknown>;
        for (const k of ['label', 'placeholder', 'required', 'fieldWidthPercentage', 'hiddenFieldQueryKey', 'hidden'] as const) {
          if (changes[k] !== undefined) target[k] = changes[k];
        }
        if (changes.label !== undefined && target.custom === true) {
          // The builder keeps these in sync for custom elements.
          target.name = changes.label;
          target.customFieldLabel = changes.label;
        }
        if (changes.props && typeof changes.props === 'object') {
          for (const [k, v] of Object.entries(changes.props)) {
            if (IDENTITY_KEYS.has(k)) throw new Error(`${at}: "${k}" identifies the element and cannot be changed; remove and re-add instead.`);
            target[k] = v;
          }
        }
        break;
      }
      default:
        throw new Error(`${at}: op must be add, remove, move or update.`);
    }
  });

  return { fields: out, removedTags };
}

/** New elements go just before the submit button, so the button stays last. */
function defaultInsertIndex(fields: FormField[]): number {
  const submit = fields.findIndex((f) => f.type === 'submit');
  return submit >= 0 ? submit : fields.length;
}

function clampIndex(index: number, length: number, at: string): number {
  if (!Number.isInteger(index) || index < 0) throw new Error(`${at}: index must be a non-negative integer.`);
  return Math.min(index, length);
}

/** Drop conditional-logic rules that reference any of the given payload keys. */
export function pruneRulesReferencing(rules: unknown, tags: string[]): { rules: unknown; dropped: number } {
  if (!Array.isArray(rules) || tags.length === 0) return { rules, dropped: 0 };
  const gone = new Set(tags);
  const kept = rules.filter((r: any) => {
    const inConditions = Array.isArray(r?.conditions) && r.conditions.some((c: any) => gone.has(c?.selectedField));
    const targets = Array.isArray(r?.outcome?.value) ? r.outcome.value : [r?.outcome?.value];
    const inOutcome = r?.outcome?.type === 'showHideFields' && targets.some((t: unknown) => typeof t === 'string' && gone.has(t));
    return !inConditions && !inOutcome;
  });
  return { rules: kept.length ? kept : null, dropped: rules.length - kept.length };
}
