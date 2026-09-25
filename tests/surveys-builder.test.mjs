// Offline tests for the internal surveys builder: HTTP client contract, palette
// (checked against the builder-saved JSON from the 2026-09-25 capture), inline
// custom-field payloads, edit ops, validator and the tool-level write paths.
//
// Run with: npm test   (builds to dist/, then node --test tests/*.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { SurveysBuilderClient } from '../dist/crm/surveys-builder-client.js';
import { SURVEY_PALETTE, buildSurveyCustomElement } from '../dist/catalog/survey-fields.js';
import { inlineFieldPayload } from '../dist/catalog/survey-custom-fields.js';
import { applySurveyOps, questionUnits } from '../dist/catalog/survey-mutations.js';
import { validateSurveyFormData } from '../dist/catalog/survey-validator.js';
import { summarizeSurvey, surveysBuilderTools } from '../dist/tools/surveys-builder.js';

const LOC = 'oIsICGsND5sAh4RdqGe8';
const tool = (name) => surveysBuilderTools.find((t) => t.tool.name === name);
const noUuid = ({ uuid, ...rest }) => rest;

// ─── HTTP client ─────────────────────────────────────────────

function mockFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const r = responses.shift();
    return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), { status: r.status });
  };
  return { impl, calls };
}

function tokenProvider() {
  const seen = [];
  const fn = async (force) => {
    seen.push(Boolean(force));
    return force ? 'eyJfresh.aaaaaaaaaaaa.bbbb' : 'eyJcached.aaaaaaaaaaaa.bbbb';
  };
  return { fn, seen };
}

const SURVEY = {
  _id: 's1',
  name: 'Feedback',
  locationId: LOC,
  dateAdded: '2026-09-25T10:00:00.000Z',
  formData: {
    form: { company: { name: 'NexGenHighLevel' } },
    slides: [
      {
        id: '1790264773205-0',
        slideName: 'Slide 1',
        button: { background: '2A3135' },
        slideData: [
          { uuid: 'u1', type: 'text', tag: 'full_name', label: 'Full Name', required: true, standard: true },
          { uuid: 'u2', type: 'radio', tag: 'cf1', id: 'cf1', label: 'Pick', custom: true, standard: false },
        ],
      },
    ],
    surveyLogicLinkById: true,
  },
};

const client = (responses) => {
  const { impl, calls } = mockFetch(responses);
  const tp = tokenProvider();
  return { c: new SurveysBuilderClient({ locationId: LOC, getIdToken: tp.fn, fetchImpl: impl }), calls, tp };
};

test('client sends exactly channel/source/version/token-id and no Authorization', async () => {
  const { c, calls } = client([{ status: 200, body: { survey: SURVEY, traceId: 't' } }]);
  const doc = await c.getSurvey('s1');
  assert.equal(doc._id, 's1', 'GET /surveys/{id} { survey } envelope is unwrapped');
  assert.equal(calls[0].url, `https://services.leadconnectorhq.com/surveys/s1`);
  const h = calls[0].init.headers;
  assert.equal(h.channel, 'APP');
  assert.equal(h.source, 'WEB_USER');
  assert.equal(h.version, '2021-07-28');
  assert.equal(h['token-id'], 'eyJcached.aaaaaaaaaaaa.bbbb');
  assert.equal(Object.keys(h).some((k) => k.toLowerCase() === 'authorization'), false);
});

test('client retries once with a forced token refresh on 401', async () => {
  const { c, calls, tp } = client([
    { status: 401, body: { message: 'Unauthorized: E003' } },
    { status: 200, body: { survey: SURVEY } },
  ]);
  await c.getSurvey('s1');
  assert.deepEqual(tp.seen, [false, true]);
  assert.equal(calls[1].init.headers['token-id'], 'eyJfresh.aaaaaaaaaaaa.bbbb');
});

