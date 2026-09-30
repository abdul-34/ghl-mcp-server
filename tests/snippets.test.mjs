// Offline tests for the internal snippets API: client contract and response
// normalization pinned to the 2026-09-30 capture, plus the tool-level flows.
//
// Run with: npm test   (builds to dist/, then node --test tests/*.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { SnippetsClient, normalizeSnippet } from '../dist/crm/snippets-client.js';
import { snippetsTools, textToEmailHtml } from '../dist/tools/snippets.js';

const LOC = 'oIsICGsND5sAh4RdqGe8';
const BASE = `https://services.leadconnectorhq.com/snippets/${LOC}`;
const tool = (name) => snippetsTools.find((t) => t.tool.name === name);

function mockFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body === undefined ? undefined : JSON.parse(init.body) });
    const r = responses.shift();
    return new Response(JSON.stringify(r.body), { status: r.status });
  };
  return { impl, calls };
}
const client = (responses) => {
  const m = mockFetch(responses);
  return { c: new SnippetsClient({ locationId: LOC, getIdToken: async () => 'eyJx.aaaaaaaaaaaa.bbbb', fetchImpl: m.impl }), calls: m.calls };
};

// Captured response bodies (§3.3, §3.5, §4.2).
const CREATE_SMS_RES = {
  snippet: {
    id: 'HRStosBWPb8V2D6IIm4H',
    date_added: { _seconds: 1790763106, _nanoseconds: 431000000 },
    date_updated: { _seconds: 1790763106, _nanoseconds: 431000000 },
    deleted: false, location_id: LOC, name: 'Claude Test Text Snippet',
    urlAttachments: ['https://picsum.photos/200.jpg'], type: 'sms',
    template: { body: 'Hi {{contact.first_name}}, this is a test SMS snippet.', attachments: [] },
  },
  traceId: 't',
};
const UPDATE_SMS_RES = {
  snippet: {
    _id: 'HRStosBWPb8V2D6IIm4H',
    _ref: { _firestore: { projectId: 'highlevel-backend' } },
    _data: {
      date_added: { _seconds: 1790763106, _nanoseconds: 431000000 },
      date_updated: { _seconds: 1790763190, _nanoseconds: 522000000 },
      deleted: false, location_id: LOC, name: 'Claude Test Text Snippet UPDATED',
      urlAttachments: ['https://picsum.photos/200.jpg'], type: 'sms',
      template: { attachments: [], body: 'Updated body for {{contact.first_name}}.' },
      old_template: { body: 'old', attachments: [] },
    },
    _snapshot: {},
  },
};
const CREATE_FOLDER_RES = {
  snippet: { id: 'WJv1ZGCoTfT788FAv6oo', deleted: false, location_id: LOC, name: 'Claude API Test Folder', urlAttachments: [], is_folder: true,
    date_added: { _seconds: 1790763061, _nanoseconds: 943000000 } },
};

test('normalizes the three response shapes (list, create, update snapshot)', () => {
  const created = normalizeSnippet(CREATE_SMS_RES.snippet);
  assert.equal(created.id, 'HRStosBWPb8V2D6IIm4H');
  assert.equal(created.type, 'sms');
  assert.equal(created.dateAdded, '2026-09-30T10:11:46.431Z', 'matches the list response dateAdded in the capture');

  const updated = normalizeSnippet(UPDATE_SMS_RES.snippet);
  assert.equal(updated.id, 'HRStosBWPb8V2D6IIm4H');
  assert.equal(updated.name, 'Claude Test Text Snippet UPDATED');
  assert.equal(updated.template.body, 'Updated body for {{contact.first_name}}.');

  const folder = normalizeSnippet(CREATE_FOLDER_RES.snippet);
  assert.equal(folder.isFolder, true);
  assert.equal(folder.type, undefined);

  const row = normalizeSnippet({ _id: 'x', name: 'n', type: 'email', parentId: 'WJv1', folderName: 'F', template: { subject: 's', html: 'h' } });
  assert.deepEqual([row.id, row.parentId, row.folderName], ['x', 'WJv1', 'F']);
  assert.equal(normalizeSnippet({ _id: 'f', name: 'F', isFolder: true, totalSnippets: 3 }).totalSnippets, 3);
});

