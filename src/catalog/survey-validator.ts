/**
 * Local validation of a complete survey formData before it is written.
 *
 * Issues block the write; warnings are returned alongside the result. Rules come
 * from the capture's checklist (§8): form must be an object (the builder crashes
 * otherwise), unique slide ids and element uuids, standard tags at most once,
 * address children only under their group, custom elements backed by a real
 * custom field, no payment elements (out of scope).
 */

import type { SurveyFormData } from '../crm/surveys-builder-client.js';
import { SURVEY_PALETTE, SURVEY_CUSTOM_TYPES, REPEATABLE_TAGS, ADDRESS_CHILD_TAGS } from './survey-fields.js';
import { isAddressChild, questionUnits } from './survey-mutations.js';

export interface SurveyValidationResult {
  valid: boolean;
  issues: string[];
  warnings: string[];
}

export interface SurveyValidateOptions {
  /** Custom-field ids that exist in the location. Skipped when undefined (registry unavailable). */
  knownCustomFieldIds?: Set<string>;
}

const KNOWN_STANDARD_TAGS = new Set([
  ...Object.values(SURVEY_PALETTE).map((d) => d.tag),
  ...ADDRESS_CHILD_TAGS,
  'image',
]);

export function validateSurveyFormData(fd: SurveyFormData, opts: SurveyValidateOptions = {}): SurveyValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!fd || typeof fd !== 'object') return { valid: false, issues: ['formData must be an object.'], warnings };
  if (!fd.form || typeof fd.form !== 'object' || Array.isArray(fd.form)) {
    issues.push('formData.form must be an object (the builder crashes on save without it).');
  }
  if (!Array.isArray(fd.slides) || fd.slides.length === 0) {
    issues.push('formData.slides must contain at least one slide.');
    return { valid: false, issues, warnings };
  }

  const slideIds = new Set<string>();
  const uuids = new Set<string>();
  const tagCount = new Map<string, number>();

  fd.slides.forEach((slide, s) => {
    const where = `slide ${s}${slide?.slideName ? ` ("${slide.slideName}")` : ''}`;
    if (!slide || typeof slide.id !== 'string' || !slide.id) {
      issues.push(`${where}: missing slide id.`);
    } else if (slideIds.has(slide.id)) {
      issues.push(`${where}: duplicate slide id "${slide.id}".`);
    } else {
      slideIds.add(slide.id);
    }
    if (!Array.isArray(slide?.slideData)) {
      issues.push(`${where}: slideData must be an array.`);
      return;
    }

    slide.slideData.forEach((el, i) => {
      if (isAddressChild(el) && (i === 0 || !(slide.slideData[i - 1].type === 'group' || isAddressChild(slide.slideData[i - 1])))) {
        issues.push(`${where}: address field "${el.tag}" is not under an address group. Add the address element instead.`);
      }
    });

    questionUnits(slide.slideData).forEach(([start, len], q) => {
      const el = slide.slideData[start];
      const at = `${where}, question ${q}`;
      if (!el || typeof el.type !== 'string' || typeof el.tag !== 'string') {
        issues.push(`${at}: element needs a type and tag.`);
        return;
      }
      if (typeof el.uuid !== 'string' || !el.uuid) issues.push(`${at} (${el.tag}): missing uuid.`);
      else if (uuids.has(el.uuid)) issues.push(`${at} (${el.tag}): duplicate uuid "${el.uuid}".`);
      else uuids.add(el.uuid);

      if (el.hidden === true && el.required === true) {
        warnings.push(`${at} (${el.tag}) is hidden and required: submission fails unless it is prefilled via ?${el.hiddenFieldQueryKey || el.tag}=…`);
      }
      if (el.type === 'payment') issues.push(`${at}: payment elements are not supported by these tools.`);

      const custom = el.custom === true || el.standard === false;
      if (custom) {
        if (el.tag !== el.id) issues.push(`${at}: a custom element's tag must equal its custom field id.`);
        if (!SURVEY_CUSTOM_TYPES[el.type]) warnings.push(`${at}: custom element type "${el.type}" is not in the captured palette.`);
        else if (!SURVEY_CUSTOM_TYPES[el.type].verified) warnings.push(`${at}: "${el.type}" was not in the builder capture; open the survey in the builder once to confirm it renders.`);
        if (opts.knownCustomFieldIds && typeof el.id === 'string' && !opts.knownCustomFieldIds.has(el.id)) {
          issues.push(`${at}: custom field "${el.id}" does not exist in this location.`);
        }
      } else {
        tagCount.set(el.tag, (tagCount.get(el.tag) || 0) + 1);
        if (!KNOWN_STANDARD_TAGS.has(el.tag)) warnings.push(`${at}: element tag "${el.tag}" is not in the captured palette.`);
        if (el.tag === 'email') warnings.push(`${at}: the email element's survey shape was observed on forms only.`);
      }

      if (el.type === 'group') {
        const children = slide.slideData.slice(start + 1, start + len).map((c) => c.tag);
        if (children.join(',') !== ADDRESS_CHILD_TAGS.join(',')) {
          warnings.push(`${at}: address group children are [${children.join(', ')}], expected [${ADDRESS_CHILD_TAGS.join(', ')}].`);
        }
      }
      if (el.type === 'html' && String(el.html || '').trim()) {
        warnings.push(`${at}: HTML block — sanitize user-supplied markup; the builder warns about third-party scripts on save.`);
      }
    });
  });

  for (const [tag, n] of tagCount) {
    if (n > 1 && !REPEATABLE_TAGS.has(tag)) issues.push(`Standard element "${tag}" appears ${n} times; it may appear at most once per survey.`);
  }

  return { valid: issues.length === 0, issues, warnings };
}