test('client errors carry the status and never echo a JWT', async () => {
  const { c } = client([
    { status: 401, body: 'bad eyJaaaaaaaaaaaaaa.bbbbbbbb.cccccc' },
    { status: 401, body: 'bad eyJaaaaaaaaaaaaaa.bbbbbbbb.cccccc' },
  ]);
  await assert.rejects(c.getSurvey('s1'), (err) => {
    assert.equal(err.status, 401);
    assert.doesNotMatch(err.message, /eyJaaaa/);
    return true;
  });
});

test('list sends the builder query string', async () => {
  const { c, calls } = client([{ status: 200, body: { surveys: [{ _id: 's1', name: 'A' }], total: 1 } }]);
  const res = await c.listSurveys({ query: 'fee' });
  assert.equal(res.total, 1);
  assert.match(calls[0].url, /\/surveys\/\?skip=0&limit=20&locationId=oIsICGsND5sAh4RdqGe8&query=fee&type=survey$/);
});

test('create posts locationId + source + name; update posts ONLY name + formData and unwraps { data }', async () => {
  const { c, calls } = client([
    { status: 201, body: { survey: SURVEY } },
    { status: 201, body: { data: SURVEY, traceId: 't' } },
  ]);
  await c.createSurvey('Feedback');
  assert.deepEqual(JSON.parse(calls[0].init.body), { locationId: LOC, source: 'landing_page', name: 'Feedback' });
  const doc = await c.updateSurvey('s1', 'Feedback', SURVEY.formData);
  assert.equal(doc._id, 's1');
  assert.equal(calls[1].init.method, 'POST');
  assert.match(calls[1].url, /\/surveys\/s1$/);
  assert.deepEqual(Object.keys(JSON.parse(calls[1].init.body)).sort(), ['formData', 'name']);
});

test('update refuses a partial formData (the API would wipe form and break the builder)', async () => {
  const { c, calls } = client([]);
  await assert.rejects(c.updateSurvey('s1', 'N', { slides: SURVEY.formData.slides }), /formData\.form/);
  await assert.rejects(c.updateSurvey('s1', 'N', { form: {}, slides: [] }), /at least one slide/);
  assert.equal(calls.length, 0);
});

test('custom field + folder payloads', async () => {
  const { c, calls } = client([
    { status: 201, body: { customFieldFolder: { id: 'fold1', documentType: 'folder' } } },
    { status: 201, body: { customField: { id: 'cf9', name: 'Q' } } },
    { status: 200, body: { succeded: true } },
  ]);
  await c.createCustomFieldFolder('Survey | Feedback');
  assert.deepEqual(JSON.parse(calls[0].init.body), { name: 'Survey | Feedback', documentType: 'folder', model: 'contact' });
  await c.createCustomField({ name: 'Q', dataType: 'RADIO', parentId: 'fold1', options: ['A', 'B'] });
  assert.deepEqual(JSON.parse(calls[1].init.body), { name: 'Q', dataType: 'RADIO', model: 'contact', placeholder: '', parentId: 'fold1', options: ['A', 'B'] });
  await c.deleteCustomField('cf9');
  assert.equal(calls[2].init.method, 'DELETE');
  assert.match(calls[2].url, /\/locations\/oIsICGsND5sAh4RdqGe8\/customFields\/cf9$/);
});

// ─── Palette vs. the builder-saved capture ───────────────────

