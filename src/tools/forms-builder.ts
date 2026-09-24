/**
 * Forms-builder tools (internal GHL API).
 *
 * End-to-end form management the public API can't do: create, edit fields,
 * conditional logic, on-submit action, styling, rename and delete. Each tool
 * reaches the sub-account's internal forms client via `client.formsBuilder()`,
 * authenticated with the agency's captured Firebase session.
 *
 * Every write is a read-modify-write of the COMPLETE formData (the API replaces it
 * wholesale), validated locally first and verified by read-back afterwards. See
 * docs/forms-builder-plan.md.
 */

import { ToolDef, defineTool } from './types.js';
import { CRMClient } from '../crm/client.js';
import { FormDocument, FormData, FormField, FormsBuilderClient } from '../crm/forms-builder-client.js';
import {
  STANDARD_FIELDS,
  CUSTOM_TYPE_MAP,
  CONDITION_OPERATORS,
  OUTCOME_TYPES,
  HIDE_TYPES,
  DISQUALIFY_ACTIONS,
  DISQUALIFY_TIMINGS,
  CustomFieldRecord,
  operatorsForType,
  payloadKeys,
} from '../catalog/form-fields.js';
import { buildDefaultFormData, formDataFromTemplate } from '../catalog/form-template.js';
import { applyGeneratedCSS } from '../catalog/form-css.js';
import { validateFormBody, FormValidationResult } from '../catalog/form-validator.js';
import {
  FieldMutation,
  FieldSpec,
  applyFieldMutations,
  buildFieldList,
  pruneRulesReferencing,
} from '../catalog/form-mutations.js';

// ─── Shared schemas ──────────────────────────────────────────

const FIELD_OVERRIDE_PROPS: Record<string, any> = {
  label: { type: 'string', description: 'Label shown on the form' },
  placeholder: { type: 'string' },
  required: { type: 'boolean' },
  fieldWidthPercentage: { type: 'number', description: '1–100; default 100' },
  hiddenFieldQueryKey: { type: 'string', description: 'URL query param that prefills the field' },
  props: {
    type: 'object',
    description:
      'Type-specific element props merged last, e.g. { html } for html, { placeholder } consent HTML for terms_and_conditions, ' +
      'submit styling (bgColor, color, borderRadius, fontSize, align, fullwidth...). Colours are 8-digit RRGGBBAA without "#".',
  },
};

const FIELD_SPEC_SCHEMA: Record<string, any> = {
  type: 'object',
  description:
    'One form element. Give EXACTLY ONE of: tag (standard palette element — see forms_builder_list_field_types) or ' +
    'customFieldId (an existing custom field id from locations_get_custom_fields; create one first with locations_create_custom_field).',
  properties: {
    tag: { type: 'string', enum: Object.keys(STANDARD_FIELDS) },
    customFieldId: { type: 'string' },
    displayAs: { type: 'string', enum: ['score'], description: 'Render a NUMERICAL custom field as a Score element' },
    ...FIELD_OVERRIDE_PROPS,
  },
  additionalProperties: false,
};

const FIELD_REF_SCHEMA: Record<string, any> = {
  type: 'object',
  description: 'Target element: { tag } (must be unique on the form) or { index } (0-based). Both = index checked against tag.',
  properties: { tag: { type: 'string' }, index: { type: 'number' } },
  additionalProperties: false,
};

const CONDITION_RULE_SCHEMA: Record<string, any> = {
  type: 'object',
  description:
    'Rules run top-down; the first matching redirect/message/disqualify wins, all show/hide rules apply. ' +
    'selectedField / show-hide values are SUBMISSION KEYS: the standard tag (first_name, email) or the custom field id.',
  properties: {
    conditionalOperation: { type: 'string', enum: ['then', 'and', 'or'], description: '"then" = exactly one condition' },
    conditions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          selectedField: { type: 'string' },
          selectedOperation: { type: 'string', enum: [...CONDITION_OPERATORS] },
          inputValue: {
            type: ['string', 'null'],
            description: 'String (numbers as strings); null for isEmpty/isFilled/isChecked/isNotChecked',
          },
        },
        required: ['selectedField', 'selectedOperation'],
        additionalProperties: true,
      },
    },
    outcome: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: [...OUTCOME_TYPES] },
        hideType: { type: 'string', enum: [...HIDE_TYPES], description: 'showHideFields only' },
        value: {
          description:
            'showHideFields: one key, or an array for "Hide Multiple"/"Show Multiple"; redirectToUrl: absolute URL; ' +
            'displayCustomMessage: HTML; disqualifyLead: HTML message or URL',
          oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
        },
        disqualifyAction: { type: 'string', enum: [...DISQUALIFY_ACTIONS] },
        disqualifyTiming: { type: 'string', enum: [...DISQUALIFY_TIMINGS] },
      },
      required: ['type'],
      additionalProperties: false,
    },
  },
  required: ['conditionalOperation', 'conditions', 'outcome'],
  additionalProperties: false,
};

