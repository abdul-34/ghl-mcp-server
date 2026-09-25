/**
 * Survey document scaffolding.
 *
 * There is no baked-in default theme yet: a builder-saved reference survey has not
 * been captured into a fixture. A new survey therefore starts either from the
 * server's own minimal formData (returned by POST /surveys/) or, with
 * templateSurveyId, from a copy of an existing builder-saved survey's formData
 * (theme, fieldCSS, footer, settings) with its slides replaced.
 */

import type { SurveyFormData, SurveySlide, SurveyElement } from '../crm/surveys-builder-client.js';
import { addressChildren } from './survey-fields.js';

/** Slide button the server puts on a new survey's first slide (capture §4.1). */
export const DEFAULT_SLIDE_BUTTON = {
  background: '2A3135',
  color: 'FFFFFF',
  border: { border: 0, padding: 11, radius: 0, color: 'FFFFFF' },
};

let slideSeq = 0;

/** Slide ids are "<epochMillis>-<index>"; a process-wide sequence keeps them unique within one millisecond. */
export function newSlideId(index: number): string {
  slideSeq = (slideSeq + 1) % 1000;
  return `${Date.now() + slideSeq}-${index}`;
}

export function newSlide(name: string, index: number, button?: Record<string, unknown>): SurveySlide {
  return {
    id: newSlideId(index),
    slideName: name,
    active: false,
    button: structuredClone(button || DEFAULT_SLIDE_BUTTON),
    slideData: [],
  };
}

export interface SlideSpec {
  name?: string;
  elements: SurveyElement[];
}

/**
 * The full formData to write: `base` (the created survey's minimal formData, or a
 * template survey's) with its slides replaced by `slides`. `company` is taken from
 * the created survey so a template from another location never leaks its branding.
 */
export function buildSurveyFormData(
  base: SurveyFormData,
  slides: SlideSpec[],
  company?: unknown
): SurveyFormData {
  const fd = structuredClone(base) as SurveyFormData;
  if (!fd.form || typeof fd.form !== 'object') fd.form = {};
  if (company !== undefined) fd.form.company = structuredClone(company);
  const button = base.slides?.[0]?.button;
  fd.slides = slides.map((s, i) => {
    const slide = newSlide(s.name || `Slide ${i + 1}`, i, button);
    slide.slideData = s.elements;
    return slide;
  });
  fd.surveyLogicLinkById = true;
  syncFormAddress(fd);
  return fd;
}

/**
 * The builder mirrors the address group's children into form.address. Keep it in
 * sync whenever the survey has an address group; leave it untouched otherwise.
 */
export function syncFormAddress(fd: SurveyFormData): void {
  const all = (fd.slides || []).flatMap((s) => s.slideData || []);
  const gi = all.findIndex((e) => e.type === 'group' && e.tag === 'group_address');
  if (gi < 0) return;
  const children = [];
  for (let i = gi + 1; i < all.length && all[i].category === 'address' && !all[i].uuid; i++) children.push(all[i]);
  const existing = (fd.form.address && typeof fd.form.address === 'object' ? fd.form.address : {}) as Record<string, unknown>;
  fd.form.address = {
    autoCompleteEnabled: true,
    label: 'Address',
    placeholder: 'Search address',
    required: true,
    ...existing,
    children: structuredClone(children.length ? children : addressChildren()),
  };
}
