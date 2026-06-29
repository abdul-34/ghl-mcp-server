# CRM MCP — self-hosted, multi-sub-account MCP server

**Built & maintained by [Abdulrehman Moaz](https://www.xylatorai.com/) · [XylatorAI](https://www.xylatorai.com/)** — custom CRM integrations & AI systems for agencies.

A self-hosted [Model Context Protocol](https://modelcontextprotocol.io) server
for your CRM, built for **agencies**. Connect any number of CRM sub-accounts,
choose which tools each client can use, and hand every client a unique,
revocable MCP URL.

- **Multiple sub-accounts** — one deployment serves all your sub-accounts.
- **Per-client URLs** — generate a unique `/mcp/<token>` link scoped to a single
  sub-account (or your whole agency).
- **Pick the tools** — each link exposes only the tools you select.
- **Self-hosted** — runs anywhere Docker runs; no third-party backend.
- **Secure by design** — tokens are encrypted at rest, link secrets are hashed,
  and the dashboard is protected by Supabase Auth + Row Level Security.
- **MIT licensed** — use it, modify it, ship it, commercial use included.

---

## What you get

This repo is a complete, two-service product you can deploy as-is:

### 1. The MCP server (`/`)
- An [MCP](https://modelcontextprotocol.io) server speaking **Streamable HTTP**
  (works with Claude, ChatGPT, and any MCP client) plus a **stdio** mode for
  local desktop use.
- **550+ CRM tools across 37 API groups**, covering the full HighLevel v2 API
  surface (contacts, conversations, calendars, opportunities, invoices,
  payments, products, social planner, and much more — see [Tools](#tools)).
- **Multi-tenant routing**: one server instance serves all your sub-accounts;
  each tool call is routed to the right sub-account's token automatically.
- **Per-link security**: every request carries a URL token that resolves to a
  specific set of sub-accounts and an allowed tool list.

### 2. The agency dashboard (`dashboard/`)
A Next.js (App Router) web app where you:
- Sign in with **Supabase Auth** (email + password).
- Add each **sub-account** with its Private Integration Token (encrypted on
  save — the raw token never touches the database in plaintext).
- Generate **client MCP links** — choose the scope (one sub-account or the whole
  agency), pick exactly which tools to expose, and copy the one-time URL.
- **Revoke** any link instantly.

### 3. The data layer (`supabase/`)
- A single SQL migration that creates the `subaccounts` and `mcp_links` tables
  with **Row Level Security**, so each agency can only ever see its own rows.

### 4. Deployment + tooling
- **`docker-compose.yml`** — bring up both services with one command.
- **`render.yaml`** — one-click Render Blueprint for both services.
- **`scripts/generate-tools.mjs`** — regenerate the entire tool set from
  HighLevel's official OpenAPI specs whenever their API changes.

---

## Architecture

```
┌──────────────────────────┐        ┌──────────────────────────┐
│  Dashboard (Next.js)      │        │   MCP Server (Express)    │
│  - Supabase Auth login    │        │   - /mcp/<link-token>     │
│  - add sub-account PITs    │        │   - resolves token→subacct│
│  - generate client URLs   │        │   - per-link tool filter  │
│  - pick tools per link    │        │   - builds session pool   │
└────────────┬─────────────┘        └────────────┬─────────────┘
   writes (RLS, anon key)                reads (service-role key)
             └───────────────┬───────────────────┘
                             ▼
                      ┌──────────────┐
                      │   Supabase    │
                      │  (Postgres)   │
                      └──────────────┘
```

### Repository layout

```
.
├── src/                       MCP server (TypeScript + Express)
│   ├── http-server.ts         Streamable HTTP server (hosted mode)
│   ├── server.ts              stdio server (local/desktop mode)
│   ├── crm/                   our CRM HTTP client + per-session client pool
│   ├── db/                    Supabase access (link resolution, token load)
│   ├── crypto/                AES-256-GCM token encryption
│   └── tools/
│       ├── generated/         550+ auto-generated tools (one file per group)
│       ├── accounts.ts        list_accounts / search_accounts
│       ├── tool-filter.ts     per-link tool whitelist
│       └── index.ts           registry + dispatch
├── dashboard/                 agency dashboard (Next.js App Router)
├── supabase/migrations/       database schema + RLS policies
├── scripts/generate-tools.mjs OpenAPI → tools generator
├── docker-compose.yml         run both services locally
└── render.yaml                one-click Render Blueprint
```

Sub-accounts authenticate to the CRM using **Private Integration Tokens (PIT)**,
which are long-lived, so there is no OAuth refresh machinery to run.

---

## Prerequisites

- Docker + Docker Compose
- A [Supabase](https://supabase.com) project (free tier is fine)
- A CRM Private Integration Token for each sub-account you want to connect

---

## Setup

### 1. Create the database schema

In the Supabase dashboard → **SQL Editor**, run the contents of
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
(Or apply it with the Supabase CLI: `supabase db push`.)

This creates the `subaccounts` and `mcp_links` tables and their RLS policies.

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in:

| Variable | Where to find it | Used by |
| --- | --- | --- |
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | both |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page (anon public key) | dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | same page (service role key) | server only |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` | both (must match) |
| `NEXT_PUBLIC_MCP_BASE_URL` | your server's public URL | dashboard |

> **`ENCRYPTION_KEY` must be identical** for the dashboard and the server, or
> PITs encrypted by the dashboard won't decrypt on the server.

### 3. Run

```bash
docker compose up --build
```

- Dashboard → http://localhost:3000
- MCP server → http://localhost:8000

---

## Deploy to Render (both services, one Blueprint)

Render doesn't run `docker-compose`, but the included
[`render.yaml`](render.yaml) Blueprint deploys **both** services together.

1. Run `supabase/migrations/0001_init.sql` in your Supabase project (one time).
2. Push this repo to GitHub.
3. In Render: **New + → Blueprint →** select your repo. Render detects
   `render.yaml` and creates both services.
4. When prompted, fill in the secrets (same `ENCRYPTION_KEY` on both):
   - `ghl-mcp-server`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`
   - `ghl-mcp-dashboard`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
     `ENCRYPTION_KEY`, `NEXT_PUBLIC_MCP_BASE_URL`
5. **One follow-up step:** the dashboard needs the server's public URL at build
   time, which isn't known until the server's first deploy. After the first
   deploy, copy the `ghl-mcp-server` URL into the dashboard's
   `NEXT_PUBLIC_MCP_BASE_URL` and redeploy the dashboard. (Only needed once.)

> On a plain VPS with Docker, `docker compose up -d` does all of this in a
> single command with no follow-up step.

---

## Usage

1. Open the dashboard, **sign up / sign in**.
2. **Sub-accounts** → add each CRM sub-account: a name, its **Location ID**, and
   its **Private Integration Token**. The token is encrypted before it's stored.
3. **MCP Links** → create a link:
   - **Scope**: a single sub-account (for a client) or all your sub-accounts.
   - **Tools**: expose all, or pick a specific subset.
   - Copy the generated URL — **the token is shown only once**.
4. Give the client the URL. They add it to Claude / ChatGPT / any MCP client:
   `https://your-host/mcp/<token>`.

Revoke a link any time from the dashboard — access stops immediately.

---

## Security model

| Concern | Mechanism |
| --- | --- |
| Only the agency can write tokens | Supabase Auth + RLS (`owner_id = auth.uid()`) |
| Client URLs can't be guessed | 256-bit random secret in the URL |
| DB leak doesn't expose live URLs | only `sha256(secret)` is stored |
| PITs unreadable from a DB dump | AES-256-GCM encryption at rest |
| Clients isolated to their sub-account | location scope + pool membership check |
| Instant revocation | `revoked` flag checked on every connect |
| Service role key never in browser | server-only; browser uses anon key + RLS |

---

## Local (stdio) usage

For a single sub-account locally (e.g. Claude Desktop), no Supabase required:

```bash
npm install
npm run build
CRM_PIT_TOKEN=pit-xxxx CRM_LOCATION_ID=your-location-id npm run start:stdio
```

Or point it at a dashboard link with `MCP_LINK_TOKEN` (+ the Supabase env vars).

---

## Development

```bash
# MCP server
npm install
npm run dev

# Dashboard
cd dashboard
npm install
npm run dev
```

---

## Tools

The server exposes **the full HighLevel v2 API surface — 550+ tools across 37
groups**, generated directly from HighLevel's official OpenAPI specifications.
Account-discovery tools (`list_accounts`, `search_accounts`) are always
available; every other tool takes a `locationId` so the caller picks which
sub-account to act on.

Groups: Ad Manager, Affiliate Manager, AI Agent Studio, Associations, Blogs,
Brand Boards, Business, Calendars, Campaigns, Chat Widget, Companies, Contacts,
Conversation AI, Conversations, Courses, Custom Fields, Custom Menus, Email,
Email ISV, Forms, Funnels, Invoices, Knowledge Base, Trigger Links,
Sub-Accounts, Media, Objects, Opportunities, Payments, LC Phone, Products,
Proposals, SaaS, Snapshots, Social Planner, Store, Surveys.

Because the full list is large, give each client link a **tool whitelist** in the
dashboard so it only exposes what that client needs.

### Regenerating the tools

The tools under `src/tools/generated/` are generated, not hand-edited. To refresh
them against the latest HighLevel API:

```bash
git clone --depth 1 https://github.com/GoHighLevel/api-v2-docs .ghl-api-docs
node scripts/generate-tools.mjs
npm run build
```

The generator reads the OpenAPI specs (public domain / CC0) and emits one tool
per endpoint plus the dashboard's tool catalog.

---

## Contributing & repository safety

This is an open, public repository — but **public means readable, not writable**.

- **Nobody can push to this repo** except the owner and explicitly invited
  collaborators. Everyone else has read-only access.
- **Outside changes arrive as Pull Requests.** A contributor forks the repo,
  commits to *their* fork, and opens a PR. Nothing changes here until the
  maintainer reviews and merges it.
- **`main` is protected.** Direct pushes are disabled; all changes — including
  the maintainer's — go through a reviewed PR with a passing build.
- **Secrets never live in the repo.** All credentials come from environment
  variables and are git-ignored (`.env`, keys, MCP configs). See
  [`.env.example`](.env.example) for the full list of variables.

To propose a change: fork → branch → commit → open a PR describing what and why.

---

## Author & Maintainer

### Abdulrehman Moaz — Founder, [XylatorAI](https://www.xylatorai.com/)

Built and maintained by **Abdulrehman Moaz**, founder of
**[XylatorAI](https://www.xylatorai.com/)** — custom CRM integrations & AI
systems for agencies and SaaS builders.

- Website: **[xylatorai.com](https://www.xylatorai.com/)**
- Contact: **rehman@xylatorai.com**

Need a custom CRM marketplace app, conversation/payment provider, AI agent, or a
bespoke MCP integration? [Book a call with XylatorAI](https://www.xylatorai.com/).

## License

[MIT](LICENSE) © 2026 Abdulrehman Moaz (XylatorAI). Free to use, modify, and
distribute — commercial use included.
