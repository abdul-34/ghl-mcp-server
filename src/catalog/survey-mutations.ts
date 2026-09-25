/**
 * Survey questions and ordered edit operations.
 *
 * A "question" is one unit in a slide's slideData: a single element, or the
 * address group marker plus the child elements that follow it. Question indexes
 * in tool input and summaries count units, not raw slideData entries.
 */

import type { SurveyElement, SurveyFormData, SurveySlide } from '../crm/surveys-builder-client.js';
import {
  SURVEY_PALETTE,
  SURVEY_CUSTOM_TYPES,
  REGISTRY_TO_SURVEY_TYPE,
  buildSurveyCustomElement,
  headingHtml,
} from './survey-fields.js';
import { InlineQuestion } from './survey-custom-fields.js';
import { newSlide, syncFormAddress } from './survey-template.js';

export interface QuestionOverrides {
  label?: string;
  placeholder?: string;
  required?: boolean;
  hiddenFieldQueryKey?: string;
  /** Hidden element: not shown on the page, value still submitted. */
  hidden?: boolean;
  /** Type-specific props merged last (e.g. html, format, rating count). */
  props?: Record<string, unknown>;
}

export interface QuestionSpec extends QuestionOverrides {
  /** Palette element (see surveys_builder_list_element_types). */
  tag?: string;
  /** Existing contact custom field. */
  customFieldId?: string;
  /** Show an existing NUMERICAL field as a rating or score element. */
  displayAs?: 'rating' | 'score';
  /** New custom field, created with the survey. */
  create?: InlineQuestion;
}

export interface QuestionContext {
  locationId: string;
  /** Location custom-field registry, needed for customFieldId questions. */
  registry?: Map<string, Record<string, any>>;
  /** Backing record for an inline question (real after creation, placeholder during dry runs). */
  inlineRecord: (spec: QuestionSpec) => Record<string, any>;
  /** Per-tag counter for numbered defaults (header_N, "HTML N"). */
  nextNumber: (tag: string) => number;
}

const IDENTITY_KEYS = new Set(['uuid', 'id', 'tag', 'type', 'dataType', 'category']);

function applyOverrides(el: SurveyElement, o: QuestionOverrides): void {
  if (o.label !== undefined) {
    el.label = el.type === 'h1' && !o.label.trimStart().startsWith('<') ? headingHtml(o.label) : o.label;
  }
  if (o.placeholder !== undefined) el.placeholder = o.placeholder;
  if (o.required !== undefined) el.required = o.required;
  if (o.hiddenFieldQueryKey !== undefined) el.hiddenFieldQueryKey = o.hiddenFieldQueryKey;
  if (o.hidden !== undefined) el.hidden = o.hidden;
  if (o.props && typeof o.props === 'object') {
    for (const [k, v] of Object.entries(o.props)) {
      if (IDENTITY_KEYS.has(k)) continue;
      el[k] = v;
    }
  }
}

/** Build the slideData entries for one question spec. */
export function buildQuestion(spec: QuestionSpec, ctx: QuestionContext): SurveyElement[] {
  if (!spec || typeof spec !== 'object') throw new Error('Each question must be an object.');
  const kinds = [spec.tag !== undefined, spec.customFieldId !== undefined, spec.create !== undefined].filter(Boolean).length;
  if (kinds !== 1) throw new Error('Each question needs exactly one of: tag, customFieldId, create.');

  if (spec.tag !== undefined) {
    const def = SURVEY_PALETTE[spec.tag];
    if (!def) {
      throw new Error(
        `Unknown element tag "${spec.tag}". Valid: ${Object.keys(SURVEY_PALETTE).join(', ')}. ` +
          'For a question with its own answer field use create: { type, name, options }.'
      );
    }
    if (spec.displayAs) throw new Error('displayAs only applies to customFieldId questions.');
    const els = def.build(ctx.nextNumber(def.tag));
    applyOverrides(els[0], spec);
    if (els[0].type === 'terms_and_conditions') {
      if (!String(els[0].placeholder || '').trim()) {
        throw new Error('terms_and_conditions needs props.placeholder: the consent HTML for the first checkbox.');
      }
      if (!els[0].preview) els[0].preview = els[0].placeholder;
    }
    return els;
  }

  if (spec.customFieldId !== undefined) {
    const record = ctx.registry?.get(spec.customFieldId);
    if (!record) {
      throw new Error(
        `Custom field "${spec.customFieldId}" was not found in this location. Use create: { type, name } to make a new one.`
      );
    }
    const dataType = String(record.dataType || '').toUpperCase();
    let type = REGISTRY_TO_SURVEY_TYPE[dataType];
    if (spec.displayAs) {
      if (dataType !== 'NUMERICAL') {
        throw new Error(`displayAs "${spec.displayAs}" needs a NUMERICAL custom field; "${record.name}" is ${dataType}.`);
      }
      type = spec.displayAs;
    }
    if (!type) {
      throw new Error(
        `Custom field "${record.name || record.id}" has dataType ${dataType}, which has no captured survey element. ` +
          `Supported: ${Object.keys(REGISTRY_TO_SURVEY_TYPE).join(', ')}.`
      );
    }
    const el = buildSurveyCustomElement(record, type, ctx.locationId);
    applyOverrides(el, spec);
    return [el];
  }

  const create = spec.create as InlineQuestion;
  if (!SURVEY_CUSTOM_TYPES[create?.type]) {
    throw new Error(`Unknown custom question type "${create?.type}". Valid: ${Object.keys(SURVEY_CUSTOM_TYPES).join(', ')}.`);
  }
  if (spec.displayAs) throw new Error('displayAs only applies to customFieldId questions; use create.type instead.');
  const el = buildSurveyCustomElement(ctx.inlineRecord(spec), create.type, ctx.locationId);
  // The field name may carry a uniqueness suffix; the question shows the clean text.
  applyOverrides(el, { ...spec, label: spec.label ?? create.name });
  return [el];
}

