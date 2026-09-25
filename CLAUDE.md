# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Self-hosted, multi-tenant MCP server for HighLevel (GHL). One Express server serves many agencies/sub-accounts; each client gets a revocable `/mcp/<token>` URL that resolves (via Supabase) to a set of sub-accounts and a tool whitelist. A separate Next.js dashboard (`dashboard/`) manages sub-accounts, links, OAuth installs, and custom domains.

## Commands

MCP server (repo root):
- `npm run dev` — ts-node + nodemon on `src/http-server.ts` (port 8000; `.claude/launch.json` config `mcp-server`)
- `npm run build` — `tsc` then `scripts/copy-assets.mjs` (copies `src/catalog/data/*.json` into `dist/`; the native workflow catalog is loaded from disk at runtime, so a bare `tsc` produces a broken build)
- `npm run lint` — type-check only (`tsc --noEmit`); there is no ESLint
- `npm test` — builds, then `node --test tests/*.test.mjs`. Tests import from `dist/`, not `src/`, so always rebuild before running.
- Single test file: `npm run build && node --test tests/forms-builder.test.mjs`
- Single test by name: `npm run build && node --test --test-name-pattern="<name>" tests/forms-builder.test.mjs`
- stdio mode (no Supabase): `CRM_PIT_TOKEN=... CRM_LOCATION_ID=... npm run start:stdio` (or `MCP_LINK_TOKEN` + Supabase env; `MCP_GATEWAY_MODE` toggles gateway mode)

Dashboard: `npm --prefix dashboard run dev` (port 3000, config `dashboard`). Both together: `docker compose up --build`.

Regenerate public-API tools: clone `GoHighLevel/api-v2-docs` into `.ghl-api-docs/`, then `node scripts/generate-tools.mjs`. This rewrites `src/tools/generated/*` **and** `dashboard/lib/tools-catalog.ts`. Never hand-edit files under `src/tools/generated/`.

## Architecture

**Request flow:** `http-server.ts` `requireAuth` resolves the URL token → `ResolvedLink` (`db/supabase-store.ts`, service-role key; only `sha256(secret)` is stored) → `CRMClientPool.fromLink()` builds a per-MCP-session pool → `tools/index.ts` `callTool()` enforces the whitelist, requires `locationId`, checks `pool.has(locationId)` (this is the per-client isolation boundary), and calls the handler with a `CRMClient` bound to that sub-account. Unknown `Mcp-Session-Id` returns 404 so clients re-initialize.

**Tool framework (`tools/types.ts`):** every tool is a `ToolDef` = MCP `Tool` + `handler(client, args)`. `defineTool()` auto-injects the required `locationId` prop; `requiresLocation: false` skips it (handler may get an undefined client). `tools/index.ts` concatenates all sources into one registry and **throws on duplicate names** — new tool sets are additive and must not collide with generated ones.

Tool sources:
- `tools/generated/` — one tool per OpenAPI operation (public API, Bearer auth).
- `tools/ported/` — tool classes ported from Go-High-Level-MCP-2026, bridged via `GHLToolAdapter` onto a per-sub-account `CRMClient`.
- `tools/workflow-builder.ts`, `workflow-insights.ts` — internal workflow-builder API (`crm/workflow-builder-client.ts`, validated by `catalog/workflow-validator.ts`, native action/trigger catalog in `catalog/native-workflow-catalog.ts` + `catalog/data/`).
- `tools/forms-builder.ts` — internal `/forms/` API (`crm/forms-builder-client.ts`); every write is a full read-modify-write of the form document, validated by `catalog/form-validator.ts`. `catalog/form-css.ts` regenerates `fieldCSS`/`mobileFieldCSS` from `fieldStyle` exactly as the GHL builder does (fixture: `tests/fixtures/builder-field-css.json`) — the public renderer uses the CSS, not `fieldStyle`.
- `tools/gateway.ts` — when a link has `gateway_mode`, only account tools + `search_ghl_tools` / `get_ghl_tool_schema` / `invoke_ghl_tool` are listed; `invoke_ghl_tool` still routes through the same whitelist/location dispatch.
- `tools/accounts.ts` — `list_accounts` / `search_accounts`, operate on the pool, always available.

**Two auth planes:**
1. *Public API (Bearer):* per sub-account `auth_mode` is `pit` (static encrypted Private Integration Token) or `oauth` (Marketplace app; `crm/ghl-oauth.ts` refreshes agency tokens and mints location tokens on demand). `CRMClient` takes a `getAccessToken` callback so the Bearer is set per request and can refresh mid-session.
2. *Internal APIs (workflow builder, forms builder):* use a Firebase ID token (`token-id` header, no Bearer) derived from Firebase creds harvested by the Chrome extension `extensions/crm-token-bridge/`, which POSTs to `/capture/:token` (per-location creds) and `/capture/builder/:token` (agency-wide builder JWT). Creds are stored encrypted; refresh-token rotation is persisted back through the pool. The forms client gets its ID token from the sibling `WorkflowBuilderClient` so rotation happens in one place.

**Encryption:** `crypto/pit-crypto.ts` (AES-256-GCM). `ENCRYPTION_KEY` must be identical on server and dashboard — the dashboard encrypts, the server decrypts.

**Database:** `supabase/migrations/000N_*.sql` are applied manually in order (Supabase SQL editor / `supabase db push`); Render does not run them. Dashboard writes use the anon key + RLS (`owner_id = auth.uid()`); the server reads with the service-role key.

**Dashboard (`dashboard/`):** Next.js App Router. Tool picker reads `lib/tools-catalog.ts` (generated) plus `lib/manual-tools-catalog.ts` (hand-written tools — update this when adding non-generated tools so they're selectable per link). Also hosts the OAuth install/callback (`app/api/oauth/...`) and Cloudflare-for-SaaS custom-domain setup (`lib/cloudflare.ts`).

## API notes

`docs/api-notes.md` is the source of truth for the internal (undocumented) GHL endpoints — which are ✅ verified live, ⚠️ unconfirmed, or 🚫 known wrong — with evidence. Read it before touching `workflow-builder-client.ts` or `forms-builder-client.ts`, and record new findings there. `docs/forms-builder-plan.md` holds the forms design and production checklist.

Deploy: `render.yaml` Blueprint (Docker, both services); `/health` reports the tool count.