test('standard elements match the builder-saved JSON', () => {
  assert.deepEqual(noUuid(SURVEY_PALETTE.full_name.build(1)[0]), {
    type: 'text', tag: 'full_name', label: 'Full Name', placeholder: 'Enter your full name', hiddenFieldQueryKey: 'full_name',
    required: false, standard: true, typeLabel: 'Text', active: false,
  });
  assert.deepEqual(noUuid(SURVEY_PALETTE.date_of_birth.build(1)[0]), {
    type: 'date', tag: 'date_of_birth', label: 'Date of birth', placeholder: 'DD / MM / YYYY', format: 'YYYY-MM-DD', separator: '-',
    hiddenFieldQueryKey: 'date_of_birth', standard: true, typeLabel: 'Date', active: false,
  });
  assert.deepEqual(noUuid(SURVEY_PALETTE.header.build(2)[0]), {
    type: 'h1', tag: 'header', typeLabel: 'Text', label: '<h1 style="padding-left: 0px!important;">Text</h1>', placeholder: 'header',
    align: 'left', bgColor: 'FFFFFF00', weight: 400,
    border: { border: 0, color: 'FFFFFF', radius: 0, type: 'none' },
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    shadow: { blur: 0, color: 'FFFFFF', horizontal: 0, spread: 0, vertical: 0 },
    hiddenFieldQueryKey: 'header_2', standard: true, active: false,
  });
});

test('address inserts the group plus 5 uuid-less children', () => {
  const els = SURVEY_PALETTE.address.build(1);
  assert.equal(els.length, 6);
  assert.equal(els[0].tag, 'group_address');
  assert.ok(els[0].uuid);
  assert.deepEqual(els.slice(1).map((e) => e.tag), ['address', 'city', 'state', 'country', 'postal_code']);
  assert.ok(els.slice(1).every((e) => e.uuid === undefined && e.category === 'address'));
  assert.equal(els[4].type, 'select');
  assert.equal(els[1].hideInLeftSideBar, true);
});

// Exact stored JSON of the captured Radio element (capture §6.5).
const CAPTURED_RADIO = {
  id: '6aS53vEYvVaUKWPCCMQS', tag: '6aS53vEYvVaUKWPCCMQS',
  type: 'radio', dataType: 'RADIO', typeLabel: 'Radio',
  label: 'Radio 3esy', name: 'Radio 3esy', placeholder: '',
  fieldKey: 'contact.radio_3esy', hiddenFieldQueryKey: 'radio_3esy',
  picklistOptions: ['Option 1', 'Option 2', 'Option 3'],
  optionDisplayType: 'TEXT_ONLY', isAllowedCustomOption: false,
  model: 'contact', documentType: 'field', parentId: 'uRSp9PasJLzlNPQi5hpy',
  locationId: LOC, position: 100, scopes: [],
  dateAdded: '2026-09-24T21:58:59.148Z',
  custom: true, customEdited: true, __pendingClone: false,
  standard: false, required: false, active: false,
};

test('custom radio element equals the builder-saved JSON', () => {
  const record = {
    id: '6aS53vEYvVaUKWPCCMQS', name: 'Radio 3esy', fieldKey: 'contact.radio_3esy', dataType: 'RADIO', placeholder: '',
    picklistOptions: ['Option 1', 'Option 2', 'Option 3'], optionDisplayType: 'TEXT_ONLY', isAllowedCustomOption: false,
    model: 'contact', documentType: 'field', parentId: 'uRSp9PasJLzlNPQi5hpy', locationId: LOC, position: 100, scopes: [],
    dateAdded: '2026-09-24T21:58:59.148Z',
  };
  assert.deepEqual(noUuid(buildSurveyCustomElement(record, 'radio', LOC)), CAPTURED_RADIO);
});

test('rating element keeps dataType RATING over a NUMERICAL field', () => {
  const el = buildSurveyCustomElement(
    { id: '2lgzXB3NyeK6qXJe87Hk', name: 'Rating rat584 2e26', fieldKey: 'contact.rating_rat584_2e26', dataType: 'NUMERICAL', model: 'contact' },
    'rating',
    LOC
  );
  assert.equal(el.dataType, 'RATING');
  assert.equal(el.type, 'rating');
  assert.equal(el.hiddenFieldQueryKey, 'rating_rat584_2e26');
  assert.deepEqual(
    [el.iconType, el.count, el.color, el.inactiveColor, el.lowestRating, el.highestRating, el.iconAlignment, el.calculationType],
    ['star', 5, 'fbbf24', 'E5E7EB', 'Bad', 'Good', 'left', 'absolute']
  );
});

