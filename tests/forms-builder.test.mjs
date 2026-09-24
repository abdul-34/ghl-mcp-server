// Offline tests for the internal forms builder: HTTP client contract, template,
// field palette/custom mapping, mutations and the validator.
//
// Run with: npm test   (builds to dist/, then node --test tests/*.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { FormsBuilderClient } from '../dist/crm/forms-builder-client.js';
import { buildDefaultFormData, formDataFromTemplate } from '../dist/catalog/form-template.js';
import { buildStandardField, buildCustomField } from '../dist/catalog/form-fields.js';
import { applyFieldMutations, buildFieldList, pruneRulesReferencing } from '../dist/catalog/form-mutations.js';
import { validateFormBody } from '../dist/catalog/form-validator.js';

const LOC = 'loc123';
const RADIO_ID = 'YtyTad36aJP6ma7PsvqO';
const SCORE_ID = 'sBCrtkfiwWINeaiZH4zi';

const REGISTRY = new Map([
  [RADIO_ID, { id: RADIO_ID, name: 'Budget', fieldKey: 'contact.budget', dataType: 'RADIO', parentId: 'folder1', picklistOptions: ['Low', 'High'] }],
  [SCORE_ID, { id: SCORE_ID, name: 'Fit Score', fieldKey: 'contact.fit_score', dataType: 'NUMERICAL', parentId: 'folder1' }],
]);
const CTX = { locationId: LOC, customFields: REGISTRY };

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

test('client sends exactly channel/source/version/token-id and no Authorization', async () => {
  const { impl, calls } = mockFetch([{ status: 200, body: { form: { _id: 'f1', name: 'A', formData: { form: { fields: [] } } }, traceId: 't' } }]);
  const tp = tokenProvider();
  const c = new FormsBuilderClient({ locationId: LOC, getIdToken: tp.fn, fetchImpl: impl });
  const doc = await c.getForm('f1');
  assert.equal(doc._id, 'f1', 'GET /forms/{id} envelope is unwrapped');
  const h = calls[0].init.headers;
  assert.equal(calls[0].url, 'https://services.leadconnectorhq.com/forms/f1');
  assert.equal(h.channel, 'APP');
  assert.equal(h.source, 'WEB_USER');
  assert.equal(h.version, '2021-07-28');
  assert.equal(h['token-id'], 'eyJcached.aaaaaaaaaaaa.bbbb');
  assert.equal(Object.keys(h).some((k) => k.toLowerCase() === 'authorization'), false);
});

test('client retries once with a forced token refresh on 401', async () => {
  const { impl, calls } = mockFetch([
    { status: 401, body: { message: 'expired' } },
    { status: 200, body: { forms: [{ _id: 'f1', name: 'A' }], total: 1 } },
  ]);
  const tp = tokenProvider();
  const c = new FormsBuilderClient({ locationId: LOC, getIdToken: tp.fn, fetchImpl: impl });
  const res = await c.listForms();
  assert.equal(res.total, 1);
  assert.deepEqual(tp.seen, [false, true]);
  assert.equal(calls[1].init.headers['token-id'], 'eyJfresh.aaaaaaaaaaaa.bbbb');
  assert.match(calls[0].url, /\/forms\/\?locationId=loc123&limit=20&skip=0$/);
});

test('client errors carry status and never echo a JWT', async () => {
  const { impl } = mockFetch([{ status: 422, body: { message: 'bad token eyJabcdefghijklmnop.qqqqqqq.rrrr' } }]);
  const c = new FormsBuilderClient({ locationId: LOC, getIdToken: tokenProvider().fn, fetchImpl: impl });
  await assert.rejects(c.createForm('x', { form: { fields: [] } }), (err) => {
    assert.equal(err.status, 422);
    assert.doesNotMatch(err.message, /eyJabcdef/);
    return true;
  });
});

test('create posts name + locationId + formData; update refuses a missing formData', async () => {
  const { impl, calls } = mockFetch([{ status: 201, body: { form: { _id: 'new1', name: 'N', formData: { form: { fields: [] } } } } }]);
  const c = new FormsBuilderClient({ locationId: LOC, getIdToken: tokenProvider().fn, fetchImpl: impl });
  const doc = await c.createForm('N', { form: { fields: [] } });
  assert.equal(doc._id, 'new1');
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(Object.keys(body).sort(), ['formData', 'locationId', 'name']);
  await assert.rejects(c.updateForm('new1', 'N', undefined), /complete formData/);
});

