/**
 * GHL Workflow Builder Client (dynamic, DB-backed).
 *
 * Talks to the hidden internal GHL workflow API at
 * backend.leadconnectorhq.com/workflow. The public GHL API only lists
 * workflows — this client can CREATE, UPDATE, DELETE, PUBLISH and CLONE with
 * full action/trigger support.
 *
 * Auth: `Authorization: Bearer <PIT>` + Firebase `token-id` (refreshed here
 * from a Firebase refresh token). Both the PIT and the Firebase credentials are
 * resolved PER SUB-ACCOUNT from Supabase — nothing comes from process.env or a
 * local token-helper. When the upstream refresh grant rotates a refresh token,
 * we hand it to the `persist` callback so the caller can write the new value
 * back to the database (replacing the source project's .env persistence).
 */

import { randomUUID } from 'crypto';
import { extractMarketplaceModules, toMarketplaceModuleHit } from '../catalog/marketplace-module-slim.js';

// ─── Types ──────────────────────────────────────────────────

export interface WorkflowAction {
  id?: string;
  order?: number;
  name: string;
  type: string;
  attributes?: Record<string, unknown>;
  next?: string | string[] | null;
  parentKey?: string | null;
  parent?: string | null;
  cat?: string;
  nodeType?: string;
  sibling?: string[] | null;
  /** True for third-party marketplace-app actions. The builder's save path REQUIRES
   *  this flag (a native-looking node with a marketplace key fails to save without it). */
  isMarketplaceAction?: boolean;
  /** Per-type instance index the builder assigns to marketplace actions (mirrored in
   *  workflow meta.stepIndexCounter). */
  stepIndex?: number;
  [key: string]: unknown;
}

