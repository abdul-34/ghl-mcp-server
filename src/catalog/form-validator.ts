/**
 * Local validation for form documents before any write.
 *
 * The forms API stores whatever it is given, so a typo'd conditional-logic key or
 * a numeric actionType is persisted and then silently never works. These checks
 * follow the blueprint's captured enums and shapes (§4–§9).
 */

import type { FormBody, FormField } from '../crm/forms-builder-client.js';
import {
  CONDITION_OPERATORS,
  UNARY_OPERATORS,
  OUTCOME_TYPES,
  HIDE_TYPES,
  DISQUALIFY_ACTIONS,
  DISQUALIFY_TIMINGS,
  REPEATABLE_TAGS,
  operatorsForType,
  payloadKeys,
} from './form-fields.js';

export interface FormValidationResult {
  valid: boolean;
  issues: string[];
  warnings: string[];
}

export interface FormValidateOptions {
  /** Custom-field ids that exist in the location; when given, custom elements are checked against it. */
  knownCustomFieldIds?: Set<string>;
}

const HEX8 = /^[0-9A-Fa-f]{8}$/;
const OPERATION_SET = new Set(['then', 'and', 'or']);

function isAbsoluteUrl(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function checkColor(issues: string[], where: string, value: unknown): void {
  if (value === undefined || value === null || value === '') return;
  if (typeof value !== 'string' || !HEX8.test(value)) {
    issues.push(`${where} must be an 8-digit RRGGBBAA hex colour without "#" (got ${JSON.stringify(value)}).`);
  }
}

export function validateFormBody(form: FormBody, opts: FormValidateOptions = {}): FormValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!form || typeof form !== 'object') {
    return { valid: false, issues: ['formData.form is missing.'], warnings };
  }
  const fields = form.fields as FormField[];
  if (!Array.isArray(fields) || fields.length === 0) {
    issues.push('formData.form.fields must be a non-empty array.');
    return { valid: false, issues, warnings };
  }

  // ─── Fields ───
  const seen = new Map<string, number>();
  fields.forEach((f, i) => {
    const at = `fields[${i}]`;
    if (!f || typeof f !== 'object') {
      issues.push(`${at} is not an object.`);
      return;
    }
    if (typeof f.type !== 'string' || !f.type) issues.push(`${at} is missing "type".`);
    if (typeof f.tag !== 'string' || !f.tag) {
      issues.push(`${at} is missing "tag".`);
      return;
    }
    if (!REPEATABLE_TAGS.has(f.tag)) {
      if (seen.has(f.tag)) issues.push(`${at}: duplicate tag "${f.tag}" (also at fields[${seen.get(f.tag)}]).`);
      else seen.set(f.tag, i);
    }
    if (f.custom === true || f.standard === false) {
      if (f.id !== f.tag) issues.push(`${at}: custom field must have id === tag (id=${JSON.stringify(f.id)}, tag="${f.tag}").`);
      if (opts.knownCustomFieldIds && !opts.knownCustomFieldIds.has(f.tag)) {
        issues.push(`${at}: custom field id "${f.tag}" does not exist in this location's custom-field registry.`);
      }
    }
    if (f.type === 'submit') {
      for (const k of ['bgColor', 'color', 'borderColor']) checkColor(issues, `${at}.${k}`, f[k]);
    }
  });

  const types = fields.map((f) => f?.type);
  if (!types.includes('submit')) warnings.push('The form has no submit button.');
  if (types.includes('captcha')) {
    warnings.push('The form has a captcha: it cannot be submitted programmatically (Cloudflare Turnstile).');
  }

  // ─── fieldStyle colours ───
  const fs = form.fieldStyle as Record<string, any> | undefined;
  if (fs && typeof fs === 'object') {
    for (const k of ['bgColor', 'fontColor', 'primaryColor', 'activeTagBgColor', 'labelColor', 'mobileLabelColor', 'placeholderColor', 'mobilePlaceholderColor']) {
      checkColor(issues, `fieldStyle.${k}`, fs[k]);
    }
    checkColor(issues, 'fieldStyle.border.color', fs.border?.color);
    checkColor(issues, 'fieldStyle.shadow.color', fs.shadow?.color);
    checkColor(issues, 'fieldStyle.shortLabel.color', fs.shortLabel?.color);
  }

  // ─── formAction ───
  const fa = form.formAction as Record<string, unknown> | undefined;
  if (fa && typeof fa === 'object') {
    if (fa.actionType !== '1' && fa.actionType !== '2') {
      issues.push(`formAction.actionType must be the STRING "1" (redirect) or "2" (message); got ${JSON.stringify(fa.actionType)}.`);
    } else if (fa.actionType === '1' && !isAbsoluteUrl(fa.redirectUrl)) {
      issues.push('formAction.actionType "1" (redirect) requires an absolute http(s) redirectUrl.');
    } else if (fa.actionType === '2' && (typeof fa.thankyouText !== 'string' || !fa.thankyouText)) {
      issues.push('formAction.actionType "2" (message) requires thankyouText (HTML).');
    }
  }

  // ─── Conditional logic ───
  const rules = form.conditionalLogic;
  if (rules !== null && rules !== undefined) {
    if (!Array.isArray(rules)) {
      issues.push('conditionalLogic must be an array or null.');
    } else {
      const keys = payloadKeys(fields);
      const keyList = Array.from(keys.keys()).join(', ');
      rules.forEach((rule: any, r) => validateRule(rule, `conditionalLogic[${r}]`, keys, keyList, issues, warnings));
    }
  }

  return { valid: issues.length === 0, issues, warnings };
}

