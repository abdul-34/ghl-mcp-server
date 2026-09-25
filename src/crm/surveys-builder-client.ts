/**
 * GHL Surveys Builder Client (internal API).
 *
 * Talks to the internal survey-builder endpoints on services.leadconnectorhq.com/surveys/
 * plus the token-id custom-field routes the builder uses to back custom elements.
 * The public API only lists surveys and submissions. See docs/surveys-builder-plan.md
 * and docs/api-notes.md.
 *
 * Auth: token-id headers only — see internal-builder-http.ts.
 *
 * Envelopes differ by call: GET and create return { survey }, update and delete
 * return { data }. `unwrap` normalizes both.
 */

import { InternalBuilderHttp, IdTokenProvider, redact, sleep } from './internal-builder-http.js';

export interface SurveysBuilderConfig {
  locationId: string;
  getIdToken: IdTokenProvider;
  /** Override for tests. */
  baseUrl?: string;
  /** Override for tests (defaults to global fetch). */
  fetchImpl?: typeof fetch;
}

/** The stored survey document (formData is kept loose; it is replaced wholesale on update). */
export interface SurveyDocument {
  _id: string;
  name: string;
  locationId: string;
  formData: SurveyFormData;
  deleted?: boolean;
  dateAdded?: string;
  dateUpdated?: string;
  updatedBy?: string;
  [key: string]: unknown;
}

export interface SurveyFormData {
  form: Record<string, unknown>;
  slides: SurveySlide[];
  [key: string]: unknown;
}

export interface SurveySlide {
  id: string;
  slideName?: string;
  active?: boolean;
  button?: Record<string, unknown>;
  slideData: SurveyElement[];
  [key: string]: unknown;
}

export interface SurveyElement {
  type: string;
  tag: string;
  uuid?: string;
  label?: string;
  [key: string]: unknown;
}

export interface SurveyListResult {
  surveys: Array<Record<string, unknown>>;
  total?: number;
}

/** Payload for POST /locations/{loc}/customFields (field, not folder). */
export interface CreateCustomFieldInput {
  name: string;
  dataType: string;
  parentId?: string;
  placeholder?: string;
  options?: string[];
  textBoxListOptions?: Array<{ label: string; prefillValue: string }>;
}

export class SurveysApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'SurveysApiError';
  }
}

export class SurveysBuilderClient {
  readonly locationId: string;
  private readonly http: InternalBuilderHttp;

  constructor(config: SurveysBuilderConfig) {
    if (!config.locationId) throw new Error('SurveysBuilderClient requires a locationId.');
    this.locationId = config.locationId;
    this.http = new InternalBuilderHttp({
      getIdToken: config.getIdToken,
      baseUrl: config.baseUrl,
      fetchImpl: config.fetchImpl,
      label: 'GHL Surveys API',
      makeError: (message, status) => new SurveysApiError(message, status),
    });
  }

  // ─── Surveys ────────────────────────────────────────────

  async listSurveys(opts: { limit?: number; skip?: number; query?: string } = {}): Promise<SurveyListResult> {
    const params = new URLSearchParams({
      skip: String(opts.skip ?? 0),
      limit: String(opts.limit ?? 20),
      locationId: this.locationId,
      query: opts.query ?? '',
      type: 'survey',
    });
    const data = await this.http.request<Record<string, unknown>>('GET', `/surveys/?${params.toString()}`);
    return {
      surveys: Array.isArray(data.surveys) ? (data.surveys as Array<Record<string, unknown>>) : [],
      total: typeof data.total === 'number' ? data.total : undefined,
    };
  }

  async getSurvey(surveyId: string): Promise<SurveyDocument> {
    const data = await this.http.request<Record<string, unknown>>('GET', `/surveys/${encodeURIComponent(surveyId)}`);
    return this.unwrap(data);
  }

  /** Creates a survey with the server's minimal formData ({ form: { company }, one empty slide }). */
  async createSurvey(name: string): Promise<SurveyDocument> {
    const data = await this.http.request<Record<string, unknown>>('POST', '/surveys/', {
      locationId: this.locationId,
      source: 'landing_page',
      name,
    });
    return this.unwrap(data);
  }

