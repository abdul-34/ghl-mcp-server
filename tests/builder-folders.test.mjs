// Offline tests for list-page folders (surveys + forms), pinned to the requests and
// responses captured from the list UI on 2026-09-25.
//
// Run with: npm test   (builds to dist/, then node --test tests/*.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { SurveysBuilderClient } from '../dist/crm/surveys-builder-client.js';
import { FormsBuilderClient } from '../dist/crm/forms-builder-client.js';
import { surveysBuilderTools } from '../dist/tools/surveys-builder.js';
import { formsBuilderTools } from '../dist/tools/forms-builder.js';

const LOC = 'oIsICGsND5sAh4RdqGe8';
const S = 'https://services.leadconnectorhq.com';

function mockFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
    const r = responses.shift();
    return new Response(JSON.stringify(r.body), { status: r.status });
  };
  return { impl, calls };
}
const token = async () => 'eyJx.aaaaaaaaaaaa.bbbb';
const surveysClient = (responses) => {
  const m = mockFetch(responses);
  return { c: new SurveysBuilderClient({ locationId: LOC, getIdToken: token, fetchImpl: m.impl }), calls: m.calls };
};
const formsClient = (responses) => {
  const m = mockFetch(responses);
  return { c: new FormsBuilderClient({ locationId: LOC, getIdToken: token, fetchImpl: m.impl }), calls: m.calls };
};

const SURVEY_FOLDER = { _id: 'n956PlBp18GBX3thCrZD', name: 'ZZ Folder Test Surveys', type: 'folder', locationId: LOC, deleted: false };
const FORM_FOLDER = { ...SURVEY_FOLDER, _id: '0QJ8pgdI79S3TyubQE68', name: 'ZZ Folder Test Forms', productType: 'form' };

test('survey folders: list, create (flat response), rename ({form}), get', async () => {
  const { c, calls } = surveysClient([
    { status: 200, body: { folders: [SURVEY_FOLDER], traceId: 't' } },
    { status: 201, body: { ...SURVEY_FOLDER, traceId: 't' } },
    { status: 201, body: { form: { ...SURVEY_FOLDER, name: 'Renamed' }, traceId: 't' } },
    { status: 200, body: { folder: SURVEY_FOLDER, traceId: 't' } },
  ]);
  assert.equal((await c.folders.list())[0]._id, SURVEY_FOLDER._id);
  assert.equal(calls[0].url, `${S}/surveys/folder?locationId=${LOC}`);

  const created = await c.folders.create('ZZ Folder Test Surveys');
  assert.equal(created._id, SURVEY_FOLDER._id);
  assert.equal(created.traceId, undefined);
  assert.equal(calls[1].method, 'POST');
  assert.equal(calls[1].url, `${S}/surveys/folder/`);
  assert.deepEqual(calls[1].body, { name: 'ZZ Folder Test Surveys', locationId: LOC });

  assert.equal((await c.folders.rename(SURVEY_FOLDER._id, 'Renamed')).name, 'Renamed');
  assert.equal(calls[2].url, `${S}/surveys/folder/${SURVEY_FOLDER._id}`);
  assert.deepEqual(calls[2].body, { name: 'Renamed' });

  assert.equal((await c.folders.get(SURVEY_FOLDER._id)).name, SURVEY_FOLDER.name);
});

test('form folders send productType: "form" on list and create, not on rename', async () => {
  const { c, calls } = formsClient([
    { status: 200, body: { folders: [FORM_FOLDER] } },
    { status: 201, body: { ...FORM_FOLDER, traceId: 't' } },
    { status: 201, body: { form: { ...FORM_FOLDER, name: 'R' } } },
  ]);
  await c.folders.list();
  assert.equal(calls[0].url, `${S}/forms/folder?locationId=${LOC}&productType=form`);
  await c.folders.create('ZZ Folder Test Forms');
  assert.deepEqual(calls[1].body, { name: 'ZZ Folder Test Forms', locationId: LOC, productType: 'form' });
  await c.folders.rename(FORM_FOLDER._id, 'R');
  assert.deepEqual(calls[2].body, { name: 'R' });
});

test('move uses surveyId / formId and "root" for the top level', async () => {
  const s = surveysClient([
    { status: 201, body: { form: { _id: 'OAlv9XNFc5BZVzfCZ5A8', parentId: SURVEY_FOLDER._id } } },
    { status: 201, body: { form: { _id: 'OAlv9XNFc5BZVzfCZ5A8' } } },
  ]);
  assert.deepEqual(await s.c.folders.move('OAlv9XNFc5BZVzfCZ5A8', SURVEY_FOLDER._id), { parentId: SURVEY_FOLDER._id });
  assert.equal(s.calls[0].url, `${S}/surveys/move-to-folder`);
  assert.deepEqual(s.calls[0].body, { surveyId: 'OAlv9XNFc5BZVzfCZ5A8', folderId: SURVEY_FOLDER._id });
  assert.deepEqual(await s.c.folders.move('OAlv9XNFc5BZVzfCZ5A8', 'root'), { parentId: undefined });

  // The captured root move for forms had no _id in the response.
  const f = formsClient([{ status: 201, body: { form: { name: 'ZZ Folder Test Form 1' } } }]);
  assert.deepEqual(await f.c.folders.move('wWksbNnMs54Wsptnm7QG', 'root'), { parentId: undefined });
  assert.deepEqual(f.calls[0].body, { formId: 'wWksbNnMs54Wsptnm7QG', folderId: 'root' });
});

