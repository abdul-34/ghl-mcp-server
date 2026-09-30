/**
 * Snippet tools (internal GHL API) — Marketing → Snippets.
 *
 * Create, edit, organize and delete SMS and email snippets and their folders through
 * the web app's internal endpoints (captured 2026-09-30, docs/api-notes.md), with the
 * agency's captured Firebase session.
 *
 * Only captured calls are used. Two inferred behaviours are avoided on purpose:
 *   - a folder on create goes through bulk/move after the create, not `parentId` in the body;
 *   - moving a snippet back to the top level (`parentId: ""`) is not offered.
 * Deleting a non-empty folder is refused (orphan vs cascade was not verified).
 *
 * These replace nothing: the ported get_/create_/update_/delete_snippet tools (which
 * call /templates/snippets) are left as they are.
 */

import { ToolDef, defineTool } from './types.js';
import { CRMClient } from '../crm/client.js';
import { Snippet, SnippetsClient, SnippetTemplate } from '../crm/snippets-client.js';
import { stableStringify } from './builder-helpers.js';

const MAX_PAGES = 50;
const PAGE = 20;
const MAX_IDS = 100;

function sc(client: CRMClient): SnippetsClient {
  return client.snippets();
}

/** The web app's email line markup (§8.4 of the capture). */
const EMAIL_LINE_OPEN = '<p class="custom-newline" style="line-height: 1.5;padding-left: 0px!important;">';

export function textToEmailHtml(text: string): string {
  return String(text)
    .split(/\r?\n/)
    .map((line) => {
      const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `${EMAIL_LINE_OPEN}${escaped || '<br>'}</p>`;
    })
    .join('');
}

function checkUrls(urls: unknown): string[] {
  if (urls === undefined) return [];
  if (!Array.isArray(urls)) throw new Error('urlAttachments must be an array of URLs.');
  return urls.map((u, i) => {
    const s = String(u).trim();
    if (!/^https?:\/\/\S+$/i.test(s)) throw new Error(`urlAttachments[${i}] must be an http(s) URL.`);
    return s;
  });
}

function preview(s: Snippet): string | undefined {
  const t = s.template || {};
  const text = s.type === 'email' ? t.subject || String(t.html || '').replace(/<[^>]+>/g, ' ') : t.body;
  if (!text) return undefined;
  const flat = String(text).replace(/\s+/g, ' ').trim();
  return flat.length > 120 ? `${flat.slice(0, 117)}...` : flat;
}

function summarize(s: Snippet, full = false): Record<string, unknown> {
  if (s.isFolder) {
    return { id: s.id, name: s.name, isFolder: true, ...(s.totalSnippets !== undefined ? { totalSnippets: s.totalSnippets } : {}) };
  }
  return {
    id: s.id,
    name: s.name,
    type: s.type,
    ...(s.parentId ? { folderId: s.parentId } : {}),
    ...(s.folderName ? { folderName: s.folderName } : {}),
    ...(full
      ? { template: s.template ?? null, urlAttachments: s.urlAttachments, ...(s.useForLiveChat !== undefined ? { useForLiveChat: s.useForLiveChat } : {}) }
      : { preview: preview(s) }),
    dateUpdated: s.dateUpdated,
  };
}

/** Every page of the paged snippet list (bounded). */
async function allSnippetPages(snippets: SnippetsClient, query?: string): Promise<Snippet[]> {
  const out: Snippet[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { snippets: rows, total } = await snippets.list({ skip: page * PAGE, limit: PAGE, query });
    out.push(...rows);
    if (rows.length < PAGE || (total !== undefined && out.length >= total)) return out;
  }
  throw new Error('Too many snippets to scan safely; narrow the search with query.');
}

async function allFolders(snippets: SnippetsClient): Promise<Snippet[]> {
  const out: Snippet[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { folders, total } = await snippets.listFolders({ skip: page * PAGE, limit: PAGE });
    out.push(...folders);
    if (folders.length < PAGE || (total !== undefined && out.length >= total)) return out;
  }
  throw new Error('Too many snippet folders to scan safely.');
}