// ─── Inline custom-field payloads ────────────────────────────

test('inline payloads follow the verified per-dataType rules', () => {
  const taken = new Set();
  assert.deepEqual(inlineFieldPayload({ type: 'rating' }, 'Rate us', taken), { name: 'Rate us', dataType: 'NUMERICAL', parentId: undefined });
  assert.equal(inlineFieldPayload({ type: 'score', name: 'Score' }, undefined, taken).dataType, 'NUMERICAL');
  assert.deepEqual(inlineFieldPayload({ type: 'radio', options: ['Google', 'Referral'] }, 'Heard from', taken).options, ['Google', 'Referral']);
  assert.deepEqual(inlineFieldPayload({ type: 'textbox_list', options: ['Name'] }, 'Kids', taken).textBoxListOptions, [{ label: 'Name', prefillValue: '' }]);
  assert.throws(() => inlineFieldPayload({ type: 'checkbox' }, 'Pick', taken), /needs create\.options/);
  assert.throws(() => inlineFieldPayload({ type: 'text', options: ['x'] }, 'Name', taken), /does not take options/);
  assert.throws(() => inlineFieldPayload({ type: 'rating' }, undefined, taken), /needs create\.name or a label/);
});

test('an inline field name already used in the location gets a suffix', () => {
  const taken = new Set(['how did you hear?']);
  const p = inlineFieldPayload({ type: 'text' }, 'How did you hear?', taken);
  assert.match(p.name, /^How did you hear\? [0-9a-f]{4}$/);
  assert.ok(taken.has(p.name.toLowerCase()));
});

// ─── Ops + validator ─────────────────────────────────────────

const ctx = (records = new Map()) => {
  const counts = new Map();
  return {
    locationId: LOC,
    registry: new Map(),
    inlineRecord: (spec) => records.get(spec),
    nextNumber: (tag) => { const n = (counts.get(tag) || 0) + 1; counts.set(tag, n); return n; },
  };
};

const freshSurvey = () => structuredClone(SURVEY.formData);

test('address moves and is removed as one question, and form.address is mirrored', () => {
  const fd = freshSurvey();
  applySurveyOps(fd, [{ op: 'add_slide', name: 'Where' }, { op: 'add_question', slide: 0, question: { tag: 'address' }, index: 0 }], ctx());
  assert.equal(fd.slides[0].slideData.length, 8);
  assert.deepEqual(fd.form.address.children.map((c) => c.tag), ['address', 'city', 'state', 'country', 'postal_code']);
  assert.equal(questionUnits(fd.slides[0].slideData).length, 3, 'group + children count as one question');

  const groupUuid = fd.slides[0].slideData[0].uuid;
  applySurveyOps(fd, [{ op: 'move_question', ref: { uuid: groupUuid }, slide: 1 }], ctx());
  assert.equal(fd.slides[0].slideData.length, 2);
  assert.equal(fd.slides[1].slideData.length, 6);
  assert.equal(validateSurveyFormData(fd).valid, true);

  applySurveyOps(fd, [{ op: 'remove_question', ref: { slide: 1, index: 0 } }], ctx());
  assert.equal(fd.slides[1].slideData.length, 0);
});

test('ops reject bad refs, removing the last slide and option edits', () => {
  assert.throws(() => applySurveyOps(freshSurvey(), [{ op: 'remove_slide', slide: 0 }], ctx()), /at least one slide/);
  assert.throws(() => applySurveyOps(freshSurvey(), [{ op: 'remove_question', ref: { uuid: 'nope' } }], ctx()), /no question with uuid/);
  assert.throws(() => applySurveyOps(freshSurvey(), [{ op: 'rename_slide', slide: 5, name: 'x' }], ctx()), /not found/);
  assert.throws(
    () => applySurveyOps(freshSurvey(), [{ op: 'update_question', ref: { uuid: 'u2' }, props: { picklistOptions: ['a'] } }], ctx()),
    /options belong to the backing custom field/
  );
});