// ─── Units ────────────────────────────────────────────────────

export function isAddressChild(el: SurveyElement): boolean {
  return el?.category === 'address' && !el.uuid;
}

/** [start, length] of each question in a slideData array. */
export function questionUnits(slideData: SurveyElement[]): Array<[number, number]> {
  const units: Array<[number, number]> = [];
  for (let i = 0; i < slideData.length; ) {
    let len = 1;
    if (slideData[i].type === 'group') while (i + len < slideData.length && isAddressChild(slideData[i + len])) len++;
    units.push([i, len]);
    i += len;
  }
  return units;
}

// ─── Operations ───────────────────────────────────────────────

export type SlideRef = number | string;
export type QuestionRef = { uuid: string } | { slide: SlideRef; index: number };

export type SurveyOp =
  | { op: 'add_slide'; name?: string; index?: number }
  | { op: 'remove_slide'; slide: SlideRef }
  | { op: 'move_slide'; slide: SlideRef; to: number }
  | { op: 'rename_slide'; slide: SlideRef; name: string }
  | { op: 'add_question'; slide?: SlideRef; question: QuestionSpec; index?: number }
  | { op: 'remove_question'; ref: QuestionRef }
  | { op: 'move_question'; ref: QuestionRef; slide?: SlideRef; index?: number }
  | ({ op: 'update_question'; ref: QuestionRef } & QuestionOverrides);

export interface OpsResult {
  /** Custom-field ids whose last element was removed from the survey. */
  orphanedCustomFieldIds: string[];
  notes: string[];
}

export function resolveSlide(slides: SurveySlide[], ref: SlideRef | undefined, at: string): number {
  if (ref === undefined) return slides.length - 1;
  const idx = typeof ref === 'number' ? ref : slides.findIndex((s) => s.id === ref);
  if (!Number.isInteger(idx) || idx < 0 || idx >= slides.length) {
    throw new Error(`${at}: slide ${JSON.stringify(ref)} not found (survey has ${slides.length} slide(s); use an index or slide id).`);
  }
  return idx;
}

function resolveQuestion(slides: SurveySlide[], ref: QuestionRef, at: string): { s: number; start: number; len: number } {
  if (!ref || typeof ref !== 'object') throw new Error(`${at}: ref must be { uuid } or { slide, index }.`);
  if ('uuid' in ref && ref.uuid) {
    for (let s = 0; s < slides.length; s++) {
      for (const [start, len] of questionUnits(slides[s].slideData)) {
        if (slides[s].slideData[start].uuid === ref.uuid) return { s, start, len };
      }
    }
    throw new Error(`${at}: no question with uuid "${ref.uuid}".`);
  }
  const r = ref as { slide: SlideRef; index: number };
  const s = resolveSlide(slides, r.slide, at);
  const units = questionUnits(slides[s].slideData);
  if (!Number.isInteger(r.index) || r.index < 0 || r.index >= units.length) {
    throw new Error(`${at}: question index ${r.index} is out of range (slide ${s} has ${units.length}).`);
  }
  const [start, len] = units[r.index];
  return { s, start, len };
}