/**
 * Find one snippet or folder by id. There is no single-item GET: the all=true list
 * finds it, then the paged list (searched by name) adds folder membership, which
 * all=true omits.
 */
async function findSnippet(snippets: SnippetsClient, id: string): Promise<Snippet> {
  if (!id) throw new Error('snippetId is required.');
  const all = await snippets.listAll();
  const hit = all.find((s) => s.id === id);
  if (!hit) throw new Error(`Snippet "${id}" was not found in this location.`);
  if (hit.isFolder) return hit;
  const paged = (await allSnippetPages(snippets, hit.name)).find((s) => s.id === id);
  return paged ? { ...hit, ...paged } : hit;
}

async function requireFolder(snippets: SnippetsClient, folderId: string): Promise<{ id: string; name: string }> {
  const folders = await snippets.folderOptions();
  const found = folders.find((f) => f.id === folderId);
  if (!found) {
    const known = folders.map((f) => `${f.id} ("${f.name}")`).join(', ') || '(none)';
    throw new Error(`Snippet folder "${folderId}" was not found. Available: ${known}.`);
  }
  return found;
}

function idList(args: Record<string, any>): string[] {
  const ids = Array.isArray(args.snippetIds) ? args.snippetIds : args.snippetId ? [args.snippetId] : [];
  const clean = Array.from(new Set(ids.map((x: unknown) => String(x).trim()).filter(Boolean))) as string[];
  if (clean.length === 0) throw new Error('Give snippetId or snippetIds.');
  if (clean.length > MAX_IDS) throw new Error(`At most ${MAX_IDS} snippets per call.`);
  return clean;
}

/** Resolve ids to non-folder snippets, failing on unknown ids or folders. */
async function requireSnippets(snippets: SnippetsClient, ids: string[]): Promise<Snippet[]> {
  const all = new Map((await snippets.listAll()).map((s) => [s.id, s]));
  return ids.map((id) => {
    const s = all.get(id);
    if (!s) throw new Error(`Snippet "${id}" was not found in this location.`);
    if (s.isFolder) throw new Error(`"${s.name}" (${id}) is a folder; use the snippets folder tools for it.`);
    return s;
  });
}

// ─── Schemas ─────────────────────────────────────────────────

const CONTENT_PROPS: Record<string, any> = {
  body: { type: 'string', description: 'SMS text. Merge tags like {{contact.first_name}} work.' },
  urlAttachments: { type: 'array', items: { type: 'string' }, description: 'SMS only: attachment URLs (http/https)' },
  useForLiveChat: { type: 'boolean', description: 'SMS only: offer the snippet in live chat (default false)' },
  subject: { type: 'string', description: 'Email subject. Merge tags work.' },
  html: { type: 'string', description: 'Email body as HTML' },
  text: { type: 'string', description: 'Email body as plain text; each line becomes a paragraph in the editor\'s markup. Use instead of html.' },
};

// ─── Tools ───────────────────────────────────────────────────