test('removing the last element of a custom field reports it as orphaned', () => {
  const res = applySurveyOps(freshSurvey(), [{ op: 'remove_question', ref: { uuid: 'u2' } }], ctx());
  assert.deepEqual(res.orphanedCustomFieldIds, ['cf1']);
});

test('update_question wraps a plain header label in the builder markup', () => {
  const fd = freshSurvey();
  applySurveyOps(fd, [{ op: 'add_question', question: { tag: 'header', label: 'Tell us <more>' } }], ctx());
  const h = fd.slides[0].slideData.at(-1);
  assert.equal(h.label, '<h1 style="padding-left: 0px!important;">Tell us &lt;more&gt;</h1>');
  assert.equal(h.hiddenFieldQueryKey, 'header_1');
});

test('validator blocks each captured rule', () => {
  const dupTag = freshSurvey();
  dupTag.slides[0].slideData.push({ ...dupTag.slides[0].slideData[0], uuid: 'u9' });
  assert.match(validateSurveyFormData(dupTag).issues.join(), /"full_name" appears 2 times/);

  const dupUuid = freshSurvey();
  dupUuid.slides[0].slideData[1].uuid = 'u1';
  assert.match(validateSurveyFormData(dupUuid).issues.join(), /duplicate uuid/);

  const noForm = freshSurvey();
  delete noForm.form;
  assert.match(validateSurveyFormData(noForm).issues.join(), /formData\.form must be an object/);

  const loose = freshSurvey();
  loose.slides[0].slideData.push({ category: 'address', type: 'text', tag: 'city', standard: true });
  assert.match(validateSurveyFormData(loose).issues.join(), /not under an address group/);

  const pay = freshSurvey();
  pay.slides[0].slideData.push({ uuid: 'p1', type: 'payment', tag: 'payment', standard: true });
  assert.match(validateSurveyFormData(pay).issues.join(), /payment elements/);

  const unknownCf = validateSurveyFormData(freshSurvey(), { knownCustomFieldIds: new Set() });
  assert.match(unknownCf.issues.join(), /custom field "cf1" does not exist/);

  assert.equal(validateSurveyFormData(freshSurvey(), { knownCustomFieldIds: new Set(['cf1']) }).valid, true);
});

// ─── Tool-level write paths (stubbed survey client) ──────────

function stubSurveys(initial) {
  const store = new Map(initial ? [[initial._id, structuredClone(initial)]] : []);
  const log = [];
  let n = 0;
  const failOn = new Set();
  const surveys = {
    failOn,
    log,
    store,
    async getSurvey(id) {
      log.push(['get', id]);
      if (!store.has(id)) throw new Error(`no survey ${id}`);
      return structuredClone(store.get(id));
    },
    async listSurveys() {
      log.push(['list']);
      return { surveys: [...store.values()].filter((s) => !s.deleted).map((s) => ({ _id: s._id, name: s.name })), total: store.size };
    },
    async createSurvey(name) {
      log.push(['createSurvey', name]);
      if (failOn.has('createSurvey')) throw new Error('create boom');
      const doc = {
        _id: `new${++n}`, name, locationId: LOC, dateAdded: new Date().toISOString(),
        formData: { form: { company: { name: 'NexGenHighLevel' } }, slides: [{ id: '1-0', slideName: 'Slide 1', active: false, slideData: [], button: { background: '2A3135' } }], surveyLogicLinkById: true, parentFolderId: '' },
      };
      store.set(doc._id, doc);
      return structuredClone(doc);
    },
    async updateSurvey(id, name, formData) {
      log.push(['updateSurvey', id, Object.keys({ name, formData })]);
      if (failOn.has('updateSurvey')) throw new Error('update boom');
      const doc = { ...store.get(id), name, formData: structuredClone(formData) };
      store.set(id, doc);
      return structuredClone(doc);
    },
    async waitForSurvey(id, isVisible) {
      const doc = structuredClone(store.get(id));
      return { verified: isVisible(doc), doc };
    },
    async deleteSurvey(id) {
      log.push(['deleteSurvey', id]);
      store.get(id).deleted = true;
      return { deleted: true };
    },
    async createCustomFieldFolder(name) {
      log.push(['folder', name]);
      return { id: 'fold1', documentType: 'folder', name };
    },
    async createCustomField(input) {
      log.push(['field', input]);
      if (failOn.has('field') && log.filter((l) => l[0] === 'field').length > 1) throw new Error('field boom');
      const id = `cf_${input.name.replace(/\W+/g, '_')}`;
      return { id, name: input.name, fieldKey: `contact.${id}`, dataType: input.dataType, parentId: input.parentId, model: 'contact', dateAdded: new Date().toISOString() };
    },
    async deleteCustomField(id) {
      log.push(['deleteField', id]);
    },
  };
  return surveys;
}