/** Raw slideData position of question index `index` (end when omitted or past the end). */
function insertPosition(slideData: SurveyElement[], index: number | undefined): number {
  const units = questionUnits(slideData);
  if (index === undefined || index >= units.length) return slideData.length;
  if (!Number.isInteger(index) || index < 0) throw new Error(`index must be a non-negative integer.`);
  return units[index][0];
}

function customIds(fd: SurveyFormData): Set<string> {
  const ids = new Set<string>();
  for (const s of fd.slides) for (const el of s.slideData) if (el.custom === true && typeof el.id === 'string') ids.add(el.id);
  return ids;
}

/** Apply ops in order to `fd` (mutated in place). */
export function applySurveyOps(fd: SurveyFormData, ops: SurveyOp[], ctx: QuestionContext): OpsResult {
  if (!Array.isArray(ops) || ops.length === 0) throw new Error('ops must be a non-empty array.');
  const before = customIds(fd);
  const notes: string[] = [];

  ops.forEach((op, i) => {
    const at = `ops[${i}] (${op?.op})`;
    const slides = fd.slides;
    switch (op?.op) {
      case 'add_slide': {
        const index = op.index ?? slides.length;
        if (!Number.isInteger(index) || index < 0 || index > slides.length) throw new Error(`${at}: index out of range.`);
        slides.splice(index, 0, newSlide(op.name || `Slide ${slides.length + 1}`, index, slides[0]?.button));
        break;
      }
      case 'remove_slide': {
        if (slides.length === 1) throw new Error(`${at}: a survey needs at least one slide.`);
        const s = resolveSlide(slides, op.slide, at);
        const [removed] = slides.splice(s, 1);
        if (removed.slideData.length) notes.push(`Removed slide "${removed.slideName}" with ${questionUnits(removed.slideData).length} question(s).`);
        break;
      }
      case 'move_slide': {
        const s = resolveSlide(slides, op.slide, at);
        if (!Number.isInteger(op.to) || op.to < 0 || op.to >= slides.length) throw new Error(`${at}: to out of range.`);
        const [slide] = slides.splice(s, 1);
        slides.splice(op.to, 0, slide);
        break;
      }
      case 'rename_slide': {
        const name = String(op.name || '').trim();
        if (!name) throw new Error(`${at}: name is required.`);
        slides[resolveSlide(slides, op.slide, at)].slideName = name;
        break;
      }
      case 'add_question': {
        const s = resolveSlide(slides, op.slide, at);
        const els = buildQuestion(op.question, ctx);
        slides[s].slideData.splice(insertPosition(slides[s].slideData, op.index), 0, ...els);
        break;
      }
      case 'remove_question': {
        const { s, start, len } = resolveQuestion(slides, op.ref, at);
        slides[s].slideData.splice(start, len);
        break;
      }
      case 'move_question': {
        const { s, start, len } = resolveQuestion(slides, op.ref, at);
        const moved = slides[s].slideData.splice(start, len);
        const target = op.slide === undefined ? s : resolveSlide(slides, op.slide, at);
        slides[target].slideData.splice(insertPosition(slides[target].slideData, op.index), 0, ...moved);
        break;
      }
      case 'update_question': {
        const { s, start } = resolveQuestion(slides, op.ref, at);
        const { op: _op, ref: _ref, ...overrides } = op;
        if ((overrides.props as any)?.picklistOptions !== undefined || (overrides.props as any)?.options !== undefined) {
          throw new Error(
            `${at}: options belong to the backing custom field and can't be changed here. ` +
              'Remove the question and add a new one with the new options.'
          );
        }
        applyOverrides(slides[s].slideData[start], overrides);
        break;
      }
      default:
        throw new Error(`${at}: unknown op. Valid: add_slide, remove_slide, move_slide, rename_slide, add_question, remove_question, move_question, update_question.`);
    }
  });

  syncFormAddress(fd);
  const after = customIds(fd);
  const orphanedCustomFieldIds = [...before].filter((id) => !after.has(id));
  if (orphanedCustomFieldIds.length) {
    notes.push(
      `${orphanedCustomFieldIds.length} custom field(s) are no longer used by this survey but still exist on contacts: ${orphanedCustomFieldIds.join(', ')}.`
    );
  }
  return { orphanedCustomFieldIds, notes };
}
