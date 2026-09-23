# Forms Builder — Development Plan

Source blueprint: `ghl-mcp-form-creation/info.md` (Parts 1 + 2, captured 2026-09-23).
Goal: end-to-end HighLevel **form** create / read / update / delete through the MCP,
using the internal `services.leadconnectorhq.com/forms/` API (the public API only lists forms).

## 1. Scope

**v1 (blueprint ✅ rows only)**

| Capability | Tool |
|---|---|
| List forms | `forms_builder_list_forms` |
| Get one form (summary or full document) | `forms_builder_get_form` |
| Field palette + custom-field type mapping | `forms_builder_list_field_types` |
| Create form (template clone + swap) | `forms_builder_create_form` |
| Add / remove / move / edit fields | `forms_builder_update_fields` |
| Conditional logic | `forms_builder_set_conditional_logic` |
| On-submit action | `forms_builder_set_form_action` |
| Global input + submit-button styling, layout | `forms_builder_set_style` |
| Rename | `forms_builder_rename_form` |
| Delete (explicit confirm) | `forms_builder_delete_form` |
| Dry-run validation | `forms_builder_validate_form` |

Reused (already present, public API): `forms_get_forms_submissions`,
`locations_get_custom_fields`, `locations_create_custom_field`.

**Excluded from v1** (blueprint 🟡/⚪): `opportunitySettings`, email notifications /
autoresponder, folders, duplicate, themes, `contactAssociationSettings`, `jumpTo` outcomes,
`formSchedule` editing. **Also excluded:** public `POST /forms/submit` and `/forms/temp-upload`
(creates real contacts; captcha forms need a Cloudflare Turnstile token we must not bypass).

## 2. Architecture

```
tool handler ──► client.formsBuilder() ──► FormsBuilderClient (services.leadconnectorhq.com)
                                              │  headers: channel APP · source WEB_USER ·
                                              │           version 2021-07-28 · token-id
                                              ▼
                                  getIdToken(force?) ──► WorkflowBuilderClient.getFirebaseIdToken
                                                         (existing agency-wide Firebase capture,
                                                          refresh + rotation persisted to Supabase)
```

- `src/crm/forms-builder-client.ts` — HTTP + auth. Exact 4-header set (Addendum A). No
  `Authorization` header (harmless but pointless). One forced token refresh + retry on 401.
  Envelope normalised with `res.form ?? res` (§14.4). Credential-safe errors.
- `src/catalog/form-fields.ts` — standard field palette (captured anatomies §4–§5), builder
  from a custom-field registry record, registry-`dataType` → form-`type` mapping (Score quirk §14.6).
- `src/catalog/form-template.ts` — vetted default document (§3 defaults + §6 fieldStyle + §9
  formAction + §5.6 submit). Every create deep-clones it (Addendum B: server injects nothing).
- `src/catalog/form-validator.ts` — local checks before every write.
- `src/tools/forms-builder.ts` — tools + one read-modify-write helper.
- Pool/CRMClient: `getFormsClient(locationId)` / `client.formsBuilder()`, sharing the
  workflow client's Firebase token cache so rotation stays in one place.

## 3. Safety rules baked into the code

1. **Never hand-authored `formData`.** All writes go through `mutateForm()`: GET → deep clone
   → apply a typed mutation → validate → POST the *complete* `formData` (§14.1, §14.2).
2. **Creates always start from the template** (or an existing form via `templateFormId`).
3. **Read-after-write verification**: poll GET (≈1.5 s, 2.5 s, 4 s) until the write is visible
   (§14.3); response reports `verified: true|false` instead of claiming success blindly.
4. **Custom fields are never invented**: a custom field element is built only from a record
   fetched from the location's custom-field registry (§14.5, §16).
5. **Conditional logic validated against the form's real payload keys** (§8.2) — a typo'd
   `selectedField` is rejected, not silently stored.
6. **Delete requires `confirm: true`** (§2.5 — immediate, irreversible).
7. Captcha fields allowed but flagged: such a form can't be submitted programmatically (§10.5).
8. Concurrent builder edits: GHL has no etag; last write wins. Tools re-read immediately
   before writing to keep the window small, and say so in the response.

## 4. Validator rules

- `fields` is a non-empty array; every element has `type` + `tag`.
- Tags unique, except repeatable display elements (`header`, `html`, `image`).
- Custom elements: `id === tag`, `custom: true`, and (when the registry is available) the id
  exists in the location.
- Colours (fieldStyle, submit button) are 8-digit `RRGGBBAA` without `#` (§5).
- `formAction.actionType` is the string `"1"` (needs `redirectUrl`) or `"2"` (needs `thankyouText`).
- Conditional logic: `conditionalOperation` ∈ then/and/or (`then` ⇒ exactly one condition);
  `selectedField` ∈ input payload keys; operator ∈ enum and applicable to the field type;
  unary operators ⇒ `inputValue: null`, others ⇒ string; outcome type ∈ enum; `hideType` ∈ enum;
  "Multiple" hide types ⇒ array value; referenced show/hide keys exist; redirect/openUrl are
  absolute http(s) URLs; disqualify action/timing enums.
- Warnings (non-blocking): no submit button, captcha present, `required` field hidden by a rule.

## 5. Test plan

**Offline (in repo, `npm test`)** — `tests/forms-builder.test.mjs`
- Client sends exactly the 4 required headers, no Authorization; 401 → forced refresh + retry;
  envelope normalisation; no token leakage in errors.
- Template clone is deep (mutating a created form never mutates the constant).
- Field builder: standard palette, custom-field mapping incl. NUMERICAL→score override.
- Mutations: add/remove/move/update by tag or index; unknown ref rejected.
- Validator: each rule has a passing and a failing case.

**Production (owner runs; record results in `docs/api-notes.md`)**
1. `forms_builder_list_forms` on a sub-account with captured Firebase creds → 200.
2. `forms_builder_create_form` name `ZZ Claude <date>` with first_name, email, a custom radio.
3. Open the public form URL → renders with style + submit; submit once (no captcha,
   phone `+12015550123`) → appears in `forms_get_forms_submissions`.
4. **Open the form in the GHL builder UI and save it** → no error (catches builder-shape gaps,
   cf. the workflow `isMarketplaceAction` lesson).
5. `forms_builder_set_conditional_logic` (hide last_name when first_name = John) → verify live.
6. `forms_builder_set_form_action` redirect → verify after submit.
7. `forms_builder_update_fields` remove + move → builder still opens.
8. `forms_builder_delete_form confirm:true` on the ZZ form only.
9. Repeat 1–2 on a **standard (non-white-label) GHL** agency (§14.11 portability).
10. Repeat 1 on an **OAuth-mode** sub-account (Firebase capture still required).

## 6. Rollout

1. Merge behind the normal link tool whitelist (new tools appear in the dashboard picker under
   "Forms Builder"; gateway mode indexes them automatically under category `forms`).
2. Run the production checklist above; mark each endpoint ✅ live in `docs/api-notes.md`.
3. If the template renders incorrectly on a given agency, use `templateFormId` (clone a
   builder-made form) and update the template constant from a real builder-created document.
4. v2 candidates once verified: opportunity settings, notifications, folders, duplicate, themes.