function stubClient(surveys, { registry = [], forms = [] } = {}) {
  return {
    locationId: LOC,
    surveysBuilder: () => surveys,
    formsBuilder: () => ({
      listForms: async () => ({ forms: forms.map((f) => ({ _id: f._id })), total: forms.length }),
      getForm: async (id) => forms.find((f) => f._id === id),
    }),
    get: async () => ({ customFields: registry }),
  };
}

const CREATE_ARGS = {
  name: 'Customer Feedback',
  slides: [
    { questions: [{ tag: 'full_name', required: true }, { tag: 'email', required: true }] },
    {
      name: 'About you',
      questions: [
        { label: 'How did you hear about us?', create: { type: 'radio', options: ['Google', 'Referral', 'Social'] } },
        { label: 'Rate your experience', create: { type: 'rating' } },
      ],
    },
  ],
  settings: { thankyouText: '<p>Thanks!</p>', progressBar: true },
};

test('create_survey: folder → fields → survey → one complete write, verified', async () => {
  const surveys = stubSurveys();
  const res = await tool('surveys_builder_create_survey').handler(stubClient(surveys), structuredClone(CREATE_ARGS));
  assert.equal(res.verified, true);
  assert.deepEqual(surveys.log.map((l) => l[0]), ['folder', 'field', 'field', 'createSurvey', 'updateSurvey']);
  assert.equal(surveys.log[0][1], 'Survey | Customer Feedback');
  const [radio, rating] = surveys.log.filter((l) => l[0] === 'field').map((l) => l[1]);
  assert.deepEqual(radio, { name: 'How did you hear about us?', dataType: 'RADIO', parentId: 'fold1', options: ['Google', 'Referral', 'Social'] });
  assert.equal(rating.dataType, 'NUMERICAL');

  const stored = surveys.store.get('new1').formData;
  assert.deepEqual(stored.form.company, { name: 'NexGenHighLevel' }, 'server-made form keys are preserved');
  assert.equal(stored.form.formAction.actionType, '2');
  assert.equal(stored.form.isProgressBarEnabled, true);
  assert.equal(stored.slides.length, 2);
  assert.equal(stored.slides[1].slideName, 'About you');
  assert.deepEqual(stored.slides[1].slideData.map((e) => [e.type, e.dataType, e.label]), [
    ['radio', 'RADIO', 'How did you hear about us?'],
    ['rating', 'RATING', 'Rate your experience'],
  ]);
  assert.ok(res.notes.some((n) => /not been saved in the builder/.test(n)), 'API-only surveys are flagged');
  assert.deepEqual(res.createdCustomFields.length, 2);
});

test('create_survey writes nothing when validation fails', async () => {
  const surveys = stubSurveys();
  const args = structuredClone(CREATE_ARGS);
  args.slides[1].questions.push({ tag: 'email' });
  await assert.rejects(tool('surveys_builder_create_survey').handler(stubClient(surveys), args), /"email" appears 2 times/);
  assert.equal(surveys.log.length, 0);
});

