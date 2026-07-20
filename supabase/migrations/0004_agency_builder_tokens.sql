-- CRM MCP — agency-level builder token
--
-- The GHL "builder" JWT used by the 2 marketplace module-discovery tools
-- (crm_search_workflow_modules / crm_get_workflow_module) is agency/session
-- scoped, NOT per sub-account. GHL never hands out a refresh token a server
-- could renew on its own, so the capture extension pushes the current builder
-- Bearer continuously (on every CRM request) to /capture/builder/<token>, which
-- upserts it here for the whole agency. All the owner's sub-accounts then share
-- this token for marketplace discovery.
--
-- One row per agency owner. Tokens are AES-256-GCM ciphertext (same key/layout
-- as pit_token_encrypted). refresh_token is populated only if GHL's /auth/refresh
-- ever returns a rotatable one.

create table if not exists public.agency_builder_tokens (
  owner_id                     uuid primary key references auth.users (id) on delete cascade,
  auth_encrypted_token         text,
  auth_encrypted_refresh_token text,
  updated_at                   timestamptz not null default now()
);

alter table public.agency_builder_tokens enable row level security;

drop policy if exists agency_builder_tokens_select_own on public.agency_builder_tokens;
create policy agency_builder_tokens_select_own on public.agency_builder_tokens
  for select using (auth.uid() = owner_id);

drop policy if exists agency_builder_tokens_insert_own on public.agency_builder_tokens;
create policy agency_builder_tokens_insert_own on public.agency_builder_tokens
  for insert with check (auth.uid() = owner_id);

drop policy if exists agency_builder_tokens_update_own on public.agency_builder_tokens;
create policy agency_builder_tokens_update_own on public.agency_builder_tokens
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists agency_builder_tokens_delete_own on public.agency_builder_tokens;
create policy agency_builder_tokens_delete_own on public.agency_builder_tokens
  for delete using (auth.uid() = owner_id);
