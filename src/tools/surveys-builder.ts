/**
 * Surveys-builder tools (internal GHL API).
 *
 * End-to-end survey management the public API can't do: create, edit slides and
 * questions, settings, rename and delete. Each tool reaches the sub-account's
 * internal surveys client via `client.surveysBuilder()`, authenticated with the
 * agency's captured Firebase session.
 *
 * Every write is a read-modify-write of the COMPLETE formData (the API replaces it
 * wholesale), dry-run and validated locally first, and verified by read-back after.
 * Questions with their own answer field ("create") get a backing contact custom
 * field created just before the survey write — in a "Survey | <name>" folder, as
 * the builder does — and rolled back if the write fails. See docs/surveys-builder-plan.md.
 */

import { ToolDef, defineTool } from './types.js';
import { CRMClient } from '../crm/client.js';
import {
  CreateCustomFieldInput,
  SurveyDocument,
  SurveyFormData,
  SurveysBuilderClient,
} from '../crm/surveys-builder-client.js';
import { SURVEY_PALETTE, SURVEY_CUSTOM_TYPES, REGISTRY_TO_SURVEY_TYPE } from '../catalog/survey-fields.js';
import { inlineFieldPayload } from '../catalog/survey-custom-fields.js';
import { DEFAULT_SLIDE_BUTTON, buildSurveyFormData } from '../catalog/survey-template.js';
import {
  QuestionContext,
  QuestionSpec,
  SurveyOp,
  applySurveyOps,
  buildQuestion,
  questionUnits,
} from '../catalog/survey-mutations.js';
import { validateSurveyFormData, SurveyValidationResult } from '../catalog/survey-validator.js';
import { loadCustomFields, deepMerge, stableStringify } from './builder-helpers.js';

// ─── Shared schemas ──────────────────────────────────────────

const QUESTION_SCHEMA: Record<string, any> = {
  type: 'object',
  description:
    'One survey question. Give EXACTLY ONE of: tag (palette element, see surveys_builder_list_element_types), ' +
    'customFieldId (an existing contact custom field), or create (a new custom field made with the survey).',
  properties: {
    tag: { type: 'string', enum: Object.keys(SURVEY_PALETTE) },
    customFieldId: { type: 'string' },
    displayAs: { type: 'string', enum: ['rating', 'score'], description: 'Show an existing NUMERICAL field as a rating or score' },
    create: {
      type: 'object',
      description: 'New custom field. name defaults to label; options are required for radio, checkbox, single_options, multiple_options and textbox_list.',
      properties: {
        type: { type: 'string', enum: Object.keys(SURVEY_CUSTOM_TYPES) },
        name: { type: 'string' },
        options: { type: 'array', items: { type: 'string' } },
      },
      required: ['type'],
      additionalProperties: false,
    },
    label: { type: 'string', description: 'Question text. For a header element, plain text is wrapped in the builder\'s <h1> markup.' },
    placeholder: { type: 'string' },
    required: { type: 'boolean' },
    hiddenFieldQueryKey: { type: 'string', description: 'URL query param that prefills the question' },
    props: {
      type: 'object',
      description:
        'Type-specific props merged last, e.g. { html } for html, { placeholder, placeholder2 } consent HTML for terms_and_conditions, ' +
        '{ format, separator } for date_of_birth, { count, iconType, lowestRating, highestRating } for rating.',
    },
  },
  additionalProperties: false,
};

const SLIDE_SCHEMA: Record<string, any> = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Default "Slide N"' },
    questions: { type: 'array', items: QUESTION_SCHEMA },
  },
  required: ['questions'],
  additionalProperties: false,
};

const SETTINGS_SCHEMA: Record<string, any> = {
  type: 'object',
  description: 'Survey settings. Give thankyouText OR redirectUrl, not both.',
  properties: {
    thankyouText: { type: 'string', description: 'HTML message shown after submit' },
    redirectUrl: { type: 'string', description: 'Redirect to this URL after submit instead' },
    progressBar: { type: 'boolean', description: 'Show the progress bar' },
    backButton: { type: 'boolean', description: 'Show the Back button' },
    autoAdvance: { type: 'boolean', description: 'Move to the next slide automatically after a choice' },
    formSchedule: { type: 'object', description: 'Partial form.formSchedule merged over the current value' },
  },
  additionalProperties: false,
};

const SLIDE_REF: Record<string, any> = { type: ['number', 'string'], description: 'Slide index (0-based) or slide id' };
const QUESTION_REF: Record<string, any> = {
  type: 'object',
  description: 'Target question: { uuid } or { slide, index } (0-based question index within the slide)',
  properties: { uuid: { type: 'string' }, slide: SLIDE_REF, index: { type: 'number' } },
  additionalProperties: false,
};