function validateRule(
  rule: any,
  at: string,
  keys: Map<string, FormField>,
  keyList: string,
  issues: string[],
  warnings: string[]
): void {
  if (!rule || typeof rule !== 'object') {
    issues.push(`${at} is not an object.`);
    return;
  }
  if (!OPERATION_SET.has(rule.conditionalOperation)) {
    issues.push(`${at}.conditionalOperation must be "then", "and" or "or" (got ${JSON.stringify(rule.conditionalOperation)}).`);
  }
  const conditions = rule.conditions;
  if (!Array.isArray(conditions) || conditions.length === 0) {
    issues.push(`${at}.conditions must be a non-empty array.`);
  } else {
    if (rule.conditionalOperation === 'then' && conditions.length !== 1) {
      issues.push(`${at}: conditionalOperation "then" takes exactly one condition; use "and"/"or" for ${conditions.length}.`);
    }
    conditions.forEach((c: any, i: number) => {
      const cat = `${at}.conditions[${i}]`;
      if (!c || typeof c !== 'object') {
        issues.push(`${cat} is not an object.`);
        return;
      }
      const field = keys.get(c.selectedField);
      if (!field) {
        issues.push(`${cat}.selectedField "${c.selectedField}" is not a submitted field on this form. Valid keys: ${keyList || '(none)'}.`);
      }
      if (!(CONDITION_OPERATORS as readonly string[]).includes(c.selectedOperation)) {
        issues.push(`${cat}.selectedOperation "${c.selectedOperation}" is not a valid operator (${CONDITION_OPERATORS.join(', ')}).`);
      } else if (field && !operatorsForType(String(field.type)).includes(c.selectedOperation)) {
        issues.push(
          `${cat}: operator "${c.selectedOperation}" does not apply to "${c.selectedField}" (type ${field.type}). ` +
            `Use one of: ${operatorsForType(String(field.type)).join(', ')}.`
        );
      }
      if (UNARY_OPERATORS.has(c.selectedOperation)) {
        if (c.inputValue !== null && c.inputValue !== undefined) issues.push(`${cat}: "${c.selectedOperation}" takes inputValue null.`);
      } else if (typeof c.inputValue !== 'string') {
        issues.push(`${cat}.inputValue must be a string (numbers go as strings); got ${JSON.stringify(c.inputValue)}.`);
      }
    });
  }

  const o = rule.outcome;
  if (!o || typeof o !== 'object') {
    issues.push(`${at}.outcome is missing.`);
    return;
  }
  if (!(OUTCOME_TYPES as readonly string[]).includes(o.type)) {
    issues.push(`${at}.outcome.type "${o.type}" is not supported (${OUTCOME_TYPES.join(', ')}).`);
    return;
  }
  switch (o.type) {
    case 'showHideFields': {
      if (!(HIDE_TYPES as readonly string[]).includes(o.hideType)) {
        issues.push(`${at}.outcome.hideType must be one of ${HIDE_TYPES.map((h) => `"${h}"`).join(', ')}.`);
      }
      const multiple = typeof o.hideType === 'string' && o.hideType.endsWith('Multiple');
      const targets: unknown[] = Array.isArray(o.value) ? o.value : [o.value];
      if (multiple && !Array.isArray(o.value)) issues.push(`${at}.outcome.value must be an array for "${o.hideType}".`);
      if (!multiple && Array.isArray(o.value)) issues.push(`${at}.outcome.value must be a single key for "${o.hideType}"; use "${o.hideType} Multiple" for several.`);
      for (const t of targets) {
        if (typeof t !== 'string' || !keys.has(t)) issues.push(`${at}.outcome.value "${String(t)}" is not a submitted field on this form.`);
      }
      const targetSet = new Set(targets as string[]);
      const hides = typeof o.hideType === 'string' && o.hideType.startsWith('Hide');
      if (hides) {
        for (const t of targetSet) {
          if (keys.get(t)?.required === true) warnings.push(`${at} hides "${t}", which is required — a hidden required field may block submission.`);
        }
      }
      break;
    }
    case 'redirectToUrl':
      if (!isAbsoluteUrl(o.value)) issues.push(`${at}.outcome.value must be an absolute http(s) URL.`);
      break;
    case 'displayCustomMessage':
      if (typeof o.value !== 'string' || !o.value) issues.push(`${at}.outcome.value must be an HTML message string.`);
      break;
    case 'disqualifyLead':
      if (!(DISQUALIFY_ACTIONS as readonly string[]).includes(o.disqualifyAction)) {
        issues.push(`${at}.outcome.disqualifyAction must be "showCustomMessage" or "openUrl".`);
      }
      if (!(DISQUALIFY_TIMINGS as readonly string[]).includes(o.disqualifyTiming)) {
        issues.push(`${at}.outcome.disqualifyTiming must be "disqualifyImmediately" or "disqualifyAfterSubmit".`);
      }
      if (o.disqualifyAction === 'openUrl' && !isAbsoluteUrl(o.value)) {
        issues.push(`${at}.outcome.value must be an absolute http(s) URL when disqualifyAction is "openUrl".`);
      } else if (o.disqualifyAction === 'showCustomMessage' && (typeof o.value !== 'string' || !o.value)) {
        issues.push(`${at}.outcome.value must be an HTML message string when disqualifyAction is "showCustomMessage".`);
      }
      break;
  }
}