test('folder-level listing matches the list-page query strings', async () => {
  const s = surveysClient([{ status: 200, body: { surveys: [], total: 0 } }, { status: 200, body: { surveys: [], total: 0 } }]);
  await s.c.listSurveys({ parentId: SURVEY_FOLDER._id });
  assert.equal(s.calls[0].url, `${S}/surveys/?skip=0&limit=20&locationId=${LOC}&query=&parentId=${SURVEY_FOLDER._id}&type=folder`);
  await s.c.listSurveys({ withFolders: true });
  assert.equal(s.calls[1].url, `${S}/surveys/?skip=0&limit=20&locationId=${LOC}&query=&type=folder`);

  const f = formsClient([{ status: 200, body: { forms: [], total: 0 } }, { status: 200, body: { forms: [], total: 0 } }]);
  await f.c.listForms({ parentId: FORM_FOLDER._id });
  assert.equal(f.calls[0].url, `${S}/forms/?locationId=${LOC}&limit=20&skip=0&parentId=${FORM_FOLDER._id}&type=folder&productType=form`);
  await f.c.listForms({});
  assert.equal(f.calls[1].url, `${S}/forms/?locationId=${LOC}&limit=20&skip=0`, 'the live-verified default list is unchanged');
});

// ─── Tools ───────────────────────────────────────────────────

function folderStub(folderList) {
  const log = [];
  return {
    log,
    async list() { log.push(['list']); return folderList; },
    async create(name) { log.push(['create', name]); return { _id: 'newF', name }; },
    async rename(id, name) { log.push(['rename', id, name]); return { _id: id, name }; },
    async move(itemId, folderId) { log.push(['move', itemId, folderId]); return { parentId: folderId === 'root' ? undefined : folderId }; },
    async require(id) {
      const f = folderList.find((x) => x._id === id);
      if (!f) throw new Error(`Folder "${id}" was not found`);
      return f;
    },
  };
}
const tool = (list, name) => list.find((t) => t.tool.name === name);

test('both builders expose list/create/rename folder and move tools', () => {
  for (const [list, p, noun] of [[surveysBuilderTools, 'surveys_builder', 'survey'], [formsBuilderTools, 'forms_builder', 'form']]) {
    for (const n of ['list_folders', 'create_folder', 'rename_folder', `move_${noun}`]) assert.ok(tool(list, `${p}_${n}`), `${p}_${n}`);
    assert.ok(tool(list, `${p}_move_${noun}`).tool.inputSchema.required.includes(`${noun}Id`));
    assert.equal(tool(list, `${p}_delete_folder`), undefined, 'folder delete was not captured');
  }
});

test('move tool verifies from the response and rejects unknown folders before calling move', async () => {
  const folders = folderStub([FORM_FOLDER]);
  const client = { locationId: LOC, formsBuilder: () => ({ folders }) };
  const res = await tool(formsBuilderTools, 'forms_builder_move_form').handler(client, { formId: 'f1', folderId: FORM_FOLDER._id });
  assert.equal(res.verified, true);
  assert.equal(res.folder.name, 'ZZ Folder Test Forms');
  const root = await tool(formsBuilderTools, 'forms_builder_move_form').handler(client, { formId: 'f1', folderId: 'root' });
  assert.equal(root.verified, true);
  await assert.rejects(tool(formsBuilderTools, 'forms_builder_move_form').handler(client, { formId: 'f1', folderId: 'nope' }), /not found/);
  assert.deepEqual(folders.log.filter((l) => l[0] === 'move').map((l) => l[2]), [FORM_FOLDER._id, 'root']);
});

test('create_survey with folderId checks the folder first and moves after the write', async () => {
  const folders = folderStub([SURVEY_FOLDER]);
  const log = [];
  const doc = { _id: 'new1', name: 'X', locationId: LOC, formData: { form: { company: {} }, slides: [{ id: '1-0', slideData: [], button: {} }] } };
  const surveys = {
    folders,
    async createSurvey() { log.push('createSurvey'); return structuredClone(doc); },
    async updateSurvey(id, name, formData) { log.push('updateSurvey'); doc.formData = structuredClone(formData); return structuredClone(doc); },
    async waitForSurvey() { return { verified: true, doc: structuredClone(doc) }; },
  };
  const client = { locationId: LOC, surveysBuilder: () => surveys, get: async () => ({ customFields: [] }) };
  const create = tool(surveysBuilderTools, 'surveys_builder_create_survey');

  await assert.rejects(create.handler(client, { name: 'X', slides: [{ questions: [{ tag: 'email' }] }], folderId: 'nope' }), /not found/);
  assert.deepEqual(log, [], 'nothing created for a bad folder');

  const res = await create.handler(client, { name: 'X', slides: [{ questions: [{ tag: 'email' }] }], folderId: SURVEY_FOLDER._id });
  assert.deepEqual(log, ['createSurvey', 'updateSurvey']);
  assert.deepEqual(folders.log.at(-1), ['move', 'new1', SURVEY_FOLDER._id]);
  assert.equal(res.folder.verified, true);
  assert.equal(res.survey.folderId, SURVEY_FOLDER._id);
});

test('create_form with folderId moves the new form; a failed move is reported, not undone', async () => {
  const folders = folderStub([FORM_FOLDER]);
  folders.move = async () => { throw new Error('move boom'); };
  const forms = {
    folders,
    async createForm(name, formData) { return { _id: 'nf1', name, formData }; },
    async waitForForm(id) { return { verified: true, doc: undefined }; },
  };
  const client = { locationId: LOC, formsBuilder: () => forms, get: async () => ({ customFields: [] }) };
  const res = await tool(formsBuilderTools, 'forms_builder_create_form').handler(client, { name: 'F', fields: [{ tag: 'email' }], folderId: FORM_FOLDER._id });
  assert.equal(res.form.id, 'nf1');
  assert.match(res.folder.error, /top level.*move boom/);
});
