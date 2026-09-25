/**
 * Surveys-builder tools (internal GHL API).
 *
 * First cut: read-only. surveys_builder_get_survey returns a builder-saved survey
 * document so its complete formData (theme, fieldCSS, footer, per-element JSON) can
 * be captured as the default template before the create/update/delete tools are
 * built on top of it. Reaches the sub-account's internal surveys client via
 * `client.surveysBuilder()`, authenticated with the agency's captured Firebase session.
 */

import { ToolDef, defineTool } from './types.js';
import { SurveyDocument } from '../crm/surveys-builder-client.js';

/** Compact, model-friendly view of a survey document. */
export function summarizeSurvey(doc: SurveyDocument): Record<string, unknown> {
  const fd = doc.formData || {};
  const slides = Array.isArray(fd.slides) ? fd.slides : [];
  const form = (fd.form || {}) as Record<string, unknown>;
  return {
    id: doc._id,
    name: doc.name,
    deleted: doc.deleted === true,
    dateUpdated: doc.dateUpdated,
    slideCount: slides.length,
    slides: slides.map((s, index) => ({
      index,
      id: s.id,
      name: s.slideName,
      questions: (Array.isArray(s.slideData) ? s.slideData : []).map((f, i) => ({
        index: i,
        uuid: f.uuid,
        tag: f.tag,
        type: f.type,
        label: f.label,
        required: f.required === true,
        custom: f.custom === true || f.standard === false,
      })),
    })),
    formAction: form.formAction ?? null,
    // A survey created via the API has only { company } until its first builder save.
    builderSaved: Boolean(form.fieldStyle) && typeof fd.fieldCSS === 'string',
  };
}

export const surveysBuilderTools: ToolDef[] = [
  defineTool({
    name: 'surveys_builder_get_survey',
    description:
      'Read one survey through the internal survey-builder API: its slides and the questions on each (uuid, tag, type, label, ' +
      'required, custom). Pass raw: true for the complete stored document, including formData with its theme, fieldCSS and the ' +
      'exact per-element JSON.',
    properties: {
      surveyId: { type: 'string' },
      raw: { type: 'boolean', description: 'Return the full stored document instead of the summary' },
    },
    required: ['surveyId'],
    handler: async (client, args) => {
      const surveyId = String(args.surveyId || '').trim();
      if (!surveyId) throw new Error('surveyId is required.');
      const doc = await client.surveysBuilder().getSurvey(surveyId);
      return args.raw === true ? doc : summarizeSurvey(doc);
    },
  }),
];
