import {
  forwardRef,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { useComposedRefs } from '@radix-ui/react-compose-refs';
import { Button } from './button';
import { ConfirmDialog } from './async-states';

export interface ConfirmActionProps extends Pick<
  ComponentPropsWithoutRef<typeof Button>,
  'id' | 'variant' | 'size' | 'disabled' | 'className' | 'aria-label' | 'aria-describedby'
> {
  children: ReactNode;
  title: string;
  description?: string;
  /** Product-owned action, called only after confirmation. Return its promise to retain pending. */
  onConfirm: () => unknown;
  confirmVariant?: 'default' | 'destructive';
  confirmLabel?: string;
  cancelLabel?: string;
  pendingLabel?: string;
  isPending?: boolean;
  confirmDisabled?: boolean;
  error?: string | null;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
}

/** A button and its local confirmation; data, authorization and recovery remain with the caller. */
export const ConfirmAction = forwardRef<HTMLButtonElement, ConfirmActionProps>(
  function ConfirmAction(
    {
      children,
      title,
      description,
      onConfirm,
      confirmVariant = 'default',
      confirmLabel,
      cancelLabel,
      pendingLabel,
      isPending = false,
      confirmDisabled,
      error,
      fallbackFocusRef,
      disabled,
      ...buttonProps
    },
    forwardedRef,
  ) {
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const ref = useComposedRefs(forwardedRef, trigger);
    return (
      <>
        <Button
          {...buttonProps}
          ref={ref}
          type="button"
          disabled={disabled || isPending}
          aria-busy={isPending || undefined}
          onClick={() => setOpen(true)}
        >
          {children}
        </Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title={title}
          description={description}
          onConfirm={onConfirm}
          closeOnConfirm
          confirmVariant={confirmVariant}
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel}
          pendingLabel={pendingLabel}
          isPending={isPending}
          confirmDisabled={disabled || confirmDisabled}
          error={error}
          returnFocusRef={trigger}
          fallbackFocusRef={fallbackFocusRef}
        />
      </>
    );
  },
);