test('client sends the web app headers, token-id and no Authorization', async () => {
  const { c, calls } = client([{ status: 200, body: { snippets: [], totalCount: 0 } }]);
  await c.list({ query: 'promo' });
  assert.equal(calls[0].url, `${BASE}?skip=0&limit=20&query=promo`);
  const h = calls[0].headers;
  assert.deepEqual([h.channel, h.source, h.version, h['x-locale']], ['APP', 'WEB_USER', '2021-07-28', 'en_US']);
  assert.equal(h['token-id'], 'eyJx.aaaaaaaaaaaa.bbbb');
  assert.equal(Object.keys(h).some((k) => k.toLowerCase() === 'authorization'), false);
});

test('every captured route and body', async () => {
  const { c, calls } = client([
    { status: 200, body: { snippets: [], traceId: 't' } },
    { status: 200, body: { snippets: [], totalCount: 0 } },
    { status: 200, body: { folders: [{ _id: 'WJv1', name: 'F' }] } },
    { status: 200, body: { exists: false } },
    { status: 201, body: CREATE_FOLDER_RES },
    { status: 200, body: UPDATE_SMS_RES },
    { status: 200, body: { success: true } },
    { status: 201, body: { success: true, count: 2 } },
    { status: 201, body: { success: true, count: 1 } },
  ]);
  await c.listAll();
  await c.listFolders();
  assert.deepEqual(await c.folderOptions(), [{ id: 'WJv1', name: 'F' }]);
  assert.equal(await c.folderNameExists('My Folder & Co'), false);
  await c.create({ name: 'Claude API Test Folder', isFolder: true });
  await c.update('HRStosBWPb8V2D6IIm4H', { name: 'X' });
  assert.equal(await c.delete('HRStosBWPb8V2D6IIm4H'), true);
  assert.equal(await c.bulkDelete(['a', 'b']), 2);
  assert.equal(await c.bulkMove(['a'], 'WJv1'), 1);

  assert.deepEqual(calls.map((x) => `${x.method} ${x.url.replace(BASE, '')}`), [
    'GET ?all=true',
    'GET ?skip=0&limit=20&isFolder=true',
    'GET /folders/list',
    'GET /folders/check?folderName=My%20Folder%20%26%20Co',
    'POST ',
    'PUT /HRStosBWPb8V2D6IIm4H',
    'DELETE /HRStosBWPb8V2D6IIm4H',
    'POST /bulk/delete',
    'POST /bulk/move',
  ]);
  assert.deepEqual(calls[4].body, { name: 'Claude API Test Folder', isFolder: true });
  assert.deepEqual(calls[6].body, {}, 'delete sends an empty JSON body like the web app');
  assert.deepEqual(calls[7].body, { snippetIds: ['a', 'b'] });
  assert.deepEqual(calls[8].body, { snippetIds: ['a'], parentId: 'WJv1' });
});

test('email text is wrapped in the editor\'s line markup and escaped', () => {
  assert.equal(
    textToEmailHtml('Hello {{contact.name}}\n<b>x</b>'),
    '<p class="custom-newline" style="line-height: 1.5;padding-left: 0px!important;">Hello {{contact.name}}</p>' +
      '<p class="custom-newline" style="line-height: 1.5;padding-left: 0px!important;">&lt;b&gt;x&lt;/b&gt;</p>'
  );
});

// ─── Tools (stubbed client) ──────────────────────────────────

