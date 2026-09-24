# API notes

Status marks: ✅ verified live · 📘 vendor spec · ⚠️ unconfirmed · 🚫 known wrong.
Record the evidence (date, account, response) next to each mark.

## HighLevel internal forms builder — `services.leadconnectorhq.com/forms/`

Source: owner's reverse-engineering blueprint (`ghl-mcp-form-creation/info.md`, 2026-09-23),
captured in a browser on the white-label `app.cerebrumai.io`. Rows stay ⚠️ until exercised
from this server via the production checklist in `docs/forms-builder-plan.md` §5.

**Live run 1 — 2026-09-24, NexGenHighLevel sub-account, deployed server (commit 3adaf5c):**
`forms_builder_create_form` "Claude MCP Form" (first_name, last_name, email, phone) → created
form `XGnkJc8D6idVJAarotvI`; tool reported the read-back matched (`verified`). Evidence: owner's
screenshot of the Claude chat. Public page `link.nexgenhighlevel.com/widget/form/XGnkJc8D6idVJAarotvI`
rendered styled (blue submit, themed inputs, phone got a country picker); a real submission showed the
template's "Thank you for your submission!" (formAction `"2"`). Stored document read back via
`forms_builder_get_form` matched the template exactly. Observed quirks (explained below by the missing `fieldCSS`): inputs rendered with the theme's filled style,
and the submit label rendered in a serif font. The doc also carried one `versionHistory` entry at 10:59:50 (create was
10:58:16) — source (builder save vs API update) not yet confirmed.

**Builder save — 2026-09-24 11:26, owner saved `XGnkJc8D6idVJAarotvI` in the GHL builder:** save succeeded
(builder UI accepts API-created forms ✅). Read-back showed the builder ADDS keys the blueprint never listed and
our v1 template lacked. The two that change the public page:
- `form.submitMessageStyle` — centred thank-you card (before: bare text at the top of the page).
- `form.fieldCSS` / `form.mobileFieldCSS` — CSS the builder regenerates **from `fieldStyle` on every save**, incl.
  the Google Fonts `@import`. The renderer uses this, not `fieldStyle` — which is why API-only forms showed the
  theme's filled inputs and a serif submit font, and why editing `fieldStyle` alone changes nothing visible.
Also added: `style`, full `formSchedule` (incl. `states.before/after = {mode:'page', html:'', redirectUrl:''}`),
`surveyImageSettings`, `formSubmissionEvent: 'SubmitApplication'`, `pageViewEvent: 'PageView'`, image-layout keys,
`address`, `company` (agency branding), measured `height`/`width`, formData-level `language: 'en-US'`,
`recurringProductCurrency`, etc.; submit element gained `hiddenFieldQueryKey: 'button'`.
Fix: template now carries these (except `company`, `height`, form `width`), and `fieldCSS`/`mobileFieldCSS` are
generated from `fieldStyle` on create and on every `set_style` (`src/catalog/form-css.ts`; byte-identical to the
builder's output for the default style — `tests/fixtures/builder-field-css.json`).

| Endpoint / fact | Status | Evidence |
|---|---|---|
| Auth headers: `channel: APP`, `source: WEB_USER`, `version: 2021-07-28`, `token-id: <Firebase ID token>` — all four individually mandatory | ✅ live (server) | Live run 1: agency Firebase capture + these four headers accepted server-side. Blueprint Addendum A header matrix. Missing channel/source/version → 401; `source: INTEGRATION` → 401; Bearer instead of token-id → 401 "Error calling IAM service"; Bearer alongside token-id → 200 (ignored). Server sends no Bearer. |
| `GET /forms/?locationId&limit&skip[&type]` → `{forms,total,traceId}` | ⚠️ (browser ✅) | Blueprint §2.1. `type=folder` is what the builder UI sends; meaning unconfirmed, so our tool only passes it when asked. |
| `GET /forms/{id}` → `{form, traceId}` | ✅ live (server) | Live run 1: post-create read-back matched. §2.2 |
| `POST /forms/` `{name, locationId, formData}` → 201 `{form, traceId}` | ✅ live (server) | Live run 1 created `XGnkJc8D6idVJAarotvI`. §2.3, Addendum B: formData stored verbatim, server injects no style/theme/action. |
| `POST /forms/{id}` `{name, formData}` → 201, full replace of formData | ⚠️ (browser ✅) | §2.4; `{name}` alone → 422 "formData must be an object". |
| `DELETE /forms/{id}` → 200 `{…, deleted: true}` | ⚠️ (browser ✅) | §2.5 |
| Reads lag writes 1–4 s | ⚠️ (browser ✅) | §14.3 — tools poll GET after writes. |
| `conditionalLogic` shape + enums | ⚠️ (browser ✅) | §8, written/read back identical and observed on the public page. |
| `currentThemeId: 69df8c1ec7fee340d1abbfa6` works in any location | ✅ live on NexGenHighLevel | Renders themed on a second location (live run 1). Still unproven on other agencies. If a created form renders unthemed elsewhere, create with `templateFormId`. |
| Custom-field `typeLabel` values other than "Radio" / "File Upload" | ⚠️ | Only those two were captured; the rest are display labels we chose. |
| h1 content key, img source key, country options, date_of_birth format | ⚠️ | Not captured — marked `verified:false` in `forms_builder_list_field_types`. |
| API-created forms open and save in the GHL builder UI | ✅ live | Owner saved `XGnkJc8D6idVJAarotvI` in the builder 2026-09-24 11:26 without error. |
| Portability to standard (non-white-label) GHL | ⚠️ | §14.11 — production checklist step 9. |
| `opportunitySettings`, notifications, folders, duplicate, themes, `jumpTo` | ⚠️ excluded | Bundle-derived names only; not implemented in v1. |
| Public `POST backend.leadconnectorhq.com/forms/submit` | ✅ live (browser), not a tool | Live run 1: submission on an API-created form succeeded. §10; creates real contacts, captcha forms need Turnstile. Not exposed as a tool. |

## HighLevel public custom fields (used by the forms builder)

| Endpoint | Status | Evidence |
|---|---|---|
| `GET /locations/{locationId}/customFields` → `{customFields:[…]}` | 📘 | Generated tool `locations_get_custom_fields` (official OpenAPI). Forms tools read it to build custom elements and validate ids. |