const FORM_ACTION_SCHEMA: Record<string, any> = {
  type: 'object',
  description: 'On-submit behaviour.',
  properties: {
    action: { type: 'string', enum: ['redirect', 'message'] },
    redirectUrl: { type: 'string', description: 'Absolute URL (action "redirect")' },
    thankyouText: { type: 'string', description: 'HTML message (action "message")' },
  },
  required: ['action'],
  additionalProperties: false,
};

/** Form-level styling/layout keys the set_style tool may change (blueprint §3, §6). */
const STYLE_FORM_KEYS = [
  'layout', 'mobileLayout', 'inputStyleType', 'formLabelVisible', 'showImage', 'fullScreenMode',
  'width', 'height', 'customStyle', 'fieldCSS', 'mobileFieldCSS', 'isGDPRCompliant', 'enableTimezone',
] as const;

// ─── Helpers ─────────────────────────────────────────────────

/** Location custom-field registry (public API). Undefined when it can't be loaded. */
async function loadCustomFields(client: CRMClient): Promise<Map<string, CustomFieldRecord> | undefined> {
  try {
    const res = await client.get<{ customFields?: CustomFieldRecord[] }>(`/locations/${client.locationId}/customFields`);
    const list = Array.isArray(res?.customFields) ? res.customFields : [];
    return new Map(list.filter((f) => f && f.id).map((f) => [f.id, f]));
  } catch {
    return undefined;
  }
}

function hasCustomElements(fields: FormField[]): boolean {
  return fields.some((f) => f && (f.custom === true || f.standard === false));
}

function toFormAction(existing: Record<string, unknown> | undefined, spec: any): Record<string, unknown> {
  const base = { ...(existing || {}) };
  if (spec.action === 'redirect') {
    base.actionType = '1';
    base.redirectUrl = spec.redirectUrl ?? '';
  } else if (spec.action === 'message') {
    base.actionType = '2';
    base.thankyouText = spec.thankyouText ?? base.thankyouText ?? '';
  } else {
    throw new Error('formAction.action must be "redirect" or "message".');
  }
  return base;
}

function deepMerge(target: Record<string, any>, patch: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...(target || {}) };
  for (const [k, v] of Object.entries(patch || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object'
      ? deepMerge(out[k], v)
      : v;
  }
  return out;
}

