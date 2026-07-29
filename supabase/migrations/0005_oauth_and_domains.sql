-- CRM MCP — Marketplace OAuth auth + white-label custom domains
--
-- Adds a SECOND, additive credential path alongside the hand-pasted PIT:
-- agencies install our GHL Marketplace app once, and each sub-account where the
-- app is installed authenticates with an OAuth *location token* minted from the
-- agency (Company) token and refreshed server-side so it never expires. The PIT
-- path is untouched — every existing sub-account defaults to auth_mode='pit'.
--
-- Also adds custom_domains for white-label: agencies map their own domain
-- (CNAME + TXT verification); the MCP server reads this table (service role) to
-- authorize on-demand TLS certificate issuance for verified domains only.
--
-- All token columns are AES-256-GCM ciphertext (same key/layout as
-- pit_token_encrypted). Low-sensitivity ids (companyId) stay plaintext.

-- ─── subaccounts: per-sub-account auth mode + cached OAuth location token ───
alter table public.subaccounts
  add column if not exists auth_mode                     text not null default 'pit',
  add column if not exists oauth_access_encrypted_token  text,
  add column if not exists oauth_refresh_encrypted_token text,
  add column if not exists oauth_token_expires_at        timestamptz,
  add column if not exists oauth_install_type            text;

do $$ begin
  alter table public.subaccounts
    add constraint subaccounts_auth_mode_chk check (auth_mode in ('pit', 'oauth'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.subaccounts
    add constraint subaccounts_oauth_install_type_chk
    check (oauth_install_type is null or oauth_install_type in ('company', 'location'));
exception when duplicate_object then null; end $$;

-- OAuth sub-accounts have no PIT; relax the NOT NULL and enforce that whichever
-- auth material the mode requires is present.
alter table public.subaccounts alter column pit_token_encrypted drop not null;

do $$ begin
  alter table public.subaccounts add constraint subaccounts_auth_material_chk check (
    (auth_mode = 'pit'   and pit_token_encrypted is not null) or
    (auth_mode = 'oauth' and ghl_company_id is not null)
  );
exception when duplicate_object then null; end $$;

-- ─── agency_oauth_installs: one Company OAuth token per agency owner ───
-- Mirrors agency_builder_tokens. This Company (agency) token is the durable root
-- of trust: its refresh token rotates and is renewed server-side, and per-sub-account
-- location tokens are minted from it on demand (POST /oauth/locationToken).
create table if not exists public.agency_oauth_installs (
  owner_id                uuid primary key references auth.users (id) on delete cascade,
  ghl_company_id          text not null,
  app_id                  text,
  user_type               text,               -- 'Company' | 'Location'
  scope                   text,
  access_encrypted_token  text not null,       -- AES-256-GCM
  refresh_encrypted_token text not null,       -- AES-256-GCM (rotates on use)
  token_expires_at        timestamptz not null,
  installed_locations     jsonb,               -- cached installedLocations result
  installed_synced_at     timestamptz,
  -- Cross-instance refresh lease: an instance claims this (atomic conditional
  -- update, timeout-bounded) before calling GHL's refresh grant, so concurrent
  -- servers never rotate the shared refresh token in parallel and lock it out.
  refresh_locked_at       timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.agency_oauth_installs enable row level security;

drop policy if exists agency_oauth_installs_select_own on public.agency_oauth_installs;
create policy agency_oauth_installs_select_own on public.agency_oauth_installs
  for select using (auth.uid() = owner_id);

drop policy if exists agency_oauth_installs_insert_own on public.agency_oauth_installs;
create policy agency_oauth_installs_insert_own on public.agency_oauth_installs
  for insert with check (auth.uid() = owner_id);

drop policy if exists agency_oauth_installs_update_own on public.agency_oauth_installs;
create policy agency_oauth_installs_update_own on public.agency_oauth_installs
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists agency_oauth_installs_delete_own on public.agency_oauth_installs;
create policy agency_oauth_installs_delete_own on public.agency_oauth_installs
  for delete using (auth.uid() = owner_id);

-- ─── custom_domains: white-label MCP URL hosts ───
-- White-label domains use Cloudflare for SaaS (Custom Hostnames): Cloudflare
-- issues + renews the per-agency TLS cert. We store the Cloudflare custom-hostname
-- id and the DNS records Cloudflare tells the agency to set (cf_verification).
create table if not exists public.custom_domains (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users (id) on delete cascade,
  domain             text not null unique,               -- lowercased; global uniqueness
  verification_token text not null,                      -- legacy/self-check ownership token
  cf_hostname_id     text,                               -- Cloudflare custom_hostname id
  cf_verification    jsonb,                              -- CNAME target + SSL/ownership validation records
  verified           boolean not null default false,
  status             text not null default 'pending',
  created_at         timestamptz not null default now(),
  verified_at        timestamptz,
  last_checked_at    timestamptz
);

do $$ begin
  alter table public.custom_domains
    add constraint custom_domains_status_chk
    check (status in ('pending', 'verifying', 'active', 'failed'));
exception when duplicate_object then null; end $$;

create index if not exists custom_domains_owner_idx on public.custom_domains (owner_id);

alter table public.custom_domains enable row level security;

drop policy if exists custom_domains_select_own on public.custom_domains;
create policy custom_domains_select_own on public.custom_domains
  for select using (auth.uid() = owner_id);

drop policy if exists custom_domains_insert_own on public.custom_domains;
create policy custom_domains_insert_own on public.custom_domains
  for insert with check (auth.uid() = owner_id);

drop policy if exists custom_domains_update_own on public.custom_domains;
create policy custom_domains_update_own on public.custom_domains
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists custom_domains_delete_own on public.custom_domains;
create policy custom_domains_delete_own on public.custom_domains
  for delete using (auth.uid() = owner_id);
