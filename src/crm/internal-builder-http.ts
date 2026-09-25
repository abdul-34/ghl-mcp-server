/**
 * Shared HTTP layer for GHL's internal builder APIs (forms, surveys).
 *
 * Auth (verified header matrix, forms blueprint Addendum A; same for surveys):
 *   channel: APP · source: WEB_USER · version: 2021-07-28 · token-id: <Firebase ID token>
 * All four are individually mandatory. A Bearer header is ignored when sent
 * alongside token-id and rejected when sent instead of it, so we don't send one.
 */

export type IdTokenProvider = (forceRefresh?: boolean) => Promise<string>;

export interface InternalHttpConfig {
  getIdToken: IdTokenProvider;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Prefix for error messages, e.g. "GHL Forms API". */
  label: string;
  /** Builds the thrown error so each client keeps its own error class. */
  makeError: (message: string, status: number) => Error;
}

const DEFAULT_BASE_URL = 'https://services.leadconnectorhq.com';

export class InternalBuilderHttp {
  private readonly getIdToken: IdTokenProvider;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly label: string;
  private readonly makeError: InternalHttpConfig['makeError'];

  constructor(config: InternalHttpConfig) {
    this.getIdToken = config.getIdToken;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.fetchImpl = config.fetchImpl || fetch;
    this.label = config.label;
    this.makeError = config.makeError;
  }

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

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const send = async (forceRefresh: boolean) => {
      const init: RequestInit = { method, headers: await this.headers(forceRefresh) };
      if (body !== undefined) init.body = JSON.stringify(body);
      return this.fetchImpl(`${this.baseUrl}${path}`, init);
    };

    let res = await send(false);
    // A cached token can expire or be revoked before its nominal expiry; mint a fresh one once.
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
      throw this.makeError(
        `${this.label} ${method} ${path.split('?')[0]} failed (${res.status}): ${redact(detail).slice(0, 800)}`,
        res.status
      );
    }
    return data as T;
  }
}

/** Strip anything JWT-shaped before it can reach the caller (the LLM). */
export function redact(s: string): string {
  return s.replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '***');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
