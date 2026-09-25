/**
 * List-page folders for surveys and forms (internal builder API).
 *
 * Captured from the Surveys and Forms list pages, 2026-09-25 (docs/api-notes.md):
 *   GET  /{p}/folder?locationId[&productType=form]          → { folders[] }
 *   GET  /{p}/folder/{id}                                    → { folder }
 *   POST /{p}/folder/  { name, locationId[, productType] }   → flat folder
 *   POST /{p}/folder/{id}  { name }                          → { form: folder }
 *   POST /{p}/move-to-folder { surveyId|formId, folderId }   → { form: item }  ("root" = top level)
 * where {p} is "surveys" or "forms". A folder is a row in the same collection with
 * type: "folder"; an item belongs to it through `parentId` (absent at the top level).
 * Folder delete and nested folders were not captured and are not implemented.
 */

import { InternalBuilderHttp } from './internal-builder-http.js';

export type FolderProduct = 'surveys' | 'forms';

export interface BuilderFolder {
  _id: string;
  name: string;
  type?: string;
  [key: string]: unknown;
}

export const ROOT_FOLDER = 'root';

export class BuilderFolders {
  constructor(
    private readonly http: InternalBuilderHttp,
    private readonly product: FolderProduct,
    private readonly locationId: string
  ) {}

  /** Forms calls carry productType: "form" (the list UI always sends it). */
  private get productType(): string | undefined {
    return this.product === 'forms' ? 'form' : undefined;
  }

  async list(): Promise<BuilderFolder[]> {
    const params = new URLSearchParams({ locationId: this.locationId });
    if (this.productType) params.set('productType', this.productType);
    const data = await this.http.request<Record<string, any>>('GET', `/${this.product}/folder?${params.toString()}`);
    return Array.isArray(data?.folders) ? data.folders : [];
  }

  async get(folderId: string): Promise<BuilderFolder> {
    const data = await this.http.request<Record<string, any>>('GET', `/${this.product}/folder/${encodeURIComponent(folderId)}`);
    return this.unwrap(data, 'folder');
  }

  async create(name: string): Promise<BuilderFolder> {
    const body: Record<string, unknown> = { name, locationId: this.locationId };
    if (this.productType) body.productType = this.productType;
    // The create response is the folder itself, not wrapped.
    const data = await this.http.request<Record<string, any>>('POST', `/${this.product}/folder/`, body);
    const { traceId: _t, ...folder } = data || {};
    return this.unwrap({ folder }, 'folder');
  }

  async rename(folderId: string, name: string): Promise<BuilderFolder> {
    const data = await this.http.request<Record<string, any>>('POST', `/${this.product}/folder/${encodeURIComponent(folderId)}`, { name });
    return this.unwrap(data, 'form');
  }

  /**
   * Move an item into `folderId`, or to the top level with "root". Returns the item's
   * parentId afterwards (undefined at the top level). The root move response for forms
   * has no _id, so callers must not rely on it.
   */
  async move(itemId: string, folderId: string): Promise<{ parentId?: string }> {
    const idKey = this.product === 'forms' ? 'formId' : 'surveyId';
    const data = await this.http.request<Record<string, any>>('POST', `/${this.product}/move-to-folder`, {
      [idKey]: itemId,
      folderId,
    });
    const item = data?.form && typeof data.form === 'object' ? data.form : {};
    return { parentId: typeof item.parentId === 'string' ? item.parentId : undefined };
  }

  /** Resolve a folder id from the folder list; throws a helpful error when it isn't there. */
  async require(folderId: string): Promise<BuilderFolder> {
    const folders = await this.list();
    const found = folders.find((f) => f._id === folderId);
    if (!found) {
      const known = folders.map((f) => `${f._id} ("${f.name}")`).join(', ') || '(none)';
      throw new Error(`Folder "${folderId}" was not found in this location's ${this.product} folders. Available: ${known}.`);
    }
    return found;
  }

  private unwrap(data: Record<string, any>, key: string): BuilderFolder {
    const inner = data?.[key];
    if (!inner || typeof inner !== 'object' || typeof inner._id !== 'string') {
      throw new Error(`Unexpected ${this.product} folder response shape (expected "${key}").`);
    }
    return inner as BuilderFolder;
  }
}
