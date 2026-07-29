-- CRM MCP — agency-wide Firebase credentials (capture once, not per sub-account)
--
-- The Firebase creds the capture extension harvests are the logged-in USER's
-- session (firebase:authUser:<apiKey> in IndexedDB) plus the agency companyId/
-- userId from localStorage — all identical across every sub-account the agency
-- owner can access. Storing them per sub-account (subaccounts.base_* columns)
-- meant opening every sub-account to capture the SAME token repeatedly.
--
-- These columns let the extension capture ONCE and have every sub-account fall
-- back to the agency-wide Firebase creds. Per-sub-account creds still override
-- when present (e.g. a sub-account accessed by a different login). Reuses the
-- agency_builder_tokens row (one per owner) so the pool needs no extra query.

alter table public.agency_builder_tokens
  add column if not exists firebase_api_key         text,   -- Firebase Web API key (low sensitivity)
  add column if not exists firebase_refresh_encrypted text, -- AES-256-GCM
  add column if not exists ghl_company_id           text,
  add column if not exists ghl_user_id              text,
  add column if not exists firebase_updated_at      timestamptz;
