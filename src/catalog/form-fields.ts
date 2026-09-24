/**
 * Form field palette for the internal forms builder.
 *
 * Every shape here comes from the captured 35-element document in the forms
 * blueprint (§4–§5). Elements whose content keys were NOT captured (h1 rich text,
 * img source, group children, country options, date format) are marked
 * `verified: false`; for those, copy the exact props from a builder-made form via
 * forms_builder_get_form and pass them as `props`.
 *
 * Custom-field elements are never invented: they are built from a record read from
 * the location's custom-field registry (public API), exactly as the builder does —
 * the registry record spread plus the form-specific keys.
 */

import type { FormField } from '../crm/forms-builder-client.js';

export interface StandardFieldDef {
  tag: string;
  type: string;
  label: string;
  /** Captured field-for-field in the blueprint. */
  verified: boolean;
  /** Display-only element (no submitted value; not usable in conditional logic). */
  displayOnly?: boolean;
  /** May appear more than once on a form. */
  repeatable?: boolean;
  defaults: Record<string, unknown>;
  note?: string;
}

const simple = (tag: string, type: string, label: string): StandardFieldDef => ({
  tag,
  type,
  label,
  verified: true,
  defaults: {
    type,
    tag,
    label,
    placeholder: '',
    required: false,
    standard: true,
    typeLabel: label,
    fieldWidthPercentage: 100,
    hiddenFieldQueryKey: tag,
  },
});

/** Submit button defaults — blueprint §5.6. */
export const DEFAULT_SUBMIT_FIELD: FormField = {
  type: 'submit',
  tag: 'button',
  label: 'Submit',
  placeholder: 'Button',
  align: 'center',
  fullwidth: true,
  fieldWidthPercentage: 100,
  bgColor: '155EEFFF',
  color: 'FFFFFFFF',
  border: 0,
  borderColor: '140C0CFF',
  borderRadius: 6,
  borderType: 'solid',
  radius: 8,
  fontFamily: 'Inter',
  fontSize: 15,
  weight: 500,
  padding: { top: 8, right: 14, bottom: 8, left: 14 },
  shadow: { horizontal: 0, vertical: 1, blur: 2, spread: 0, color: '1018280D' },
  submitSubText: '',
  subTextColor: '000000',
  subTextFontFamily: 'Inter',
  subTextFontSize: 14,
  subTextWeight: 200,
  standard: true,
  hiddenFieldQueryKey: 'button',
};

export const STANDARD_FIELDS: Record<string, StandardFieldDef> = {
  first_name: simple('first_name', 'text', 'First Name'),
  last_name: simple('last_name', 'text', 'Last Name'),
  full_name: simple('full_name', 'text', 'Full Name'),
  phone: simple('phone', 'text', 'Phone'),
  email: simple('email', 'email', 'Email'),
  address: simple('address', 'text', 'Address'),
  city: simple('city', 'text', 'City'),
  state: simple('state', 'text', 'State'),
  postal_code: simple('postal_code', 'text', 'Postal Code'),
  source: simple('source', 'source', 'Source'),
  country: {
    ...simple('country', 'select', 'Country'),
    verified: false,
    note: 'Option list not captured; the renderer is assumed to supply countries.',
  },
  date_of_birth: {
    tag: 'date_of_birth',
    type: 'date',
    label: 'Date of birth',
    verified: false,
    note: '`format` / `separator` values were not captured — copy them from a builder-made form if needed.',
    defaults: { type: 'date', tag: 'date_of_birth', label: 'Date of birth', required: false, standard: true, hiddenFieldQueryKey: 'date_of_birth' },
  },
  group_address: {
    tag: 'group_address',
    type: 'group',
    label: 'Address',
    verified: false,
    displayOnly: true,
    note: 'Group heading; address sub-fields are separate flat elements (address, city, state, country, postal_code).',
    defaults: { type: 'group', tag: 'group_address', label: 'Address', title: 'Address', required: false, standard: true, active: false },
  },
  terms_and_conditions: {
    tag: 'terms_and_conditions',
    type: 'terms_and_conditions',
    label: 'T & C',
    verified: true,
    note: 'Consent copy is HTML in `placeholder`. Submitted value is the consent text.',
    defaults: {
      type: 'terms_and_conditions',
      tag: 'terms_and_conditions',
      label: 'T & C',
      linkColor: '72B76FFF',
      placeholder: '<p>By checking this box, I consent to receive communications.</p>',
      required: false,
      standard: true,
      hiddenFieldQueryKey: 'terms_and_conditions',
    },
  },
  captcha: {
    tag: 'captcha',
    type: 'captcha',
    label: 'Bot protection',
    verified: true,
    displayOnly: true,
    note: 'Forms with captcha cannot be submitted programmatically (Cloudflare Turnstile).',
    defaults: { type: 'captcha', tag: 'captcha', label: 'Bot protection', invisible: false, standard: true, active: false, hiddenFieldQueryKey: 'captcha' },
  },
  html: {
    tag: 'html',
    type: 'html',
    label: 'HTML',
    verified: true,
    displayOnly: true,
    repeatable: true,
    note: 'Custom HTML goes in `html`.',
    defaults: { type: 'html', tag: 'html', label: 'HTML 1', html: '', placeholder: 'The Custom HTML goes here', standard: true },
  },
  header: {
    tag: 'header',
    type: 'h1',
    label: 'Header',
    verified: false,
    displayOnly: true,
    repeatable: true,
    note: 'Rich-text block. Its content key was not captured — copy props from a builder-made h1 element.',
    defaults: { type: 'h1', tag: 'header', label: 'Header', standard: true },
  },
  image: {
    tag: 'image',
    type: 'img',
    label: 'Image',
    verified: false,
    displayOnly: true,
    repeatable: true,
    note: 'Image source key was not captured — copy props from a builder-made img element.',
    defaults: { type: 'img', tag: 'image', label: 'Image', standard: true },
  },
  button: {
    tag: 'button',
    type: 'submit',
    label: 'Submit',
    verified: true,
    displayOnly: true,
    note: 'Fully styleable (bgColor, color, border*, radius, font*, padding, shadow, align, fullwidth).',
    defaults: DEFAULT_SUBMIT_FIELD,
  },
};

