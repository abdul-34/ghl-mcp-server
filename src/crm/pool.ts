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
  AuthMode,
  loadLocationsForLink,
  loadAgencyBuilderToken,
  updateWorkflowCreds,
  storeAgencyBuilderToken,
  storeAgencyFirebaseCreds,
  getOrRefreshLocationToken,
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
  /** PIT (pit mode) or the initial cached OAuth token (oauth mode; may be ''). */
  accessToken: string;
  name?: string;
  workflow?: ResolvedWorkflowCreds;
  authMode: AuthMode;
  /** The full resolved record — its cached OAuth token/expiry is mutated in place on refresh. */
  resolved: ResolvedLocation;
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
      if (!loc.locationId) continue;
      // PIT rows need a token now; OAuth rows mint one lazily on first use.
      if (loc.authMode === 'pit' && !loc.accessToken) continue;
      this.accounts.set(loc.locationId, {
        subaccountId: loc.subaccountId,
        locationId: loc.locationId,
        accessToken: loc.accessToken,
        name: loc.name,
        workflow: loc.workflow,
        authMode: loc.authMode,
        resolved: loc,
      });
    }
  }

  /**
   * A fresh Bearer for a sub-account. PIT → the static token. OAuth → a cached
   * location token while valid, else minted/refreshed on demand (persisted). The
   * resolved record holds the cached token in memory, so repeated calls avoid
   * network until expiry.
   */
  private tokenProvider(locationId: string): () => Promise<string> {
    return async () => {
      const acct = this.accounts.get(locationId);
      if (!acct) throw new Error(`Unknown sub-account locationId "${locationId}".`);
      if (acct.authMode === 'pit') return acct.accessToken;
      return getOrRefreshLocationToken(acct.resolved);
    };
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
      // OAuth locations refresh per request; PIT locations return the static token.
      getAccessToken: acct.authMode === 'oauth' ? this.tokenProvider(locationId) : undefined,
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
    const agency = this.agencyBuilder;
    // The builder JWT is agency-wide and kept fresh by the extension's continuous
    // push; prefer it over any stale per-sub-account copy.
    const authToken = agency?.authToken || wf?.authToken;
    const refreshToken = agency?.refreshToken || wf?.refreshToken;

    // Firebase creds are the logged-in user's session — identical for every
    // sub-account — so they're captured once and shared at the agency level. Prefer
    // a per-sub-account override when present (e.g. a different login), else fall
    // back to the agency-wide creds. The rotation persists to whichever source we used.
    const hasSubFirebase = Boolean(wf?.firebaseApiKey && wf?.firebaseRefreshToken);
    const firebaseSource: 'subaccount' | 'agency' = hasSubFirebase ? 'subaccount' : 'agency';
    const firebaseApiKey = hasSubFirebase ? wf!.firebaseApiKey! : agency?.firebaseApiKey || '';
    const firebaseRefreshToken = hasSubFirebase ? wf!.firebaseRefreshToken! : agency?.firebaseRefreshToken || '';
    // companyId sources, in order: per-sub workflow creds → the OAuth install's saved
    // company id on the sub-account row (acct.resolved.ghlCompanyId — set at install,
    // and the reliable source for OAuth subs whose `wf` block is empty) → agency creds.
    const companyId = wf?.companyId || acct.resolved.ghlCompanyId || agency?.companyId;
    const userId = wf?.userId || agency?.userId;

    const hasFirebase = Boolean(firebaseApiKey && firebaseRefreshToken);
    const hasBuilder = Boolean(authToken || refreshToken);
    if (!hasFirebase && !hasBuilder) {
      throw new Error(
        `No workflow credentials captured for this agency. Run the capture extension ONCE on any ` +
          `logged-in CRM tab — the Firebase session is shared across all sub-accounts (plus the agency ` +
          `builder token for marketplace module discovery).`
      );
    }

    const subaccountId = acct.subaccountId;
    const ownerId = this.ownerId;

    const client = new WorkflowBuilderClient({
      // PIT accounts reuse the PIT as the internal-API Bearer. OAuth location tokens
      // do NOT work on the internal /workflow API, so OAuth accounts pass no static
      // Bearer — the workflow client falls back to the Firebase id token (which is
      // what the /workflow API actually authenticates). Workflow tools therefore
      // still require the Firebase capture for OAuth sub-accounts, exactly as for PIT.
      apiKey: acct.authMode === 'pit' ? acct.accessToken : '',
      firebaseApiKey,
      firebaseRefreshToken,
      authToken,
      refreshToken,
      locationId: acct.locationId,
      userId,
      companyId,
      companyAge: wf?.companyAge,
      // Route rotated tokens to their source: Firebase → the agency row when the
      // creds came from there (default), or the sub-account row on a per-sub override;
      // builder JWT → always the agency row.
      persist: async (patch) => {
        if (patch.firebaseRefreshToken || patch.companyId || patch.userId) {
          if (firebaseSource === 'agency' && ownerId) {
            await storeAgencyFirebaseCreds(ownerId, {
              firebaseRefreshToken: patch.firebaseRefreshToken,
              companyId: patch.companyId,
              userId: patch.userId,
            });
          } else {
            await updateWorkflowCreds(subaccountId, {
              firebaseRefreshToken: patch.firebaseRefreshToken,
              companyId: patch.companyId,
              userId: patch.userId,
            });
          }
        }
        // Builder JWT is agency-wide → the agency row.
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
