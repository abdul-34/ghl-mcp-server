/**
 * GHL Forms Builder Client (internal API).
 *
 * Talks to the internal form-builder endpoints on services.leadconnectorhq.com/forms/.
 * The public API only lists forms and submissions; these endpoints create, update
 * and delete them. See docs/forms-builder-plan.md and docs/api-notes.md.
 *
 * Auth: token-id headers only — see internal-builder-http.ts.
 *
 * The Firebase ID token comes from `getIdToken`, which the pool wires to the
 * sub-account's WorkflowBuilderClient so refresh-token rotation is persisted once.
 */

import { InternalBuilderHttp, IdTokenProvider, redact, sleep } from './internal-builder-http.js';
import { BuilderFolders } from './builder-folders.js';

export type { IdTokenProvider };

export interface FormsBuilderConfig {
  locationId: string;
  getIdToken: IdTokenProvider;
  /** Override for tests. */
  baseUrl?: string;
  /** Override for tests (defaults to global fetch). */
  fetchImpl?: typeof fetch;
}

/** The stored form document (formData is kept loose — it is replaced wholesale). */
export interface FormDocument {
  _id: string;
  name: string;
  locationId: string;
  formData: FormData;
  deleted?: boolean;
  dateAdded?: string;
  dateUpdated?: string;
  updatedBy?: string;
  [key: string]: unknown;
}

export interface FormData {
  form: FormBody;
  lastUpdatedAt?: string;
  [key: string]: unknown;
}

export interface FormBody {
  fields: FormField[];
  [key: string]: unknown;
}

export interface FormField {
  type: string;
  tag: string;
  label?: string;
  [key: string]: unknown;
}

export interface FormListResult {
  forms: Array<Record<string, unknown>>;
  total?: number;
}

export class FormsApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'FormsApiError';
  }
}

export class FormsBuilderClient {
  readonly locationId: string;
  /** List-page folders (create, rename, move). */
  readonly folders: BuilderFolders;
  private readonly http: InternalBuilderHttp;

  constructor(config: FormsBuilderConfig) {
    if (!config.locationId) throw new Error('FormsBuilderClient requires a locationId.');
    this.locationId = config.locationId;
    this.http = new InternalBuilderHttp({
      getIdToken: config.getIdToken,
      baseUrl: config.baseUrl,
      fetchImpl: config.fetchImpl,
      label: 'GHL Forms API',
      makeError: (message, status) => new FormsApiError(message, status),
    });
    this.folders = new BuilderFolders(this.http, 'forms', this.locationId);
  }

  // ─── CRUD ───────────────────────────────────────────────

  /**
   * All forms (no type; live-verified), or the list-page view of one folder level:
   * `parentId` → that folder's contents; `type: "folder"` → folder rows plus top-level
   * forms. The folder views send productType=form like the list UI.
   */
  async listForms(opts: { limit?: number; skip?: number; type?: string; parentId?: string } = {}): Promise<FormListResult> {
    const params = new URLSearchParams({
      locationId: this.locationId,
      limit: String(opts.limit ?? 20),
      skip: String(opts.skip ?? 0),
    });
    if (opts.parentId) params.set('parentId', opts.parentId);
    const type = opts.parentId ? 'folder' : opts.type;
    if (type) params.set('type', type);
    if (type === 'folder') params.set('productType', 'form');
    const data = await this.request<Record<string, unknown>>('GET', `/forms/?${params.toString()}`);
    return {
      forms: Array.isArray(data.forms) ? (data.forms as Array<Record<string, unknown>>) : [],
      total: typeof data.total === 'number' ? data.total : undefined,
    };
  }

  async getForm(formId: string): Promise<FormDocument> {
    const data = await this.request<Record<string, unknown>>('GET', `/forms/${encodeURIComponent(formId)}`);
    return this.unwrap(data);
  }

  async createForm(name: string, formData: FormData): Promise<FormDocument> {
    const data = await this.request<Record<string, unknown>>('POST', '/forms/', {
      name,
      locationId: this.locationId,
      formData,
    });
    return this.unwrap(data);
  }

  /** Full replace of formData (not a patch) — callers must send the complete document. */
  async updateForm(formId: string, name: string, formData: FormData): Promise<FormDocument | undefined> {
    if (!formData || typeof formData !== 'object') {
      throw new Error('updateForm requires the complete formData object (the API replaces it wholesale).');
    }
    const data = await this.request<Record<string, unknown>>('POST', `/forms/${encodeURIComponent(formId)}`, {
      name,
      formData,
    });
    return data && typeof data === 'object' ? this.unwrapLoose(data) : undefined;
  }

  async deleteForm(formId: string): Promise<Record<string, unknown>> {
    const data = await this.request<Record<string, unknown>>('DELETE', `/forms/${encodeURIComponent(formId)}`);
    return (this.unwrapLoose(data) as unknown as Record<string, unknown>) || {};
  }

  /**
   * Poll GET until `isVisible(doc)` holds. Reads lag writes by ~1–4 s, so a single
   * immediate read can wrongly suggest a write failed.
   */
  async waitForForm(
    formId: string,
    isVisible: (doc: FormDocument) => boolean,
    delaysMs: number[] = [1500, 2500, 4000]
  ): Promise<{ verified: boolean; doc?: FormDocument }> {
    let last: FormDocument | undefined;
    for (const delay of delaysMs) {
      await sleep(delay);
      try {
        last = await this.getForm(formId);
        if (isVisible(last)) return { verified: true, doc: last };
      } catch {
        /* transient — keep polling */
      }
    }
    return { verified: false, doc: last };
  }

  private request<T>(method: string, path: string, body?: unknown): Promise<T> {
    return this.http.request<T>(method, path, body);
  }

  /** GET /forms/{id} and POST /forms/ wrap the document in { form, traceId }. */
  private unwrap(data: Record<string, unknown>): FormDocument {
    const doc = this.unwrapLoose(data);
    if (!doc || typeof doc !== 'object' || !('_id' in doc)) {
      throw new Error(`Unexpected forms API response shape: ${redact(JSON.stringify(data)).slice(0, 300)}`);
    }
    return doc;
  }

  private unwrapLoose(data: Record<string, unknown>): FormDocument {
    const inner = data && typeof data === 'object' && data.form && typeof data.form === 'object' && '_id' in (data.form as object)
      ? data.form
      : data;
    return inner as FormDocument;
  }
}
