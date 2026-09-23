/**
 * Known-good default form document.
 *
 * POST /forms/ stores formData verbatim — the server injects no style, theme,
 * layout or on-submit behaviour (blueprint Addendum B). Every create therefore
 * deep-clones this template and swaps in the name + fields.
 *
 * Contents are only the values captured from a live builder-made document:
 * §3 form-level defaults, §6 fieldStyle, §9 formAction. Keys whose value shape was
 * not captured (formSchedule.states, payment, notifications, tracking hooks) are
 * deliberately absent — builder-made forms that predate those features lack them too.
 * If a given agency renders this poorly, create with `templateFormId` instead.
 */

import type { FormData, FormField } from '../crm/forms-builder-client.js';

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

const DEFAULT_FORM_DATA: FormData = {
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
  },
};

/** A fresh, independent copy of the default document with the given fields. */
export function buildDefaultFormData(fields: FormField[]): FormData {
  const data = structuredClone(DEFAULT_FORM_DATA);
  data.form.fields = structuredClone(fields);
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
