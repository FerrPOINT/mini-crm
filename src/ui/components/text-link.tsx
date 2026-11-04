import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../lib/utils';

/** Inline navigation; route resolution and URL policy remain with the caller. */
export const TextLink = forwardRef<
  HTMLAnchorElement,
  AnchorHTMLAttributes<HTMLAnchorElement> & { asChild?: boolean }
>(({ asChild = false, className, ...props }, ref) => {
  const Component = asChild ? Slot : 'a';
  return <Component {...props} ref={ref} className={cn('base-text-link', className)} />;
});
TextLink.displayName = 'TextLink';