const OP_SCHEMA: Record<string, any> = {
  type: 'object',
  description:
    '{op:"add_slide", name?, index?} · {op:"remove_slide", slide} · {op:"move_slide", slide, to} · {op:"rename_slide", slide, name} · ' +
    '{op:"add_question", slide?, question, index?} (slide defaults to the last one, index to the end) · {op:"remove_question", ref} · ' +
    '{op:"move_question", ref, slide?, index?} · {op:"update_question", ref, label?, placeholder?, required?, hiddenFieldQueryKey?, props?}',
  properties: {
    op: {
      type: 'string',
      enum: ['add_slide', 'remove_slide', 'move_slide', 'rename_slide', 'add_question', 'remove_question', 'move_question', 'update_question'],
    },
    name: { type: 'string' },
    index: { type: 'number' },
    to: { type: 'number' },
    slide: SLIDE_REF,
    ref: QUESTION_REF,
    question: QUESTION_SCHEMA,
    label: { type: 'string' },
    placeholder: { type: 'string' },
    required: { type: 'boolean' },
    hiddenFieldQueryKey: { type: 'string' },
    props: { type: 'object' },
  },
  required: ['op'],
  additionalProperties: false,
};

// ─── Helpers ─────────────────────────────────────────────────

function sb(client: CRMClient): SurveysBuilderClient {
  return client.surveysBuilder();
}

type Registry = Map<string, Record<string, any>>;

/** Per-tag numbering (header_N, "HTML N") continuing from what the survey already has. */
function numberer(fd?: SurveyFormData): (tag: string) => number {
  const counts = new Map<string, number>();
  for (const s of fd?.slides || []) for (const el of s.slideData || []) counts.set(el.tag, (counts.get(el.tag) || 0) + 1);
  return (tag) => {
    const n = (counts.get(tag) || 0) + 1;
    counts.set(tag, n);
    return n;
  };
}

function hasCustom(fd?: SurveyFormData): boolean {
  return (fd?.slides || []).some((s) => (s.slideData || []).some((el) => el.custom === true || el.standard === false));
}

/** Inline-field plan: the create payload for every `create` question, built before anything is written. */
interface InlinePlan {
  specs: QuestionSpec[];
  payloads: Map<QuestionSpec, CreateCustomFieldInput>;
}

function planInline(specs: QuestionSpec[], registry: Registry | undefined): InlinePlan {
  const taken = new Set(Array.from(registry?.values() || []).map((f) => String(f.name || '').toLowerCase()));
  const payloads = new Map<QuestionSpec, CreateCustomFieldInput>();
  for (const spec of specs) {
    if (spec?.create) payloads.set(spec, inlineFieldPayload(spec.create, spec.label, taken));
  }
  return { specs: Array.from(payloads.keys()), payloads };
}

/** Placeholder records for a dry run, so validation runs before any custom field exists. */
function pendingRecords(plan: InlinePlan): Map<QuestionSpec, Record<string, any>> {
  const out = new Map<QuestionSpec, Record<string, any>>();
  plan.specs.forEach((spec, i) => {
    const p = plan.payloads.get(spec)!;
    out.set(spec, { id: `pending_${i}`, name: p.name, fieldKey: `contact.pending_${i}`, dataType: p.dataType, model: 'contact' });
  });
  return out;
}

function questionContext(
  client: CRMClient,
  registry: Registry | undefined,
  records: Map<QuestionSpec, Record<string, any>>,
  fd?: SurveyFormData
): QuestionContext {
  return {
    locationId: client.locationId,
    registry,
    inlineRecord: (spec) => {
      const rec = records.get(spec);
      if (!rec) throw new Error('Internal error: inline question has no backing field record.');
      return rec;
    },
    nextNumber: numberer(fd),
  };
}

interface CreatedFields {
  records: Map<QuestionSpec, Record<string, any>>;
  fieldIds: string[];
  folderId?: string;
  folderCreated: boolean;
}

/** Create the folder (unless one is given) and every inline field; undo everything on failure. */
async function createInlineFields(
  surveys: SurveysBuilderClient,
  plan: InlinePlan,
  folderName: string,
  existingFolderId?: string
): Promise<CreatedFields> {
  const created: CreatedFields = { records: new Map(), fieldIds: [], folderCreated: false };
  if (plan.specs.length === 0) return created;
  try {
    if (existingFolderId) {
      created.folderId = existingFolderId;
    } else {
      const folder = await surveys.createCustomFieldFolder(folderName);
      created.folderId = folder.id;
      created.folderCreated = true;
    }
    for (const spec of plan.specs) {
      const field = await surveys.createCustomField({ ...plan.payloads.get(spec)!, parentId: created.folderId });
      created.records.set(spec, field);
      created.fieldIds.push(field.id);
    }
    return created;
  } catch (err) {
    const leftovers = await rollbackFields(surveys, created);
    throw new Error(`Creating the survey's custom fields failed: ${(err as Error).message}${leftovers}`);
  }
}

