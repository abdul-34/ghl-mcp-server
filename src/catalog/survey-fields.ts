/**
 * Survey element palette for the internal surveys builder.
 *
 * Shapes come from the owner's 2026-09-25 capture: every Quick Add element was
 * dropped onto "Element Catalog Test" (M0L9OqLcV3cwjkPgdC8q), saved in the builder
 * and read back. Entries marked `verified: false` were not in that save.
 *
 * Every top-level element carries a fresh v4 `uuid` (the survey has
 * surveyLogicLinkById: true, so logic keys on it) and `active: false`. The address
 * group is the exception: its 5 children follow it in the same slideData array and
 * have no uuid.
 *
 * Custom elements are the backing custom-field record spread in, plus the survey
 * keys — exactly as the builder stores them.
 */

import { randomUUID } from 'node:crypto';
import type { SurveyElement } from '../crm/surveys-builder-client.js';

export interface SurveyPaletteDef {
  tag: string;
  label: string;
  verified: boolean;
  /** Display-only element (no submitted value). */
  displayOnly?: boolean;
  /** May appear more than once in a survey. */
  repeatable?: boolean;
  note?: string;
  /** Builds the element(s); the address group returns the marker plus its children. */
  build: (n: number) => SurveyElement[];
}

const std = (tag: string, label: string, placeholder: string, extra: Record<string, unknown> = {}): SurveyElement => ({
  uuid: randomUUID(),
  type: 'text',
  tag,
  label,
  placeholder,
  hiddenFieldQueryKey: tag,
  required: false,
  standard: true,
  typeLabel: 'Text',
  active: false,
  ...extra,
});

const addressChild = (
  tag: string,
  label: string,
  placeholder: string,
  title: string,
  type = 'text',
  typeLabel = 'Text'
): SurveyElement => ({
  category: 'address',
  type,
  tag,
  label,
  placeholder,
  title,
  typeLabel,
  hiddenFieldQueryKey: tag,
  required: false,
  standard: true,
});

/** The 5 address children, in builder order. `address` alone carries hideInLeftSideBar. */
export function addressChildren(): SurveyElement[] {
  return [
    { ...addressChild('address', 'Street Address', 'Enter your full address', 'Address'), hideInLeftSideBar: true },
    addressChild('city', 'City', 'Enter your city', 'City'),
    addressChild('state', 'State', 'Enter your state', 'State'),
    addressChild('country', 'Country', 'Enter your country', 'Country', 'select', 'Select'),
    addressChild('postal_code', 'Postal Code', 'ZIP or postal code', 'Postal Code'),
  ];
}

export const ADDRESS_CHILD_TAGS = ['address', 'city', 'state', 'country', 'postal_code'];

