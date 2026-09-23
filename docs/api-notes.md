# API notes

Status marks: ✅ verified live · 📘 vendor spec · ⚠️ unconfirmed · 🚫 known wrong.
Record the evidence (date, account, response) next to each mark.

## HighLevel internal forms builder — `services.leadconnectorhq.com/forms/`

Source: owner's reverse-engineering blueprint (`ghl-mcp-form-creation/info.md`, 2026-09-23),
captured in a browser on the white-label `app.cerebrumai.io`. **Not yet called from this
server** — each row stays ⚠️ until the production checklist in
`docs/forms-builder-plan.md` §5 is run and the response recorded here.

| Endpoint / fact | Status | Evidence |
|---|---|---|
| Auth headers: `channel: APP`, `source: WEB_USER`, `version: 2021-07-28`, `token-id: <Firebase ID token>` — all four individually mandatory | ⚠️ (browser ✅) | Blueprint Addendum A header matrix. Missing channel/source/version → 401; `source: INTEGRATION` → 401; Bearer instead of token-id → 401 "Error calling IAM service"; Bearer alongside token-id → 200 (ignored). Server sends no Bearer. |
| `GET /forms/?locationId&limit&skip[&type]` → `{forms,total,traceId}` | ⚠️ (browser ✅) | Blueprint §2.1. `type=folder` is what the builder UI sends; meaning unconfirmed, so our tool only passes it when asked. |
| `GET /forms/{id}` → `{form, traceId}` | ⚠️ (browser ✅) | §2.2 |
| `POST /forms/` `{name, locationId, formData}` → 201 `{form, traceId}` | ⚠️ (browser ✅) | §2.3, Addendum B: formData stored verbatim, server injects no style/theme/action. |
| `POST /forms/{id}` `{name, formData}` → 201, full replace of formData | ⚠️ (browser ✅) | §2.4; `{name}` alone → 422 "formData must be an object". |
| `DELETE /forms/{id}` → 200 `{…, deleted: true}` | ⚠️ (browser ✅) | §2.5 |
| Reads lag writes 1–4 s | ⚠️ (browser ✅) | §14.3 — tools poll GET after writes. |
| `conditionalLogic` shape + enums | ⚠️ (browser ✅) | §8, written/read back identical and observed on the public page. |
| `currentThemeId: 69df8c1ec7fee340d1abbfa6` works in any location | ⚠️ | Observed on one location only. If a created form renders unthemed elsewhere, create with `templateFormId`. |
| Custom-field `typeLabel` values other than "Radio" / "File Upload" | ⚠️ | Only those two were captured; the rest are display labels we chose. |
| h1 content key, img source key, country options, date_of_birth format | ⚠️ | Not captured — marked `verified:false` in `forms_builder_list_field_types`. |
| API-created forms open and save in the GHL builder UI | ⚠️ | Untested — production checklist step 4. |
| Portability to standard (non-white-label) GHL | ⚠️ | §14.11 — production checklist step 9. |
| `opportunitySettings`, notifications, folders, duplicate, themes, `jumpTo` | ⚠️ excluded | Bundle-derived names only; not implemented in v1. |
| Public `POST backend.leadconnectorhq.com/forms/submit` | ⚠️ excluded | §10; creates real contacts, captcha forms need Turnstile. Not exposed as a tool. |

## HighLevel public custom fields (used by the forms builder)

| Endpoint | Status | Evidence |
|---|---|---|
| `GET /locations/{locationId}/customFields` → `{customFields:[…]}` | 📘 | Generated tool `locations_get_custom_fields` (official OpenAPI). Forms tools read it to build custom elements and validate ids. |
