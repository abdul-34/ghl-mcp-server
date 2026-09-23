/**
 * CRMClient — a thin, original client for the HighLevel (LeadConnector) v2 API.
 *
 * Written from the public API surface (services.leadconnectorhq.com). It is a
 * generic Bearer-token HTTP wrapper: tools call `request()` (or the get/post/
 * put/delete helpers) with a path + payload. Each client instance is bound to a
 * single sub-account's Private Integration Token and location id.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { WorkflowBuilderClient } from './workflow-builder-client.js';
import { FormsBuilderClient } from './forms-builder-client.js';

export interface CRMClientConfig {
  /**
   * Bearer token for this sub-account. For PIT auth this is the static, long-lived
   * Private Integration Token. When `getAccessToken` is provided (OAuth), this may
   * be an initial/empty value — the provider supplies a fresh token per request.
   */
  accessToken: string;
  /** Sub-account (location) id this client acts on. */
  locationId: string;
  baseUrl?: string;
  version?: string;
  /**
   * Optional per-request Bearer provider. When present, the Authorization header
   * is set on EVERY request from this callback instead of being baked in at
   * construction — this is what lets a short-lived OAuth token refresh mid-session
   * without dropping the MCP connection. When absent, behavior is the original
   * static-header path (PIT / stdio), fully backward-compatible.
   */
  getAccessToken?: () => Promise<string>;
  /**
   * Lazily resolve the sibling internal-API workflow client for this
   * sub-account. Injected by the pool; absent for direct/stdio clients. Throws
   * inside `workflowBuilder()` if the sub-account has no captured workflow creds.
   */
  getWorkflowBuilder?: () => WorkflowBuilderClient;
  /**
   * Lazily resolve the internal forms-builder client for this sub-account.
   * Injected by the pool; it authenticates with the same captured Firebase session.
   */
  getFormsBuilder?: () => FormsBuilderClient;
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
  private readonly getWorkflowBuilder?: () => WorkflowBuilderClient;
  private readonly getFormsBuilder?: () => FormsBuilderClient;

  constructor(config: CRMClientConfig) {
    if (!config.accessToken && !config.getAccessToken) {
      throw new Error('CRMClient: accessToken or getAccessToken is required.');
    }
    if (!config.locationId) throw new Error('CRMClient: locationId is required.');

    this.locationId = config.locationId;
    this.getWorkflowBuilder = config.getWorkflowBuilder;
    this.getFormsBuilder = config.getFormsBuilder;

    const headers: Record<string, string> = {
      Version: config.version || DEFAULT_VERSION,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    // Static-token path (PIT/stdio): bake the Bearer once. Provider path (OAuth):
    // leave it off and set it per request via the interceptor below.
    if (!config.getAccessToken) headers.Authorization = `Bearer ${config.accessToken}`;

    this.http = axios.create({
      baseURL: config.baseUrl || DEFAULT_BASE_URL,
      timeout: 30_000,
      headers,
    });

    if (config.getAccessToken) {
      const provider = config.getAccessToken;
      this.http.interceptors.request.use(async (cfg) => {
        const token = await provider();
        cfg.headers.set('Authorization', `Bearer ${token}`);
        return cfg;
      });
    }
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
   * The sibling client for GHL's internal workflow-builder API, scoped to the
   * same sub-account. Throws a friendly error when the pool did not inject one
   * (stdio/direct clients) or the sub-account has no captured workflow creds.
   */
  workflowBuilder(): WorkflowBuilderClient {
    if (!this.getWorkflowBuilder) {
      throw new Error(
        `Workflow tools are unavailable for location "${this.locationId}": no captured workflow ` +
          `credentials. Run the capture extension against this sub-account, or connect via a link URL.`
      );
    }
    return this.getWorkflowBuilder();
  }

  /**
   * The sibling client for GHL's internal forms-builder API (create/update/delete
   * forms), scoped to the same sub-account. Requires the captured Firebase session.
   */
  formsBuilder(): FormsBuilderClient {
    if (!this.getFormsBuilder) {
      throw new Error(
        `Forms builder tools are unavailable for location "${this.locationId}": no captured Firebase ` +
          `credentials. Run the capture extension once on any logged-in CRM tab, or connect via a link URL.`
      );
    }
    return this.getFormsBuilder();
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