// ─── Template ────────────────────────────────────────────────

test('default template is a deep, styled copy', () => {
  const a = buildDefaultFormData([buildStandardField('email')]);
  a.form.fieldStyle.bgColor = '00000000';
  const b = buildDefaultFormData([]);
  assert.equal(b.form.fieldStyle.bgColor, 'FFFFFFFF', 'mutating one copy must not leak into the template');
  assert.equal(a.form.formAction.actionType, '2');
  assert.equal(a.form.inputStyleType, 'box');
});

test('template-from-form copies settings but not fields, logic or folder', () => {
  const src = { form: { fields: [{ type: 'text', tag: 'x' }], conditionalLogic: [{}], fieldStyle: { bgColor: '11111111' } }, parentFolderId: 'p', lastUpdatedAt: 'z' };
  const out = formDataFromTemplate(src, [buildStandardField('email')]);
  assert.equal(out.form.fields[0].tag, 'email');
  assert.equal(out.form.conditionalLogic, null);
  assert.equal(out.form.fieldStyle.bgColor, '11111111');
  assert.equal(out.parentFolderId, undefined);
  assert.equal(src.form.fields[0].tag, 'x', 'source not mutated');
});

// ─── Field palette / custom mapping ─────────────────────────

test('standard field matches the captured anatomy', () => {
  const f = buildStandardField('first_name', { required: true });
  assert.deepEqual(f, {
    type: 'text', tag: 'first_name', label: 'First Name', placeholder: '', required: true,
    standard: true, typeLabel: 'First Name', fieldWidthPercentage: 100, hiddenFieldQueryKey: 'first_name',
  });
  assert.throws(() => buildStandardField('company_logo'), /Unknown standard field tag/);
});

test('custom field element: id === tag, fieldKey-derived query key, identity not overridable', () => {
  const f = buildCustomField(REGISTRY.get(RADIO_ID), LOC, { label: 'Your budget', props: { tag: 'hack', optionDisplayType: 'TEXT_ONLY' } });
  assert.equal(f.id, RADIO_ID);
  assert.equal(f.tag, RADIO_ID);
  assert.equal(f.type, 'radio');
  assert.equal(f.dataType, 'RADIO');
  assert.equal(f.hiddenFieldQueryKey, 'budget');
  assert.equal(f.custom, true);
  assert.equal(f.standard, false);
  assert.equal(f.label, 'Your budget');
  assert.equal(f.optionDisplayType, 'TEXT_ONLY');
  assert.deepEqual(f.picklistOptions, ['Low', 'High']);
});

test('NUMERICAL custom field renders as SCORE only on request (§14.6)', () => {
  assert.equal(buildCustomField(REGISTRY.get(SCORE_ID), LOC).type, 'numerical');
  const s = buildCustomField(REGISTRY.get(SCORE_ID), LOC, { displayAs: 'score' });
  assert.equal(s.type, 'score');
  assert.equal(s.dataType, 'SCORE');
  assert.throws(() => buildCustomField(REGISTRY.get(RADIO_ID), LOC, { displayAs: 'score' }), /requires a NUMERICAL/);
  assert.throws(() => buildCustomField({ id: 'p', dataType: 'PHONE' }, LOC), /no captured form element/);
});

// ─── Mutations ───────────────────────────────────────────────

test('buildFieldList appends a submit button and rejects unknown custom ids', () => {
  const fields = buildFieldList([{ tag: 'email' }, { customFieldId: RADIO_ID }], CTX);
  assert.deepEqual(fields.map((f) => f.tag), ['email', RADIO_ID, 'button']);
  assert.throws(() => buildFieldList([{ customFieldId: 'nope' }], CTX), /does not exist in this location/);
  assert.throws(() => buildFieldList([{ tag: 'email', customFieldId: RADIO_ID }], CTX), /exactly one/);
});

