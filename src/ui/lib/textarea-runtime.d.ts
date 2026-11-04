// Generated from checked JavaScript/JSDoc by runtime-declarations.mjs.
/**
 * Shared, opt-in measurement for React and native pages. It never changes the
 * value, selection, focus or form events. Refresh after an imperative value or
 * parent change; destroy before removing a native control.
 * @param {HTMLTextAreaElement} field
 * @returns {TextareaAutosizeController | undefined}
 */
export function initTextareaAutosize(
  field: HTMLTextAreaElement,
): TextareaAutosizeController | undefined;
/** @param {HTMLTextAreaElement} field */
export function refreshTextareaAutosize(field: HTMLTextAreaElement): void;
/** @param {HTMLTextAreaElement} field */
export function destroyTextareaAutosize(field: HTMLTextAreaElement): void;
export type TextareaAutosizeController = {
  refresh: () => void;
  destroy: () => void;
};