export interface WorkflowTrigger {
  id?: string;
  status?: 'draft' | 'published';
  type: string;
  name?: string;
  workflowId?: string;
  schedule_config?: Record<string, unknown>;
  conditions?: Record<string, unknown>[];
  masterType?: string;
  actions?: Record<string, unknown>[];
  active?: boolean;
  triggersChanged?: boolean;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WorkflowListItem {
  _id: string;
  name: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowFull {
  _id: string;
  name: string;
  status: string;
  version: number;
  dataVersion?: number;
  timezone?: string;
  workflowData?: {
    templates: WorkflowAction[];
  };
  triggers?: WorkflowTrigger[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/** One entry from the live module list (the builder's action/trigger picker). */
export interface ModuleListEntry {
  value: string; // module key
  label: string; // display name
}

/** Result of a marketplace module search, with the install-filter provenance. */
export interface MarketplaceSearchResult {
  modules: unknown[];
  /** Whether the returned set is the installed-only set (false = fell back to the full catalog). */
  isInstalled: boolean;
  /** True if an installed-only search returned nothing and we retried unfiltered. */
  fellBack: boolean;
}

/** Slim schema facts for a marketplace module, used to validate app-typed actions. */
export interface MarketplaceModuleSchema {
  key: string;
  kind: 'action' | 'trigger';
  requiredFields: string[];
}

/** A real action/trigger payload mined from an existing workflow. */
export interface WorkflowExample {
  kind: 'action' | 'trigger';
  type: string;
  name?: string;
  attributes?: Record<string, unknown>;
  conditions?: unknown;
  schedule_config?: unknown;
  workflowId: string;
  workflowName: string;
}

/** Rotated tokens / derived context handed to the caller to persist (e.g. to Supabase). */
export interface WorkflowCredsPatch {
  firebaseRefreshToken?: string;
  refreshToken?: string;
  authToken?: string;
  /** Resolved GHL company (agency) id — persisted to the sub-account row. */
  companyId?: string;
  /** Resolved GHL user id — persisted to the sub-account row. */
  userId?: string;
}

export interface WorkflowBuilderConfig {
  /**
   * Bearer token for the internal API = the sub-account's Private Integration
   * Token. Empty for OAuth sub-accounts (OAuth location tokens do NOT work on the
   * internal /workflow API), in which case the Firebase id token is used as the
   * Bearer instead — so a workflow client for an OAuth account still requires
   * captured Firebase credentials.
   */
  apiKey: string;
  firebaseApiKey: string;
  firebaseRefreshToken: string;
  /** Current short-lived builder JWT captured from an authorized session. */
  authToken?: string;
  /** v2 JWT refresh token (30-day, preferred over Firebase for marketplace search). */
  refreshToken?: string;
  locationId: string;
  userId?: string;
  companyId?: string;
  companyAge?: number;
  /**
   * Called when a refresh grant rotates a refresh/auth token so the new value
   * can be persisted (e.g. written back to the sub-account row). Best-effort:
   * errors thrown here are swallowed — the token still works for this session.
   */
  persist?: (patch: WorkflowCredsPatch) => void | Promise<void>;
}

// ─── Client ─────────────────────────────────────────────────

export class WorkflowBuilderClient {
  private config: WorkflowBuilderConfig;
  private cachedIdToken: string | null = null;
  private cachedJwt: string | null = null;
  private jwtExpiry: number = 0;
  private firebaseTokenExpiry: number = 0;
  /** Reuse auto-save session ids so back-to-back writes don't fight a pending commit lock. */
  private autoSaveSessions = new Map<string, string>();
  /** Which auth the marketplace endpoint accepted (learned once per session). */
  private marketplaceAuthMode: 'workflow' | 'builder' | null = null;
  /** Cached index of real action/trigger payloads mined from live workflows. */
  private exampleIndex: Map<string, WorkflowExample[]> | null = null;
  /** Cached live module list (the complete set of valid action/trigger keys). */
  private moduleListCache: { actions: ModuleListEntry[]; triggers: ModuleListEntry[] } | null = null;
  /** Cached marketplace (installed-app) module schemas, keyed by module key. */
  private marketplaceModuleCache: Map<string, MarketplaceModuleSchema> | null = null;

  private static readonly API_ORIGIN = 'https://backend.leadconnectorhq.com';
  private static readonly BUILDER_ORIGIN = 'https://client-app-automation-workflows.leadconnectorhq.com';
  private static readonly FIREBASE_TOKEN_URL = 'https://securetoken.googleapis.com/v1/token';
  private static readonly JWT_REFRESH_URL = 'https://services.leadconnectorhq.com/auth/refresh';
  private static readonly TOKEN_TTL_MS = 55 * 60 * 1000; // 55 minutes (tokens last 60)
  private static readonly AUTO_SAVE_LOCK_RETRIES = 3;
  private static readonly AUTO_SAVE_LOCK_BACKOFF_MS = [2000, 5000, 10000];

  constructor(config: WorkflowBuilderConfig) {
    this.config = config;
    if (!config.locationId) {
      throw new Error('WorkflowBuilderClient requires a locationId.');
    }
    if (!config.authToken && !config.refreshToken && (!config.firebaseApiKey || !config.firebaseRefreshToken)) {
      throw new Error(
        'No workflow credentials captured for this sub-account. Run the capture extension so the ' +
          'server can store a Firebase api key + refresh token (or a builder JWT) for this location.'
      );
    }
    if (config.authToken) {
      this.cachedJwt = config.authToken;
      this.jwtExpiry = this.readTokenExpiry(config.authToken) ?? Date.now() + WorkflowBuilderClient.TOKEN_TTL_MS;
    }
  }

  // ─── Auth ───────────────────────────────────────────────

  /**
   * Get authenticated headers.
   * - workflow mode: Firebase token-id when available (CRUD). Builder JWT is NOT used here —
   *   a captured builder Bearer often 401s on /workflow while Firebase works.
   * - builder mode: builder JWT only (marketplace module search)
   */
  private async getHeaders(
    authMode: 'workflow' | 'builder' = 'workflow'
  ): Promise<Record<string, string>> {
    if (authMode === 'builder') {
      return this.getBuilderJwtHeaders();
    }

    const hasFirebase = Boolean(
      this.config.firebaseApiKey && this.config.firebaseRefreshToken
    );
    if (hasFirebase) {
      if (!this.cachedIdToken || Date.now() >= this.firebaseTokenExpiry) {
        await this.refreshFirebaseToken();
      }
      return {
        // PIT accounts: Bearer = PIT. OAuth accounts have no PIT — the /workflow API
        // does not accept an OAuth location token, so the Firebase id token is the
        // Bearer (it is what actually authenticates the internal workflow API).
        'Authorization': `Bearer ${this.config.apiKey || this.cachedIdToken}`,
        'token-id': this.cachedIdToken!,
        'channel': 'APP',
        'source': 'WEB_USER',
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'Version': '2021-07-28',
        'Origin': WorkflowBuilderClient.BUILDER_ORIGIN,
        'Referer': `${WorkflowBuilderClient.BUILDER_ORIGIN}/`,
      };
    }

    // No Firebase: last resort for workflow CRUD is builder JWT.
    return this.getBuilderJwtHeaders();
  }

  private async getBuilderJwtHeaders(): Promise<Record<string, string>> {
    if (!this.config.authToken && !this.config.refreshToken) {
      throw new Error(
        'Workflow catalog discovery requires a captured builder JWT (auth token or refresh token) for this ' +
          'sub-account; Firebase token-id authentication is supported only by workflow CRUD.'
      );
    }

    if (!this.cachedJwt || Date.now() >= this.jwtExpiry) {
      if (!this.config.refreshToken) {
        throw new Error(
          'The captured builder auth token has expired and no builder refresh token is available for this ' +
            'sub-account. Re-run the capture extension, or use Firebase credentials for workflow CRUD.'
        );
      }
      await this.refreshJWT();
    }

    return {
      'Authorization': `Bearer ${this.cachedJwt}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'Version': '2021-07-28',
      'channel': 'APP',
      'source': 'WEB_USER',
      'Origin': WorkflowBuilderClient.BUILDER_ORIGIN,
      'Referer': `${WorkflowBuilderClient.BUILDER_ORIGIN}/`,
    };
  }

  /**
   * Refresh v2 JWT via services.leadconnectorhq.com/auth/refresh.
   * Returns a 1-hour JWT and rotates the 30-day refresh token.
   */
  private async refreshJWT(): Promise<void> {
    const res = await fetch(WorkflowBuilderClient.JWT_REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.config.refreshToken }),
    });

    const data = await res.json() as {
      jwt?: string;
      refreshJwt?: string;
      traceId?: string;
    };

    if ((res.status !== 200 && res.status !== 201) || !data.jwt) {
      throw new Error(
        `JWT refresh failed (${res.status}): ${JSON.stringify(data)}`
      );
    }

    this.cachedJwt = data.jwt;
    this.jwtExpiry =
      this.readTokenExpiry(data.jwt) ?? Date.now() + WorkflowBuilderClient.TOKEN_TTL_MS;

    // Persist rotated refresh token (and the fresh auth token) to the caller's store.
    if (data.refreshJwt && data.refreshJwt !== this.config.refreshToken) {
      this.config.refreshToken = data.refreshJwt;
      this.config.authToken = data.jwt;
      await this.persist({ refreshToken: data.refreshJwt, authToken: data.jwt });
    }
  }

  /**
   * Refresh Firebase token and persist the rotated refresh token.
   */
  private async refreshFirebaseToken(): Promise<void> {
    const url = `${WorkflowBuilderClient.FIREBASE_TOKEN_URL}?key=${this.config.firebaseApiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(this.config.firebaseRefreshToken)}`,
    });

    const data = await res.json() as {
      id_token?: string;
      refresh_token?: string;
      error?: { message: string };
    };

    if (!res.ok || !data.id_token) {
      throw new Error(
        `Firebase token refresh failed (${res.status}): ${data.error?.message || JSON.stringify(data)}`
      );
    }

    this.cachedIdToken = data.id_token;
    this.firebaseTokenExpiry = Date.now() + WorkflowBuilderClient.TOKEN_TTL_MS;

    // Persist rotated refresh token to the caller's store.
    if (data.refresh_token && data.refresh_token !== this.config.firebaseRefreshToken) {
      this.config.firebaseRefreshToken = data.refresh_token;
      await this.persist({ firebaseRefreshToken: data.refresh_token });
    }
  }

  /** Hand a rotated-token patch to the caller. Best-effort: never throws. */
  private async persist(patch: WorkflowCredsPatch): Promise<void> {
    if (!this.config.persist) return;
    try {
      await this.config.persist(patch);
    } catch (err) {
      // Non-fatal — the token still works for this session.
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[WorkflowBuilderClient] Failed to persist rotated token: ${message}`);
    }
  }

  // ─── HTTP Helper ────────────────────────────────────────

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    authMode: 'workflow' | 'builder' = 'workflow'
  ): Promise<{ status: number; data: T }> {
    const headers = await this.getHeaders(authMode);
    const url = `${WorkflowBuilderClient.API_ORIGIN}${path}`;

    const opts: RequestInit = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const text = await res.text();

    let data: T;
    try {
      data = JSON.parse(text);
    } catch {
      data = text as unknown as T;
    }

    if (!res.ok) {
      throw new Error(
        `GHL Workflow API error ${res.status} ${method} ${path}: ${typeof data === 'string' ? data : JSON.stringify(data)}`
      );
    }

    return { status: res.status, data };
  }

  /** Extract the HTTP status embedded in a request() error message, if any. */
  private parseStatus(err: unknown): number | undefined {
    const m = err instanceof Error ? err.message.match(/API error (\d{3})\b/) : null;
    return m ? Number(m[1]) : undefined;
  }

  /**
   * Marketplace request with auth fallback. The marketplace endpoint may accept
   * the durable Firebase token-id or require the agency builder JWT — we don't
   * assume. Try Firebase first (self-renewing, per sub-account), fall back to the
   * builder JWT on 401/403, and remember whichever mode worked for the session.
   */
  private async requestMarketplace<T = unknown>(path: string): Promise<{ status: number; data: T }> {
    const hasFirebase = Boolean(this.config.firebaseApiKey && this.config.firebaseRefreshToken);
    const hasBuilder = Boolean(this.config.authToken || this.config.refreshToken);

    if (this.marketplaceAuthMode) {
      return this.request<T>('GET', path, undefined, this.marketplaceAuthMode);
    }

    const order: Array<'workflow' | 'builder'> = [];
    if (hasFirebase) order.push('workflow');
    if (hasBuilder) order.push('builder');
    if (order.length === 0) {
      // Neither available — let the builder path throw its standard "no creds" error.
      return this.request<T>('GET', path, undefined, 'builder');
    }

    let lastErr: unknown;
    for (let i = 0; i < order.length; i++) {
      try {
        const res = await this.request<T>('GET', path, undefined, order[i]);
        this.marketplaceAuthMode = order[i]; // remember the mode that worked
        return res;
      } catch (err) {
        lastErr = err;
        const status = this.parseStatus(err);
        const isAuthError = status === 401 || status === 403;
        const hasNext = i < order.length - 1;
        if (!isAuthError || !hasNext) throw err;
      }
    }
    throw lastErr;
  }

  // ─── API Methods ────────────────────────────────────────

  /**
   * Create an empty workflow.
   */
  async createWorkflow(name: string): Promise<{ id: string }> {
    const context = await this.getWriteContext();
    const { data } = await this.request<{ id: string }>(
      'POST',
      `/workflow/${this.config.locationId}`,
      {
        name,
        status: 'draft',
        parentId: null,
        updatedBy: context.userId,
        modifiedSteps: [],
        deletedSteps: [],
        createdSteps: [],
        senderAddress: {},
        stopOnResponse: false,
        allowMultiple: false,
        allowMultipleOpportunity: true,
        autoMarkAsRead: false,
        eventStartDate: '',
        timezone: '',
        workflowData: { templates: [] },
        triggersChanged: false,
        company_id: context.companyId,
        company_age: context.companyAge,
      }
    );
    return data;
  }

  /**
   * Get a workflow with full workflowData (actions, triggers, etc.)
   */
  async getWorkflow(workflowId: string): Promise<WorkflowFull> {
    const { data } = await this.request<WorkflowFull>(
      'GET',
      `/workflow/${this.config.locationId}/${workflowId}?includeScheduledPauseInfo=true`
    );
    return data;
  }

  /**
   * List workflows with full data.
   */
  async listWorkflows(opts?: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ rows: WorkflowListItem[]; total: number }> {
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    const sortBy = opts?.sortBy ?? 'name';
    const sortOrder = opts?.sortOrder ?? 'asc';

    const query = `type=workflow&limit=${limit}&offset=${offset}&sortBy=${sortBy}&sortOrder=${sortOrder}&includeCustomObjects=true&includeObjectiveBuilder=true`;

    const { data } = await this.request<{ rows: WorkflowListItem[]; total?: number; count?: number }>(
      'GET',
      `/workflow/${this.config.locationId}/list?${query}`
    );
    return { rows: data.rows || [], total: data.total ?? data.count ?? 0 };
  }

  /**
   * Update a workflow. Step graphs are committed the same way as the CRM builder
   * (validate-assets → PUT). Triggers are separate records written through trigger CRUD.
   */
  async updateWorkflow(
    workflowId: string,
    update: {
      name?: string;
      status?: 'draft' | 'published';
      actions?: WorkflowAction[];
      triggers?: WorkflowTrigger[];
      deletedSteps?: string[];
    }
  ): Promise<WorkflowFull> {
    let current = await this.getWorkflow(workflowId);

    if (update.actions || update.name) {
      current = await this.saveWorkflowBody(
        workflowId,
        update.actions || current.workflowData?.templates || [],
        update.name
      );
    }

    if (update.triggers) {
      await this.replaceWorkflowTriggers(workflowId, update.triggers);
    }

    if (update.status === 'published') {
      current = await this.publishWorkflow(workflowId);
    } else if (update.status === 'draft' && current.status === 'published') {
      current = await this.setWorkflowStatus(workflowId, 'draft');
    }

    const fresh = await this.getWorkflow(workflowId);
    fresh.triggers = await this.listWorkflowTriggers(workflowId);
    return fresh;
  }

  /**
   * Commit the action graph the way the CRM builder does:
   * 1) POST /workflow/{locationId}/validate-assets
   * 2) PUT /workflow/{locationId}/{workflowId}
   *
   * Reuses autoSaveSessionId when present. Retries commit-lock 422s with backoff.
   */
  async saveWorkflowBody(
    workflowId: string,
    rawActions: WorkflowAction[],
    name?: string
  ): Promise<WorkflowFull> {
    const actions = this.buildActionChain(rawActions);
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= WorkflowBuilderClient.AUTO_SAVE_LOCK_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay =
          WorkflowBuilderClient.AUTO_SAVE_LOCK_BACKOFF_MS[
            Math.min(attempt - 1, WorkflowBuilderClient.AUTO_SAVE_LOCK_BACKOFF_MS.length - 1)
          ];
        await this.sleep(delay);
      }

      const current = await this.getWorkflow(workflowId);
      const context = await this.getWriteContext(current);
      const triggers = await this.listWorkflowTriggers(workflowId);
      const validation = await this.validateWorkflowAssets(actions, triggers, context.companyId);
      const issues = this.extractValidationIssues(validation);
      if (issues.length) {
        // Validation won't change across retries — fail fast with actionable detail
        // so the caller can fix the action attributes (use crm_find_workflow_examples
        // for a real payload, or crm_validate_workflow to iterate).
        throw new Error(`Workflow validation failed before commit: ${issues.join('; ')}`);
      }
      const body = this.buildCommitBody(workflowId, current, actions, name, context, triggers);

      try {
        const { data } = await this.request<WorkflowFull>(
          'PUT',
          `/workflow/${this.config.locationId}/${workflowId}`,
          body
        );

        const sessionId = body.autoSaveSessionId;
        if (typeof sessionId === 'string') {
          this.autoSaveSessions.set(workflowId, sessionId);
        }
        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        lastError = error;
        if (!this.isAutoSaveCommitLockError(error) || attempt === WorkflowBuilderClient.AUTO_SAVE_LOCK_RETRIES) {
          if (this.isAutoSaveCommitLockError(error)) {
            throw new Error(
              `${error.message} — CRM still has a pending workflow commit lock. ` +
                `Do not rapid-retry. Wait 2–3 minutes with the builder closed, ` +
                `or open the workflow in the CRM builder, save once, close it, then retry once.`
            );
          }
          throw error;
        }
        this.autoSaveSessions.delete(workflowId);
      }
    }

    throw lastError || new Error('Workflow commit failed.');
  }

