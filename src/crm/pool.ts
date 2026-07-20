/**
 * CRMClientPool — one CRMClient per sub-account, for a single MCP session.
 *
 * A pool is built from a resolved MCP link (see db/supabase-store.ts):
 *   - agency scope   → every sub-account the owner stored.
 *   - location scope → exactly one sub-account; `has()` rejects any other id,
 *                      which is the isolation boundary for per-client URLs.
 *
 * Private Integration Tokens are long-lived, so clients are created directly
 * from the decrypted token — no refresh logic.
 */

import { CRMClient } from './client.js';
import { WorkflowBuilderClient } from './workflow-builder-client.js';
import {
  ResolvedLink,
  ResolvedLocation,
  ResolvedWorkflowCreds,
  AgencyBuilderToken,
  loadLocationsForLink,
  loadAgencyBuilderToken,
  updateWorkflowCreds,
  storeAgencyBuilderToken,
} from '../db/supabase-store.js';

export interface AccountSummary {
  locationId: string;
  name?: string;
}

export interface PoolOptions {
  baseUrl?: string;
  version?: string;
  /** Agency owner — needed to persist rotated agency-level builder tokens. */
  ownerId?: string;
  /** Agency-wide builder JWT shared by all the owner's sub-accounts. */
  agencyBuilder?: AgencyBuilderToken;
}

interface Account {
  subaccountId: string;
  locationId: string;
  accessToken: string;
  name?: string;
  workflow?: ResolvedWorkflowCreds;
}

const DEFAULT_BASE_URL = 'https://services.leadconnectorhq.com';
const DEFAULT_VERSION = '2021-07-28';

export class CRMClientPool {
  private readonly accounts = new Map<string, Account>();
  private readonly clients = new Map<string, CRMClient>();
  private readonly workflowClients = new Map<string, WorkflowBuilderClient>();
  private readonly baseUrl: string;
  private readonly version: string;
  private readonly ownerId?: string;
  private readonly agencyBuilder?: AgencyBuilderToken;

  constructor(locations: ResolvedLocation[], options: PoolOptions = {}) {
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    this.version = options.version || DEFAULT_VERSION;
    this.ownerId = options.ownerId;
    this.agencyBuilder = options.agencyBuilder;

    if (locations.length === 0) {
      throw new Error(
        'CRMClientPool: no sub-accounts available for this link. Add a sub-account (with its ' +
        'Private Integration Token) in the dashboard, then point a link at it.'
      );
    }

    for (const loc of locations) {
      if (!loc.locationId || !loc.accessToken) continue;
      this.accounts.set(loc.locationId, {
        subaccountId: loc.subaccountId,
        locationId: loc.locationId,
        accessToken: loc.accessToken,
        name: loc.name,
        workflow: loc.workflow,
      });
    }
  }

  static fromLocations(locations: ResolvedLocation[], options: PoolOptions = {}): CRMClientPool {
    return new CRMClientPool(locations, options);
  }

  static async fromLink(link: ResolvedLink, options: PoolOptions = {}): Promise<CRMClientPool> {
    const [locations, agencyBuilder] = await Promise.all([
      loadLocationsForLink(link),
      loadAgencyBuilderToken(link.ownerId),
    ]);
    return new CRMClientPool(locations, { ...options, ownerId: link.ownerId, agencyBuilder });
  }

  get(locationId: string): CRMClient {
    const cached = this.clients.get(locationId);
    if (cached) return cached;

    const acct = this.accounts.get(locationId);
    if (!acct) {
      const available = this.listSummaries()
        .map((a) => (a.name ? `${a.locationId} (${a.name})` : a.locationId))
        .join(', ');
      throw new Error(
        `Unknown sub-account locationId "${locationId}". Available for this session: ${available || '(none)'}.`
      );
    }

    const client = new CRMClient({
      accessToken: acct.accessToken,
      locationId: acct.locationId,
      baseUrl: this.baseUrl,
      version: this.version,
      getWorkflowBuilder: () => this.getWorkflowClient(locationId),
    });
    this.clients.set(locationId, client);
    return client;
  }

  /**
   * The internal workflow-builder client for a sub-account, built from its PIT
   * (Bearer) plus the captured Firebase/builder credentials. Rotated refresh
   * tokens are persisted back to the sub-account row. Throws when the location
   * is unknown or has no captured workflow credentials.
   */
  getWorkflowClient(locationId: string): WorkflowBuilderClient {
    const cached = this.workflowClients.get(locationId);
    if (cached) return cached;

    const acct = this.accounts.get(locationId);
    if (!acct) {
      throw new Error(`Unknown sub-account locationId "${locationId}".`);
    }

    const wf = acct.workflow;
    // The builder JWT is agency-wide and kept fresh by the extension's continuous
    // push; prefer it over any stale per-sub-account copy.
    const authToken = this.agencyBuilder?.authToken || wf?.authToken;
    const refreshToken = this.agencyBuilder?.refreshToken || wf?.refreshToken;

    const hasFirebase = Boolean(wf?.firebaseApiKey && wf?.firebaseRefreshToken);
    const hasBuilder = Boolean(authToken || refreshToken);
    if (!hasFirebase && !hasBuilder) {
      throw new Error(
        `No workflow credentials captured for sub-account "${locationId}". Run the capture ` +
          `extension against this location (Firebase creds for workflow CRUD, plus the agency ` +
          `builder token for marketplace module discovery).`
      );
    }

    const subaccountId = acct.subaccountId;
    const ownerId = this.ownerId;

    const client = new WorkflowBuilderClient({
      apiKey: acct.accessToken, // PIT — reused as the internal-API Bearer token.
      firebaseApiKey: wf?.firebaseApiKey || '',
      firebaseRefreshToken: wf?.firebaseRefreshToken || '',
      authToken,
      refreshToken,
      locationId: acct.locationId,
      userId: wf?.userId,
      companyId: wf?.companyId,
      companyAge: wf?.companyAge,
      // Route rotated tokens: Firebase → the sub-account row; builder JWT → the
      // agency row (shared across all the owner's sub-accounts).
      persist: async (patch) => {
        if (patch.firebaseRefreshToken) {
          await updateWorkflowCreds(subaccountId, { firebaseRefreshToken: patch.firebaseRefreshToken });
        }
        if ((patch.authToken || patch.refreshToken) && ownerId) {
          await storeAgencyBuilderToken(ownerId, { authToken: patch.authToken, refreshToken: patch.refreshToken });
        }
      },
    });
    this.workflowClients.set(locationId, client);
    return client;
  }

  has(locationId: string): boolean {
    return this.accounts.has(locationId);
  }

  listSummaries(): AccountSummary[] {
    return Array.from(this.accounts.values()).map(({ locationId, name }) => ({ locationId, name }));
  }

  search(query: string): AccountSummary[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.listSummaries();
    return this.listSummaries().filter(
      (a) => a.locationId.toLowerCase().includes(q) || (a.name ? a.name.toLowerCase().includes(q) : false)
    );
  }

  size(): number {
    return this.accounts.size;
  }
}
