# CRM Token Bridge (Chrome extension)

Captures a logged-in GoHighLevel session's **Firebase credentials** (api key +
refresh token) and account context (locationId, companyId, userId) from the
CRM tab's IndexedDB, then pushes them to your self-hosted MCP server's
`/capture/<token>` endpoint. The server stores them **encrypted** on the
sub-account whose `location_id` matches the tab, so the workflow-builder tools
can run dynamically against that sub-account — no `.env` editing.

## Setup

1. In the MCP **dashboard**, open **Settings → Workflow capture** and generate a
   capture token. Copy it (it's shown once).
2. Load this folder as an unpacked extension: `chrome://extensions` →
   *Developer mode* → *Load unpacked* → select `extensions/crm-token-bridge`.
3. Open the extension **Options** and set:
   - **MCP server URL** — e.g. `https://your-mcp.example.com` (or
     `http://localhost:8000` in dev).
   - **Capture token** — paste the token from step 1.
4. Make sure the sub-account already exists in the dashboard **with its PIT**
   (the capture only adds Firebase creds; it never creates the sub-account).

## Capture

1. Open the CRM and navigate into the specific **sub-account** (the URL contains
   `/location/<id>`).
2. Click the extension icon → **Capture from this CRM tab**.
3. The popup confirms the location it stored credentials for. Re-capture anytime
   the Firebase refresh token needs refreshing (the server also auto-rotates it).

## Security notes

- The capture token — not the request origin — authenticates the push; treat it
  like a password and revoke it in the dashboard if leaked.
- Only the Firebase refresh token / builder token are stored encrypted; the
  Firebase Web API key (low-sensitivity) is stored as-is.
- The builder JWT is sniffed from CRM requests and only ever sent bundled with a
  Firebase capture (it has no location context on its own).