test('add inserts before submit; move/update/remove by tag or index', () => {
  const base = buildFieldList([{ tag: 'first_name' }, { tag: 'email' }], CTX);
  const { fields, removedTags } = applyFieldMutations(base, [
    { op: 'add', field: { tag: 'phone' } },
    { op: 'move', ref: { tag: 'phone' }, index: 0 },
    { op: 'update', ref: { tag: 'email' }, changes: { required: true, label: 'Work email' } },
    { op: 'remove', ref: { index: 1 } },
  ], CTX);
  assert.deepEqual(fields.map((f) => f.tag), ['phone', 'email', 'button']);
  assert.deepEqual(removedTags, ['first_name']);
  assert.equal(fields[1].required, true);
  assert.equal(fields[1].label, 'Work email');
  assert.equal(base[0].tag, 'first_name', 'input not mutated');
});

test('mutations refuse ambiguous refs and identity changes', () => {
  const base = buildFieldList([{ tag: 'html' }, { tag: 'html' }], CTX);
  assert.throws(() => applyFieldMutations(base, [{ op: 'remove', ref: { tag: 'html' } }], CTX), /appears 2 times/);
  assert.throws(() => applyFieldMutations(base, [{ op: 'update', ref: { index: 0 }, changes: { props: { tag: 'x' } } }], CTX), /cannot be changed/);
  assert.throws(() => applyFieldMutations(base, [{ op: 'remove', ref: { index: 0, tag: 'button' } }], CTX), /has tag "html"/);
});

test('pruneRulesReferencing drops rules touching removed keys', () => {
  const rules = [
    { conditionalOperation: 'then', conditions: [{ selectedField: 'first_name' }], outcome: { type: 'showHideFields', hideType: 'Hide', value: 'last_name' } },
    { conditionalOperation: 'then', conditions: [{ selectedField: 'email' }], outcome: { type: 'redirectToUrl', value: 'https://x.test' } },
  ];
  assert.equal(pruneRulesReferencing(rules, ['last_name']).dropped, 1);
  assert.equal(pruneRulesReferencing(rules, ['last_name', 'email']).rules, null);
});

// ─── Validator ───────────────────────────────────────────────

function formWith(rules, extra = {}) {
  const data = buildDefaultFormData(buildFieldList(
    [{ tag: 'first_name' }, { tag: 'last_name', required: true }, { tag: 'email' }, { customFieldId: RADIO_ID }, { customFieldId: SCORE_ID, displayAs: 'score' }],
    CTX
  ));
  data.form.conditionalLogic = rules;
  Object.assign(data.form, extra);
  return data.form;
}

// The exact four rules the blueprint wrote and read back byte-identical (§8.1).
const BLUEPRINT_RULES = [
  { conditionalOperation: 'then', conditions: [{ selectedField: 'first_name', selectedOperation: 'isEqualTo', inputValue: 'John' }], outcome: { type: 'showHideFields', hideType: 'Hide', value: 'last_name' } },
  { conditionalOperation: 'then', conditions: [{ selectedField: 'email', selectedOperation: 'contains', inputValue: '@vip.com' }], outcome: { type: 'redirectToUrl', value: 'https://example.com/vip' } },
  { conditionalOperation: 'then', conditions: [{ selectedField: RADIO_ID, selectedOperation: 'isEqualTo', inputValue: 'Option 3' }], outcome: { type: 'displayCustomMessage', value: '<p>Thanks!</p>' } },
  { conditionalOperation: 'and', conditions: [{ selectedField: SCORE_ID, selectedOperation: 'lessThan', inputValue: '5' }, { selectedField: 'first_name', selectedOperation: 'isFilled', inputValue: null }], outcome: { type: 'disqualifyLead', disqualifyAction: 'showCustomMessage', disqualifyTiming: 'disqualifyImmediately', value: '<p>Not a fit</p>' } },
];

test('validator accepts the blueprint\'s round-tripped rules', () => {
  const r = validateFormBody(formWith(BLUEPRINT_RULES), { knownCustomFieldIds: new Set(REGISTRY.keys()) });
  assert.deepEqual(r.issues, []);
  assert.ok(r.warnings.some((w) => w.includes('hides "last_name", which is required')));
});

