/**
 * Generates a form's `fieldCSS` / `mobileFieldCSS` from its `fieldStyle`.
 *
 * The public renderer styles inputs from these CSS strings, NOT from `fieldStyle`:
 * the builder regenerates them from `fieldStyle` on every save. A form written only
 * through the API therefore keeps whatever CSS it was created with — without it the
 * page falls back to the theme's filled inputs and never loads the font.
 *
 * Trailing spaces are written as ${' '} so editors can't strip them (the test
 * compares byte-for-byte). Transcribed from the CSS the builder generated for a live form on 2026-09-24
 * (docs/api-notes.md, live run 1). With the default fieldStyle this reproduces it.
 * Mobile differs only in the label / placeholder colours (mobileLabelColor,
 * mobilePlaceholderColor, shortLabel.mobileColor).
 */

type Box = { top?: number; right?: number; bottom?: number; left?: number };
type Shadow = { horizontal?: number; vertical?: number; blur?: number; spread?: number; color?: string };

export interface FieldStyleLike {
  width?: number;
  bgColor?: string;
  fontColor?: string;
  primaryColor?: string;
  activeTagBgColor?: string;
  border?: { border?: number; color?: string; radius?: number; type?: string };
  padding?: Box;
  shadow?: Shadow;
  labelColor?: string;
  labelFontFamily?: string;
  labelFontSize?: number;
  labelFontWeight?: number;
  mobileLabelColor?: string;
  placeholderColor?: string;
  placeholderFontFamily?: string;
  placeholderFontSize?: number;
  placeholderFontWeight?: number;
  mobilePlaceholderColor?: string;
  shortLabel?: { color?: string; fontFamily?: string; fontSize?: number; fontWeight?: number; mobileColor?: string };
  [key: string]: unknown;
}

const FONT_WEIGHTS = '100,100i,300,300i,400,400i,500,500i,700,700i,900,900i';