  /**
   * Builder preflight used before every action/trigger save.
   */
  async validateWorkflowAssets(
    templates: WorkflowAction[],
    triggers: WorkflowTrigger[],
    companyId: string
  ): Promise<unknown> {
    const { data } = await this.request(
      'POST',
      `/workflow/${this.config.locationId}/validate-assets`,
      {
        templates,
        triggers,
        companyId,
      }
    );
    return data;
  }

  /**
   * Dry-run a workflow graph: build the action chain and run the builder's
   * validate-assets preflight WITHOUT committing. Lets the caller iterate
   * build → validate → fix → create before writing anything.
   */
  async validateWorkflow(
    rawActions: WorkflowAction[],
    triggers: WorkflowTrigger[] = []
  ): Promise<{ valid: boolean; issues: string[]; raw: unknown }> {
    const actions = this.buildActionChain(rawActions);
    const context = await this.getWriteContext();
    const raw = await this.validateWorkflowAssets(actions, triggers, context.companyId);
    const issues = this.extractValidationIssues(raw);
    return { valid: issues.length === 0, issues, raw };
  }

  /**
   * Best-effort extraction of validation problems from validate-assets' 200 body.
   * The exact shape is undocumented, so we probe the common ones. A non-2xx
   * response is already surfaced by request() throwing with the body.
   */
  private extractValidationIssues(result: unknown): string[] {
    const issues: string[] = [];
    const rec = result && typeof result === 'object' ? (result as Record<string, unknown>) : null;
    if (!rec) return issues;
    if (rec.valid === false || rec.isValid === false) issues.push('validate-assets reported the graph invalid');

    const collect = (v: unknown) => {
      if (!Array.isArray(v)) return;
      for (const e of v) {
        if (typeof e === 'string') issues.push(e);
        else if (e && typeof e === 'object') {
          const r = e as Record<string, unknown>;
          const msg = r.message || r.error || r.reason || r.detail;
          issues.push(typeof msg === 'string' ? msg : JSON.stringify(e));
        }
      }
    };
    collect(rec.errors);
    collect(rec.issues);
    collect(rec.invalid);
    collect(rec.invalidActions);
    collect(rec.invalidTriggers);
    return issues;
  }