const bad = (mutate) => {
  const rules = structuredClone(BLUEPRINT_RULES);
  mutate(rules);
  return validateFormBody(formWith(rules)).issues;
};

test('validator rejects each conditional-logic mistake', () => {
  assert.ok(bad((r) => { r[0].conditions[0].selectedField = 'firstname'; }).some((i) => i.includes('not a submitted field')));
  assert.ok(bad((r) => { r[0].conditions[0].selectedField = 'button'; }).some((i) => i.includes('not a submitted field')));
  assert.ok(bad((r) => { r[1].conditions[0].selectedOperation = 'greaterThan'; }).some((i) => i.includes('does not apply')));
  assert.ok(bad((r) => { r[3].conditions[0].inputValue = 5; }).some((i) => i.includes('must be a string')));
  assert.ok(bad((r) => { r[3].conditions[1].inputValue = 'x'; }).some((i) => i.includes('takes inputValue null')));
  assert.ok(bad((r) => { r[0].conditions.push(r[1].conditions[0]); }).some((i) => i.includes('exactly one condition')));
  assert.ok(bad((r) => { r[0].outcome.hideType = 'hide'; }).some((i) => i.includes('hideType')));
  assert.ok(bad((r) => { r[0].outcome.hideType = 'Hide Multiple'; }).some((i) => i.includes('must be an array')));
  assert.ok(bad((r) => { r[0].outcome.value = 'lastname'; }).some((i) => i.includes('"lastname" is not a submitted field')));
  assert.ok(bad((r) => { r[1].outcome.value = '/vip'; }).some((i) => i.includes('absolute http(s) URL')));
  assert.ok(bad((r) => { r[3].outcome.disqualifyTiming = 'now'; }).some((i) => i.includes('disqualifyTiming')));
  assert.ok(bad((r) => { r[2].outcome.type = 'jumpTo'; }).some((i) => i.includes('not supported')));
});

test('validator checks formAction, colours, duplicates and registry ids', () => {
  const issuesFor = (extra, opts) => validateFormBody(formWith(null, extra), opts).issues;
  assert.ok(issuesFor({ formAction: { actionType: 2, thankyouText: 'x' } }).some((i) => i.includes('STRING "1"')));
  assert.ok(issuesFor({ formAction: { actionType: '1', redirectUrl: '' } }).some((i) => i.includes('redirectUrl')));
  assert.ok(issuesFor({ fieldStyle: { bgColor: '#FFFFFF' } }).some((i) => i.includes('fieldStyle.bgColor')));
  const dup = formWith(null);
  dup.fields.push(buildStandardField('email'));
  assert.ok(validateFormBody(dup).issues.some((i) => i.includes('duplicate tag "email"')));
  assert.ok(issuesFor({}, { knownCustomFieldIds: new Set([RADIO_ID]) }).some((i) => i.includes(`"${SCORE_ID}" does not exist`)));
  assert.deepEqual(issuesFor({}), []);
});

test('validator warns about captcha and missing submit', () => {
  const form = buildDefaultFormData([buildStandardField('email'), buildStandardField('captcha')]).form;
  const r = validateFormBody(form);
  assert.ok(r.warnings.some((w) => w.includes('no submit button')));
  assert.ok(r.warnings.some((w) => w.includes('captcha')));
});

// ─── Tool handlers (stubbed API) ─────────────────────────────

import { formsBuilderTools } from '../dist/tools/forms-builder.js';

const tool = (name) => formsBuilderTools.find((t) => t.tool.name === name);

/** In-memory forms API + CRM client stub; records every write. */
function stubClient(initialForm) {
  const store = new Map();
  const writes = [];
  if (initialForm) store.set(initialForm._id, structuredClone(initialForm));
  const forms = {
    getForm: async (id) => structuredClone(store.get(id)),
    createForm: async (name, formData) => {
      const doc = { _id: 'created1', name, locationId: LOC, formData: structuredClone(formData) };
      store.set(doc._id, doc);
      writes.push({ kind: 'create', name, formData });
      return structuredClone(doc);
    },
    updateForm: async (id, name, formData) => {
      writes.push({ kind: 'update', id, name, formData: structuredClone(formData) });
      store.set(id, { ...store.get(id), name, formData: structuredClone(formData) });
    },
    deleteForm: async (id) => { writes.push({ kind: 'delete', id }); return { deleted: true }; },
    waitForForm: async (id, pred) => { const doc = structuredClone(store.get(id)); return { verified: pred(doc), doc }; },
  };
  const client = {
    locationId: LOC,
    formsBuilder: () => forms,
    get: async () => ({ customFields: Array.from(REGISTRY.values()) }),
  };
  return { client, store, writes };
}