export const snippetsTools: ToolDef[] = [
  defineTool({
    name: 'snippets_list',
    description:
      'List SMS and email snippets (Marketing → Snippets): id, name, type, folder and a short preview. Filter by name (query), ' +
      'type, or folderId. Use snippets_get for the full content.',
    properties: {
      query: { type: 'string', description: 'Search by name' },
      type: { type: 'string', enum: ['sms', 'email'] },
      folderId: { type: 'string', description: 'Only snippets in this folder' },
      limit: { type: 'number', description: 'Default 20 (ignored when filtering by type or folder, which scans every page)' },
      skip: { type: 'number' },
    },
    handler: async (client, args) => {
      const snippets = sc(client);
      if (args.type || args.folderId) {
        const rows = (await allSnippetPages(snippets, args.query)).filter(
          (s) => (!args.type || s.type === args.type) && (!args.folderId || s.parentId === args.folderId)
        );
        return { total: rows.length, snippets: rows.map((s) => summarize(s)) };
      }
      const { snippets: rows, total } = await snippets.list({ skip: args.skip, limit: args.limit, query: args.query });
      return { total, snippets: rows.map((s) => summarize(s)) };
    },
  }),

  defineTool({
    name: 'snippets_get',
    description: 'Get one snippet with its full content: SMS body and attachment URLs, or email subject and HTML, plus its folder.',
    properties: { snippetId: { type: 'string' } },
    required: ['snippetId'],
    handler: async (client, args) => summarize(await findSnippet(sc(client), String(args.snippetId || '').trim()), true),
  }),

  defineTool({
    name: 'snippets_create',
    description:
      'Create an SMS or email snippet, optionally inside a folder. SMS: body (+ urlAttachments). Email: subject plus html or text. ' +
      'Merge tags such as {{contact.first_name}} are kept as-is.',
    properties: {
      name: { type: 'string' },
      type: { type: 'string', enum: ['sms', 'email'] },
      ...CONTENT_PROPS,
      folderId: { type: 'string', description: 'Put the snippet in this folder (from snippets_list_folders)' },
    },
    required: ['name', 'type'],
    handler: async (client, args) => {
      const snippets = sc(client);
      const name = String(args.name || '').trim();
      if (!name) throw new Error('name is required.');

      let body: Record<string, unknown>;
      if (args.type === 'sms') {
        if (args.subject !== undefined || args.html !== undefined || args.text !== undefined) {
          throw new Error('subject, html and text are for email snippets; an SMS snippet takes body.');
        }
        if (!String(args.body || '').trim()) throw new Error('An SMS snippet needs body.');
        body = {
          name,
          template: { body: String(args.body), attachments: [] },
          useForLiveChat: args.useForLiveChat === true,
          urlAttachments: checkUrls(args.urlAttachments),
          type: 'sms',
          isFolder: false,
          parentId: '',
        };
      } else if (args.type === 'email') {
        if (args.body !== undefined || args.urlAttachments !== undefined || args.useForLiveChat !== undefined) {
          throw new Error('body, urlAttachments and useForLiveChat are for SMS snippets; an email snippet takes subject and html or text.');
        }
        if ((args.html === undefined) === (args.text === undefined)) throw new Error('An email snippet needs exactly one of html or text.');
        const html = args.html !== undefined ? String(args.html) : textToEmailHtml(args.text);
        if (!html.trim()) throw new Error('The email body is empty.');
        body = {
          name,
          template: { html, subject: String(args.subject ?? ''), attachments: [] },
          type: 'email',
          isFolder: false,
          parentId: '',
        };
      } else {
        throw new Error('type must be "sms" or "email".');
      }

      // Check the folder first, so a bad id creates nothing.
      const folder = args.folderId ? await requireFolder(snippets, args.folderId) : undefined;
      const created = await snippets.create(body);
      const result: Record<string, unknown> = {
        message: `${args.type === 'sms' ? 'SMS' : 'Email'} snippet "${created.name}" created`,
        verified: stableStringify(created.template) === stableStringify(body.template),
        snippet: summarize(created, true),
      };
      if (folder) {
        try {
          const moved = await snippets.bulkMove([created.id], folder.id);
          result.folder = { id: folder.id, name: folder.name, moved: moved === 1 };
        } catch (err) {
          result.folder = { id: folder.id, name: folder.name, error: `Created at the top level; the move failed: ${(err as Error).message}` };
        }
      }
      return result;
    },
  }),

  defineTool({
    name: 'snippets_update',
    description:
      'Edit a snippet. Only the fields you pass change; the rest of the snippet is kept (the API replaces the whole template, ' +
      'so the current one is read and merged first). The type cannot change.',
    properties: { snippetId: { type: 'string' }, name: { type: 'string' }, ...CONTENT_PROPS },
    required: ['snippetId'],
    handler: async (client, args) => {
      const snippets = sc(client);
      const current = await findSnippet(snippets, String(args.snippetId || '').trim());
      if (current.isFolder) throw new Error(`"${current.name}" is a folder; use snippets_rename_folder.`);
      const name = args.name !== undefined ? String(args.name).trim() : current.name;
      if (!name) throw new Error('name cannot be empty.');
      const tpl: SnippetTemplate = { attachments: [], ...(current.template || {}) };

      let body: Record<string, unknown>;
      if (current.type === 'sms') {
        if (args.subject !== undefined || args.html !== undefined || args.text !== undefined) {
          throw new Error('This is an SMS snippet: change body, not subject/html/text.');
        }
        if (args.body !== undefined) {
          if (!String(args.body).trim()) throw new Error('body cannot be empty.');
          tpl.body = String(args.body);
        }
        body = {
          name,
          template: tpl,
          useForLiveChat: args.useForLiveChat ?? current.useForLiveChat ?? false,
          urlAttachments: args.urlAttachments !== undefined ? checkUrls(args.urlAttachments) : current.urlAttachments,
        };
      } else if (current.type === 'email') {
        if (args.body !== undefined || args.urlAttachments !== undefined || args.useForLiveChat !== undefined) {
          throw new Error('This is an email snippet: change subject and html or text, not body/urlAttachments.');
        }
        if (args.html !== undefined && args.text !== undefined) throw new Error('Give html or text, not both.');
        if (args.html !== undefined) tpl.html = String(args.html);
        if (args.text !== undefined) tpl.html = textToEmailHtml(args.text);
        if (args.subject !== undefined) tpl.subject = String(args.subject);
        body = { name, template: tpl };
      } else {
        throw new Error(`Snippet "${current.name}" has an unknown type "${current.type}".`);
      }

      const updated = await snippets.update(current.id, body);
      return {
        message: `Snippet "${updated.name}" updated`,
        verified: updated.name === name && stableStringify(updated.template) === stableStringify(tpl),
        snippet: summarize({ ...current, ...updated, parentId: current.parentId, folderName: current.folderName }, true),
      };
    },
  }),

  defineTool({
    name: 'snippets_delete',
    description:
      'Permanently delete one snippet (snippetId) or several (snippetIds, up to 100). Requires confirm: true. For a single ' +
      'snippet, expectedName guards against deleting the wrong one. Folders are deleted with snippets_delete_folder.',
    properties: {
      snippetId: { type: 'string' },
      snippetIds: { type: 'array', items: { type: 'string' } },
      confirm: { type: 'boolean', description: 'Must be true' },
      expectedName: { type: 'string', description: 'Single delete only: the snippet name must match exactly' },
    },
    required: ['confirm'],
    handler: async (client, args) => {
      if (args.confirm !== true) throw new Error('Deletion is irreversible — pass confirm: true.');
      const snippets = sc(client);
      const ids = idList(args);
      const targets = await requireSnippets(snippets, ids);
      if (args.expectedName !== undefined) {
        if (targets.length !== 1) throw new Error('expectedName applies to a single snippet.');
        if (targets[0].name !== args.expectedName) {
          throw new Error(`Not deleted: snippet ${targets[0].id} is named "${targets[0].name}", not "${args.expectedName}".`);
        }
      }
      if (targets.length === 1) {
        const ok = await snippets.delete(targets[0].id);
        return { message: `Snippet "${targets[0].name}" deleted`, deleted: ok ? [targets[0].id] : [], success: ok };
      }
      const count = await snippets.bulkDelete(ids);
      return {
        message: `${count} of ${ids.length} snippet(s) deleted`,
        success: count === ids.length,
        deleted: targets.map((t) => ({ id: t.id, name: t.name })),
      };
    },
  }),

  defineTool({
    name: 'snippets_list_folders',
    description: 'List snippet folders with how many snippets each holds.',
    handler: async (client) => {
      const folders = await allFolders(sc(client));
      return { total: folders.length, folders: folders.map((f) => summarize(f)) };
    },
  }),

  defineTool({
    name: 'snippets_create_folder',
    description: 'Create a snippet folder. Fails if a folder with that name already exists.',
    properties: { name: { type: 'string' } },
    required: ['name'],
    handler: async (client, args) => {
      const snippets = sc(client);
      const name = String(args.name || '').trim();
      if (!name) throw new Error('name is required.');
      if (await snippets.folderNameExists(name)) throw new Error(`A snippet folder named "${name}" already exists.`);
      const folder = await snippets.create({ name, isFolder: true });
      return { message: `Folder "${folder.name}" created`, verified: folder.isFolder && folder.name === name, folder: summarize(folder) };
    },
  }),

  defineTool({
    name: 'snippets_rename_folder',
    description: 'Rename a snippet folder. Fails if another folder already has the new name.',
    properties: { folderId: { type: 'string' }, name: { type: 'string' } },
    required: ['folderId', 'name'],
    handler: async (client, args) => {
      const snippets = sc(client);
      const name = String(args.name || '').trim();
      if (!name) throw new Error('name is required.');
      const current = await requireFolder(snippets, args.folderId);
      if (current.name === name) return { message: `Folder is already named "${name}"`, folder: current };
      if (await snippets.folderNameExists(name)) throw new Error(`A snippet folder named "${name}" already exists.`);
      const folder = await snippets.update(current.id, { name });
      return { message: `Folder renamed to "${folder.name}"`, verified: folder.name === name, folder: summarize(folder) };
    },
  }),

  defineTool({
    name: 'snippets_delete_folder',
    description:
      'Delete an EMPTY snippet folder. Requires confirm: true; expectedName guards against deleting the wrong one. A folder ' +
      'that still holds snippets is refused — delete them or move them to another folder first.',
    properties: {
      folderId: { type: 'string' },
      confirm: { type: 'boolean', description: 'Must be true' },
      expectedName: { type: 'string' },
    },
    required: ['folderId', 'confirm'],
    handler: async (client, args) => {
      if (args.confirm !== true) throw new Error('Deletion is irreversible — pass confirm: true.');
      const snippets = sc(client);
      const folder = (await allFolders(snippets)).find((f) => f.id === args.folderId);
      if (!folder) throw new Error(`Snippet folder "${args.folderId}" was not found.`);
      if (args.expectedName !== undefined && folder.name !== args.expectedName) {
        throw new Error(`Not deleted: folder ${folder.id} is named "${folder.name}", not "${args.expectedName}".`);
      }
      const inside = (await allSnippetPages(snippets)).filter((s) => s.parentId === folder.id);
      if (inside.length || (folder.totalSnippets ?? 0) > 0) {
        throw new Error(
          `Not deleted: "${folder.name}" still holds ${Math.max(inside.length, folder.totalSnippets ?? 0)} snippet(s)` +
            (inside.length ? ` (${inside.map((s) => s.id).join(', ')})` : '') +
            '. Delete them or move them to another folder first.'
        );
      }
      const ok = await snippets.delete(folder.id);
      return { message: `Folder "${folder.name}" deleted`, success: ok, id: folder.id };
    },
  }),

  defineTool({
    name: 'snippets_move_to_folder',
    description:
      'Move one or more snippets (up to 100) into a folder. Moving snippets back out to the top level is not supported yet.',
    properties: {
      snippetId: { type: 'string' },
      snippetIds: { type: 'array', items: { type: 'string' } },
      folderId: { type: 'string', description: 'Destination folder id (from snippets_list_folders)' },
    },
    required: ['folderId'],
    handler: async (client, args) => {
      const snippets = sc(client);
      const ids = idList(args);
      const folder = await requireFolder(snippets, args.folderId);
      const targets = await requireSnippets(snippets, ids);
      const count = await snippets.bulkMove(ids, folder.id);
      return {
        message: `${count} of ${ids.length} snippet(s) moved to "${folder.name}"`,
        success: count === ids.length,
        folder,
        snippets: targets.map((t) => ({ id: t.id, name: t.name })),
      };
    },
  }),
];