/** Form element types that submit no value (not valid as a conditional-logic selectedField). */
export const DISPLAY_ONLY_TYPES = new Set(['submit', 'h1', 'html', 'img', 'captcha', 'group']);

/** Standard tags that may appear more than once. */
export const REPEATABLE_TAGS = new Set(['header', 'html', 'image']);

// ─── Custom fields ──────────────────────────────────────────

/**
 * Custom-field registry dataType → form element { type, dataType, typeLabel }.
 * Score quirk (§14.6): the registry stores a Score field as NUMERICAL while the form
 * element carries dataType SCORE — request it with displayAs: "score".
 */
export const CUSTOM_TYPE_MAP: Record<string, { type: string; dataType: string; typeLabel: string }> = {
  TEXT: { type: 'text', dataType: 'TEXT', typeLabel: 'Single Line' },
  LARGE_TEXT: { type: 'large_text', dataType: 'LARGE_TEXT', typeLabel: 'Multi Line' },
  NUMERICAL: { type: 'numerical', dataType: 'NUMERICAL', typeLabel: 'Number' },
  MONETORY: { type: 'monetory', dataType: 'MONETORY', typeLabel: 'Monetary' },
  CHECKBOX: { type: 'checkbox', dataType: 'CHECKBOX', typeLabel: 'Checkbox' },
  SINGLE_OPTIONS: { type: 'single_options', dataType: 'SINGLE_OPTIONS', typeLabel: 'Dropdown (Single)' },
  MULTIPLE_OPTIONS: { type: 'multiple_options', dataType: 'MULTIPLE_OPTIONS', typeLabel: 'Dropdown (Multiple)' },
  RADIO: { type: 'radio', dataType: 'RADIO', typeLabel: 'Radio' },
  DATE: { type: 'date', dataType: 'DATE', typeLabel: 'Date Picker' },
  TEXTBOX_LIST: { type: 'textbox_list', dataType: 'TEXTBOX_LIST', typeLabel: 'Text Box List' },
  FILE_UPLOAD: { type: 'file_upload', dataType: 'FILE_UPLOAD', typeLabel: 'File Upload' },
  SIGNATURE: { type: 'signature', dataType: 'SIGNATURE', typeLabel: 'Signature' },
  RATING: { type: 'rating', dataType: 'RATING', typeLabel: 'Rating' },
};

const SCORE_ELEMENT = { type: 'score', dataType: 'SCORE', typeLabel: 'Score' };

/** Minimal view of a custom-field registry record (public API /locations/{id}/customFields). */
export interface CustomFieldRecord {
  id: string;
  name?: string;
  fieldKey?: string;
  dataType?: string;
  model?: string;
  parentId?: string;
  placeholder?: string;
  picklistOptions?: unknown[];
  [key: string]: unknown;
}

/** Common per-element overrides accepted from tool input. */
export interface FieldOverrides {
  label?: string;
  placeholder?: string;
  required?: boolean;
  fieldWidthPercentage?: number;
  hiddenFieldQueryKey?: string;
  /** Type-specific props merged last (e.g. html, bgColor, picklist display). */
  props?: Record<string, unknown>;
}

function applyOverrides(field: Record<string, unknown>, o: FieldOverrides): void {
  if (o.label !== undefined) field.label = o.label;
  if (o.placeholder !== undefined) field.placeholder = o.placeholder;
  if (o.required !== undefined) field.required = o.required;
  if (o.fieldWidthPercentage !== undefined) field.fieldWidthPercentage = o.fieldWidthPercentage;
  if (o.hiddenFieldQueryKey !== undefined) field.hiddenFieldQueryKey = o.hiddenFieldQueryKey;
  if (o.props && typeof o.props === 'object') {
    for (const [k, v] of Object.entries(o.props)) {
      if (k === 'tag' || k === 'id' || k === 'type') continue; // identity is not overridable
      field[k] = v;
    }
  }
}