function stub(initial = []) {
  const store = new Map(initial.map((s) => [s.id, structuredClone(s)]));
  const log = [];
  let n = 0;
  return {
    store,
    log,
    async list({ skip = 0, limit = 20, query } = {}) {
      const rows = [...store.values()].filter((s) => !s.isFolder && (!query || s.name.toLowerCase().includes(query.toLowerCase())));
      return { snippets: structuredClone(rows.slice(skip, skip + limit)), total: rows.length };
    },
    async listAll() {
      return [...store.values()].map(({ parentId, folderName, ...rest }) => structuredClone(rest));
    },
    async listFolders() {
      const folders = [...store.values()].filter((s) => s.isFolder).map((f) => ({ ...f, totalSnippets: [...store.values()].filter((s) => s.parentId === f.id).length }));
      return { folders: structuredClone(folders), total: folders.length };
    },
    async folderOptions() {
      return [...store.values()].filter((s) => s.isFolder).map((f) => ({ id: f.id, name: f.name }));
    },
    async folderNameExists(name) {
      return [...store.values()].some((s) => s.isFolder && s.name === name);
    },
    async create(body) {
      log.push(['create', body]);
      const s = { id: `new${++n}`, name: body.name, isFolder: body.isFolder === true, urlAttachments: body.urlAttachments || [], ...(body.type ? { type: body.type } : {}), ...(body.template ? { template: structuredClone(body.template) } : {}) };
      store.set(s.id, s);
      return structuredClone(s);
    },
    async update(id, body) {
      log.push(['update', id, body]);
      const s = { ...store.get(id), ...structuredClone(body) };
      store.set(id, s);
      const { parentId, folderName, ...rest } = s;
      return structuredClone(rest);
    },
    async delete(id) { log.push(['delete', id]); store.delete(id); return true; },
    async bulkDelete(ids) { log.push(['bulkDelete', ids]); ids.forEach((id) => store.delete(id)); return ids.length; },
    async bulkMove(ids, parentId) {
      log.push(['bulkMove', ids, parentId]);
      ids.forEach((id) => { store.get(id).parentId = parentId; });
      return ids.length;
    },
  };
}
const ctx = (s) => ({ locationId: LOC, snippets: () => s });

const FOLDER = { id: 'WJv1', name: 'Promos', isFolder: true, urlAttachments: [] };
const SMS = { id: 'sms1', name: 'Welcome SMS', type: 'sms', isFolder: false, urlAttachments: ['https://x.test/a.jpg'], template: { body: 'Hi {{contact.first_name}}', attachments: [] } };
const EMAIL = { id: 'em1', name: 'Welcome Email', type: 'email', isFolder: false, urlAttachments: [], template: { subject: 'Hi', html: '<p>Hello</p>', attachments: [], extra: 'keep' } };

test('create SMS sends the captured body shape', async () => {
  const s = stub();
  const res = await tool('snippets_create').handler(ctx(s), { name: 'Promo', type: 'sms', body: 'Hi {{contact.first_name}}', urlAttachments: ['https://picsum.photos/200.jpg'] });
  assert.equal(res.verified, true);
  assert.deepEqual(s.log[0][1], {
    name: 'Promo', template: { body: 'Hi {{contact.first_name}}', attachments: [] }, useForLiveChat: false,
    urlAttachments: ['https://picsum.photos/200.jpg'], type: 'sms', isFolder: false, parentId: '',
  });
});

test('create email from text, then move into a folder via bulk/move', async () => {
  const s = stub([FOLDER]);
  const res = await tool('snippets_create').handler(ctx(s), { name: 'News', type: 'email', subject: 'Hi {{contact.first_name}}', text: 'Line one', folderId: 'WJv1' });
  const body = s.log[0][1];
  assert.deepEqual(Object.keys(body).sort(), ['isFolder', 'name', 'parentId', 'template', 'type']);
  assert.equal(body.parentId, '', 'folder is not set through the (inferred) create parentId');
  assert.match(body.template.html, /^<p class="custom-newline"/);
  assert.deepEqual(s.log[1], ['bulkMove', ['new1'], 'WJv1']);
  assert.equal(res.folder.moved, true);
});

test('create rejects mismatched fields and bad folders before writing', async () => {
  const s = stub([FOLDER]);
  const create = tool('snippets_create').handler;
  await assert.rejects(create(ctx(s), { name: 'x', type: 'sms', body: 'b', subject: 's' }), /for email snippets/);
  await assert.rejects(create(ctx(s), { name: 'x', type: 'email', html: '<p>a</p>', text: 'a' }), /exactly one of html or text/);
  await assert.rejects(create(ctx(s), { name: 'x', type: 'sms', body: 'b', urlAttachments: ['ftp://x'] }), /http\(s\) URL/);
  await assert.rejects(create(ctx(s), { name: 'x', type: 'sms', body: 'b', folderId: 'nope' }), /not found/);
  assert.equal(s.log.length, 0);
});