function storedForm() {
  const formData = buildDefaultFormData(buildFieldList([{ tag: 'first_name' }, { tag: 'last_name' }, { tag: 'email' }], CTX));
  formData.form.customStyle = 'keep-me';
  return { _id: 'f1', name: 'Lead form', locationId: LOC, formData };
}

test('create_form builds from the styled template, resolves custom fields, verifies', async () => {
  const { client, writes } = stubClient();
  const res = await tool('forms_builder_create_form').handler(client, {
    name: 'ZZ test', fields: [{ tag: 'email', required: true }, { customFieldId: RADIO_ID }],
    formAction: { action: 'redirect', redirectUrl: 'https://example.com/thanks' },
  });
  assert.equal(res.verified, true);
  const sent = writes[0].formData.form;
  assert.ok(sent.fieldStyle && sent.currentThemeId, 'never created from a minimal body');
  assert.deepEqual(sent.fields.map((f) => f.tag), ['email', RADIO_ID, 'button']);
  assert.equal(sent.formAction.actionType, '1');
});

test('create_form writes nothing when validation fails', async () => {
  const { client, writes } = stubClient();
  await assert.rejects(tool('forms_builder_create_form').handler(client, {
    name: 'ZZ bad', fields: [{ tag: 'email' }],
    conditionalLogic: [{ conditionalOperation: 'then', conditions: [{ selectedField: 'emial', selectedOperation: 'isFilled', inputValue: null }], outcome: { type: 'redirectToUrl', value: 'https://x.test' } }],
  }), /validation failed/);
  assert.equal(writes.length, 0);
});

test('update_fields sends the COMPLETE formData, preserving untouched keys', async () => {
  const { client, writes } = stubClient(storedForm());
  const res = await tool('forms_builder_update_fields').handler(client, { formId: 'f1', mutations: [{ op: 'add', field: { tag: 'phone' } }] });
  assert.equal(res.verified, true);
  const sent = writes[0].formData.form;
  assert.equal(sent.customStyle, 'keep-me');
  assert.ok(sent.fieldStyle && sent.formAction);
  assert.deepEqual(sent.fields.map((f) => f.tag), ['first_name', 'last_name', 'email', 'phone', 'button']);
  assert.equal(writes[0].name, 'Lead form');
});

test('removing a field referenced by logic is blocked unless dropDanglingRules', async () => {
  const form = storedForm();
  form.formData.form.conditionalLogic = [BLUEPRINT_RULES[0]];
  const { client, writes } = stubClient(form);
  await assert.rejects(
    tool('forms_builder_update_fields').handler(client, { formId: 'f1', mutations: [{ op: 'remove', ref: { tag: 'last_name' } }] }),
    /not a submitted field/
  );
  assert.equal(writes.length, 0);
  const res = await tool('forms_builder_update_fields').handler(client, { formId: 'f1', mutations: [{ op: 'remove', ref: { tag: 'last_name' } }], dropDanglingRules: true });
  assert.equal(writes[0].formData.form.conditionalLogic, null);
  assert.ok(res.notes.some((n) => n.includes('Dropped 1')));
});

test('pre-existing issues do not lock a form; only introduced ones block', async () => {
  const form = storedForm();
  form.formData.form.formAction.actionType = 2; // builder-made quirk already stored
  const { client, writes } = stubClient(form);
  const res = await tool('forms_builder_rename_form').handler(client, { formId: 'f1', name: 'Renamed' });
  assert.equal(writes[0].name, 'Renamed');
  assert.ok(res.warnings.some((w) => w.startsWith('pre-existing:')));
});