export function buildStandardField(tag: string, overrides: FieldOverrides = {}): FormField {
  const def = STANDARD_FIELDS[tag];
  if (!def) {
    throw new Error(
      `Unknown standard field tag "${tag}". Valid tags: ${Object.keys(STANDARD_FIELDS).join(', ')}. ` +
        'For anything else use a custom field (customFieldId).'
    );
  }
  const field = structuredClone(def.defaults) as Record<string, unknown>;
  applyOverrides(field, overrides);
  return field as FormField;
}

export function buildCustomField(
  record: CustomFieldRecord,
  locationId: string,
  overrides: FieldOverrides & { displayAs?: 'score' } = {}
): FormField {
  if (!record || !record.id) throw new Error('Custom field record is missing its id.');
  const registryType = String(record.dataType || '').toUpperCase();
  let element = CUSTOM_TYPE_MAP[registryType];
  if (!element) {
    throw new Error(
      `Custom field "${record.name || record.id}" has dataType "${record.dataType}", which has no captured form ` +
        `element. Supported: ${Object.keys(CUSTOM_TYPE_MAP).join(', ')}.`
    );
  }
  if (overrides.displayAs === 'score') {
    if (registryType !== 'NUMERICAL') {
      throw new Error(`displayAs "score" requires a NUMERICAL custom field; "${record.name || record.id}" is ${registryType}.`);
    }
    element = SCORE_ELEMENT;
  }

  const name = record.name || record.id;
  const fieldKey = record.fieldKey || '';
  const queryKey = fieldKey.includes('.') ? fieldKey.slice(fieldKey.indexOf('.') + 1) : fieldKey || record.id;

  const field: Record<string, unknown> = {
    ...structuredClone(record),
    id: record.id,
    tag: record.id,
    type: element.type,
    dataType: element.dataType,
    typeLabel: element.typeLabel,
    label: name,
    name,
    customFieldLabel: name,
    fieldKey,
    hiddenFieldQueryKey: queryKey,
    model: record.model || 'contact',
    locationId,
    picklistOptions: Array.isArray(record.picklistOptions) ? record.picklistOptions : [],
    placeholder: record.placeholder ?? '',
    required: false,
    fieldWidthPercentage: 100,
    standard: false,
    custom: true,
  };
  if (element.type === 'file_upload' && field.isPrivate === undefined) field.isPrivate = false;
  applyOverrides(field, overrides);
  return field as FormField;
}

// ─── Conditional-logic support ──────────────────────────────

export const CONDITION_OPERATORS = [
  'isEqualTo', 'isNotEqualTo', 'contains', 'doesNotContain', 'startsWith', 'endsWith',
  'isEmpty', 'isFilled', 'before', 'after', 'greaterThan', 'lessThan', 'between',
  'isChecked', 'isNotChecked',
] as const;

export const UNARY_OPERATORS = new Set(['isEmpty', 'isFilled', 'isChecked', 'isNotChecked']);

const TEXT_OPS = ['isEqualTo', 'isNotEqualTo', 'contains', 'doesNotContain', 'startsWith', 'endsWith', 'isEmpty', 'isFilled'];
const NUMBER_OPS = ['isEqualTo', 'isNotEqualTo', 'greaterThan', 'lessThan', 'between', 'isEmpty', 'isFilled'];
const DATE_OPS = ['isEqualTo', 'isNotEqualTo', 'before', 'after', 'isEmpty', 'isFilled'];
const CHECK_OPS = ['isChecked', 'isNotChecked', 'isEmpty', 'isFilled'];
const FALLBACK_OPS = ['isEqualTo', 'isNotEqualTo', 'isEmpty', 'isFilled'];

/** Operators applicable to a form element type (blueprint §8.3 applicability). */
export function operatorsForType(type: string): string[] {
  switch (type) {
    case 'text': case 'email': case 'phone': case 'textarea': case 'large_text':
    case 'select': case 'single_options': case 'radio': case 'source':
      return TEXT_OPS;
    case 'multiple_options': case 'textbox_list':
      return TEXT_OPS;
    case 'number': case 'numerical': case 'monetory': case 'score': case 'rating':
      return NUMBER_OPS;
    case 'date':
      return DATE_OPS;
    case 'checkbox': case 'terms_and_conditions':
      return CHECK_OPS;
    default:
      return FALLBACK_OPS;
  }
}

export const OUTCOME_TYPES = ['showHideFields', 'redirectToUrl', 'displayCustomMessage', 'disqualifyLead'] as const;
export const HIDE_TYPES = ['Hide', 'Show', 'Hide Multiple', 'Show Multiple'] as const;
export const DISQUALIFY_ACTIONS = ['showCustomMessage', 'openUrl'] as const;
export const DISQUALIFY_TIMINGS = ['disqualifyImmediately', 'disqualifyAfterSubmit'] as const;

/** Payload keys a form submits (= valid conditional-logic selectedField values). */
export function payloadKeys(fields: FormField[]): Map<string, FormField> {
  const map = new Map<string, FormField>();
  for (const f of fields || []) {
    if (!f || typeof f.tag !== 'string') continue;
    if (DISPLAY_ONLY_TYPES.has(String(f.type))) continue;
    map.set(f.tag, f);
  }
  return map;
}
