import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ComponentProps } from 'react';
import { cn } from '../lib/utils';

export interface SidebarItemProps extends ComponentProps<'button'> {
  asChild?: boolean;
  active?: boolean;
  compact?: boolean | 'responsive';
  kind?: 'item' | 'group';
}

/** Shared presentation; routes, permissions and disclosure state belong to the product. */
export function SidebarItem({
  asChild = false,
  active,
  compact = false,
  kind = 'item',
  className,
  ...props
}: SidebarItemProps) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      type={asChild ? undefined : 'button'}
      className={cn('base-sidebar-item', className)}
      data-active={active}
      data-compact={compact}
      data-kind={kind}
      {...props}
    />
  );
}

export interface SidebarItemLabelProps extends ComponentProps<'span'> {
  asChild?: boolean;
}

/** The shared text slot keeps truncation and compact visibility tied to SidebarItem. */
export const SidebarItemLabel = forwardRef<HTMLSpanElement, SidebarItemLabelProps>(
  function SidebarItemLabel({ asChild = false, className, ...props }, ref) {
    const Component = asChild ? Slot : 'span';
    return <Component {...props} ref={ref} className={cn('base-sidebar-item-label', className)} />;
  },
);
