/**
 * GHL Surveys Builder Client (internal API).
 *
 * Talks to the internal survey-builder endpoints on services.leadconnectorhq.com/surveys/.
 * The public API only lists surveys and submissions. This first cut is read-only
 * (get), used to capture a builder-saved reference document before any write path
 * is built. See docs/api-notes.md.
 *
 * Auth is the same as the forms builder (owner capture, 2026-09-25):
 *   channel: APP · source: WEB_USER · version: 2021-07-28 · token-id: <Firebase ID token>
 * No Authorization header is sent.
 */

import type { IdTokenProvider } from './forms-builder-client.js';

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
  form?: Record<string, unknown>;
  slides?: SurveySlide[];
  [key: string]: unknown;
}

export interface SurveySlide {
  id: string;
  slideName?: string;
  slideData?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export class SurveysApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'SurveysApiError';
  }
}

const DEFAULT_BASE_URL = 'https://services.leadconnectorhq.com';

export class SurveysBuilderClient {
  readonly locationId: string;
  private readonly getIdToken: IdTokenProvider;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: SurveysBuilderConfig) {
    if (!config.locationId) throw new Error('SurveysBuilderClient requires a locationId.');
    this.locationId = config.locationId;
    this.getIdToken = config.getIdToken;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.fetchImpl = config.fetchImpl || fetch;
  }

  async getSurvey(surveyId: string): Promise<SurveyDocument> {
    const data = await this.request<Record<string, unknown>>('GET', `/surveys/${encodeURIComponent(surveyId)}`);
    return this.unwrap(data);
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
    // Expired ID token → 401 "Unauthorized: E003"; mint a fresh one once.
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
      throw new SurveysApiError(
        `GHL Surveys API ${method} ${path.split('?')[0]} failed (${res.status}): ${redact(detail).slice(0, 800)}`,
        res.status
      );
    }
    return data as T;
  }

  /** GET and create wrap the document in { survey }; update and delete wrap it in { data }. */
  private unwrap(data: Record<string, unknown>): SurveyDocument {
    const inner = [data?.survey, data?.data].find((v) => v && typeof v === 'object' && '_id' in (v as object));
    if (!inner) {
      throw new Error(`Unexpected surveys API response shape: ${redact(JSON.stringify(data)).slice(0, 300)}`);
    }
    return inner as SurveyDocument;
  }
}

function redact(s: string): string {
  return s.replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '***');
}