  // ─── Example mining ─────────────────────────────────────

  /**
   * Build (once per session) an index of real action/trigger payloads from the
   * agency's own workflows. This is the ground-truth source for dynamic-field
   * values and third-party modules the static catalog can't describe.
   */
  private async buildExampleIndex(maxWorkflows: number): Promise<Map<string, WorkflowExample[]>> {
    if (this.exampleIndex) return this.exampleIndex;

    const index = new Map<string, WorkflowExample[]>();
    const push = (type: string | undefined, ex: WorkflowExample) => {
      if (!type) return;
      const list = index.get(type) || [];
      list.push(ex);
      index.set(type, list);
    };

    const { rows } = await this.listWorkflows({ limit: Math.min(Math.max(maxWorkflows, 1), 100) });
    for (const row of rows.slice(0, maxWorkflows)) {
      const id = row._id;
      if (!id) continue;
      let wf: WorkflowFull;
      try {
        wf = await this.getWorkflow(id);
      } catch {
        continue;
      }
      const workflowName = wf.name || row.name || id;
      for (const a of wf.workflowData?.templates || []) {
        push(a.type, {
          kind: 'action',
          type: a.type,
          name: a.name,
          attributes: a.attributes,
          workflowId: id,
          workflowName,
        });
      }
      try {
        const triggers = await this.listWorkflowTriggers(id);
        for (const t of triggers) {
          push(t.type, {
            kind: 'trigger',
            type: t.type,
            name: t.name,
            conditions: t.conditions,
            schedule_config: t.schedule_config,
            workflowId: id,
            workflowName,
          });
        }
      } catch {
        // triggers are optional for the index
      }
    }

    this.exampleIndex = index;
    return index;
  }

