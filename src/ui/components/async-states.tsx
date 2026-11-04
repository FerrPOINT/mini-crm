import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import { Button } from './button';
import { ActionGroup } from './action-group';
import { useUiLabels } from './labels';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog';

interface LoadingStateProps {
  message?: string;
  /** Presentation scope of the loading indicator. */
  scope?: 'page' | 'local';
}

export function LoadingState({ message, scope = 'page' }: LoadingStateProps) {
  const { t } = useTranslation();
  const labels = useUiLabels();
  return (
    <>
      <div
        role="status"
        aria-busy="true"
        aria-label={message ?? t('common.loading', { defaultValue: labels.loading })}
        className="base-loading-state"
        data-scope={scope}
      >
        {message ?? t('common.loading', { defaultValue: labels.loading })}
      </div>
    </>
  );
}

interface EmptyStateProps {
  message: string;
  /** Optional document heading; the owner chooses its level in the surrounding page. */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ message, headingLevel, description, icon, action }: EmptyStateProps) {
  const Message = headingLevel
    ? (`h${headingLevel}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6')
    : 'p';
  return (
    <div className="base-empty-state">
      {icon}
      <Message className={headingLevel ? 'base-empty-heading' : undefined}>{message}</Message>
      {description && <p className="base-empty-description">{description}</p>}
      {action}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  /** Product-owned request admission; does not start, cancel or repeat a request. */
  retryDisabled?: boolean;
  /** Presentation scope of the error message. */
  scope?: 'page' | 'local';
}

export function ErrorState({
  message,
  onRetry,
  retryDisabled = false,
  scope = 'page',
}: ErrorStateProps) {
  const { t } = useTranslation();
  const labels = useUiLabels();
  return (
    <>
      <div role="alert" className="base-error-state" data-scope={scope}>
        <p className="base-error-message">{message}</p>
        {onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={retryDisabled}
            onClick={onRetry}
          >
            <RotateCcw className="base-state-retry-icon" />
            {t('common.retry', { defaultValue: labels.retry })}
          </Button>
        )}
      </div>
    </>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  onConfirm: () => unknown;
  isPending?: boolean;
  confirmDisabled?: boolean;
  error?: string | null;
  returnFocusRef?: RefObject<HTMLElement | null>;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
  confirmLabel?: string;
  cancelLabel?: string;
  pendingLabel?: string;
  confirmVariant?: 'default' | 'destructive';
  closeOnConfirm?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onConfirm,
  isPending = false,
  confirmDisabled = false,
  error,
  returnFocusRef,
  fallbackFocusRef,
  confirmLabel,
  cancelLabel,
  pendingLabel,
  confirmVariant = 'destructive',
  closeOnConfirm = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const initiator = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const locked = useRef(false);
  const generation = useRef(0);
  const action = useRef(0);
  const promisePending = useRef(false);
  const wasPending = useRef(isPending);
  const [submitting, setSubmitting] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  const busy = isPending || submitting;
  if (wasOpen !== open) {
    setWasOpen(open);
    setSubmitting(false);
  }
  useLayoutEffect(() => {
    generation.current += 1;
    locked.current = false;
    promisePending.current = false;
    if (
      open &&
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
    ) {
      initiator.current = document.activeElement;
    }
    return () => {
      generation.current += 1;
    };
  }, [open]);
  useLayoutEffect(() => {
    if (wasPending.current && !isPending && !promisePending.current) locked.current = false;
    wasPending.current = isPending;
  }, [isPending]);
  useLayoutEffect(() => {
    if (open && busy) contentRef.current?.focus({ preventScroll: true });
  }, [open, busy]);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => !isPending && !locked.current && onOpenChange(next)}
    >
      <AlertDialogContent
        ref={contentRef}
        tabIndex={-1}
        onOpenAutoFocus={(event) => {
          if (busy) {
            event.preventDefault();
            contentRef.current?.focus({ preventScroll: true });
          }
        }}
        className="min-w-0 w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto"
        onCloseAutoFocus={(event) => {
          // A pending form can disable its opener; cancellation must stay in that retained modal.
          const retainedModal = [
            ...document.querySelectorAll<HTMLElement>(
              '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
            ),
          ]
            .reverse()
            .find(
              (element) =>
                element !== contentRef.current &&
                !contentRef.current?.contains(element) &&
                !element.closest('[hidden],[inert]'),
            );
          const candidates = [
            returnFocusRef?.current,
            initiator.current,
            fallbackFocusRef?.current,
          ];
          const target =
            candidates.find(
              (element) =>
                element?.isConnected &&
                (!retainedModal || retainedModal.contains(element)) &&
                !element.matches(':disabled,[hidden],[inert]') &&
                !element.closest(
                  '[hidden],[inert],[role="dialog"][data-state="closed"],[role="alertdialog"][data-state="closed"]',
                ),
            ) ?? retainedModal;
          if (target) {
            event.preventDefault();
            target.focus();
          }
        }}
      >
        <AlertDialogHeader className="min-w-0 text-left">
          <AlertDialogTitle className="break-words [overflow-wrap:anywhere]">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription
            className="break-words [overflow-wrap:anywhere]"
            hidden={!description}
          >
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p
            role="alert"
            className="min-w-0 break-words [overflow-wrap:anywhere] text-sm text-danger"
          >
            {error}
          </p>
        )}
        {children && (
          <fieldset disabled={busy} className="base-page-stack min-w-0 border-0 p-0">
            {children}
          </fieldset>
        )}
        <ActionGroup className="pt-2">
          <AlertDialogCancel className="min-h-10 sm:min-h-10" disabled={busy}>
            {cancelLabel ?? t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={confirmVariant}
            className="min-h-10 sm:min-h-10"
            disabled={busy || confirmDisabled}
            aria-label={confirmLabel ?? t('common.confirm')}
            aria-busy={busy}
            onClick={(event) => {
              event.preventDefault();
              if (isPending || confirmDisabled || locked.current) return;
              locked.current = true;
              const current = generation.current;
              const currentAction = ++action.current;
              const release = () => {
                if (generation.current !== current || action.current !== currentAction) return;
                locked.current = false;
                promisePending.current = false;
                setSubmitting(false);
              };
              try {
                const result = onConfirm();
                if (
                  result &&
                  (typeof result === 'object' || typeof result === 'function') &&
                  'then' in result &&
                  typeof result.then === 'function'
                ) {
                  promisePending.current = true;
                  setSubmitting(true);
                  void Promise.resolve(result).then(() => {
                    if (generation.current !== current || action.current !== currentAction) return;
                    release();
                    if (closeOnConfirm) onOpenChange(false);
                  }, release);
                } else {
                  queueMicrotask(release);
                  if (closeOnConfirm) onOpenChange(false);
                }
              } catch (error) {
                queueMicrotask(release);
                throw error;
              }
            }}
          >
            {busy ? (pendingLabel ?? t('common.loading')) : (confirmLabel ?? t('common.confirm'))}
          </AlertDialogAction>
        </ActionGroup>
      </AlertDialogContent>
    </AlertDialog>
  );
}