test('create_survey rolls back the survey, fields and folder when the write fails', async () => {
  const surveys = stubSurveys();
  surveys.failOn.add('updateSurvey');
  await assert.rejects(tool('surveys_builder_create_survey').handler(stubClient(surveys), structuredClone(CREATE_ARGS)), /update boom.*deleted.*rolled back/s);
  const deletes = surveys.log.filter((l) => l[0] === 'deleteField' || l[0] === 'deleteSurvey').map((l) => l[1]);
  assert.deepEqual(deletes, ['new1', 'cf_How_did_you_hear_about_us_', 'cf_Rate_your_experience', 'fold1']);
});

test('create_survey rolls back fields already made when a later field fails', async () => {
  const surveys = stubSurveys();
  surveys.failOn.add('field');
  await assert.rejects(tool('surveys_builder_create_survey').handler(stubClient(surveys), structuredClone(CREATE_ARGS)), /field boom/);
  assert.deepEqual(surveys.log.filter((l) => l[0] === 'deleteField').map((l) => l[1]), ['cf_How_did_you_hear_about_us_', 'fold1']);
  assert.equal(surveys.log.some((l) => l[0] === 'createSurvey'), false);
});

test('create_survey from a template copies the theme but not its folder or logic', async () => {
  const template = {
    _id: 'tpl', name: 'Styled', locationId: LOC,
    formData: {
      form: { fieldStyle: { bgColor: 'FFFFFFFF' }, conditionalLogic: [{ x: 1 }], company: { name: 'Other agency' } },
      fieldCSS: '.x{}', slides: [{ id: 't-0', slideData: [{ uuid: 'old', type: 'text', tag: 'full_name' }], button: { background: '111111' } }],
      parentFolderId: 'folderX', parentFolderName: 'Old',
    },
  };
  const surveys = stubSurveys(template);
  const res = await tool('surveys_builder_create_survey').handler(stubClient(surveys), { name: 'T', slides: [{ questions: [{ tag: 'phone' }] }], templateSurveyId: 'tpl' });
  const fd = surveys.store.get('new1').formData;
  assert.equal(fd.fieldCSS, '.x{}');
  assert.deepEqual(fd.form.fieldStyle, { bgColor: 'FFFFFFFF' });
  assert.deepEqual(fd.form.company, { name: 'NexGenHighLevel' });
  assert.equal(fd.form.conditionalLogic, null);
  assert.equal(fd.parentFolderId, '');
  assert.deepEqual(fd.slides[0].slideData.map((e) => e.tag), ['phone']);
  assert.equal(fd.slides[0].button.background, '111111');
  assert.equal(res.survey.builderSaved, true);
});

test('update_questions preserves the rest of the survey and reuses its field folder', async () => {
  const stored = structuredClone(SURVEY);
  stored.formData.form.customKey = 'keep-me';
  stored.formData.fieldCSS = '.keep{}';
  stored.formData.slides[0].slideData[1] = { ...stored.formData.slides[0].slideData[1], customEdited: true, parentId: 'foldS' };
  const surveys = stubSurveys(stored);
  const res = await tool('surveys_builder_update_questions').handler(stubClient(surveys, { registry: [{ id: 'cf1', name: 'Pick', dataType: 'RADIO' }] }), {
    surveyId: 's1',
    ops: [{ op: 'add_question', slide: 0, question: { label: 'Any comments?', create: { type: 'large_text' } } }, { op: 'rename_slide', slide: 0, name: 'Start' }],
  });
  assert.equal(res.verified, true);
  assert.equal(surveys.log.some((l) => l[0] === 'folder'), false, 'existing survey folder reused');
  assert.equal(surveys.log.find((l) => l[0] === 'field')[1].parentId, 'foldS');
  const fd = surveys.store.get('s1').formData;
  assert.equal(fd.form.customKey, 'keep-me');
  assert.equal(fd.fieldCSS, '.keep{}');
  assert.equal(fd.slides[0].slideName, 'Start');
  assert.deepEqual(fd.slides[0].slideData.map((e) => e.type), ['text', 'radio', 'large_text']);
  assert.deepEqual(surveys.log.find((l) => l[0] === 'updateSurvey')[2], ['name', 'formData']);
});