/** Best-effort undo of createInlineFields. Returns a note naming anything left behind. */
async function rollbackFields(surveys: SurveysBuilderClient, created: CreatedFields): Promise<string> {
  const failed: string[] = [];
  for (const id of created.fieldIds) {
    try {
      await surveys.deleteCustomField(id);
    } catch {
      failed.push(id);
    }
  }
  if (created.folderCreated && created.folderId) {
    try {
      await surveys.deleteCustomField(created.folderId);
    } catch {
      failed.push(`${created.folderId} (folder)`);
    }
  }
  return failed.length ? ` Rollback could not delete: ${failed.join(', ')}.` : ' Created custom fields were rolled back.';
}

function blocking(before: SurveyValidationResult | undefined, after: SurveyValidationResult): string[] {
  return before ? after.issues.filter((i) => !before.issues.includes(i)) : after.issues;
}

function assertValid(before: SurveyValidationResult | undefined, after: SurveyValidationResult, what: string): void {
  const introduced = blocking(before, after);
  if (introduced.length) throw new Error(`${what} — validation failed:\n- ${introduced.join('\n- ')}`);
}

function knownIds(registry: Registry | undefined, records?: Map<QuestionSpec, Record<string, any>>): Set<string> | undefined {
  if (!registry) return undefined;
  const ids = new Set(registry.keys());
  for (const r of records?.values() || []) ids.add(r.id);
  return ids;
}

function docFingerprint(fd: SurveyFormData | undefined): string {
  return stableStringify({ form: fd?.form, slides: fd?.slides });
}

/** Apply a settings patch to form (mutated). */
function applySettings(form: Record<string, any>, s: Record<string, any> | undefined): string[] {
  const notes: string[] = [];
  if (!s) return notes;
  if (s.thankyouText !== undefined && s.redirectUrl !== undefined) {
    throw new Error('Give thankyouText or redirectUrl, not both.');
  }
  if (s.redirectUrl !== undefined) {
    if (!/^https?:\/\/\S+$/i.test(String(s.redirectUrl))) throw new Error('redirectUrl must be an http(s) URL.');
    form.formAction = { ...(form.formAction || {}), actionType: '1', redirectUrl: s.redirectUrl };
    notes.push('Redirect uses formAction.actionType "1", inferred from the builder default; confirm it on the public page.');
  }
  if (s.thankyouText !== undefined) {
    form.formAction = { ...(form.formAction || {}), actionType: '2', thankyouText: String(s.thankyouText) };
  }
  if (s.progressBar !== undefined) form.isProgressBarEnabled = s.progressBar === true;
  if (s.backButton !== undefined) form.isBackButtonEnable = s.backButton === true;
  if (s.autoAdvance !== undefined) form.disableAutoNavigation = s.autoAdvance !== true;
  if (s.formSchedule !== undefined) {
    if (!s.formSchedule || typeof s.formSchedule !== 'object') throw new Error('formSchedule must be an object.');
    form.formSchedule = deepMerge(form.formSchedule || {}, s.formSchedule);
  }
  return notes;
}

const API_ONLY_NOTE =
  'This survey has not been saved in the builder, so it uses the builder\'s default theme until then. ' +
  'Pass templateSurveyId (a builder-saved survey) to copy its theme and settings.';

/** Compact, model-friendly view of a survey document. */
export function summarizeSurvey(doc: SurveyDocument): Record<string, unknown> {
  const fd = (doc.formData || {}) as SurveyFormData;
  const slides = Array.isArray(fd.slides) ? fd.slides : [];
  const form = (fd.form || {}) as Record<string, any>;
  return {
    id: doc._id,
    name: doc.name,
    deleted: doc.deleted === true,
    dateUpdated: doc.dateUpdated,
    slideCount: slides.length,
    slides: slides.map((s, index) => {
      const data = Array.isArray(s.slideData) ? s.slideData : [];
      return {
        index,
        id: s.id,
        name: s.slideName,
        questions: questionUnits(data).map(([start, len], i) => {
          const f = data[start];
          return {
            index: i,
            uuid: f.uuid,
            tag: f.tag,
            type: f.type,
            label: f.label,
            required: f.required === true,
            custom: f.custom === true || f.standard === false,
            ...(len > 1 ? { children: data.slice(start + 1, start + len).map((c) => c.tag) } : {}),
          };
        }),
      };
    }),
    settings: {
      formAction: form.formAction ?? null,
      progressBar: form.isProgressBarEnabled ?? null,
      backButton: form.isBackButtonEnable ?? null,
      autoAdvance: form.disableAutoNavigation === undefined ? null : form.disableAutoNavigation !== true,
    },
    // A survey created via the API has only { company } until its first builder save.
    builderSaved: Boolean(form.fieldStyle) && typeof fd.fieldCSS === 'string',
  };
}