test('update merges into the full template (PUT replaces it) and keeps the type-specific fields', async () => {
  const s = stub([EMAIL, SMS]);
  const res = await tool('snippets_update').handler(ctx(s), { snippetId: 'em1', subject: 'New subject' });
  assert.equal(res.verified, true);
  assert.deepEqual(s.log[0][2], { name: 'Welcome Email', template: { attachments: [], subject: 'New subject', html: '<p>Hello</p>', extra: 'keep' } });

  await tool('snippets_update').handler(ctx(s), { snippetId: 'sms1', body: 'New body' });
  assert.deepEqual(s.log[1][2], {
    name: 'Welcome SMS', template: { attachments: [], body: 'New body' }, useForLiveChat: false, urlAttachments: ['https://x.test/a.jpg'],
  });
  await assert.rejects(tool('snippets_update').handler(ctx(s), { snippetId: 'sms1', html: '<p>x</p>' }), /SMS snippet/);
});

test('get fills in folder membership, which the all=true list omits', async () => {
  const s = stub([FOLDER, { ...SMS, parentId: 'WJv1', folderName: 'Promos' }]);
  const res = await tool('snippets_get').handler(ctx(s), { snippetId: 'sms1' });
  assert.deepEqual([res.folderId, res.folderName, res.template.body], ['WJv1', 'Promos', 'Hi {{contact.first_name}}']);
});

test('delete: confirm, expectedName, folders refused, single vs bulk endpoint', async () => {
  const s = stub([FOLDER, SMS, EMAIL]);
  const del = tool('snippets_delete').handler;
  await assert.rejects(del(ctx(s), { snippetId: 'sms1', confirm: false }), /confirm: true/);
  await assert.rejects(del(ctx(s), { snippetId: 'sms1', confirm: true, expectedName: 'Other' }), /Not deleted/);
  await assert.rejects(del(ctx(s), { snippetId: 'WJv1', confirm: true }), /is a folder/);
  await del(ctx(s), { snippetId: 'sms1', confirm: true, expectedName: 'Welcome SMS' });
  assert.deepEqual(s.log.at(-1), ['delete', 'sms1']);
  s.store.set('sms1', structuredClone(SMS));
  const res = await del(ctx(s), { snippetIds: ['sms1', 'em1'], confirm: true });
  assert.deepEqual(s.log.at(-1), ['bulkDelete', ['sms1', 'em1']]);
  assert.equal(res.success, true);
});

test('folders: create checks the name, delete refuses a non-empty folder', async () => {
  const s = stub([FOLDER, { ...SMS, parentId: 'WJv1' }]);
  await assert.rejects(tool('snippets_create_folder').handler(ctx(s), { name: 'Promos' }), /already exists/);
  const created = await tool('snippets_create_folder').handler(ctx(s), { name: 'Holidays' });
  assert.deepEqual(s.log.at(-1), ['create', { name: 'Holidays', isFolder: true }]);
  assert.equal(created.verified, true);

  await assert.rejects(tool('snippets_delete_folder').handler(ctx(s), { folderId: 'WJv1', confirm: true }), /still holds 1 snippet/);
  await tool('snippets_delete_folder').handler(ctx(s), { folderId: 'new1', confirm: true, expectedName: 'Holidays' });
  assert.deepEqual(s.log.at(-1), ['delete', 'new1']);

  const renamed = await tool('snippets_rename_folder').handler(ctx(s), { folderId: 'WJv1', name: 'Promos 2026' });
  assert.deepEqual(s.log.at(-1), ['update', 'WJv1', { name: 'Promos 2026' }]);
  assert.equal(renamed.verified, true);
});

test('move requires an existing folder and real snippets', async () => {
  const s = stub([FOLDER, SMS]);
  const move = tool('snippets_move_to_folder').handler;
  await assert.rejects(move(ctx(s), { snippetIds: ['sms1'], folderId: 'nope' }), /not found/);
  await assert.rejects(move(ctx(s), { snippetIds: ['ghost'], folderId: 'WJv1' }), /not found/);
  const res = await move(ctx(s), { snippetIds: ['sms1'], folderId: 'WJv1' });
  assert.equal(res.success, true);
  assert.deepEqual(s.log.at(-1), ['bulkMove', ['sms1'], 'WJv1']);
});
