/**
 * Inline custom questions → the POST /locations/{loc}/customFields payload that
 * creates their backing contact custom field (capture §6.6, API-verified):
 *   - choice types (RADIO, CHECKBOX, SINGLE_/MULTIPLE_OPTIONS) send `options: string[]`
 *   - TEXTBOX_LIST sends `textBoxListOptions: [{ label, prefillValue }]`
 *   - Rating and Score are created as NUMERICAL (RATING / SCORE → 422)
 */

import { randomBytes } from 'node:crypto';
import type { CreateCustomFieldInput } from '../crm/surveys-builder-client.js';
import { SURVEY_CUSTOM_TYPES } from './survey-fields.js';

/** dataTypes the custom-field API accepts (capture §6.5, API-verified). */
export const CUSTOM_FIELD_DATA_TYPES = new Set([
  'TEXT', 'LARGE_TEXT', 'NUMERICAL', 'PHONE', 'MONETORY', 'CHECKBOX', 'SINGLE_OPTIONS', 'MULTIPLE_OPTIONS',
  'FLOAT', 'TIME', 'DATE', 'TEXTBOX_LIST', 'FILE_UPLOAD', 'SIGNATURE', 'RADIO', 'URL', 'DATE_TIME', 'USER',
  'RICH_TEXT', 'FORMULA',
]);

export interface InlineQuestion {
  type: string;
  /** Custom-field name; defaults to the question label. */
  name?: string;
  options?: string[];
}

/**
 * Build the create payload for one inline question. `takenNames` holds the
 * lower-cased names already used in the location; a clash gets a short suffix
 * (the builder does the same, e.g. "Radio 3esy") and the new name is added.
 */
export function inlineFieldPayload(
  q: InlineQuestion,
  label: string | undefined,
  takenNames: Set<string>,
  parentId?: string
): CreateCustomFieldInput {
  const def = SURVEY_CUSTOM_TYPES[q?.type];
  if (!def) {
    throw new Error(`Unknown custom question type "${q?.type}". Valid: ${Object.keys(SURVEY_CUSTOM_TYPES).join(', ')}.`);
  }
  if (!CUSTOM_FIELD_DATA_TYPES.has(def.fieldDataType)) {
    throw new Error(`Custom field dataType "${def.fieldDataType}" is not accepted by the custom-field API.`);
  }
  const base = String(q.name ?? label ?? '').trim();
  if (!base) throw new Error(`A "${q.type}" question needs create.name or a label.`);

  const payload: CreateCustomFieldInput = { name: uniqueName(base, takenNames), dataType: def.fieldDataType, parentId };

  if (def.options) {
    const options = Array.isArray(q.options) ? q.options.map((o) => String(o).trim()) : [];
    if (options.length === 0 || options.some((o) => !o)) {
      throw new Error(`"${base}" (${q.type}) needs create.options: a non-empty list of non-empty strings.`);
    }
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
      throw new Error(`"${base}" has duplicate options.`);
    }
    if (def.options === 'textbox') payload.textBoxListOptions = options.map((label) => ({ label, prefillValue: '' }));
    else payload.options = options;
  } else if (q.options !== undefined) {
    throw new Error(`"${base}" (${q.type}) does not take options.`);
  }
  return payload;
}

function uniqueName(base: string, taken: Set<string>): string {
  let name = base;
  while (taken.has(name.toLowerCase())) name = `${base} ${randomBytes(2).toString('hex')}`;
  taken.add(name.toLowerCase());
  return name;
}