/** Write `next`, poll until the read-back matches, and summarize. */
async function writeAndVerify(
  surveys: SurveysBuilderClient,
  surveyId: string,
  name: string,
  next: SurveyFormData
): Promise<{ verified: boolean; doc: SurveyDocument }> {
  const written = await surveys.updateSurvey(surveyId, name, next);
  const expected = docFingerprint(next);
  const { verified, doc } = await surveys.waitForSurvey(
    surveyId,
    (d) => d.name === name && docFingerprint(d.formData) === expected
  );
  return { verified, doc: doc || written };
}

const NOT_VERIFIED_NOTE =
  'The write was accepted but the read-back did not match yet (reads can lag writes). Re-check with surveys_builder_get_survey.';

interface SurveyMutation {
  name?: string;
  /** Questions that may need backing fields or the registry. */
  specs?: QuestionSpec[];
  apply: (fd: SurveyFormData, ctx: QuestionContext) => string[];
}

/**
 * The single edit path: GET → dry run on a clone → validate (block only issues the
 * change introduced) → create inline fields → apply for real → POST the complete
 * formData → verify. Inline fields are rolled back if the write fails.
 */
async function mutateSurvey(client: CRMClient, surveyId: string, m: SurveyMutation): Promise<Record<string, unknown>> {
  if (!surveyId) throw new Error('surveyId is required.');
  const surveys = sb(client);
  const current = await surveys.getSurvey(surveyId);
  if (current.deleted === true) throw new Error(`Survey ${surveyId} is deleted.`);
  if (!current.formData?.form || typeof current.formData.form !== 'object') {
    throw new Error(`Survey ${surveyId} has no formData.form — refusing to overwrite it. Open and save it in the builder once.`);
  }
  if (!Array.isArray(current.formData.slides) || current.formData.slides.length === 0) {
    throw new Error(`Survey ${surveyId} has no slides — refusing to overwrite it.`);
  }

  const specs = m.specs || [];
  const needsRegistry = hasCustom(current.formData) || specs.some((s) => s?.customFieldId || s?.create);
  const registry = needsRegistry ? await loadCustomFields(client) : undefined;
  if (specs.some((s) => s?.customFieldId) && !registry) throw new Error('Could not load this location\'s custom fields.');
  const plan = planInline(specs, registry);
  const name = m.name ?? current.name;

  // Dry run: nothing is created unless the finished survey validates.
  const pending = pendingRecords(plan);
  const dry = structuredClone(current.formData);
  m.apply(dry, questionContext(client, registry, pending, current.formData));
  const before = validateSurveyFormData(current.formData, { knownCustomFieldIds: knownIds(registry) });
  assertValid(before, validateSurveyFormData(dry, { knownCustomFieldIds: knownIds(registry, pending) }), 'Survey not changed');

  // Reuse the folder that holds this survey's own fields, as the builder does.
  const existingFolder = current.formData.slides
    .flatMap((s) => s.slideData || [])
    .find((el) => el.custom === true && el.customEdited === true && typeof el.parentId === 'string')?.parentId as string | undefined;
  const created = await createInlineFields(surveys, plan, `Survey | ${name}`, existingFolder);

  try {
    const next = structuredClone(current.formData);
    const notes = m.apply(next, questionContext(client, registry, created.records, current.formData));
    const after = validateSurveyFormData(next, { knownCustomFieldIds: knownIds(registry, created.records) });
    assertValid(before, after, 'Survey not changed');

    const { verified, doc } = await writeAndVerify(surveys, surveyId, name, next);
    const warnings = [
      ...after.warnings,
      ...before.issues.filter((i) => after.issues.includes(i)).map((i) => `pre-existing: ${i}`),
    ];
    return {
      verified,
      ...(verified ? {} : { verificationNote: NOT_VERIFIED_NOTE }),
      ...(created.fieldIds.length ? { createdCustomFields: created.fieldIds, customFieldFolderId: created.folderId } : {}),
      notes: [...notes, 'Last write wins: edits made in the GHL builder between our read and write would be overwritten.'],
      warnings,
      survey: summarizeSurvey(doc),
    };
  } catch (err) {
    if (created.fieldIds.length === 0) throw err;
    const leftovers = await rollbackFields(surveys, created);
    throw new Error(`${(err as Error).message}${leftovers}`);
  }
}