  /**
   * Return real, deduped example payloads for one action/trigger `type` (catalog
   * key), mined from the agency's live workflows.
   */
  async findExamples(opts: {
    type: string;
    kind?: 'action' | 'trigger';
    limit?: number;
    maxWorkflows?: number;
    refresh?: boolean;
  }): Promise<{ type: string; workflowsScanned: number; examples: WorkflowExample[] }> {
    if (opts.refresh) this.exampleIndex = null;
    const maxWorkflows = Math.min(Math.max(opts.maxWorkflows ?? 25, 1), 100);
    const limit = Math.min(Math.max(opts.limit ?? 3, 1), 20);

    const index = await this.buildExampleIndex(maxWorkflows);
    let list = index.get(opts.type) || [];
    if (opts.kind) list = list.filter((e) => e.kind === opts.kind);

    const seen = new Set<string>();
    const examples: WorkflowExample[] = [];
    for (const e of list) {
      const shapeKey = JSON.stringify(e.attributes ?? e.conditions ?? {});
      if (seen.has(shapeKey)) continue;
      seen.add(shapeKey);
      examples.push(e);
      if (examples.length >= limit) break;
    }

    const workflowsScanned = new Set(
      Array.from(index.values()).flat().map((e) => e.workflowId)
    ).size;
    return { type: opts.type, workflowsScanned, examples };
  }

