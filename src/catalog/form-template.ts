/**
 * Known-good default form document.
 *
 * POST /forms/ stores formData verbatim — the server injects no style, theme,
 * layout or on-submit behaviour (blueprint Addendum B). Every create therefore
 * deep-clones this template and swaps in the name + fields.
 *
 * Contents are values captured from live builder-made documents: the blueprint's
 * §3 / §6 / §9, plus the keys the builder added when it saved an API-created form
 * on 2026-09-24 (docs/api-notes.md, live run 1). Two of those decide how the public
 * page looks: `submitMessageStyle` (the centred thank-you card) and `fieldCSS` /
 * `mobileFieldCSS` (input styling + font import), which we generate from fieldStyle.
 * Left out on purpose: `company` (agency branding the builder fills in on save) and
 * `height` / form-level `width` (measured by the builder).
 */

import type { FormData, FormField } from '../crm/forms-builder-client.js';
import { applyGeneratedCSS } from './form-css.js';

export const DEFAULT_FIELD_STYLE = {
  width: 900,
  bgColor: 'FFFFFFFF',
  fontColor: '101828FF',
  primaryColor: '155EEFFF',
  activeTagBgColor: '009EF426',
  mapPrimaryColorToButtonColor: false,
  border: { border: 1, color: 'D0D5DDFF', radius: 6, type: 'solid' },
  padding: { top: 8, right: 8, bottom: 8, left: 8 },
  shadow: { horizontal: 0, vertical: 1, blur: 2, spread: 0, color: '1018280D' },
  labelAlignment: 'top',
  labelWidth: 200,
  labelColor: '344054FF',
  labelFontFamily: 'Inter',
  labelFontSize: 16,
  labelFontWeight: 500,
  mobileLabelColor: '344054FF',
  placeholderColor: '667085FF',
  placeholderFontFamily: 'Inter',
  placeholderFontSize: 16,
  placeholderFontWeight: 400,
  mobilePlaceholderColor: '667085FF',
  shortLabel: { color: '464D5FFF', fontFamily: 'Inter', fontSize: 12, fontWeight: 300, mobileColor: '464D5FFF' },
};

export const DEFAULT_FORM_ACTION = {
  actionType: '2',
  redirectUrl: '',
  thankyouText: '<p>Thank you for your submission!</p>',
  headerImageSrc: '',
  mobileHeaderImageSrc: '',
  mobileHeaderImageSrcDeleted: false,
};

const IMAGE_DEFAULTS = {
  desktopImageLayout: 'topFixed',
  mobileImageLayout: 'header',
  imageCornerRadius: 0,
  imageFieldSpacing: 24,
  imageFocusPoint: { x: 50, y: 50 },
};

const DEFAULT_FORM_DATA: FormData = {
  autoResponder: false,
  emailNotifications: false,
  language: 'en-US',
  parentFolderId: '',
  parentFolderName: '',
  recurringProductCurrency: 'USD',
  recurringProductId: null,
  recurringProducts: [],
  form: {
    fields: [],
    currentThemeId: '69df8c1ec7fee340d1abbfa6',
    inputStyleType: 'box',
    formLabelVisible: true,
    isGDPRCompliant: false,
    showImage: false,
    fullScreenMode: true,
    enableTimezone: true,
    layout: 1,
    mobileLayout: 1,
    conditionalLogic: null,
    opportunitySettings: null,
    contactAssociationSettings: null,
    fieldStyle: DEFAULT_FIELD_STYLE,
    formAction: DEFAULT_FORM_ACTION,
    customStyle: '',
    fbPixelId: '',
    formSubmissionEvent: 'SubmitApplication',
    pageViewEvent: 'PageView',
    payment: null,
    stickyContact: false,
    generateSubmissionDocument: false,
    showSubmissionInConversationsFeed: false,
    enableSaveExitConfirmation: false,
    autoResponderConfig: null,
    emailNotificationsConfig: null,
    ...IMAGE_DEFAULTS,
    address: { autoCompleteEnabled: true, children: [], label: 'Address', placeholder: 'Search address', required: true },
    style: {
      acBranding: false,
      background: 'FFFFFF',
      bgImage: '',
      border: { border: 1, color: 'CDE0EC', radius: 4, style: 'dashed' },
      fieldSpacing: 16,
      mobileBgImage: '',
      mobileBgImageDeleted: false,
      padding: { top: 0, right: 20, bottom: 0, left: 20 },
      shadow: { horizontal: 0, vertical: 0, blur: 0, spread: 0, color: 'FFFFFF' },
    },
    submitMessageStyle: {
      autoBgFromImage: false,
      bgColor: 'FFFFFF',
      cornerRadius: 10,
      fontWeight: 400,
      isEnabled: true,
      margin: { top: 'auto', right: 'auto', bottom: 'auto', left: 'auto' },
      mobileBgColor: 'FFFFFF',
      mobileFontWeight: 400,
      mobileMargin: { top: 'auto', right: 'auto', bottom: 'auto', left: 'auto' },
      mobilePadding: { top: 48, right: 48, bottom: 48, left: 48 },
      padding: { top: 48, right: 48, bottom: 48, left: 48 },
    },
    surveyImageSettings: {
      slideSettings: {},
      surveyDefault: { ...IMAGE_DEFAULTS, headerImageSrc: '', mobileHeaderImageSrc: '', mobileHeaderImageSrcDeleted: false, showImage: false },
    },
    formSchedule: {
      enabled: false,
      timezone: '',
      open: { mode: 'anytime', date: '', time: '' },
      close: { mode: 'never', date: '', time: '' },
      states: {
        before: { mode: 'page', html: '', redirectUrl: '' },
        after: { mode: 'page', html: '', redirectUrl: '' },
      },
      appearance: {
        pageBackground: '#f9fafb',
        cardBackground: '#ffffff',
        cardWidth: 460,
        cardHeight: 0,
        cornerRadius: 14,
        shadow: 'soft',
        agencyBranding: false,
        padding: { top: 48, right: 40, bottom: 48, left: 40 },
        margin: { top: 'auto', right: 'auto', bottom: 'auto', left: 'auto' },
      },
    },
  },
};

/** A fresh, independent copy of the default document with the given fields. */
export function buildDefaultFormData(fields: FormField[]): FormData {
  const data = structuredClone(DEFAULT_FORM_DATA);
  data.form.fields = structuredClone(fields);
  applyGeneratedCSS(data.form);
  return data;
}

/**
 * Turn an existing form's formData into a template: deep copy, drop server
 * bookkeeping and folder placement, swap in the new fields. Conditional logic is
 * cleared because it references the source form's fields.
 */
export function formDataFromTemplate(source: FormData, fields: FormField[]): FormData {
  const data = structuredClone(source) as FormData;
  delete data.lastUpdatedAt;
  delete data.parentFolderId;
  delete data.parentFolderName;
  data.form = { ...(data.form || {}), fields: structuredClone(fields), conditionalLogic: null };
  return data;
}