interface SlideInput {
  name?: string;
  questions: QuestionSpec[];
}

function slideInputs(raw: unknown): SlideInput[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('slides must be a non-empty array.');
  return raw.map((s, i) => {
    if (!s || typeof s !== 'object' || !Array.isArray((s as any).questions)) {
      throw new Error(`slides[${i}] needs a questions array.`);
    }
    return s as SlideInput;
  });
}

function buildSlides(inputs: SlideInput[], ctx: QuestionContext) {
  return inputs.map((s) => ({ name: s.name, elements: s.questions.flatMap((q) => buildQuestion(q, ctx)) }));
}

/** Every page of a paged listing (bounded). */
async function pageAll<T>(fetchPage: (skip: number) => Promise<{ items: T[]; total?: number }>, pageSize: number): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < 50; page++) {
    const { items, total } = await fetchPage(page * pageSize);
    out.push(...items);
    if (items.length < pageSize || (total !== undefined && out.length >= total)) return out;
  }
  throw new Error('Too many pages to scan safely.');
}

/** Custom-field ids used by every other survey and form in the location. */
async function customFieldsUsedElsewhere(client: CRMClient, surveyId: string): Promise<{ used: Set<string>; scanned: string }> {
  const used = new Set<string>();
  const surveys = sb(client);
  const list = await pageAll((skip) => surveys.listSurveys({ skip, limit: 20 }).then((r) => ({ items: r.surveys, total: r.total })), 20);
  let surveyCount = 0;
  for (const s of list) {
    const id = String(s._id || '');
    if (!id || id === surveyId) continue;
    const doc = await surveys.getSurvey(id);
    surveyCount++;
    for (const slide of doc.formData?.slides || []) for (const el of slide.slideData || []) if (typeof el.id === 'string') used.add(el.id);
  }
  const forms = client.formsBuilder();
  const formList = await pageAll((skip) => forms.listForms({ skip, limit: 20 }).then((r) => ({ items: r.forms, total: r.total })), 20);
  for (const f of formList) {
    const id = String(f._id || '');
    if (!id) continue;
    const doc = await forms.getForm(id);
    for (const el of doc.formData?.form?.fields || []) {
      if (typeof el.id === 'string') used.add(el.id);
      if (typeof el.tag === 'string') used.add(el.tag);
    }
  }
  return { used, scanned: `${surveyCount} other survey(s) and ${formList.length} form(s)` };
}

// ─── Tools ───────────────────────────────────────────────────