  /**
   * Fetch the complete live module list (the builder's action/trigger picker) from
   * backend.leadconnectorhq.com/workflows-marketplace/assets/smartlist/{actions,triggers}.
   * Returns { value: key, label } entries — the authoritative, complete set of valid
   * module keys for this location (far more than the static catalog). Cached per session.
   * Best-effort: a failing endpoint yields an empty list rather than throwing.
   */
  async fetchModuleList(refresh = false): Promise<{ actions: ModuleListEntry[]; triggers: ModuleListEntry[] }> {
    if (this.moduleListCache && !refresh) return this.moduleListCache;
    const loc = this.config.locationId;
    const get = async (kind: 'actions' | 'triggers'): Promise<ModuleListEntry[]> => {
      try {
        const { data } = await this.request<unknown>(
          'GET',
          `/workflows-marketplace/assets/smartlist/${kind}?locationId=${encodeURIComponent(loc)}`
        );
        if (!Array.isArray(data)) return [];
        return data
          .map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}))
          .filter((x) => typeof x.value === 'string' && x.value)
          .map((x) => ({ value: x.value as string, label: typeof x.label === 'string' ? (x.label as string) : (x.value as string) }));
      } catch {
        return [];
      }
    };
    const [actions, triggers] = await Promise.all([get('actions'), get('triggers')]);
    this.moduleListCache = { actions, triggers };
    return this.moduleListCache;
  }

  /**
   * The set of valid NATIVE module keys (actions + triggers) for this location, from
   * the builder's smartlist. This omits installed marketplace-app modules (Todoist,
   * ClickUp, …) — those carry no app context in their key, so they can't be enumerated
   * cheaply and are instead resolved per-workflow-type via resolveMarketplaceModuleSchemas.
   */
  async getKnownModuleKeys(): Promise<Set<string>> {
    const { actions, triggers } = await this.fetchModuleList();
    return new Set([...actions, ...triggers].map((m) => m.value));
  }

  async listWorkflowTriggers(workflowId: string): Promise<WorkflowTrigger[]> {
    const { data } = await this.request<WorkflowTrigger[]>(
      'GET',
      `/workflow/${this.config.locationId}/trigger?workflowId=${encodeURIComponent(workflowId)}`
    );
    return Array.isArray(data) ? data : [];
  }

  async createWorkflowTrigger(
    workflowId: string,
    trigger: WorkflowTrigger
  ): Promise<WorkflowTrigger> {
    const context = await this.getWriteContext();
    const body = {
      status: trigger.status || 'draft',
      workflowId,
      schedule_config: trigger.schedule_config || {},
      conditions: trigger.conditions || [],
      type: trigger.type,
      masterType: trigger.masterType || 'highlevel',
      name: trigger.name || this.humanize(trigger.type),
      actions: trigger.actions || [{ workflow_id: workflowId, type: 'add_to_workflow' }],
      active: trigger.active ?? true,
      triggersChanged: true,
      location_id: this.config.locationId,
      company_id: context.companyId,
      company_age: context.companyAge,
    };

    const { data } = await this.request<{ id: string }>(
      'POST',
      `/workflow/${this.config.locationId}/trigger`,
      body
    );
    if (!data?.id) {
      throw new Error('CRM trigger create returned no trigger ID.');
    }

    const triggers = await this.listWorkflowTriggers(workflowId);
    const created = triggers.find(item =>
      item.id === data.id || (item as Record<string, unknown>)._id === data.id
    );
    if (!created) {
      throw new Error(
        `CRM returned trigger ID ${data.id}, but the trigger was not persisted. Check workflowId casing and trigger fields.`
      );
    }
    return created;
  }

  async deleteWorkflowTrigger(triggerId: string): Promise<void> {
    const context = await this.getWriteContext();
    await this.request(
      'DELETE',
      `/workflow/${this.config.locationId}/trigger/${triggerId}?userId=${encodeURIComponent(context.userId)}`
    );
  }

  /** One raw call to the marketplace module-search endpoint. */
  private async runMarketplaceModuleQuery(options: {
    type: 'actions' | 'triggers';
    query?: string;
    isInstalled: boolean;
    skip?: number;
    limit?: number;
  }): Promise<unknown[]> {
    const context = await this.getWriteContext();
    const query = new URLSearchParams({
      locationId: this.config.locationId,
      companyId: context.companyId,
      type: options.type,
      skip: String(Math.max(0, options.skip ?? 0)),
      limit: String(Math.min(25, Math.max(1, options.limit ?? 8))),
      isInstalled: String(options.isInstalled),
      query: options.query?.trim() || 'null',
    });
    const { data } = await this.requestMarketplace<unknown[]>(
      `/marketplace/core/search/module?${query.toString()}`
    );
    return Array.isArray(data) ? data : [];
  }

  /**
   * Search the marketplace for app modules. GHL's `isInstalled=true` filter can
   * miss genuinely-connected apps (a company/location scope-propagation lag), which
   * previously made every connected-app module look "not found" and forced callers
   * onto force:true. So when an installed-only search comes back empty we retry
   * unfiltered — the module data itself resolves fine that way — and report that we
   * fell back, so connected apps are usable through the normal flow.
   */
  async searchMarketplaceModules(options: {
    type: 'actions' | 'triggers';
    query?: string;
    isInstalled?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<MarketplaceSearchResult> {
    const wantInstalled = options.isInstalled ?? true;
    let modules = await this.runMarketplaceModuleQuery({ ...options, isInstalled: wantInstalled });
    if (wantInstalled && modules.length === 0) {
      const all = await this.runMarketplaceModuleQuery({ ...options, isInstalled: false });
      if (all.length) return { modules: all, isInstalled: false, fellBack: true };
    }
    return { modules, isInstalled: wantInstalled, fellBack: false };
  }

  /** Find one marketplace module by exact key within a search response, as a slim schema. */
  private extractModuleSchema(
    modules: unknown[],
    key: string,
    kind: 'action' | 'trigger'
  ): MarketplaceModuleSchema | null {
    const want = key.trim().toLowerCase();
    for (const appRaw of modules) {
      const app = appRaw && typeof appRaw === 'object' ? (appRaw as Record<string, unknown>) : null;
      if (!app) continue;
      for (const mod of extractMarketplaceModules(app, kind)) {
        const hit = toMarketplaceModuleHit(app, mod, kind);
        if (hit && hit.moduleKey.toLowerCase() === want) {
          return { key: hit.moduleKey, kind, requiredFields: hit.requiredFields };
        }
      }
    }
    return null;
  }

  /**
   * Resolve installed-app (marketplace) module schemas for a SPECIFIC set of keys —
   * the ones a workflow actually uses. A module key like "create_task___________"
   * carries no app context, so it can't be looked up directly; instead we search the
   * marketplace by the key's humanized label ("Create Task"), then the raw key, then
   * the leading token, and match the exact key among the FULL-catalog results
   * (isInstalled:false — the install filter is unreliable and adds nothing when we
   * match by exact key; searching the full catalog reaches app actions AND triggers).
   * Cached per key across the session. Best-effort — unresolved keys are simply absent.
   * Lets the validator (a) accept app-typed actions without force and (b) run
   * required-field checks against the app's own schema.
   */
  async resolveMarketplaceModuleSchemas(want: {
    actions?: string[];
    triggers?: string[];
  }): Promise<Map<string, MarketplaceModuleSchema>> {
    if (!this.marketplaceModuleCache) this.marketplaceModuleCache = new Map();
    const cache = this.marketplaceModuleCache;
    const out = new Map<string, MarketplaceModuleSchema>();

    const resolveKind = async (keys: string[], type: 'actions' | 'triggers'): Promise<void> => {
      const kind = type === 'actions' ? 'action' : 'trigger';
      const seen = new Set<string>();
      for (const raw of keys) {
        const key = (raw || '').trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        if (cache.has(key)) {
          out.set(key, cache.get(key)!);
          continue;
        }
        const queries = [
          this.humanize(key),
          key,
          key.split(/[_-]+/).filter(Boolean)[0] || '',
        ].filter((q, i, a) => q && a.indexOf(q) === i);
        for (const q of queries) {
          try {
            // Search the FULL catalog (isInstalled:false), not the installed-only set.
            // We match by exact key, so the install filter adds no value — and it is
            // unreliable: for triggers it returns a non-empty-but-wrong set (so the
            // empty-fallback never fires) and the wanted app key is simply absent.
            // Going straight to the full catalog reaches app actions AND triggers alike.
            const { modules } = await this.searchMarketplaceModules({ type, query: q, isInstalled: false, limit: 15 });
            const schema = this.extractModuleSchema(modules, key, kind);
            if (schema) {
              cache.set(key, schema);
              out.set(key, schema);
              break;
            }
          } catch {
            /* marketplace unavailable for this query — try the next */
          }
        }
      }
    };

    await resolveKind(want.actions || [], 'actions');
    await resolveKind(want.triggers || [], 'triggers');
    return out;
  }

  /**
   * Delete a workflow.
   */
  async deleteWorkflow(workflowId: string): Promise<void> {
    await this.request('DELETE', `/workflow/${this.config.locationId}/${workflowId}`);
    this.autoSaveSessions.delete(workflowId);
  }

  /**
   * Publish a workflow (set status to published).
   */
  async publishWorkflow(workflowId: string): Promise<WorkflowFull> {
    return this.setWorkflowStatus(workflowId, 'published');
  }

  /**
   * Clone a workflow: GET → create new → PUT with same actions/triggers.
   */
  async cloneWorkflow(workflowId: string, newName?: string): Promise<WorkflowFull> {
    const source = await this.getWorkflow(workflowId);
    const sourceTriggers = await this.listWorkflowTriggers(workflowId);
    const name = newName || `${source.name} (copy)`;

    // Create empty workflow
    const { id: newId } = await this.createWorkflow(name);

    // Remap action IDs to new UUIDs
    const idMap = new Map<string, string>();
    const sourceTemplates = source.workflowData?.templates || [];
    for (const action of sourceTemplates) {
      if (action.id) {
        idMap.set(action.id, randomUUID());
      }
    }

    // Clone actions with remapped IDs
    const clonedActions: WorkflowAction[] = sourceTemplates.map(a => {
      const remapId = (id: string) => idMap.get(id) || id;

      let nextValue: string | string[] | null | undefined;
      if (Array.isArray(a.next)) {
        nextValue = a.next.map(remapId);
      } else if (typeof a.next === 'string') {
        nextValue = remapId(a.next);
      } else if (a.next === null) {
        nextValue = null;
      } else {
        nextValue = undefined;
      }

      return {
        ...a,
        id: a.id ? idMap.get(a.id) || randomUUID() : randomUUID(),
        next: nextValue,
        parentKey: a.parentKey ? remapId(a.parentKey) : undefined,
        parent: a.parent ? remapId(a.parent) : undefined,
        sibling: Array.isArray(a.sibling)
          ? a.sibling.map(remapId)
          : undefined,
      };
    });

    // Clone triggers with remapped targetActionId
    const clonedTriggers: WorkflowTrigger[] = sourceTriggers.map(t => ({
      id: randomUUID(),
      type: t.type,
      name: t.name,
      status: 'draft',
      schedule_config: t.schedule_config,
      conditions: t.conditions,
      masterType: t.masterType,
      active: t.active,
    }));

    // Update with cloned data
    return this.updateWorkflow(newId, {
      actions: clonedActions,
      triggers: clonedTriggers.length > 0 ? clonedTriggers : undefined,
    });
  }

  // ─── Helpers ────────────────────────────────────────────

  private buildCommitBody(
    workflowId: string,
    current: WorkflowFull,
    actions: WorkflowAction[],
    name: string | undefined,
    context: { userId: string; companyId: string; companyAge: number },
    triggers: WorkflowTrigger[]
  ): Record<string, unknown> {
    const currentIds = new Set(
      (current.workflowData?.templates || []).map(action => action.id).filter(Boolean)
    );
    const nextIds = new Set(actions.map(action => action.id).filter(Boolean));
    const createdSteps = actions
      .map(action => action.id)
      .filter((id): id is string => !!id && !currentIds.has(id));
    const modifiedSteps = actions
      .map(action => action.id)
      .filter((id): id is string => !!id && currentIds.has(id));
    const deletedSteps = (current.workflowData?.templates || [])
      .map(action => action.id)
      .filter((id): id is string => !!id && !nextIds.has(id));

    const autoSaveSessionId = this.resolveAutoSaveSessionId(workflowId, current);

    // Marketplace actions carry a per-type stepIndex; the builder mirrors the max
    // per type in meta.stepIndexCounter. Merge over whatever the workflow already has.
    const currentMeta = (current.meta && typeof current.meta === 'object' ? current.meta : {}) as Record<string, unknown>;
    const stepIndexCounter: Record<string, number> = {
      ...((currentMeta.stepIndexCounter as Record<string, number> | undefined) || {}),
    };
    for (const action of actions) {
      if (action?.isMarketplaceAction && typeof action.stepIndex === 'number' && typeof action.type === 'string') {
        stepIndexCounter[action.type] = Math.max(stepIndexCounter[action.type] || 0, action.stepIndex);
      }
    }
    const meta = Object.keys(stepIndexCounter).length ? { ...currentMeta, stepIndexCounter } : currentMeta;

    const body: Record<string, unknown> = {
      ...current,
      meta,
      _id: current._id || workflowId,
      id: workflowId,
      locationId: this.config.locationId,
      companyId: context.companyId,
      companyAge: context.companyAge,
      name: name || current.name,
      status: current.status === 'published' ? 'draft' : (current.status || 'draft'),
      version: current.version,
      dataVersion: current.dataVersion ?? 7,
      type: current.type || 'workflow',
      parentId: current.parentId ?? null,
      timezone: current.timezone || 'account',
      allowMultiple: current.allowMultiple ?? false,
      allowMultipleOpportunity: current.allowMultipleOpportunity ?? true,
      removeContactFromLastStep: current.removeContactFromLastStep ?? true,
      stopOnResponse: current.stopOnResponse ?? false,
      autoMarkAsRead: current.autoMarkAsRead ?? false,
      scheduledPauseDates: current.scheduledPauseDates || [],
      senderAddress: current.senderAddress || {},
      eventStartDate: current.eventStartDate || '',
      updatedBy: context.userId,
      triggersChanged: false,
      autoSaveSessionId,
      createdSteps,
      modifiedSteps,
      deletedSteps,
      oldTriggers: triggers,
      newTriggers: triggers,
      workflowData: { templates: actions },
    };

    // Builder commit uses flat autoSaveSessionId, not the nested auto-save payload.
    delete body.autoSaveSession;
    delete body.isAutoSave;
    delete body.triggers;
    delete body.lockedBy;
    delete body.lock;
    delete body.pendingCommit;

    return body;
  }

  private resolveAutoSaveSessionId(workflowId: string, current: WorkflowFull): string {
    if (typeof current.autoSaveSessionId === 'string' && current.autoSaveSessionId) {
      this.autoSaveSessions.set(workflowId, current.autoSaveSessionId);
      return current.autoSaveSessionId;
    }

    const nested = current.autoSaveSession;
    if (
      nested &&
      typeof nested === 'object' &&
      typeof (nested as { id?: unknown }).id === 'string'
    ) {
      const id = (nested as { id: string }).id;
      this.autoSaveSessions.set(workflowId, id);
      return id;
    }

    const cachedId = this.autoSaveSessions.get(workflowId);
    if (cachedId) return cachedId;

    const id = randomUUID();
    this.autoSaveSessions.set(workflowId, id);
    return id;
  }

  private isAutoSaveCommitLockError(error: Error): boolean {
    return (
      /\b422\b/.test(error.message) &&
      /try again|sometime|after some|lock|pending|busy|conflict|session/i.test(error.message)
    );
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  private async replaceWorkflowTriggers(
    workflowId: string,
    triggers: WorkflowTrigger[]
  ): Promise<void> {
    const existing = await this.listWorkflowTriggers(workflowId);
    for (const trigger of existing) {
      const triggerId = trigger.id || (trigger as Record<string, unknown>)._id;
      if (typeof triggerId === 'string') {
        await this.deleteWorkflowTrigger(triggerId);
      }
    }
    for (const trigger of triggers) {
      await this.createWorkflowTrigger(workflowId, trigger);
    }
  }

  private async setWorkflowStatus(
    workflowId: string,
    status: 'draft' | 'published'
  ): Promise<WorkflowFull> {
    const current = await this.getWorkflow(workflowId);
    const body = { ...current, status };
    delete (body as Record<string, unknown>).autoSaveSession;
    delete (body as Record<string, unknown>).autoSaveSessionId;
    delete (body as Record<string, unknown>).isAutoSave;
    const { data } = await this.request<WorkflowFull>(
      'PUT',
      `/workflow/${this.config.locationId}/${workflowId}`,
      body
    );
    this.autoSaveSessions.delete(workflowId);
    return data;
  }

  private async getWriteContext(current?: WorkflowFull): Promise<{
    userId: string;
    companyId: string;
    companyAge: number;
  }> {
    // Ensure a token exists before attempting to derive user claims from it.
    await this.getHeaders();

    // user id: prefer the stored value, else the token claim. Persist a freshly
    // derived value so we don't re-decode every session.
    let userId = this.config.userId || this.readJwtClaim(
      ['authClassId', 'user_id', 'userId', 'sub']
    );
    if (userId && !this.config.userId) {
      this.config.userId = userId;
      await this.persist({ userId });
    }

    let companyId = this.config.companyId ||
      (typeof current?.companyId === 'string' ? current.companyId : undefined) ||
      (typeof current?.company_id === 'string' ? current.company_id : undefined);
    let companyAge = this.config.companyAge;
    if (companyAge === undefined) {
      const candidate = current?.companyAge ?? current?.company_age;
      if (typeof candidate === 'number') companyAge = candidate;
    }

    // Authoritative company id from the location itself (via the PIT) — works even
    // with zero existing workflows, and doesn't depend on the browser scrape.
    // Resolved once, then persisted to the sub-account row.
    if (!companyId) {
      const fromLocation = await this.resolveCompanyIdFromLocation();
      if (fromLocation) {
        companyId = fromLocation;
        this.config.companyId = fromLocation;
        await this.persist({ companyId: fromLocation });
      }
    }

    // Fallback: read from an existing workflow row (also the source for companyAge).
    if (!companyId || companyAge === undefined) {
      const result = await this.listWorkflows({ limit: 1 });
      const row = result.rows[0] as WorkflowListItem & Record<string, unknown> | undefined;
      if (!companyId && typeof row?.companyId === 'string') companyId = row.companyId;
      if (!companyId && typeof row?.company_id === 'string') companyId = row.company_id;
      if (companyAge === undefined && typeof row?.companyAge === 'number') companyAge = row.companyAge;
      if (companyAge === undefined && typeof row?.company_age === 'number') companyAge = row.company_age;
    }

    if (!userId) {
      throw new Error('Workflow writes require a captured GHL user id or a JWT containing authClassId.');
    }
    if (!companyId) {
      throw new Error('Workflow writes and module search require a GHL company id (could not resolve from the location or existing workflows).');
    }

    return { userId, companyId, companyAge: companyAge ?? 12 };
  }

  /**
   * Resolve the owning company (agency) id from the sub-account's location via the
   * PUBLIC API, using the PIT we already hold. Authoritative and independent of the
   * browser capture or any existing workflows. Best-effort — returns undefined on
   * any error (caller falls back to workflow rows).
   */
  private async resolveCompanyIdFromLocation(): Promise<string | undefined> {
    try {
      const res = await fetch(`https://services.leadconnectorhq.com/locations/${this.config.locationId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          Version: '2021-07-28',
          Accept: 'application/json',
        },
      });
      if (!res.ok) return undefined;
      const data = (await res.json()) as Record<string, unknown>;
      const loc = (data.location as Record<string, unknown> | undefined) ?? data;
      const companyId = loc?.companyId ?? loc?.company_id;
      return typeof companyId === 'string' && companyId ? companyId : undefined;
    } catch {
      return undefined;
    }
  }

  private readJwtClaim(names: string[]): string | undefined {
    const token = this.cachedJwt || this.cachedIdToken;
    if (!token) return undefined;
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as Record<string, unknown>;
      for (const name of names) {
        if (typeof payload[name] === 'string' && payload[name]) return payload[name] as string;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  private readTokenExpiry(token: string): number | undefined {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as Record<string, unknown>;
      return typeof payload.exp === 'number' ? payload.exp * 1000 - 60_000 : undefined;
    } catch {
      return undefined;
    }
  }

  private humanize(value: string): string {
    return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  }

  /**
   * Chain raw actions with next/parentKey linkages.
   * If actions already have next/parentKey set, preserves them (for branching).
   */
  private buildActionChain(rawActions: WorkflowAction[]): WorkflowAction[] {
    // First pass: assign IDs and basic structure
    const withIds = rawActions.map((a, i) => ({
      ...a,
      id: a.id || randomUUID(),
      order: a.order ?? i,
      attributes: a.attributes || {},
    }));

    // Second pass: wire up next/parentKey for actions that don't have explicit linkage
    const linked = withIds.map((a, i, arr) => {
      const original = rawActions[i];
      const hasExplicitNext = original.next !== undefined;
      const hasExplicitParent = original.parentKey !== undefined;

      let nextValue: string | string[] | null | undefined;
      if (hasExplicitNext) {
        nextValue = original.next;
      } else if (i < arr.length - 1) {
        nextValue = arr[i + 1].id!;
      } else {
        nextValue = null;
      }

      return {
        ...a,
        next: nextValue,
        parentKey: hasExplicitParent
          ? a.parentKey
          : (i > 0 ? arr[i - 1].id! : null),
      };
    }).map(a => a as WorkflowAction);

    return this.stampMarketplaceActions(linked);
  }

  /**
   * Third-party (marketplace-app) actions need extra shape the builder's save path
   * requires — without it the builder rejects an otherwise-valid node ("saves via
   * API but fails in the UI"). For each action flagged `isMarketplaceAction`:
   *   - echo `type` and ensure `__customInputs__` inside `attributes`,
   *   - assign a per-type `stepIndex` (1-based, continuing past any existing index).
   * The matching meta.stepIndexCounter is written in buildCommitBody.
   */
  private stampMarketplaceActions(actions: WorkflowAction[]): WorkflowAction[] {
    // Seed per-type counters from any stepIndex already present (updates/clones).
    const counters: Record<string, number> = {};
    for (const a of actions) {
      if (a?.isMarketplaceAction && typeof a.stepIndex === 'number' && typeof a.type === 'string') {
        counters[a.type] = Math.max(counters[a.type] || 0, a.stepIndex);
      }
    }

    return actions.map((a) => {
      if (!a?.isMarketplaceAction || typeof a.type !== 'string') return a;
      const attrs = (a.attributes && typeof a.attributes === 'object' ? a.attributes : {}) as Record<string, unknown>;
      const stepIndex =
        typeof a.stepIndex === 'number' ? a.stepIndex : (counters[a.type] = (counters[a.type] || 0) + 1);
      return {
        ...a,
        stepIndex,
        attributes: {
          __customInputs__: {},
          ...attrs,
          type: a.type, // the builder expects the module key echoed inside attributes
        },
      };
    });
  }

  /**
   * Get location ID being used.
   */
  getLocationId(): string {
    return this.config.locationId;
  }

  /**
   * Get user ID being used.
   */
  getUserId(): string | undefined {
    return this.config.userId;
  }
}
