/**
 * GHL Forms Builder Client (internal API).
 *
 * Talks to the internal form-builder endpoints on services.leadconnectorhq.com/forms/.
 * The public API only lists forms and submissions; these endpoints create, update
 * and delete them. See docs/forms-builder-plan.md and docs/api-notes.md.
 *
 * Auth (verified header matrix, blueprint Addendum A): exactly
 *   channel: APP · source: WEB_USER · version: 2021-07-28 · token-id: <Firebase ID token>
 * All four are individually mandatory. A Bearer header is ignored when sent
 * alongside token-id and rejected when sent instead of it, so we don't send one.
 *
 * The Firebase ID token comes from `getIdToken`, which the pool wires to the
 * sub-account's WorkflowBuilderClient so refresh-token rotation is persisted once.
 */

export type IdTokenProvider = (forceRefresh?: boolean) => Promise<string>;

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

const DEFAULT_BASE_URL = 'https://services.leadconnectorhq.com';

export class FormsBuilderClient {
  readonly locationId: string;
  private readonly getIdToken: IdTokenProvider;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: FormsBuilderConfig) {
    if (!config.locationId) throw new Error('FormsBuilderClient requires a locationId.');
    this.locationId = config.locationId;
    this.getIdToken = config.getIdToken;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.fetchImpl = config.fetchImpl || fetch;
  }

  // ─── CRUD ───────────────────────────────────────────────

  async listForms(opts: { limit?: number; skip?: number; type?: string } = {}): Promise<FormListResult> {
    const params = new URLSearchParams({
      locationId: this.locationId,
      limit: String(opts.limit ?? 20),
      skip: String(opts.skip ?? 0),
    });
    if (opts.type) params.set('type', opts.type);
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

  // ─── HTTP ───────────────────────────────────────────────

  private async headers(forceRefresh: boolean): Promise<Record<string, string>> {
    const token = await this.getIdToken(forceRefresh);
    return {
      accept: 'application/json',
      'content-type': 'application/json',
      channel: 'APP',
      source: 'WEB_USER',
      version: '2021-07-28',
      'token-id': token,
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const send = async (forceRefresh: boolean) => {
      const init: RequestInit = { method, headers: await this.headers(forceRefresh) };
      if (body !== undefined) init.body = JSON.stringify(body);
      return this.fetchImpl(`${this.baseUrl}${path}`, init);
    };

    let res = await send(false);
    // A cached token can be revoked before its nominal expiry; mint a fresh one once.
    if (res.status === 401) res = await send(true);

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = text;
    }

    if (!res.ok) {
      const detail = typeof data === 'string' ? data : JSON.stringify(data);
      throw new FormsApiError(
        `GHL Forms API ${method} ${path.split('?')[0]} failed (${res.status}): ${redact(detail).slice(0, 800)}`,
        res.status
      );
    }
    return data as T;
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

function redact(s: string): string {
  return s.replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '***');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
