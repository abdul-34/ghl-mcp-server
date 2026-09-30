/**
 * GHL Snippets Client (internal API).
 *
 * Marketing → Snippets: SMS and email snippets and their folders, captured from the
 * web app on 2026-09-30 (docs/api-notes.md). Snippets and folders are one resource
 * (Firestore `templates`); a folder is a snippet with isFolder: true. Membership is
 * the snippet's `parentId`.
 *
 * Auth: token-id headers (see internal-builder-http.ts) plus `x-locale: en_US`, as the
 * web app sends. Whether a PIT/OAuth Bearer works here is unverified, so it isn't used.
 *
 * Response shapes differ by call and are normalized by `normalizeSnippet`:
 *   list → camelCase with `_id`; create → snake_case with `id` and Firestore timestamps;
 *   update → a raw Firestore DocumentSnapshot (`_id` + `_data`).
 */

import { InternalBuilderHttp, IdTokenProvider } from './internal-builder-http.js';

export interface SnippetsClientConfig {
  locationId: string;
  getIdToken: IdTokenProvider;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export type SnippetType = 'sms' | 'email';

export interface SnippetTemplate {
  body?: string;
  subject?: string;
  html?: string;
  attachments?: unknown[];
  [key: string]: unknown;
}

/** One normalized snippet or folder. */
export interface Snippet {
  id: string;
  name: string;
  isFolder: boolean;
  type?: SnippetType;
  template?: SnippetTemplate;
  urlAttachments: string[];
  useForLiveChat?: boolean;
  parentId?: string;
  folderName?: string;
  totalSnippets?: number;
  dateAdded?: string;
  dateUpdated?: string;
}

export class SnippetsApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'SnippetsApiError';
  }
}

function toIso(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && typeof (v as any)._seconds === 'number') {
    return new Date((v as any)._seconds * 1000 + Math.floor(((v as any)._nanoseconds || 0) / 1e6)).toISOString();
  }
  return undefined;
}

/** Normalize any of the three response shapes (list row, create, update snapshot). */
export function normalizeSnippet(raw: Record<string, any>): Snippet {
  const s = raw && typeof raw === 'object' ? raw : {};
  const d = s._data && typeof s._data === 'object' ? s._data : s;
  const id = s.id ?? s._id;
  if (typeof id !== 'string' || !id) throw new Error('Snippet response has no id.');
  const isFolder = d.isFolder === true || d.is_folder === true;
  const out: Snippet = {
    id,
    name: String(d.name ?? ''),
    isFolder,
    urlAttachments: Array.isArray(d.urlAttachments) ? d.urlAttachments : [],
  };
  if (!isFolder && (d.type === 'sms' || d.type === 'email')) out.type = d.type;
  if (d.template && typeof d.template === 'object') out.template = d.template;
  if (typeof d.useForLiveChat === 'boolean') out.useForLiveChat = d.useForLiveChat;
  const parentId = d.parentId ?? d.parent_id;
  if (typeof parentId === 'string' && parentId) out.parentId = parentId;
  if (typeof d.folderName === 'string') out.folderName = d.folderName;
  if (typeof d.totalSnippets === 'number') out.totalSnippets = d.totalSnippets;
  const added = toIso(d.dateAdded ?? d.date_added);
  const updated = toIso(d.dateUpdated ?? d.date_updated);
  if (added) out.dateAdded = added;
  if (updated) out.dateUpdated = updated;
  return out;
}

export class SnippetsClient {
  readonly locationId: string;
  private readonly http: InternalBuilderHttp;

  constructor(config: SnippetsClientConfig) {
    if (!config.locationId) throw new Error('SnippetsClient requires a locationId.');
    this.locationId = config.locationId;
    this.http = new InternalBuilderHttp({
      getIdToken: config.getIdToken,
      baseUrl: config.baseUrl,
      fetchImpl: config.fetchImpl,
      label: 'GHL Snippets API',
      makeError: (message, status) => new SnippetsApiError(message, status),
      extraHeaders: { 'x-locale': 'en_US' },
    });
  }

