import type { RefObject } from 'react';

export function captureDialogOpener(target: EventTarget | null): HTMLElement | null {
  const content = target as HTMLElement | null;
  const owner = content?.ownerDocument;
  const active = owner?.activeElement;
  return active &&
    active !== owner?.body &&
    !content?.contains(active) &&
    'focus' in active &&
    typeof active.focus === 'function'
    ? (active as HTMLElement)
    : null;
}

/** Reuse the initiating control if it still participates in interaction. */
export function restoreDialogFocus(
  references: Array<RefObject<HTMLElement | null> | undefined>,
): boolean {
  const target = references
    .map((reference) => reference?.current)
    .find(
      (element) =>
        element?.isConnected &&
        !element.matches(':disabled,[hidden],[inert]') &&
        !element.closest('[hidden],[inert]'),
    );
  if (!target) return false;
  target.focus();
  return true;
}