/** Heading HTML the builder writes into an h1 element's label. */
export function headingHtml(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<h1 style="padding-left: 0px!important;">${escaped}</h1>`;
}

export const SURVEY_PALETTE: Record<string, SurveyPaletteDef> = {
  full_name: { tag: 'full_name', label: 'Full Name', verified: true, build: () => [std('full_name', 'Full Name', 'Enter your full name')] },
  first_name: { tag: 'first_name', label: 'First Name', verified: true, build: () => [std('first_name', 'First Name', 'Enter your first name')] },
  last_name: { tag: 'last_name', label: 'Last Name', verified: true, build: () => [std('last_name', 'Last Name', 'Enter your last name')] },
  email: {
    tag: 'email',
    label: 'Email',
    verified: false,
    note: 'Shape observed in this location\'s forms, not in the survey element save.',
    build: () => [std('email', 'Email', 'you@email.com', { type: 'email', typeLabel: 'Email' })],
  },
  phone: {
    tag: 'phone',
    label: 'Phone',
    verified: true,
    build: () => [std('phone', 'Phone', '+1 (555) 000-0000', { typeLabel: 'Phone', enableCountryPicker: false, required: true })],
  },
  date_of_birth: {
    tag: 'date_of_birth',
    label: 'Date of birth',
    verified: true,
    note: 'props.format: YYYY-MM-DD | MM-DD-YYYY | DD-MM-YYYY; props.separator: - | / | .',
    build: () => [
      {
        uuid: randomUUID(),
        type: 'date',
        tag: 'date_of_birth',
        label: 'Date of birth',
        placeholder: 'DD / MM / YYYY',
        format: 'YYYY-MM-DD',
        separator: '-',
        hiddenFieldQueryKey: 'date_of_birth',
        standard: true,
        typeLabel: 'Date',
        active: false,
      },
    ],
  },
  organization: {
    tag: 'organization',
    label: 'Organization',
    verified: true,
    build: () => [std('organization', 'Organization', 'Enter your organization', { title: 'Organization' })],
  },
  website: {
    tag: 'website',
    label: 'Website',
    verified: true,
    build: () => [std('website', 'Website', 'https://yourwebsite.com', { title: 'Website' })],
  },
  source: {
    tag: 'source',
    label: 'Source',
    verified: true,
    displayOnly: true,
    note: 'Hidden tracking value (props.value).',
    build: () => [
      { uuid: randomUUID(), type: 'source', tag: 'source', label: 'Source', value: '', hiddenFieldQueryKey: 'source', standard: true, active: false },
    ],
  },
  address: {
    tag: 'group_address',
    label: 'Address',
    verified: true,
    note: 'Inserts the address group marker plus Street Address, City, State, Country and Postal Code, mirrored into form.address.',
    build: () => [
      {
        uuid: randomUUID(),
        type: 'group',
        tag: 'group_address',
        label: 'Address',
        placeholder: 'Street Address',
        title: 'Street Address',
        hiddenFieldQueryKey: 'group_address',
        required: false,
        standard: true,
        active: false,
      },
      ...addressChildren(),
    ],
  },
  header: {
    tag: 'header',
    label: 'Text',
    verified: true,
    displayOnly: true,
    repeatable: true,
    note: 'Heading / rich text. A plain label is wrapped in the builder\'s <h1> markup; a label starting with "<" is used as HTML.',
    build: (n) => [
      {
        uuid: randomUUID(),
        type: 'h1',
        tag: 'header',
        typeLabel: 'Text',
        label: headingHtml('Text'),
        placeholder: 'header',
        align: 'left',
        bgColor: 'FFFFFF00',
        weight: 400,
        border: { border: 0, color: 'FFFFFF', radius: 0, type: 'none' },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        shadow: { blur: 0, color: 'FFFFFF', horizontal: 0, spread: 0, vertical: 0 },
        hiddenFieldQueryKey: `header_${n}`,
        standard: true,
        active: false,
      },
    ],
  },
  html: {
    tag: 'html',
    label: 'Html',
    verified: true,
    displayOnly: true,
    repeatable: true,
    note: 'Markup goes in props.html. The builder warns about third-party scripts on save.',
    build: (n) => [
      {
        uuid: randomUUID(),
        type: 'html',
        tag: 'html',
        html: '',
        label: `HTML ${n}`,
        placeholder: 'The Custom HTML goes here',
        standard: true,
        active: false,
      },
    ],
  },
  captcha: {
    tag: 'captcha',
    label: 'Bot protection',
    verified: true,
    displayOnly: true,
    note: 'Blocks programmatic submissions.',
    build: () => [
      { uuid: randomUUID(), type: 'captcha', tag: 'captcha', invisible: false, label: 'Bot protection', standard: true, active: false },
    ],
  },
  terms_and_conditions: {
    tag: 'terms_and_conditions',
    label: 'T & C',
    verified: false,
    note:
      'Consent copy is HTML: props.placeholder (first checkbox, required) and props.placeholder2 (second checkbox). ' +
      'The builder\'s default copy was not captured, so you must supply it.',
    build: () => [
      {
        uuid: randomUUID(),
        type: 'terms_and_conditions',
        tag: 'terms_and_conditions',
        label: 'T & C',
        placeholder: '',
        placeholder2: '',
        preview: '',
        linkColor: '188bf6',
        textColor: '000000',
        required: true,
        standard: true,
        active: false,
      },
    ],
  },
};

/** Palette tags that may appear more than once per survey. */
export const REPEATABLE_TAGS = new Set(['header', 'html', 'image']);
export const DISPLAY_ONLY_TYPES = new Set(['h1', 'html', 'img', 'captcha', 'group', 'source']);

// ─── Custom elements ──────────────────────────────────────────

export interface SurveyCustomType {
  /** Element `type`. */
  type: string;
  /** Element `dataType`. */
  dataType: string;
  /** dataType the backing custom field is created with (Rating/Score → NUMERICAL). */
  fieldDataType: string;
  typeLabel: string;
  placeholder: string;
  options?: 'strings' | 'textbox';
  verified: boolean;
  extra?: () => Record<string, unknown>;
}

const choiceExtra = () => ({ optionDisplayType: 'TEXT_ONLY', isAllowedCustomOption: false });

/** Inline custom question types, keyed by element `type` (§6.5 of the capture). */
export const SURVEY_CUSTOM_TYPES: Record<string, SurveyCustomType> = {
  text: { type: 'text', dataType: 'TEXT', fieldDataType: 'TEXT', typeLabel: 'Single Line', placeholder: 'Enter your text', verified: true },
  large_text: { type: 'large_text', dataType: 'LARGE_TEXT', fieldDataType: 'LARGE_TEXT', typeLabel: 'Multi Line', placeholder: 'Type your message here', verified: true },
  textbox_list: { type: 'textbox_list', dataType: 'TEXTBOX_LIST', fieldDataType: 'TEXTBOX_LIST', typeLabel: 'Text Box List', placeholder: '', options: 'textbox', verified: true },
  single_options: { type: 'single_options', dataType: 'SINGLE_OPTIONS', fieldDataType: 'SINGLE_OPTIONS', typeLabel: 'Single Dropdown', placeholder: 'Select an option', options: 'strings', verified: true },
  multiple_options: { type: 'multiple_options', dataType: 'MULTIPLE_OPTIONS', fieldDataType: 'MULTIPLE_OPTIONS', typeLabel: 'Multi Dropdown', placeholder: 'Select an option', options: 'strings', verified: false },
  checkbox: { type: 'checkbox', dataType: 'CHECKBOX', fieldDataType: 'CHECKBOX', typeLabel: 'Checkbox', placeholder: '', options: 'strings', verified: true, extra: choiceExtra },
  radio: { type: 'radio', dataType: 'RADIO', fieldDataType: 'RADIO', typeLabel: 'Radio', placeholder: '', options: 'strings', verified: true, extra: choiceExtra },
  rating: {
    type: 'rating',
    dataType: 'RATING',
    fieldDataType: 'NUMERICAL',
    typeLabel: 'Rating',
    placeholder: '',
    verified: true,
    extra: () => ({
      iconType: 'star',
      count: 5,
      color: 'fbbf24',
      inactiveColor: 'E5E7EB',
      lowestRating: 'Bad',
      highestRating: 'Good',
      iconAlignment: 'left',
      calculationType: 'absolute',
    }),
  },
  score: { type: 'score', dataType: 'SCORE', fieldDataType: 'NUMERICAL', typeLabel: 'Score', placeholder: 'Ex: Your Score is 100%', verified: true },
  numerical: { type: 'numerical', dataType: 'NUMERICAL', fieldDataType: 'NUMERICAL', typeLabel: 'Number', placeholder: 'Enter a number', verified: true },
  monetory: { type: 'monetory', dataType: 'MONETORY', fieldDataType: 'MONETORY', typeLabel: 'Monetary', placeholder: 'Enter amount', verified: true },
  date: {
    type: 'date',
    dataType: 'DATE',
    fieldDataType: 'DATE',
    typeLabel: 'Date Picker',
    placeholder: 'DD / MM / YYYY',
    verified: true,
    extra: () => ({ defaultTime: 'none', timeFormat: '24' }),
  },
  file_upload: {
    type: 'file_upload',
    dataType: 'FILE_UPLOAD',
    fieldDataType: 'FILE_UPLOAD',
    typeLabel: 'File Upload',
    placeholder: 'Click to upload',
    verified: true,
    extra: () => ({ isPrivate: false, picklistOptions: [] }),
  },
  signature: { type: 'signature', dataType: 'SIGNATURE', fieldDataType: 'SIGNATURE', typeLabel: 'Signature', placeholder: 'Sign here', verified: true },
};

/** Registry dataType → default survey element type, for existing custom fields. */
export const REGISTRY_TO_SURVEY_TYPE: Record<string, string> = {
  TEXT: 'text',
  LARGE_TEXT: 'large_text',
  TEXTBOX_LIST: 'textbox_list',
  SINGLE_OPTIONS: 'single_options',
  MULTIPLE_OPTIONS: 'multiple_options',
  CHECKBOX: 'checkbox',
  RADIO: 'radio',
  NUMERICAL: 'numerical',
  MONETORY: 'monetory',
  DATE: 'date',
  FILE_UPLOAD: 'file_upload',
  SIGNATURE: 'signature',
};

/**
 * Build a custom element from its backing custom-field record, as the builder
 * stores it: the record spread in, then the survey keys.
 */
export function buildSurveyCustomElement(
  record: Record<string, any>,
  surveyType: string,
  locationId: string
): SurveyElement {
  if (!record || !record.id) throw new Error('Custom field record is missing its id.');
  const def = SURVEY_CUSTOM_TYPES[surveyType];
  if (!def) throw new Error(`Unknown survey custom element type "${surveyType}".`);
  const name = String(record.name || record.id);
  const fieldKey = String(record.fieldKey || '');
  const queryKey = fieldKey.includes('.') ? fieldKey.slice(fieldKey.indexOf('.') + 1) : fieldKey || record.id;
  return {
    ...structuredClone(record),
    uuid: randomUUID(),
    id: record.id,
    tag: record.id,
    type: def.type,
    dataType: def.dataType,
    typeLabel: def.typeLabel,
    label: name,
    name,
    placeholder: def.placeholder,
    fieldKey,
    hiddenFieldQueryKey: queryKey,
    model: record.model || 'contact',
    locationId,
    ...(def.extra ? def.extra() : {}),
    custom: true,
    customEdited: true,
    __pendingClone: false,
    standard: false,
    required: false,
    active: false,
  };
}