  private get base(): string {
    return `/snippets/${encodeURIComponent(this.locationId)}`;
  }

  // ─── Reads ──────────────────────────────────────────────

  /** Paged snippets (no folders), each with parentId/folderName when inside a folder. */
  async list(opts: { skip?: number; limit?: number; query?: string } = {}): Promise<{ snippets: Snippet[]; total?: number }> {
    const params = new URLSearchParams({ skip: String(opts.skip ?? 0), limit: String(opts.limit ?? 20) });
    if (opts.query) params.set('query', opts.query);
    const data = await this.http.request<Record<string, any>>('GET', `${this.base}?${params.toString()}`);
    return {
      snippets: (Array.isArray(data?.snippets) ? data.snippets : []).map(normalizeSnippet),
      total: typeof data?.totalCount === 'number' ? data.totalCount : undefined,
    };
  }

  /** Every snippet and folder in one array. This projection omits parentId. */
  async listAll(): Promise<Snippet[]> {
    const data = await this.http.request<Record<string, any>>('GET', `${this.base}?all=true`);
    return (Array.isArray(data?.snippets) ? data.snippets : []).map(normalizeSnippet);
  }

  /** Paged folders with their snippet counts (totalSnippets). */
  async listFolders(opts: { skip?: number; limit?: number } = {}): Promise<{ folders: Snippet[]; total?: number }> {
    const params = new URLSearchParams({ skip: String(opts.skip ?? 0), limit: String(opts.limit ?? 20), isFolder: 'true' });
    const data = await this.http.request<Record<string, any>>('GET', `${this.base}?${params.toString()}`);
    return {
      folders: (Array.isArray(data?.snippets) ? data.snippets : []).map(normalizeSnippet),
      total: typeof data?.totalCount === 'number' ? data.totalCount : undefined,
    };
  }

  /** Lightweight folder list ({ _id, name }), as the folder dropdown uses. */
  async folderOptions(): Promise<Array<{ id: string; name: string }>> {
    const data = await this.http.request<Record<string, any>>('GET', `${this.base}/folders/list`);
    return (Array.isArray(data?.folders) ? data.folders : []).map((f: any) => ({ id: String(f._id), name: String(f.name ?? '') }));
  }

  async folderNameExists(name: string): Promise<boolean> {
    const data = await this.http.request<Record<string, any>>(
      'GET',
      `${this.base}/folders/check?folderName=${encodeURIComponent(name)}`
    );
    return data?.exists === true;
  }

  // ─── Writes ─────────────────────────────────────────────

  async create(body: Record<string, unknown>): Promise<Snippet> {
    const data = await this.http.request<Record<string, any>>('POST', this.base, body);
    return normalizeSnippet(data?.snippet);
  }

  /** PUT replaces `template` wholesale — send the complete object. */
  async update(id: string, body: Record<string, unknown>): Promise<Snippet> {
    const data = await this.http.request<Record<string, any>>('PUT', `${this.base}/${encodeURIComponent(id)}`, body);
    return normalizeSnippet(data?.snippet);
  }

  /** Deletes one snippet or folder. The web app sends an empty JSON body. */
  async delete(id: string): Promise<boolean> {
    const data = await this.http.request<Record<string, any>>('DELETE', `${this.base}/${encodeURIComponent(id)}`, {});
    return data?.success === true;
  }

  async bulkDelete(snippetIds: string[]): Promise<number> {
    const data = await this.http.request<Record<string, any>>('POST', `${this.base}/bulk/delete`, { snippetIds });
    return typeof data?.count === 'number' ? data.count : 0;
  }

  async bulkMove(snippetIds: string[], parentId: string): Promise<number> {
    const data = await this.http.request<Record<string, any>>('POST', `${this.base}/bulk/move`, { snippetIds, parentId });
    return typeof data?.count === 'number' ? data.count : 0;
  }
}