test('set_settings: redirect uses actionType 1 and rejects both message and redirect', async () => {
  const surveys = stubSurveys(structuredClone(SURVEY));
  const c = stubClient(surveys, { registry: [{ id: 'cf1', name: 'Pick', dataType: 'RADIO' }] });
  await tool('surveys_builder_set_settings').handler(c, { surveyId: 's1', redirectUrl: 'https://example.com/thanks', autoAdvance: false });
  const form = surveys.store.get('s1').formData.form;
  assert.deepEqual([form.formAction.actionType, form.formAction.redirectUrl, form.disableAutoNavigation], ['1', 'https://example.com/thanks', true]);
  await assert.rejects(tool('surveys_builder_set_settings').handler(c, { surveyId: 's1', redirectUrl: 'https://x.test', thankyouText: 'hi' }), /not both/);
});

test('delete_survey guards: confirm and expectedName', async () => {
  const surveys = stubSurveys(structuredClone(SURVEY));
  const c = stubClient(surveys);
  await assert.rejects(tool('surveys_builder_delete_survey').handler(c, { surveyId: 's1', confirm: false }), /confirm: true/);
  await assert.rejects(tool('surveys_builder_delete_survey').handler(c, { surveyId: 's1', confirm: true, expectedName: 'Other' }), /Not deleted/);
  assert.equal(surveys.log.some((l) => l[0] === 'deleteSurvey'), false);
});

test('delete_survey cleanup deletes only fields made for this survey and unused elsewhere', async () => {
  const stored = structuredClone(SURVEY);
  const made = '2026-09-25T10:00:01.000Z';
  stored.formData.slides[0].slideData = [
    { uuid: 'a', type: 'radio', tag: 'mine', id: 'mine', custom: true, parentId: 'foldS', dateAdded: made },
    { uuid: 'b', type: 'text', tag: 'shared', id: 'shared', custom: true, parentId: 'foldS', dateAdded: made },
    { uuid: 'c', type: 'text', tag: 'old', id: 'old', custom: true, parentId: 'other', dateAdded: '2025-01-01T00:00:00.000Z' },
  ];
  const surveys = stubSurveys(stored);
  const forms = [{ _id: 'f1', formData: { form: { fields: [{ tag: 'shared', id: 'shared' }] } } }];
  const registry = [{ id: 'shared', parentId: 'foldS' }, { id: 'old', parentId: 'other' }];
  const res = await tool('surveys_builder_delete_survey').handler(stubClient(surveys, { forms, registry }), { surveyId: 's1', confirm: true, deleteCustomFields: true });
  assert.equal(res.deleted, true);
  assert.deepEqual(res.customFields.deleted, ['mine']);
  assert.deepEqual(res.customFields.keptBecauseUsedElsewhere, ['shared']);
  assert.deepEqual(res.customFields.keptBecausePreExisting, ['old']);
  assert.deepEqual(res.customFields.deletedFolders, [], 'folder still holds "shared"');
});

test('summary counts the address group as one question', () => {
  const fd = freshSurvey();
  applySurveyOps(fd, [{ op: 'add_question', question: { tag: 'address' } }], ctx());
  const s = summarizeSurvey({ ...SURVEY, formData: fd });
  assert.equal(s.slides[0].questions.length, 3);
  assert.deepEqual(s.slides[0].questions[2].children, ['address', 'city', 'state', 'country', 'postal_code']);
  assert.equal(s.builderSaved, false);
});