  /**
   * Full replace of formData (not a merge). The server whitelists exactly `name` and
   * `formData` (any other key → 422), and a formData without `form` breaks the builder.
   */
  async updateSurvey(surveyId: string, name: string, formData: SurveyFormData): Promise<SurveyDocument> {
    if (!formData || typeof formData !== 'object' || !formData.form || typeof formData.form !== 'object') {
      throw new Error('updateSurvey requires the complete formData with a formData.form object (the API replaces it wholesale).');
    }
    if (!Array.isArray(formData.slides) || formData.slides.length === 0) {
      throw new Error('updateSurvey requires formData.slides with at least one slide.');
    }
    const data = await this.http.request<Record<string, unknown>>('POST', `/surveys/${encodeURIComponent(surveyId)}`, {
      name,
      formData,
    });
    return this.unwrap(data);
  }

  /** Soft delete. Does not remove the survey's custom fields or folder. */
  async deleteSurvey(surveyId: string): Promise<{ deleted: boolean }> {
    const data = await this.http.request<Record<string, unknown>>('DELETE', `/surveys/${encodeURIComponent(surveyId)}`);
    const inner = data && typeof data.data === 'object' ? (data.data as Record<string, unknown>) : data;
    return { deleted: inner?.deleted === true };
  }

  /** Poll GET until `isVisible(doc)` holds; reads can lag writes by a few seconds. */
  async waitForSurvey(
    surveyId: string,
    isVisible: (doc: SurveyDocument) => boolean,
    delaysMs: number[] = [1500, 2500, 4000]
  ): Promise<{ verified: boolean; doc?: SurveyDocument }> {
    let last: SurveyDocument | undefined;
    for (const delay of delaysMs) {
      await sleep(delay);
      try {
        last = await this.getSurvey(surveyId);
        if (isVisible(last)) return { verified: true, doc: last };
      } catch {
        /* transient — keep polling */
      }
    }
    return { verified: false, doc: last };
  }

  // ─── Custom fields (token-id, as the builder does) ──────

  async createCustomFieldFolder(name: string): Promise<Record<string, any>> {
    const data = await this.http.request<Record<string, any>>('POST', this.cfPath(), {
      name,
      documentType: 'folder',
      model: 'contact',
    });
    const folder = data?.customFieldFolder;
    if (!folder || !folder.id) {
      throw new Error(`Unexpected custom-field folder response: ${redact(JSON.stringify(data)).slice(0, 300)}`);
    }
    return folder;
  }

  async createCustomField(input: CreateCustomFieldInput): Promise<Record<string, any>> {
    const body: Record<string, unknown> = {
      name: input.name,
      dataType: input.dataType,
      model: 'contact',
      placeholder: input.placeholder ?? '',
    };
    if (input.parentId) body.parentId = input.parentId;
    if (input.options) body.options = input.options;
    if (input.textBoxListOptions) body.textBoxListOptions = input.textBoxListOptions;
    const data = await this.http.request<Record<string, any>>('POST', this.cfPath(), body);
    const field = data?.customField;
    if (!field || !field.id) {
      throw new Error(`Unexpected custom-field response: ${redact(JSON.stringify(data)).slice(0, 300)}`);
    }
    return field;
  }

  /** Deletes a custom field or a folder. */
  async deleteCustomField(id: string): Promise<void> {
    await this.http.request('DELETE', `${this.cfPath()}/${encodeURIComponent(id)}`);
  }

  private cfPath(): string {
    return `/locations/${encodeURIComponent(this.locationId)}/customFields`;
  }

  private unwrap(data: Record<string, unknown>): SurveyDocument {
    const inner = [data?.survey, data?.data].find((v) => v && typeof v === 'object' && '_id' in (v as object));
    if (!inner) {
      throw new Error(`Unexpected surveys API response shape: ${redact(JSON.stringify(data)).slice(0, 300)}`);
    }
    return inner as SurveyDocument;
  }
}