test('set_conditional_logic, set_form_action and set_style write validated changes', async () => {
  const { client, writes } = stubClient(storedForm());
  await tool('forms_builder_set_conditional_logic').handler(client, { formId: 'f1', rules: [BLUEPRINT_RULES[0]] });
  assert.equal(writes[0].formData.form.conditionalLogic.length, 1);
  await tool('forms_builder_set_form_action').handler(client, { formId: 'f1', action: 'message', thankyouText: '<p>Hi</p>' });
  assert.equal(writes[1].formData.form.formAction.actionType, '2');
  await tool('forms_builder_set_style').handler(client, { formId: 'f1', fieldStyle: { border: { radius: 12 } }, submitButton: { bgColor: 'FF0000FF' } });
  const s = writes[2].formData.form;
  assert.equal(s.fieldStyle.border.radius, 12);
  assert.equal(s.fieldStyle.border.color, 'D0D5DDFF', 'deep merge keeps siblings');
  assert.equal(s.fields.find((f) => f.type === 'submit').bgColor, 'FF0000FF');
  await assert.rejects(tool('forms_builder_set_style').handler(client, { formId: 'f1', fieldStyle: { bgColor: 'red' } }), /8-digit/);
  assert.equal(writes.length, 3);
});

test('delete_form requires confirm:true and a matching expectedName', async () => {
  const { client, writes } = stubClient(storedForm());
  await assert.rejects(tool('forms_builder_delete_form').handler(client, { formId: 'f1', confirm: false }), /confirm: true/);
  await assert.rejects(tool('forms_builder_delete_form').handler(client, { formId: 'f1', confirm: true, expectedName: 'Other' }), /Not deleted/);
  assert.equal(writes.length, 0);
  const res = await tool('forms_builder_delete_form').handler(client, { formId: 'f1', confirm: true, expectedName: 'Lead form' });
  assert.equal(res.deleted, true);
});

// ─── Builder-generated CSS + builder defaults (live run 1) ───

import { readFileSync } from 'node:fs';
import { generateFieldCSS } from '../dist/catalog/form-css.js';
import { DEFAULT_FIELD_STYLE } from '../dist/catalog/form-template.js';

const BUILDER_CSS = JSON.parse(readFileSync(new URL('./fixtures/builder-field-css.json', import.meta.url), 'utf8')).fieldCSS;

test('generated fieldCSS matches what the GHL builder produced for the default style', () => {
  assert.equal(generateFieldCSS(DEFAULT_FIELD_STYLE), BUILDER_CSS);
  assert.equal(generateFieldCSS(DEFAULT_FIELD_STYLE, { mobile: true }), BUILDER_CSS);
});

test('generated fieldCSS follows fieldStyle changes', () => {
  const css = generateFieldCSS({ ...DEFAULT_FIELD_STYLE, bgColor: '000000FF', primaryColor: 'FF0000FF', border: { border: 2, color: 'ABCDEF12', radius: 10, type: 'dashed' } });
  assert.match(css, /background-color: #000000FF !important/);
  assert.match(css, /border: 2px dashed #ABCDEF12 !important/);
  assert.match(css, /border-radius: 10px !important/);
  assert.match(css, /box-shadow: 0 0 0 2px #FF0000FF33/);
  assert.doesNotMatch(css, /#FFFFFFFF !important/);
});

test('template carries the builder defaults that shape the public page', () => {
  const form = buildDefaultFormData([buildStandardField('email')]).form;
  assert.equal(form.submitMessageStyle.isEnabled, true, 'centred thank-you card');
  assert.equal(form.fieldCSS, BUILDER_CSS, 'input styling + Inter font import');
  assert.equal(form.mobileFieldCSS, BUILDER_CSS);
  assert.equal(form.formSchedule.states.after.mode, 'page');
  assert.equal(form.company, undefined, 'agency branding is left for the builder');
});

test('set_style regenerates fieldCSS so the change is visible on the page', async () => {
  const { client, writes } = stubClient(storedForm());
  await tool('forms_builder_set_style').handler(client, { formId: 'f1', fieldStyle: { bgColor: '000000FF' } });
  const form = writes[0].formData.form;
  assert.match(form.fieldCSS, /background-color: #000000FF !important/);
  assert.match(form.mobileFieldCSS, /background-color: #000000FF !important/);
});
