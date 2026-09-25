/**
 * List-page folder tools, shared by the surveys and forms builders.
 *
 * Each product gets list/create/rename folder tools plus a move tool, built from the
 * captured endpoints in crm/builder-folders.ts. Folder delete and nested folders were
 * not captured, so they are not offered.
 */

import { ToolDef, defineTool } from './types.js';
import { CRMClient } from '../crm/client.js';
import { BuilderFolders, BuilderFolder, ROOT_FOLDER } from '../crm/builder-folders.js';

export interface FolderToolsConfig {
  /** Tool-name prefix, e.g. "surveys_builder". */
  prefix: string;
  /** Singular item noun, e.g. "survey". */
  noun: string;
  folders: (client: CRMClient) => BuilderFolders;
}

export function summarizeFolder(f: BuilderFolder): Record<string, unknown> {
  return { id: f._id, name: f.name, dateUpdated: f.dateUpdated ?? f.updatedAt };
}

/**
 * Move an item and confirm from the move response that it landed. `folderId` of
 * "root" (or null) means the top level.
 */
export async function moveItem(folders: BuilderFolders, itemId: string, folderId: string | null | undefined) {
  const target = !folderId || folderId === ROOT_FOLDER ? ROOT_FOLDER : folderId;
  const folder = target === ROOT_FOLDER ? undefined : await folders.require(target);
  const { parentId } = await folders.move(itemId, target);
  const verified = target === ROOT_FOLDER ? parentId === undefined : parentId === target;
  return {
    verified,
    folder: folder ? summarizeFolder(folder) : { id: ROOT_FOLDER, name: '(top level)' },
    ...(verified ? {} : { verificationNote: `The move was accepted but the response shows parentId ${JSON.stringify(parentId ?? null)}.` }),
  };
}

export function folderTools(cfg: FolderToolsConfig): ToolDef[] {
  const { prefix, noun } = cfg;
  const plural = `${noun}s`;
  return [
    defineTool({
      name: `${prefix}_list_folders`,
      description: `List the ${noun} folders in the sub-account (ids and names). Use a folder id with ${prefix}_list_${plural} (folderId) or ${prefix}_move_${noun}.`,
      handler: async (client) => {
        const folders = await cfg.folders(client).list();
        return { total: folders.length, folders: folders.map(summarizeFolder) };
      },
    }),

    defineTool({
      name: `${prefix}_create_folder`,
      description: `Create a ${noun} folder at the top level of the ${plural} list.`,
      properties: { name: { type: 'string' } },
      required: ['name'],
      handler: async (client, args) => {
        const name = String(args.name || '').trim();
        if (!name) throw new Error('name is required.');
        const folder = await cfg.folders(client).create(name);
        return { message: `Folder "${folder.name}" created`, folder: summarizeFolder(folder) };
      },
    }),

    defineTool({
      name: `${prefix}_rename_folder`,
      description: `Rename a ${noun} folder.`,
      properties: { folderId: { type: 'string' }, name: { type: 'string' } },
      required: ['folderId', 'name'],
      handler: async (client, args) => {
        const name = String(args.name || '').trim();
        if (!name) throw new Error('name is required.');
        const folders = cfg.folders(client);
        await folders.require(args.folderId);
        const folder = await folders.rename(args.folderId, name);
        return { message: `Folder renamed to "${folder.name}"`, verified: folder.name === name, folder: summarizeFolder(folder) };
      },
    }),

    defineTool({
      name: `${prefix}_move_${noun}`,
      description: `Move a ${noun} into a folder, or back to the top level with folderId "root".`,
      properties: {
        [`${noun}Id`]: { type: 'string' },
        folderId: { type: 'string', description: `Destination folder id (from ${prefix}_list_folders), or "root" for the top level` },
      },
      required: [`${noun}Id`, 'folderId'],
      handler: async (client, args) => {
        const itemId = String(args[`${noun}Id`] || '').trim();
        if (!itemId) throw new Error(`${noun}Id is required.`);
        const res = await moveItem(cfg.folders(client), itemId, args.folderId);
        return { message: `Moved ${noun} ${itemId} to ${res.folder.name}`, id: itemId, ...res };
      },
    }),
  ];
}