export function generateFieldCSS(fs: FieldStyleLike, opts: { mobile?: boolean } = {}): string {
  const s = fs || {};
  const b = s.border || {};
  const p = s.padding || {};
  const sh = s.shadow || {};
  const sl = s.shortLabel || {};

  const bg = `#${s.bgColor ?? 'FFFFFFFF'}`;
  const font = `#${s.fontColor ?? '101828FF'}`;
  const primary = `#${s.primaryColor ?? '155EEFFF'}`;
  const borderColor = `#${b.color ?? 'D0D5DDFF'}`;
  const border = `${b.border ?? 1}px ${b.type ?? 'solid'} ${borderColor}`;
  const radius = `${b.radius ?? 6}px`;
  const padding = `${p.top ?? 8}px ${p.right ?? 8}px ${p.bottom ?? 8}px ${p.left ?? 8}px`;
  const shadow = `${sh.horizontal ?? 0}px ${sh.vertical ?? 1}px ${sh.blur ?? 2}px ${sh.spread ?? 0}px #${sh.color ?? '1018280D'}`;
  const inFamily = s.placeholderFontFamily ?? 'Inter';
  const inSize = `${s.placeholderFontSize ?? 16}px`;
  const inWeight = s.placeholderFontWeight ?? 400;
  const placeholder = `#${(opts.mobile ? s.mobilePlaceholderColor : s.placeholderColor) ?? s.placeholderColor ?? '667085FF'}`;
  const labelColor = `#${(opts.mobile ? s.mobileLabelColor : s.labelColor) ?? s.labelColor ?? '344054FF'}`;
  const summaryColor = `#${s.labelColor ?? '344054FF'}`;
  const labelFamily = s.labelFontFamily ?? 'Inter';
  const labelSize = `${s.labelFontSize ?? 16}px`;
  const labelWeight = s.labelFontWeight ?? 500;
  const shortColor = `#${(opts.mobile ? sl.mobileColor : sl.color) ?? sl.color ?? '464D5FFF'}`;
  const shortFamily = sl.fontFamily ?? 'Inter';
  const shortSize = `${sl.fontSize ?? 12}px`;
  const shortWeight = sl.fontWeight ?? 300;
  const activeTag = `#${s.activeTagBgColor ?? '009EF426'}`;
  const maxWidth = `${s.width ?? 900}px`;

  const families = Array.from(new Set([labelFamily, inFamily, shortFamily].filter(Boolean)));
  const fontImport = `@import url('https://fonts.googleapis.com/css?family=${families
    .map((f) => `${f.replace(/ /g, '+')}:${FONT_WEIGHTS}`)
    .join('|')}');`;

  return `${fontImport}

  #_builder-form .form-builder--item input[type=text][class=form-control],#_builder-form .form-builder--item .date-picker-custom-style,#_builder-form .form-builder--item input[type=number]{
    background-color: ${bg} !important;
    color: ${font} !important;
    border: ${border} !important;
    border-radius: ${radius} !important;
    padding: ${padding} !important;
    box-shadow: ${shadow};
    font-family: '${inFamily}';
    font-size: ${inSize};
    font-weight: ${inWeight};
    background-clip: inherit !important;
  }
  #_builder-form textarea {
    background-color: ${bg} !important;
    color: ${font} !important;
    border: ${border} !important;
    border-radius: ${radius} !important;
    padding: ${padding} !important;
    box-shadow: ${shadow} !important;
    font-family: '${inFamily}';
    font-size: ${inSize};
    font-weight: ${inWeight};
    background-clip: inherit !important;
  }
  #_builder-form input[type=tel],#_builder-form input[type=email],#_builder-form .multiselect .multiselect__tags{
    background-color: ${bg} !important;
    color: ${font} !important;
    border: ${border} !important;
    border: ${border} !important;
    border-radius: ${radius} !important;
    padding: ${padding} !important;
    box-shadow: ${shadow};
    font-family: '${inFamily}';
    font-size: ${inSize};
    font-weight: ${inWeight};
    background-clip: inherit !important;
  }
  #_builder-form .multi_select_form {
    border-radius: ${radius} !important;
  }
  #_builder-form .iti--allow-dropdown input, .iti--allow-dropdown input[type=tel]{
    padding-left: 38px !important;
  }
  #_builder-form .countryphone {
    height: inherit;
  }


  #_builder-form .form-builder--item .date-picker-custom-style input[type=text],  #_builder-form .form-builder--item .multiselect .multiselect__placeholder {
    padding:0;
    background-color: ${bg};
    color: ${font};
    font-size: ${inSize};
  }
  #_builder-form .form-builder--item .multiselect .multiselect__input{
    background-color: ${bg} !important;
  }
  #_builder-form .form-builder--item .multiselect .multiselect__select{
    background: transparent;
    z-index:10;
  }
  #_builder-form .form-builder--item .multiselect ,.multiselect__single{
    padding:0 !important;
    margin:0 !important;
    min-height: 24px;
    color:  ${font} !important;
    background-color: ${bg} !important;
    font-family: '${inFamily}';
    font-size: ${inSize};
    font-weight: ${inWeight};
  }
  #_builder-form .form-builder--item  .multiselect__placeholder {
    padding:0 !important;
    margin:0 !important;
    min-height: 24px;
    color: ${placeholder} !important;
    background-color: ${bg} !important;
    font-family: '${inFamily}';
    font-size: ${inSize};
    font-weight: ${inWeight};
  }
  #_builder-form .field-container{
    width:100%;
    max-width: ${maxWidth};
  }
  #_builder-form ::-webkit-input-placeholder { /* Chrome, Firefox, Opera, Safari 10.1+ */
    color: ${placeholder};
    font-family: '${inFamily}';
    font-size: ${inSize};
    font-weight: ${inWeight};
    opacity: 1; /* Firefox */
  }
  #_builder-form ::placeholder, .signature-placeholder {
    color: ${placeholder} !important;
    font-family: '${inFamily}';
    font-size: ${inSize};
    font-weight: ${inWeight};
  }

  #_builder-form .input-icon {
    color: ${placeholder};
  }
${'    '}
  #_builder-form :-ms-input-placeholder { /* Internet Explorer 10-11 */
    color: ${placeholder} !important;
    font-family: '${inFamily}';
    font-size: ${inSize};
    font-weight: ${inWeight};
  }
  #_builder-form ::-ms-input-placeholder { /* Microsoft Edge */
    color: ${placeholder} !important;
    font-family: '${inFamily}';
    font-size: ${inSize};
    font-weight: ${inWeight};
  }

  #_builder-form label{
    color: ${labelColor};
    font-family: '${labelFamily}';
    font-size: ${labelSize};
    font-weight: ${labelWeight};
  }
  #_builder-form label * {
    color: ${labelColor};
    font-family: '${labelFamily}';
  }
  #_builder-form .text-element * {
    color: inherit;
    font-family: '${labelFamily}';
  }
  #_builder-form .short-label{
    color: ${shortColor};
    font-family: '${shortFamily}';
    font-size: ${shortSize};
    font-weight: ${shortWeight};
    -webkit-font-smoothing: auto;
  }
  #_builder-form .form-builder--item .payment-suggestion-tag-container {
    background-color: ${bg};
    color: ${font} !important;
    font-family: '${inFamily}';
    font-size: ${inSize};
    font-weight: ${inWeight};
      box-shadow: ${shadow};
  }
  #_builder-form .product-summary-amount-large, #order-confirmation .product-summary-amount-large {
    color: ${summaryColor};
    font-size: 20px;
    font-weight: 700;
    font-family: ${labelFamily};
    line-height: 1.5rem;
  }
  #_builder-form .product-summary-amount-normal, #order-confirmation .product-summary-amount-normal {
    color: ${summaryColor};
    font-size: 16px;
    font-weight: 600;
    font-family: ${labelFamily};
    line-height: 1.5rem;
  }
  #_builder-form .product-summary-label-bold, #order-confirmation .product-summary-label-bold{
    color: ${summaryColor};
    font-size: 16px;
    font-weight: 700;
    font-family: ${labelFamily};
    line-height: 1.5rem;
  }
  #_builder-form .crossed-amount {
    color: ${summaryColor};
    font-size: 18px;
    font-weight: 600;
    font-family: ${labelFamily};
    line-height: 1.5rem;
  }
  #_builder-form .product-summary-label-large, #order-confirmation .product-summary-label-large{
    color: ${summaryColor};
    font-size: 18px;
    font-weight: 600;
    font-family: ${labelFamily};
    line-height: 1.575rem;
  }
  #_builder-form .product-summary-label-normal, #order-confirmation .product-summary-label-normal{
    color: ${summaryColor};
    font-size: 16px;
    font-weight: 500;
    font-family: ${labelFamily};
    line-height: 1.575rem;
  }
  #_builder-form .product-summary-label-small, #order-confirmation .product-summary-label-small{
    color: ${summaryColor};
    font-size: 14px;
    font-weight: 500;
    font-family: ${labelFamily};
    line-height: 1.575rem;
  }
  #_builder-form .variant-tag {
    color: ${summaryColor};
    font-size: 15px;
    font-weight: 500;
    font-family: ${labelFamily};
    line-height: 1.5rem;
  }
  #_builder-form .selected-tag {
    background-color: ${activeTag} !important;
  }
  #_builder-form .payment-tag, #_builder-form .quantity-container-counter {
    box-shadow: ${shadow};
    background-color : ${bg};
  }
  #_builder-form .quantity-container-counter  {
    padding-top: 6px !important;
    padding-bottom:  6px !important;
  }
  #_builder-form .quantity-text {
    font-size: ${inSize} !important;
  }
  .bubble-label, .bubble-checkbox-label {
    background-color: ${bg} !important;
    color: ${placeholder} !important;
    font-family: '${inFamily}' !important;
    font-size: ${inSize} !important;
    font-weight: ${inWeight} !important;
  }
  .bubble-container, .bubble-checkbox-container {
    border: ${border} !important;
    border-radius: 12px !important;
    /* Small horizontal gap between bubbles */
    margin-left: 2px !important;
    margin-right: 2px !important;
    padding: ${padding} !important;
    box-shadow: ${shadow};
    font-family: '${inFamily}';
    font-size: ${inSize};
    font-weight: 500;
    background-clip: inherit !important;
  }
  .vdpHeadCellContent {
    word-wrap: normal;
    }

${'  '}
  /* Input field hover and focus styles */
  #_builder-form .form-builder--item input[type=text][class=form-control]:hover,
  #_builder-form .form-builder--item .date-picker-custom-style:hover,
  #_builder-form .form-builder--item input[type=number]:hover,
  #_builder-form textarea:hover,
  #_builder-form input[type=tel]:hover,
  #_builder-form input[type=email]:hover,
  #_builder-form .multiselect .multiselect__tags:hover {
    border: 1px solid ${primary} !important;
  }

  /* Monetary element input group prepend hover styles */
  #_builder-form .input-group:hover .input-group-prepend .input-group-text {
    border-color: ${primary} !important;
    box-shadow: 0 0 0 2px ${primary}33 !important;
  }
  #_builder-form .form-builder--item input[type=text][class=form-control]:focus,
  #_builder-form .form-builder--item .date-picker-custom-style:focus,
  #_builder-form .form-builder--item input[type=number]:focus,
  #_builder-form textarea:focus,
  #_builder-form input[type=tel]:focus,
  #_builder-form input[type=email]:focus,
  #_builder-form .multiselect .multiselect__tags:focus {
    border: 1px solid ${primary} !important;
    outline: none;
  }

  /* Monetary element input group prepend focus styles */
  #_builder-form .input-group:focus-within .input-group-prepend .input-group-text {
    border-color: ${primary} !important;
    box-shadow: 0 0 0 2px ${primary}33 !important;
  }

  /* Checkbox and Radio button accent color */
   #_builder-form input[type=checkbox] {
    accent-color: ${primary};
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    border-radius: 4px !important;
    height: 16px !important;
    width: 16px !important;
    background: #ffffff;
    position: relative;${' '}
    border: 1px solid ${borderColor};
      &:checked {${' '}
      background : ${primary};

      &::after {
      content: '';
      position: absolute;
      left: 4px;
      top: 1px;
      width: 6px;
      height: 10px;
      border: solid white;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }
    }
  }
   /* Radio button styles */
   #_builder-form input[type=radio] {
    accent-color: ${primary};
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    border-radius: 50% !important;
    height: 16px !important;
    width: 16px !important;
    background: #ffffff;
    position: relative;${' '}
    border: 1px solid ${borderColor};
    &:checked {${' '}
      background : #FFFFFF;

      &::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: ${primary};
      }
    }
  }

  /* Date picker cell hover effect with primary color */
  @media (hover: hover) {
    #_builder-form .vdpCell.selectable:hover .vdpCellContent {
      color: #fff !important;
      background: ${primary} !important;
    }
  }

  /* Date picker today cell with primary color */
  #_builder-form .vdpCell.today {
    color: ${primary} !important;
  }

  /* Date picker selected cell with primary color */
#_builder-form .vdpCell.selectable.selected .vdpCellContent {
  color: #fff !important;
  background: ${primary} !important;
}

  /* File upload hover styles */
  #_builder-form input[type=file]:hover,
  #_builder-form .custom-file-upload:hover,
  #_builder-form .file-input:hover {
    border-color: ${primary};
    box-shadow: 0 0 0 2px ${primary}33;
  }

  /* Signature field hover styles */
  #_builder-form .signature-button:hover {
    border-color: ${primary} !important;
    box-shadow: 0 0 0 2px ${primary}33;
  }

  /* Quantity container counter hover styles */
  #_builder-form .quantity-container-counter:hover {
    border-color: ${primary};
    box-shadow: 0 0 0 2px ${primary}33;
  }

  /* Bubble container hover styles */
  #_builder-form .bubble-container:hover,
  #_builder-form .bubble-checkbox-container:hover {
    border-color: ${primary} !important;
    box-shadow: 0 0 0 2px ${primary}33 !important;
  }

  /* Bubble checkbox checked state - apply primary color to container border */
  #_builder-form .bubble-container:has(input[type=checkbox]:checked),
  #_builder-form .bubble-checkbox-container:has(input[type=checkbox]:checked) {
    border-color: ${primary} !important;
    box-shadow: 0 0 0 2px ${primary}33 !important;
  }

  /* Bubble radio checked state when input is inside the label (common in preview) */
  #_builder-form .bubble-container:has(input[type=radio]:checked),
  #_builder-form .bubble-checkbox-container:has(input[type=radio]:checked) {
    border-color: ${primary} !important;
    box-shadow: 0 0 0 2px ${primary}33 !important;
  }

  /* Bubble radio checked state - apply primary color to label border and indicator */
  #_builder-form .option-radio-bubble input[type=radio]:checked + label {
    border-color: ${primary} !important;
  }
  #_builder-form .option-radio-bubble input[type=radio]:checked + label:before {
    border-color: ${primary} !important;
    background: ${primary} !important;
  }

  /* Payment suggestion tag container hover styles */
  #_builder-form .payment-suggestion-tag-container:hover {
    border-color: ${primary} !important;
    box-shadow: 0 0 0 2px ${primary}33 !important;
  }

  /* Payment suggestion tag container focus styles */
  #_builder-form .payment-suggestion-tag-container:focus-within {
    border-color: ${primary} !important;
    box-shadow: 0 0 0 2px ${primary}33 !important;
  }
  /* Dropdown hover and selection styles */
  #_builder-form .multiselect__option--highlight {
    background-color: ${primary};
    color: #000000;
  }
  #_builder-form .multiselect__option:hover {
    background-color: ${primary};
    color: #000000;
  }

  /* Multiselect tag styles */
  #_builder-form .multiselect__tag {
    border: 1px solid ${primary};
    color: ${font};
    background-color:transparent;
  }
  #_builder-form .multiselect__tag-icon {
    background-color:transparent;
    color: #98A2B3;
  }
  #_builder-form .multiselect__tag-icon:after {

    color: #98A2B3;
  }
  #_builder-form .multiselect__tag-icon:hover {

    color: #98A2B3;
    opacity: 0.8;
  }
  #_builder-form .multiselect__tag-icon:hover:after {

    color: #98A2B3;
  }

  /* Single select dropdown styles */
  #_builder-form select option:hover {
    background-color: ${primary};
    color: #000000;
  }

  /* Custom dropdown components */
  #_builder-form .dropdown-option:hover {
    background-color: ${primary};
    color: #000000;
  }

  /* Button styles when mapPrimaryColorToButtonColor is enabled - only for submit buttons */
${'  '}
  `;
}

/** Regenerate both CSS strings on a form body from its current fieldStyle. */
export function applyGeneratedCSS(form: Record<string, unknown>): void {
  const fs = (form.fieldStyle || {}) as FieldStyleLike;
  form.fieldCSS = generateFieldCSS(fs);
  form.mobileFieldCSS = generateFieldCSS(fs, { mobile: true });
}
