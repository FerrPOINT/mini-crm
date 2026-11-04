import { forwardRef, type HTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../lib/utils';

export interface SidebarListProps extends HTMLAttributes<HTMLDivElement> {
  /** Preserve a native nav/list/list-item/section without an extra DOM container. */
  asChild?: boolean;
  /** Shared divider and density-aware inset; outer placement remains caller-owned. */
  separated?: boolean;
  /** Inset an existing child collection; the caller still owns its hierarchy. */
  nested?: boolean;
}

/** Sidebar composition only; routes, grouping, disclosure and access remain caller-owned. */
export const SidebarList = forwardRef<HTMLDivElement, SidebarListProps>(function SidebarList(
  { asChild = false, separated = false, nested = false, className, ...props },
  ref,
) {
  const Component = asChild ? Slot : 'div';
  return (
    <Component
      {...props}
      ref={ref}
      className={cn('base-sidebar-list', className)}
      data-separated={separated || undefined}
      data-nested={nested || undefined}
    />
  );
});