export const surveysBuilderTools: ToolDef[] = [
  defineTool({
    name: 'surveys_builder_list_element_types',
    description:
      'Reference for building surveys: the palette elements (tag), the custom question types that create their own contact ' +
      'custom field (create.type), and which ones are unverified. No sub-account needed.',
    requiresLocation: false,
    handler: async () => ({
      palette: Object.entries(SURVEY_PALETTE).map(([key, d]) => ({
        tag: key,
        label: d.label,
        verified: d.verified,
        ...(d.displayOnly ? { displayOnly: true } : {}),
        ...(d.repeatable ? { repeatable: true } : { oncePerSurvey: true }),
        ...(d.note ? { note: d.note } : {}),
      })),
      customTypes: Object.values(SURVEY_CUSTOM_TYPES).map((d) => ({
        type: d.type,
        typeLabel: d.typeLabel,
        createsFieldAs: d.fieldDataType,
        ...(d.options ? { needsOptions: true } : {}),
        verified: d.verified,
      })),
      existingFieldTypes: REGISTRY_TO_SURVEY_TYPE,
      notes: [
        'A new custom field is created for each create question, in a "Survey | <survey name>" folder.',
        'Not supported: payment elements, image elements, loose address sub-fields (use the address element).',
        'Survey logic (jumps, disqualify) is not available yet.',
      ],
    }),
  }),

  defineTool({
    name: 'surveys_builder_list_surveys',
    description: 'List surveys in the sub-account (internal builder API), optionally searched by name.',
    properties: {
      query: { type: 'string', description: 'Search by name' },
      limit: { type: 'number', description: 'Default 20' },
      skip: { type: 'number' },
    },
    handler: async (client, args) => {
      const res = await sb(client).listSurveys({ query: args.query, limit: args.limit, skip: args.skip });
      return {
        total: res.total,
        surveys: res.surveys.map((s) => ({ id: s._id, name: s.name, dateUpdated: s.dateUpdated ?? s.updatedAt })),
      };
    },
  }),

  defineTool({
    name: 'surveys_builder_get_survey',
    description:
      'Read one survey through the internal survey-builder API: its slides and the questions on each (uuid, tag, type, label, ' +
      'required, custom) plus settings. Pass raw: true for the complete stored document, including formData with its theme, ' +
      'fieldCSS and the exact per-element JSON.',
    properties: {
      surveyId: { type: 'string' },
      raw: { type: 'boolean', description: 'Return the full stored document instead of the summary' },
    },
    required: ['surveyId'],
    handler: async (client, args) => {
      const surveyId = String(args.surveyId || '').trim();
      if (!surveyId) throw new Error('surveyId is required.');
      const doc = await sb(client).getSurvey(surveyId);
      return args.raw === true ? doc : summarizeSurvey(doc);
    },
  }),

  defineTool({
    name: 'surveys_builder_validate_survey',
    description:
      'Dry-run validation. Pass slides (the same shape as surveys_builder_create_survey) to check a survey before creating it, ' +
      'or surveyId to check a stored survey. Nothing is created or changed.',
    properties: {
      slides: { type: 'array', items: SLIDE_SCHEMA },
      surveyId: { type: 'string' },
    },
    handler: async (client, args) => {
      if (args.surveyId) {
        const doc = await sb(client).getSurvey(args.surveyId);
        const registry = hasCustom(doc.formData) ? await loadCustomFields(client) : undefined;
        return validateSurveyFormData(doc.formData, { knownCustomFieldIds: knownIds(registry) });
      }
      const inputs = slideInputs(args.slides);
      const specs = inputs.flatMap((s) => s.questions);
      const registry = specs.some((s) => s?.customFieldId || s?.create) ? await loadCustomFields(client) : undefined;
      const plan = planInline(specs, registry);
      const pending = pendingRecords(plan);
      const fd = buildSurveyFormData(
        { form: {}, slides: [{ id: 'x', button: DEFAULT_SLIDE_BUTTON, slideData: [] }] },
        buildSlides(inputs, questionContext(client, registry, pending))
      );
      return {
        ...validateSurveyFormData(fd, { knownCustomFieldIds: knownIds(registry, pending) }),
        customFieldsToCreate: plan.specs.map((s) => plan.payloads.get(s)),
      };
    },
  }),

  defineTool({
    name: 'surveys_builder_create_survey',
    description:
      'Create a survey with its slides and questions in one call. Validated before anything is created; custom fields for ' +
      '"create" questions are made in a "Survey | <name>" folder and rolled back if the survey write fails; verified by read-back. ' +
      'Pass templateSurveyId (a builder-saved survey) to copy its theme and settings; its slides are not copied. ' +
      'Avoid a captcha element if the survey must be submitted programmatically.',
    properties: {
      name: { type: 'string' },
      slides: { type: 'array', items: SLIDE_SCHEMA, description: 'Slides in order' },
      settings: SETTINGS_SCHEMA,
      templateSurveyId: { type: 'string' },
    },
    required: ['name', 'slides'],
    handler: async (client, args) => {
      const surveys = sb(client);
      const name = String(args.name || '').trim();
      if (!name) throw new Error('name is required.');
      const inputs = slideInputs(args.slides);
      const specs = inputs.flatMap((s) => s.questions);

      const needsRegistry = specs.some((s) => s?.customFieldId || s?.create);
      const registry = needsRegistry ? await loadCustomFields(client) : undefined;
      if (specs.some((s) => s?.customFieldId) && !registry) throw new Error('Could not load this location\'s custom fields.');

      let base: SurveyFormData | undefined;
      const notes: string[] = [];
      if (args.templateSurveyId) {
        const template = await surveys.getSurvey(args.templateSurveyId);
        if (!template.formData?.form || typeof template.formData.form !== 'object') {
          throw new Error(`Template survey ${args.templateSurveyId} has no formData.form.`);
        }
        base = template.formData;
        notes.push(`Theme and settings copied from "${template.name}" (${template._id}); its slides were not copied.`);
      }

      // Dry run on a stand-in base: nothing is created unless the survey validates.
      const plan = planInline(specs, registry);
      const pending = pendingRecords(plan);
      const standIn = base || { form: {}, slides: [{ id: 'x', button: DEFAULT_SLIDE_BUTTON, slideData: [] }] };
      const draft = buildSurveyFormData(standIn, buildSlides(inputs, questionContext(client, registry, pending)));
      notes.push(...applySettings(draft.form, args.settings));
      const check = validateSurveyFormData(draft, { knownCustomFieldIds: knownIds(registry, pending) });
      assertValid(undefined, check, 'Survey not created');

      const created = await createInlineFields(surveys, plan, `Survey | ${name}`);
      let survey: SurveyDocument | undefined;
      try {
        survey = await surveys.createSurvey(name);
        const formData = buildSurveyFormData(
          base || survey.formData,
          buildSlides(inputs, questionContext(client, registry, created.records)),
          survey.formData?.form?.company
        );
        if (base) {
          // Keep the new survey out of the template's list folder, and drop logic that points at the template's questions.
          formData.parentFolderId = survey.formData?.parentFolderId ?? '';
          formData.parentFolderName = survey.formData?.parentFolderName ?? '';
          if (formData.form.conditionalLogic) {
            formData.form.conditionalLogic = null;
            notes.push('The template\'s conditional logic was not copied.');
          }
        }
        applySettings(formData.form, args.settings);
        assertValid(undefined, validateSurveyFormData(formData, { knownCustomFieldIds: knownIds(registry, created.records) }), 'Survey not created');

        const { verified, doc } = await writeAndVerify(surveys, survey._id, name, formData);
        const summary = summarizeSurvey(doc);
        if (!summary.builderSaved) notes.push(API_ONLY_NOTE);
        return {
          message: `Survey "${name}" created`,
          verified,
          ...(verified ? {} : { verificationNote: NOT_VERIFIED_NOTE }),
          ...(created.fieldIds.length ? { createdCustomFields: created.fieldIds, customFieldFolderId: created.folderId } : {}),
          notes,
          warnings: check.warnings,
          survey: summary,
        };
      } catch (err) {
        let cleanup = '';
        if (survey) {
          try {
            await surveys.deleteSurvey(survey._id);
            cleanup += ` The half-created survey ${survey._id} was deleted.`;
          } catch {
            cleanup += ` The half-created survey ${survey._id} could not be deleted.`;
          }
        }
        if (created.fieldIds.length) cleanup += await rollbackFields(surveys, created);
        throw new Error(`${(err as Error).message}${cleanup}`);
      }
    },
  }),

  defineTool({
    name: 'surveys_builder_update_questions',
    description:
      'Add, remove, move or edit slides and questions, applied in order to the stored survey (everything else is preserved). ' +
      'Question refs are { uuid } or { slide, index } — get both from surveys_builder_get_survey. An address element moves and ' +
      'is removed as one question with its sub-fields. Answer options of an existing question cannot be edited (remove and re-add). ' +
      'Removing a question does not delete its custom field.',
    properties: {
      surveyId: { type: 'string' },
      ops: { type: 'array', items: OP_SCHEMA },
    },
    required: ['surveyId', 'ops'],
    handler: async (client, args) => {
      const ops = args.ops as SurveyOp[];
      if (!Array.isArray(ops) || ops.length === 0) throw new Error('ops must be a non-empty array.');
      const specs = ops.filter((o) => o?.op === 'add_question').map((o) => (o as any).question as QuestionSpec);
      return mutateSurvey(client, args.surveyId, {
        specs,
        apply: (fd, ctx) => applySurveyOps(fd, ops, ctx).notes,
      });
    },
  }),

  defineTool({
    name: 'surveys_builder_set_settings',
    description:
      'Change survey settings: the message shown after submit (thankyouText, HTML) or a redirect URL, the progress bar, the Back ' +
      'button, auto-advance, and scheduling (formSchedule, merged). Everything else is preserved.',
    properties: { surveyId: { type: 'string' }, ...SETTINGS_SCHEMA.properties },
    required: ['surveyId'],
    handler: async (client, args) => {
      const { surveyId, locationId: _loc, ...settings } = args;
      if (Object.keys(settings).length === 0) throw new Error('Give at least one setting to change.');
      return mutateSurvey(client, surveyId, { apply: (fd) => applySettings(fd.form, settings) });
    },
  }),

  defineTool({
    name: 'surveys_builder_rename_survey',
    description: 'Rename a survey. Its content is unchanged.',
    properties: { surveyId: { type: 'string' }, name: { type: 'string' } },
    required: ['surveyId', 'name'],
    handler: async (client, args) => {
      const name = String(args.name || '').trim();
      if (!name) throw new Error('name is required.');
      return mutateSurvey(client, args.surveyId, { name, apply: () => [] });
    },
  }),

  defineTool({
    name: 'surveys_builder_delete_survey',
    description:
      'Delete a survey (it disappears from the survey list). Requires confirm: true; pass expectedName to guard against deleting ' +
      'the wrong one. With deleteCustomFields: true, also permanently deletes the contact custom fields that were created for this ' +
      'survey and are used by no other survey or form, and their folder once it is empty. Fields that existed before the survey ' +
      'are always kept. Deleted custom fields lose their values on every contact.',
    properties: {
      surveyId: { type: 'string' },
      confirm: { type: 'boolean', description: 'Must be true' },
      expectedName: { type: 'string', description: 'If given, the survey name must match exactly or nothing is deleted' },
      deleteCustomFields: { type: 'boolean', description: 'Also delete custom fields no other survey or form uses' },
    },
    required: ['surveyId', 'confirm'],
    handler: async (client, args) => {
      if (args.confirm !== true) throw new Error('Pass confirm: true to delete this survey.');
      const surveys = sb(client);
      const doc = await surveys.getSurvey(args.surveyId);
      if (doc.deleted === true) return { message: `Survey ${args.surveyId} was already deleted.`, id: doc._id, name: doc.name };
      if (args.expectedName !== undefined && doc.name !== args.expectedName) {
        throw new Error(`Not deleted: survey ${args.surveyId} is named "${doc.name}", not "${args.expectedName}".`);
      }

      const customEls = (doc.formData?.slides || [])
        .flatMap((s) => s.slideData || [])
        .filter((el) => el.custom === true && typeof el.id === 'string');
      const fieldIds = Array.from(new Set(customEls.map((el) => el.id as string)));
      // Only fields created for this survey are candidates: a field that existed before the survey
      // (attached with customFieldId) is never deleted, nor one whose creation time is unknown.
      const surveyCreated = Date.parse(String(doc.dateAdded || ''));
      const createdForSurvey = new Set(
        customEls
          .filter((el) => {
            const added = Date.parse(String(el.dateAdded || ''));
            return Number.isFinite(added) && Number.isFinite(surveyCreated) && added >= surveyCreated - 60_000;
          })
          .map((el) => el.id as string)
      );

      // Scan usage BEFORE deleting anything, so a failed scan deletes no fields.
      let cleanupPlan: { toDelete: string[]; kept: string[]; preExisting: string[]; scanned: string } | undefined;
      let cleanupError: string | undefined;
      if (args.deleteCustomFields === true && fieldIds.length) {
        try {
          const { used, scanned } = await customFieldsUsedElsewhere(client, doc._id);
          cleanupPlan = {
            toDelete: fieldIds.filter((id) => createdForSurvey.has(id) && !used.has(id)),
            kept: fieldIds.filter((id) => createdForSurvey.has(id) && used.has(id)),
            preExisting: fieldIds.filter((id) => !createdForSurvey.has(id)),
            scanned,
          };
        } catch (err) {
          cleanupError = `Custom fields were NOT deleted: could not check which other surveys or forms use them (${(err as Error).message}).`;
        }
      }

      const res = await surveys.deleteSurvey(doc._id);
      const result: Record<string, unknown> = { message: `Survey "${doc.name}" deleted`, id: doc._id, name: doc.name, deleted: res.deleted };
      if (cleanupError) result.customFields = { error: cleanupError };
      if (!cleanupPlan) {
        if (fieldIds.length && args.deleteCustomFields !== true) {
          result.note = `The survey's ${fieldIds.length} custom field(s) were kept: ${fieldIds.join(', ')}.`;
        }
        return result;
      }

      const deleted: string[] = [];
      const failed: string[] = [];
      for (const id of cleanupPlan.toDelete) {
        try {
          await surveys.deleteCustomField(id);
          deleted.push(id);
        } catch {
          failed.push(id);
        }
      }

      // A folder goes only when it held deleted fields and nothing is left in it.
      const folders = Array.from(new Set(
        customEls.filter((el) => deleted.includes(el.id as string) && typeof el.parentId === 'string').map((el) => el.parentId as string)
      ));
      const deletedFolders: string[] = [];
      let folderNote: string | undefined;
      if (folders.length) {
        const registry = await loadCustomFields(client);
        const records = Array.from(registry?.values() || []);
        if (!registry || !records.some((r) => 'parentId' in r)) {
          folderNote = `Folder(s) ${folders.join(', ')} were kept: could not confirm they are empty.`;
        } else {
          for (const folderId of folders) {
            if (records.some((r) => r.parentId === folderId)) continue;
            try {
              await surveys.deleteCustomField(folderId);
              deletedFolders.push(folderId);
            } catch {
              failed.push(`${folderId} (folder)`);
            }
          }
        }
      }

      result.customFields = {
        deleted,
        keptBecauseUsedElsewhere: cleanupPlan.kept,
        keptBecausePreExisting: cleanupPlan.preExisting,
        ...(failed.length ? { failed } : {}),
        deletedFolders,
        ...(folderNote ? { note: folderNote } : {}),
        scanned: cleanupPlan.scanned,
      };
      return result;
    },
  }),
];
