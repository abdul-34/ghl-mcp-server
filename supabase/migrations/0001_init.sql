-- CRM MCP — initial schema
--
-- Two tables, both owned by an authenticated agency user (auth.users):
--   subaccounts  — one row per CRM sub-account, holds the encrypted Private
--                  Integration Token (PIT) the agency pastes in the dashboard.
--   mcp_links    — one row per generated MCP URL handed to a client. Stores
--                  only the SHA-256 hash of the URL secret (never the secret),
--                  the scope (single sub-account vs the whole agency), and the
--                  set of tools that link is allowed to expose.
--
-- Security model:
--   * RLS restricts every dashboard read/write to `owner_id = auth.uid()`.
--   * The MCP server connects with the Supabase SERVICE ROLE key, which
--     bypasses RLS so it can resolve any link by its token hash.
--   * PIT values are encrypted application-side (AES-256-GCM) before insert,
--     so a database dump never exposes a usable CRM credential.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- subaccounts
-- ---------------------------------------------------------------------------
create table if not exists public.subaccounts (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users (id) on delete cascade,
  location_id         text not null,
  name                text,
  -- AES-256-GCM ciphertext (base64). Never store the raw PIT.
  pit_token_encrypted text not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (owner_id, location_id)
);

create index if not exists subaccounts_owner_idx on public.subaccounts (owner_id);

-- ---------------------------------------------------------------------------
-- mcp_links
-- ---------------------------------------------------------------------------
create table if not exists public.mcp_links (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users (id) on delete cascade,
  label          text,
  scope          text not null check (scope in ('agency', 'location')),
  -- Required when scope = 'location'; null for agency-wide links.
  subaccount_id  uuid references public.subaccounts (id) on delete cascade,
  -- sha256(secret) hex digest. The raw secret is shown to the agency once.
  url_token_hash text not null unique,
  enabled_tools  text[] not null default '{}',
  revoked        boolean not null default false,
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz,
  -- A location-scoped link must point at a sub-account; an agency link must not.
  constraint mcp_links_scope_subaccount_chk check (
    (scope = 'location' and subaccount_id is not null) or
    (scope = 'agency'   and subaccount_id is null)
  )
);

create index if not exists mcp_links_owner_idx on public.mcp_links (owner_id);
create index if not exists mcp_links_token_idx on public.mcp_links (url_token_hash);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subaccounts_set_updated_at on public.subaccounts;
create trigger subaccounts_set_updated_at
  before update on public.subaccounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.subaccounts enable row level security;
alter table public.mcp_links   enable row level security;

-- subaccounts: owner-only full access.
drop policy if exists subaccounts_select_own on public.subaccounts;
create policy subaccounts_select_own on public.subaccounts
  for select using (auth.uid() = owner_id);

drop policy if exists subaccounts_insert_own on public.subaccounts;
create policy subaccounts_insert_own on public.subaccounts
  for insert with check (auth.uid() = owner_id);

drop policy if exists subaccounts_update_own on public.subaccounts;
create policy subaccounts_update_own on public.subaccounts
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists subaccounts_delete_own on public.subaccounts;
create policy subaccounts_delete_own on public.subaccounts
  for delete using (auth.uid() = owner_id);

-- mcp_links: owner-only full access.
drop policy if exists mcp_links_select_own on public.mcp_links;
create policy mcp_links_select_own on public.mcp_links
  for select using (auth.uid() = owner_id);

drop policy if exists mcp_links_insert_own on public.mcp_links;
create policy mcp_links_insert_own on public.mcp_links
  for insert with check (auth.uid() = owner_id);

drop policy if exists mcp_links_update_own on public.mcp_links;
create policy mcp_links_update_own on public.mcp_links
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists mcp_links_delete_own on public.mcp_links;
create policy mcp_links_delete_own on public.mcp_links
  for delete using (auth.uid() = owner_id);

-- Note: the MCP server uses the service_role key (bypasses RLS) to look up
-- links by url_token_hash and read the owner's sub-accounts at connect time.
