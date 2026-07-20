-- CRM MCP — workflow-builder credentials + capture tokens
--
-- Adds the per-sub-account credentials the internal GHL workflow API needs on
-- top of the Private Integration Token (PIT) already stored in `subaccounts`.
-- The internal API (backend.leadconnectorhq.com/workflow) authenticates with
--   Authorization: Bearer <PIT>   +   token-id: <Firebase id token>
-- so the PIT is reused; the only NEW secrets are the Firebase api key + refresh
-- token (and, optionally, a builder JWT + its refresh token for marketplace
-- module discovery), plus the company/user context ids.
--
-- These credentials are captured dynamically per sub-account by the browser
-- extension (POST /capture/<token>) — never hand-configured in an .env file.
--
-- Encryption note: `*_refresh_token` / `auth_encrypted_*` columns hold
-- AES-256-GCM ciphertext (same ENCRYPTION_KEY + layout as pit_token_encrypted).
-- `base_api_key` is the low-sensitivity Firebase Web API key, stored as-is.

-- ---------------------------------------------------------------------------
-- subaccounts: workflow-builder credential columns (all nullable / default null
-- so existing rows and the PIT-only flow are completely unaffected).
-- ---------------------------------------------------------------------------
alter table public.subaccounts
  add column if not exists base_api_key                text,
  add column if not exists base_refresh_token          text,
  add column if not exists auth_encrypted_token         text,
  add column if not exists auth_encrypted_refresh_token text,
  add column if not exists ghl_user_id                 text,
  add column if not exists ghl_company_id              text,
  add column if not exists ghl_company_age             integer,
  add column if not exists workflow_creds_updated_at   timestamptz;

-- ---------------------------------------------------------------------------
-- workflow_capture_tokens — one (or more) per agency owner. The extension
-- carries the raw secret; only its sha256 hash is stored. Resolving the hash
-- to an owner lets the /capture endpoint write Firebase creds onto that owner's
-- matching sub-account row.
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_capture_tokens (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  label        text,
  -- sha256(secret) hex digest. The raw secret is shown to the agency once.
  token_hash   text not null unique,
  revoked      boolean not null default false,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists workflow_capture_tokens_owner_idx
  on public.workflow_capture_tokens (owner_id);
create index if not exists workflow_capture_tokens_hash_idx
  on public.workflow_capture_tokens (token_hash);

-- ---------------------------------------------------------------------------
-- Row Level Security — owner-only, mirroring mcp_links. The MCP server uses the
-- service_role key (bypasses RLS) to resolve capture tokens by hash.
-- ---------------------------------------------------------------------------
alter table public.workflow_capture_tokens enable row level security;

drop policy if exists workflow_capture_tokens_select_own on public.workflow_capture_tokens;
create policy workflow_capture_tokens_select_own on public.workflow_capture_tokens
  for select using (auth.uid() = owner_id);

drop policy if exists workflow_capture_tokens_insert_own on public.workflow_capture_tokens;
create policy workflow_capture_tokens_insert_own on public.workflow_capture_tokens
  for insert with check (auth.uid() = owner_id);

drop policy if exists workflow_capture_tokens_update_own on public.workflow_capture_tokens;
create policy workflow_capture_tokens_update_own on public.workflow_capture_tokens
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists workflow_capture_tokens_delete_own on public.workflow_capture_tokens;
create policy workflow_capture_tokens_delete_own on public.workflow_capture_tokens
  for delete using (auth.uid() = owner_id);
