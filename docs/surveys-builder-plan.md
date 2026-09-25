# Surveys Builder — Development Plan

Source: the owner's survey-builder capture (2026-09-25, NexGenHighLevel, location `oIsICGsND5sAh4RdqGe8`).
Endpoint status and evidence live in [api-notes.md](api-notes.md).

## 1. Scope

The public API only reads surveys. The `surveys_builder_*` tools manage surveys end to end through the
internal builder API, authenticated with the agency's captured Firebase session (same as `forms_builder_*`).

| Tool | What it does |
|---|---|
| `surveys_builder_list_element_types` | Palette tags, inline custom question types, verification status |
| `surveys_builder_list_surveys` | List / search by name |
| `surveys_builder_get_survey` | Slides → questions summary; `raw: true` for the stored document |
| `surveys_builder_validate_survey` | Dry run of a slides spec, or check a stored survey |
| `surveys_builder_create_survey` | Slides, questions and settings in one call; optional `templateSurveyId` |
| `surveys_builder_update_questions` | Ordered slide/question ops |
| `surveys_builder_set_settings` | Thank-you message or redirect, progress bar, back button, auto-advance, schedule |
| `surveys_builder_rename_survey` | Name only |
| `surveys_builder_delete_survey` | Soft delete; optional cleanup of the survey's own custom fields |

Not in v1: payment elements, image elements, survey logic (shape not captured yet), editing the answer
options of an existing question (they belong to the backing custom field).

## 2. Architecture

- `src/crm/internal-builder-http.ts` — shared token-id HTTP layer (headers, one forced-refresh retry on 401, JWT redaction) used by the forms and surveys clients.
- `src/crm/surveys-builder-client.ts` — `/surveys/` CRUD plus the token-id `/locations/{loc}/customFields` create/delete the builder uses. Normalizes the `{survey}` / `{data}` envelopes.
- `src/catalog/survey-fields.ts` — palette and custom element shapes, checked against the builder-saved JSON in `tests/surveys-builder.test.mjs`.
- `src/catalog/survey-custom-fields.ts` — inline question → create-field payload.
- `src/catalog/survey-template.ts` — slide factory, formData assembly, `form.address` mirroring.
- `src/catalog/survey-mutations.ts` — question building and ops. A question is a unit: one element, or the address group plus its 5 children.
- `src/catalog/survey-validator.ts` — local rules (below).
- `src/tools/surveys-builder.ts` — the tools; `mutateSurvey()` is the single edit path.

## 3. Safety rules baked into the code

- Every write is a read-modify-write of the **complete** formData. The update body holds only `name` and `formData`; the client refuses a formData without `form` or slides.
- Dry run first: the finished document is built with placeholder custom-field records and validated before anything is created. Only issues the change introduces block an edit; pre-existing ones come back as warnings.
- Inline custom fields are created after validation and before the survey write, in a `Survey | <name>` folder (an edit reuses the folder of the survey's own fields). If a later step fails, the fields, the folder and (on create) the half-made survey are deleted again.
- A clashing custom-field name gets a 4-hex suffix (as the builder does); the question keeps the clean text.
- Rating and Score fields are created as `NUMERICAL`; the element keeps `RATING` / `SCORE`.
- Writes are verified by polling GET until slides and form match.
- Delete needs `confirm: true` and honours `expectedName`. Field cleanup scans every other survey and form first (a failed scan deletes no fields), never deletes a field created before the survey, and removes a folder only once it is empty.

## 4. Validator rules

`formData.form` is an object · at least one slide · unique slide ids · every question has a unique uuid · standard tags at most once (header/html repeatable) · address sub-fields only under an address group · custom element tag = custom field id, and the id exists in the location · no payment elements. Warnings: unverified element types, email (forms-observed shape), HTML blocks.

## 5. Open items

1. **Default theme.** A survey created without `templateSurveyId` uses the server's minimal formData, so it shows builder defaults until someone saves it in the builder. Capture a builder-saved survey (`surveys_builder_get_survey` with `raw: true`) to bake in a default template, as the forms builder does.
2. **Survey logic.** Add a jump rule and a disqualify rule to "Element Catalog Test" (`M0L9OqLcV3cwjkPgdC8q`) in the builder, save, and read it back with `raw: true`. `surveys_builder_set_logic` is built only from that captured shape.
3. **Unverified shapes:** redirect `actionType: "1"`, Multi Dropdown, Email, T & C default copy.

## 6. Live test plan (NexGenHighLevel)

1. `create_survey` with two slides: full_name, email, address, one inline radio, one inline rating, one inline textbox_list. Check the folder and fields exist.
2. Open the public page and the builder; save in the builder with no `toString` crash.
3. `update_questions` (add, move, remove), `set_settings` with a redirect, `rename_survey`.
4. Add a multi-dropdown question and confirm it renders.
5. Submit once; check `surveys_get_surveys_submissions`.
6. `delete_survey` with `deleteCustomFields: true`; confirm the survey, fields and folder are gone.
