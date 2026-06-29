/**
 * CRMClient — a thin, original client for the HighLevel (LeadConnector) v2 API.
 *
 * Written from the public API surface (services.leadconnectorhq.com). It is a
 * generic Bearer-token HTTP wrapper: tools call `request()` (or the get/post/
 * put/delete helpers) with a path + payload. Each client instance is bound to a
 * single sub-account's Private Integration Token and location id.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

export interface CRMClientConfig {
  /** Bearer token (Private Integration Token) for this sub-account. */
  accessToken: string;
  /** Sub-account (location) id this client acts on. */
  locationId: string;
  baseUrl?: string;
  version?: string;
}

const DEFAULT_BASE_URL = 'https://services.leadconnectorhq.com';
const DEFAULT_VERSION = '2021-07-28';

export interface RequestOptions {
  params?: Record<string, unknown>;
  data?: unknown;
  /** Per-request header overrides (e.g. a different API `Version`). */
  headers?: Record<string, string>;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class CRMClient {
  readonly locationId: string;
  private readonly http: AxiosInstance;

  constructor(config: CRMClientConfig) {
    if (!config.accessToken) throw new Error('CRMClient: accessToken is required.');
    if (!config.locationId) throw new Error('CRMClient: locationId is required.');

    this.locationId = config.locationId;
    this.http = axios.create({
      baseURL: config.baseUrl || DEFAULT_BASE_URL,
      timeout: 30_000,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        Version: config.version || DEFAULT_VERSION,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  async request<T = unknown>(method: HttpMethod, path: string, opts: RequestOptions = {}): Promise<T> {
    try {
      const res = await this.http.request<T>({
        method,
        url: path,
        params: opts.params,
        data: opts.data,
        headers: opts.headers,
      });
      return res.data;
    } catch (err) {
      throw this.toCleanError(err, method, path);
    }
  }

  get<T = unknown>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('GET', path, { params });
  }
  post<T = unknown>(path: string, data?: unknown, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('POST', path, { data, params });
  }
  put<T = unknown>(path: string, data?: unknown, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('PUT', path, { data, params });
  }
  delete<T = unknown>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('DELETE', path, { params });
  }

  /**
   * Turn an axios error into a compact, credential-safe Error. We never echo
   * the Authorization header or raw token back to the caller (the LLM).
   */
  private toCleanError(err: unknown, method: string, path: string): Error {
    const axErr = err as AxiosError;
    if (axErr?.isAxiosError) {
      const status = axErr.response?.status;
      const body = axErr.response?.data;
      const detail =
        typeof body === 'string'
          ? body
          : body
          ? JSON.stringify(body)
          : axErr.message;
      const safe = String(detail).replace(/Bearer\s+[^\s"']+/gi, 'Bearer ***');
      return new Error(`CRM API ${method} ${path} failed${status ? ` (${status})` : ''}: ${safe}`);
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