function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stableStringify((v as any)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/** Compact, model-friendly view of a form document. */
export function summarizeForm(doc: FormDocument): Record<string, unknown> {
  const form = doc.formData?.form || ({ fields: [] } as any);
  const fields: FormField[] = Array.isArray(form.fields) ? form.fields : [];
  return {
    id: doc._id,
    name: doc.name,
    deleted: doc.deleted === true,
    dateUpdated: doc.dateUpdated,
    fieldCount: fields.length,
    fields: fields.map((f, index) => ({
      index,
      tag: f.tag,
      type: f.type,
      label: f.label,
      required: f.required === true,
      custom: f.custom === true || f.standard === false,
    })),
    submissionKeys: Array.from(payloadKeys(fields).keys()),
    conditionalLogic: form.conditionalLogic ?? null,
    formAction: form.formAction ?? null,
    styled: Boolean(form.fieldStyle),
    hasCaptcha: fields.some((f) => f.type === 'captcha'),
  };
}

async function validationContext(client: CRMClient, fields: FormField[]) {
  const registry = hasCustomElements(fields) ? await loadCustomFields(client) : undefined;
  return { registry, knownCustomFieldIds: registry ? new Set(registry.keys()) : undefined };
}

interface MutationOutcome {
  name?: string;
  formData: FormData;
  notes?: string[];
}

/**
 * The single write path: GET → deep clone → mutate → validate → POST complete
 * formData → poll until the write is visible. Validation only blocks issues the
 * mutation INTRODUCED; problems already present on the stored form are reported
 * as warnings so a builder-made quirk can't lock the form against edits.
 */
async function mutateForm(
  client: CRMClient,
  formId: string,
  mutate: (doc: FormDocument, formData: FormData) => MutationOutcome | Promise<MutationOutcome>
): Promise<Record<string, unknown>> {
  if (!formId) throw new Error('formId is required.');
  const fb = client.formsBuilder();
  const current = await fb.getForm(formId);
  if (current.deleted === true) throw new Error(`Form ${formId} is deleted.`);
  if (!current.formData?.form) throw new Error(`Form ${formId} has no formData.form — refusing to overwrite it.`);

  const working = structuredClone(current.formData);
  const outcome = await mutate(current, working);
  const name = outcome.name ?? current.name;
  const next = outcome.formData;

  const allFields = [...(current.formData.form.fields || []), ...(next.form.fields || [])];
  const { knownCustomFieldIds } = await validationContext(client, allFields);
  const before = validateFormBody(current.formData.form, { knownCustomFieldIds });
  const after = validateFormBody(next.form, { knownCustomFieldIds });
  const introduced = after.issues.filter((i) => !before.issues.includes(i));
  if (introduced.length) {
    throw new Error(`Form not changed — validation failed:\n- ${introduced.join('\n- ')}`);
  }

  await fb.updateForm(formId, name, next);
  const expected = stableStringify(next.form);
  const { verified } = await fb.waitForForm(
    formId,
    (doc) => doc.name === name && stableStringify(doc.formData?.form) === expected
  );
  const saved = await fb.getForm(formId);

  const warnings = [...after.warnings, ...before.issues.filter((i) => after.issues.includes(i)).map((i) => `pre-existing: ${i}`)];
  return {
    verified,
    ...(verified ? {} : { verificationNote: 'The write was accepted but the read-back did not match yet (reads lag writes by a few seconds). Re-check with forms_builder_get_form.' }),
    notes: [
      ...(outcome.notes || []),
      'Last write wins: edits made in the GHL builder between our read and write would be overwritten.',
    ],
    warnings,
    form: summarizeForm(saved),
  };
}

function fb(client: CRMClient): FormsBuilderClient {
  return client.formsBuilder();
}

// ─── Tools ───────────────────────────────────────────────────

export const formsBuilderTools: ToolDef[] = [
  defineTool({
    name: 'forms_builder_list_field_types',
    description:
      'Reference for building forms: the standard element palette (tags usable in forms_builder_create_form / ' +
      'forms_builder_update_fields), how custom-field data types map to form elements, and the conditional-logic ' +
      'operators allowed per element type. No sub-account needed.',
    requiresLocation: false,
    handler: async () => ({
      standardElements: Object.values(STANDARD_FIELDS).map((d) => ({
        tag: d.tag,
        type: d.type,
        label: d.label,
        displayOnly: d.displayOnly === true,
        repeatable: d.repeatable === true,
        verified: d.verified,
        ...(d.note ? { note: d.note } : {}),
      })),
      customFieldTypes: Object.entries(CUSTOM_TYPE_MAP).map(([registryType, el]) => ({
        registryDataType: registryType,
        formType: el.type,
        ...(registryType === 'NUMERICAL' ? { note: 'Pass displayAs:"score" to render as a Score element.' } : {}),
      })),
      customFieldHowTo:
        'Custom elements need an existing custom field: list with locations_get_custom_fields, create with ' +
        'locations_create_custom_field, then pass its id as customFieldId.',
      conditionalLogic: {
        operatorsByType: Object.fromEntries(
          ['text', 'email', 'large_text', 'single_options', 'radio', 'multiple_options', 'numerical', 'monetory', 'score', 'rating', 'date', 'checkbox', 'terms_and_conditions']
            .map((t) => [t, operatorsForType(t)])
        ),
        outcomeTypes: OUTCOME_TYPES,
        hideTypes: HIDE_TYPES,
        disqualifyActions: DISQUALIFY_ACTIONS,
        disqualifyTimings: DISQUALIFY_TIMINGS,
        keyRule: 'selectedField and show/hide values are submission keys: standard tag or custom field id.',
      },
      colours: '8-digit RRGGBBAA hex without "#", e.g. 155EEFFF.',
    }),
  }),

  defineTool({
    name: 'forms_builder_list_forms',
    description: 'List forms in a sub-account via the internal forms-builder API (ids and names).',
    properties: {
      limit: { type: 'number', description: 'Default 20' },
      skip: { type: 'number', description: 'Default 0' },
      type: { type: 'string', description: 'Optional list type filter passed through as-is (the builder UI sends "folder")' },
    },
    handler: async (client, args) => {
      const res = await fb(client).listForms({ limit: args.limit, skip: args.skip, type: args.type });
      return {
        total: res.total,
        forms: res.forms.map((f) => ({
          id: f._id ?? f.id,
          name: f.name,
          dateAdded: f.dateAdded,
          dateUpdated: f.dateUpdated,
          ...(f.type ? { type: f.type } : {}),
        })),
      };
    },
  }),

  defineTool({
    name: 'forms_builder_get_form',
    description:
      'Get one form. view "summary" (default) lists elements (index, tag, type, label), submission keys, conditional ' +
      'logic and on-submit action. view "full" returns the raw stored document (large).',
    properties: {
      formId: { type: 'string' },
      view: { type: 'string', enum: ['summary', 'full'] },
    },
    required: ['formId'],
    handler: async (client, args) => {
      const doc = await fb(client).getForm(args.formId);
      return args.view === 'full' ? doc : summarizeForm(doc);
    },
  }),

  defineTool({
    name: 'forms_builder_validate_form',
    description:
      'Dry-run: validate a stored form, optionally with candidate conditionalLogic and/or formAction applied, without writing anything.',
    properties: {
      formId: { type: 'string' },
      conditionalLogic: { type: ['array', 'null'], items: CONDITION_RULE_SCHEMA },
      formAction: FORM_ACTION_SCHEMA,
    },
    required: ['formId'],
    handler: async (client, args) => {
      const doc = await fb(client).getForm(args.formId);
      const form = structuredClone(doc.formData.form);
      if (args.conditionalLogic !== undefined) form.conditionalLogic = args.conditionalLogic;
      if (args.formAction) form.formAction = toFormAction(form.formAction as any, args.formAction);
      const { knownCustomFieldIds } = await validationContext(client, form.fields || []);
      const result: FormValidationResult = validateFormBody(form, { knownCustomFieldIds });
      return { ...result, submissionKeys: Array.from(payloadKeys(form.fields || []).keys()) };
    },
  }),

  defineTool({
    name: 'forms_builder_create_form',
    description:
      'Create a complete, styled form. Built from a vetted default document (theme, input styling, thank-you message) — or from an ' +
      'existing form via templateFormId — with your elements swapped in. A submit button is appended when none is given. ' +
      'Validated before anything is created; verified by read-back after. Avoid a captcha element if the form must be ' +
      'submitted programmatically.',
    properties: {
      name: { type: 'string' },
      fields: { type: 'array', items: FIELD_SPEC_SCHEMA, description: 'Elements in display order' },
      formAction: FORM_ACTION_SCHEMA,
      conditionalLogic: { type: 'array', items: CONDITION_RULE_SCHEMA },
      fieldStyle: {
        type: 'object',
        description: 'Partial fieldStyle merged over the defaults (bgColor, fontColor, primaryColor, border{}, labelColor, labelFontSize...)',
      },
      templateFormId: {
        type: 'string',
        description: 'Copy styling/settings from this existing form instead of the built-in default (its fields and logic are not copied).',
      },
    },
    required: ['name', 'fields'],
    handler: async (client, args) => {
      const forms = fb(client);
      const name = String(args.name || '').trim();
      if (!name) throw new Error('name is required.');
      const specs = args.fields as FieldSpec[];
      const needsRegistry = Array.isArray(specs) && specs.some((s) => s && s.customFieldId);
      const registry = needsRegistry ? await loadCustomFields(client) : undefined;
      const fields = buildFieldList(specs, { locationId: client.locationId, customFields: registry });

      let formData: FormData;
      const notes: string[] = [];
      if (args.templateFormId) {
        const template = await forms.getForm(args.templateFormId);
        if (!template.formData?.form) throw new Error(`Template form ${args.templateFormId} has no formData.form.`);
        formData = formDataFromTemplate(template.formData, fields);
        notes.push(`Settings copied from "${template.name}" (${template._id}); its fields and conditional logic were not copied.`);
      } else {
        formData = buildDefaultFormData(fields);
      }
      if (args.fieldStyle) {
        formData.form.fieldStyle = deepMerge(formData.form.fieldStyle as any, args.fieldStyle);
        // The public page renders inputs from fieldCSS, not fieldStyle.
        applyGeneratedCSS(formData.form);
      }
      if (args.formAction) formData.form.formAction = toFormAction(formData.form.formAction as any, args.formAction);
      if (args.conditionalLogic) formData.form.conditionalLogic = args.conditionalLogic;

      const check = validateFormBody(formData.form, {
        knownCustomFieldIds: registry ? new Set(registry.keys()) : undefined,
      });
      if (!check.valid) throw new Error(`Form not created — validation failed:\n- ${check.issues.join('\n- ')}`);

      const created = await forms.createForm(name, formData);
      const expected = stableStringify(formData.form);
      const { verified, doc } = await forms.waitForForm(
        created._id,
        (d) => stableStringify(d.formData?.form) === expected
      );
      return {
        message: `Form "${name}" created`,
        verified,
        ...(verified ? {} : { verificationNote: 'Created, but the read-back did not match yet. Re-check with forms_builder_get_form.' }),
        notes,
        warnings: check.warnings,
        form: summarizeForm(doc || created),
      };
    },
  }),

  defineTool({
    name: 'forms_builder_update_fields',
    description:
      'Add, remove, move or edit form elements, applied in order to the stored form (the rest of the form is preserved). ' +
      'ops: {op:"add", field, index?} (default: just before the submit button) · {op:"remove", ref} · ' +
      '{op:"move", ref, index} · {op:"update", ref, changes}. Removing an element that conditional logic references is ' +
      'rejected unless dropDanglingRules is true.',
    properties: {
      formId: { type: 'string' },
      mutations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            op: { type: 'string', enum: ['add', 'remove', 'move', 'update'] },
            field: FIELD_SPEC_SCHEMA,
            ref: FIELD_REF_SCHEMA,
            index: { type: 'number' },
            changes: { type: 'object', properties: FIELD_OVERRIDE_PROPS, additionalProperties: false },
          },
          required: ['op'],
          additionalProperties: false,
        },
      },
      dropDanglingRules: { type: 'boolean', description: 'Also delete conditional-logic rules that reference removed elements' },
      name: { type: 'string', description: 'Optional rename in the same write' },
    },
    required: ['formId', 'mutations'],
    handler: async (client, args) => {
      const muts = args.mutations as FieldMutation[];
      const needsRegistry = Array.isArray(muts) && muts.some((m: any) => m?.op === 'add' && m.field?.customFieldId);
      const registry = needsRegistry ? await loadCustomFields(client) : undefined;
      return mutateForm(client, args.formId, (_doc, formData) => {
        const { fields, removedTags } = applyFieldMutations(formData.form.fields || [], muts, {
          locationId: client.locationId,
          customFields: registry,
        });
        formData.form.fields = fields;
        const notes: string[] = [];
        const stillPresent = new Set(fields.map((f) => f.tag));
        const gone = removedTags.filter((t) => !stillPresent.has(t));
        if (args.dropDanglingRules === true && gone.length) {
          const pruned = pruneRulesReferencing(formData.form.conditionalLogic, gone);
          formData.form.conditionalLogic = pruned.rules;
          if (pruned.dropped) notes.push(`Dropped ${pruned.dropped} conditional-logic rule(s) that referenced removed elements.`);
        }
        return { formData, name: args.name, notes };
      });
    },
  }),

  defineTool({
    name: 'forms_builder_set_conditional_logic',
    description:
      'Replace (default) or append conditional-logic rules on a form, or pass rules: null to clear them. Every selectedField and ' +
      'show/hide target is checked against the form\'s real submission keys and operators against the element type.',
    properties: {
      formId: { type: 'string' },
      rules: { type: ['array', 'null'], items: CONDITION_RULE_SCHEMA },
      mode: { type: 'string', enum: ['replace', 'append'] },
    },
    required: ['formId', 'rules'],
    handler: async (client, args) =>
      mutateForm(client, args.formId, (_doc, formData) => {
        const rules = args.rules as unknown[] | null;
        if (rules === null) {
          formData.form.conditionalLogic = null;
        } else if (args.mode === 'append') {
          const existing = Array.isArray(formData.form.conditionalLogic) ? formData.form.conditionalLogic : [];
          formData.form.conditionalLogic = [...existing, ...rules];
        } else {
          formData.form.conditionalLogic = rules.length ? rules : null;
        }
        return { formData };
      }),
  }),

  defineTool({
    name: 'forms_builder_set_form_action',
    description: 'Set what happens on submit: redirect to a URL, or show an HTML thank-you message.',
    properties: { formId: { type: 'string' }, ...FORM_ACTION_SCHEMA.properties },
    required: ['formId', 'action'],
    handler: async (client, args) =>
      mutateForm(client, args.formId, (_doc, formData) => {
        formData.form.formAction = toFormAction(formData.form.formAction as any, args);
        return { formData };
      }),
  }),

  defineTool({
    name: 'forms_builder_set_style',
    description:
      'Change form styling: fieldStyle (partial, deep-merged — bgColor, fontColor, primaryColor, border{border,color,radius,type}, ' +
      'padding{}, shadow{}, labelColor, labelFontFamily, labelFontSize, placeholderColor...), submitButton (props merged onto the ' +
      'submit element — bgColor, color, borderRadius, fontSize, align, fullwidth, label...), and form-level layout keys. ' +
      'Colours are 8-digit RRGGBBAA without "#".',
    properties: {
      formId: { type: 'string' },
      fieldStyle: { type: 'object' },
      submitButton: { type: 'object' },
      formSettings: {
        type: 'object',
        description: `Form-level keys: ${STYLE_FORM_KEYS.join(', ')}`,
        properties: Object.fromEntries(STYLE_FORM_KEYS.map((k) => [k, {}])),
        additionalProperties: false,
      },
    },
    required: ['formId'],
    handler: async (client, args) => {
      if (!args.fieldStyle && !args.submitButton && !args.formSettings) {
        throw new Error('Pass at least one of fieldStyle, submitButton or formSettings.');
      }
      return mutateForm(client, args.formId, (_doc, formData) => {
        const form = formData.form;
        if (args.fieldStyle) {
          form.fieldStyle = deepMerge(form.fieldStyle as any, args.fieldStyle);
          // The public page renders inputs from fieldCSS, not fieldStyle — regenerate it
          // the way the builder does on save, or the change never shows.
          applyGeneratedCSS(form);
        }
        if (args.submitButton) {
          const idx = (form.fields || []).findIndex((f) => f.type === 'submit');
          if (idx < 0) throw new Error('This form has no submit button to style; add one with forms_builder_update_fields (tag "button").');
          for (const k of ['type', 'tag', 'id']) {
            if (k in args.submitButton) throw new Error(`submitButton.${k} cannot be changed.`);
          }
          form.fields[idx] = deepMerge(form.fields[idx], args.submitButton) as FormField;
        }
        if (args.formSettings) {
          for (const [k, v] of Object.entries(args.formSettings)) {
            if (!(STYLE_FORM_KEYS as readonly string[]).includes(k)) throw new Error(`formSettings.${k} is not a supported style key.`);
            form[k] = v;
          }
        }
        return { formData };
      });
    },
  }),

  defineTool({
    name: 'forms_builder_rename_form',
    description: 'Rename a form (the rest of the form is preserved).',
    properties: { formId: { type: 'string' }, name: { type: 'string' } },
    required: ['formId', 'name'],
    handler: async (client, args) => {
      const name = String(args.name || '').trim();
      if (!name) throw new Error('name is required.');
      return mutateForm(client, args.formId, (_doc, formData) => ({ formData, name }));
    },
  }),

  defineTool({
    name: 'forms_builder_delete_form',
    description:
      'Permanently delete a form. Immediate and irreversible. Requires confirm: true; pass expectedName to guard against deleting the wrong form.',
    properties: {
      formId: { type: 'string' },
      confirm: { type: 'boolean', description: 'Must be true' },
      expectedName: { type: 'string', description: 'If given, the form name must match exactly or nothing is deleted' },
    },
    required: ['formId', 'confirm'],
    handler: async (client, args) => {
      if (args.confirm !== true) {
        throw new Error('Deletion is irreversible — pass confirm: true to delete this form.');
      }
      const forms = fb(client);
      const doc = await forms.getForm(args.formId);
      if (doc.deleted === true) return { message: `Form ${args.formId} was already deleted.`, id: doc._id, name: doc.name };
      if (args.expectedName !== undefined && doc.name !== args.expectedName) {
        throw new Error(`Not deleted: form ${args.formId} is named "${doc.name}", not "${args.expectedName}".`);
      }
      const res = await forms.deleteForm(args.formId);
      return { message: `Form "${doc.name}" deleted`, id: doc._id, name: doc.name, deleted: res.deleted === true };
    },
  }),
];
