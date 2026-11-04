import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../lib/utils';

export interface ResourceListProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  variant?: 'plain' | 'bordered';
  density?: 'normal' | 'comfortable';
}

export interface ResourceListRowProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  interactive?: boolean;
  /** Visual emphasis only; current/selected semantics and focus remain caller-owned. */
  highlighted?: boolean;
}

/** Styling only: consumers retain native list structure and content layout. */
export const ResourceList = React.forwardRef<HTMLDivElement, ResourceListProps>(
  ({ asChild = false, variant = 'plain', density = 'normal', className, ...props }, ref) => {
    const Component = asChild ? Slot : 'div';
    return (
      <Component
        {...props}
        ref={ref}
        className={cn('base-resource-list', className)}
        data-variant={variant}
        data-density={density}
      />
    );
  },
);
ResourceList.displayName = 'ResourceList';

/** Column labels share row insets; consumers retain grid, visibility and native semantics. */
export const ResourceListHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }
>(({ asChild = false, className, ...props }, ref) => {
  const Component = asChild ? Slot : 'div';
  return <Component {...props} ref={ref} className={cn('base-resource-list-header', className)} />;
});
ResourceListHeader.displayName = 'ResourceListHeader';

/** Interactive appearance never supplies routing, roles or keyboard handlers. */
export const ResourceListRow = React.forwardRef<HTMLDivElement, ResourceListRowProps>(
  ({ asChild = false, interactive = false, highlighted = false, className, ...props }, ref) => {
    const Component = asChild ? Slot : 'div';
    return (
      <Component
        {...props}
        ref={ref}
        className={cn('base-resource-list-row', className)}
        data-interactive={interactive ? 'true' : undefined}
        data-highlighted={highlighted || undefined}
      />
    );
  },
);
ResourceListRow.displayName = 'ResourceListRow';

type ResourceListTextProps = React.HTMLAttributes<HTMLSpanElement> & {
  /** Preserve the caller's heading or paragraph semantics without adding a wrapper. */
  asChild?: boolean;
  /** Literal resource IDs, revisions and paths use the shared monospace token. */
  technical?: boolean;
  /** Inherit the surrounding link/status color, or emphasize a resource identifier. */
  tone?: 'default' | 'inherit' | 'accent';
};

/** A resource name; the caller owns its data and position in the document outline. */
export const ResourceListTitle = React.forwardRef<HTMLSpanElement, ResourceListTextProps>(
  ({ asChild = false, technical = false, tone = 'default', className, ...props }, ref) => {
    const Component = asChild ? Slot : 'span';
    return (
      <Component
        {...props}
        ref={ref}
        className={cn('base-resource-title', className)}
        data-technical={technical || undefined}
        data-tone={tone === 'inherit' || tone === 'accent' ? tone : undefined}
      />
    );
  },
);
ResourceListTitle.displayName = 'ResourceListTitle';

/** Secondary row text; default phrasing content also works inside a native action. */
export const ResourceListDescription = React.forwardRef<HTMLSpanElement, ResourceListTextProps>(
  ({ asChild = false, technical = false, tone = 'default', className, ...props }, ref) => {
    const Component = asChild ? Slot : 'span';
    return (
      <Component
        {...props}
        ref={ref}
        className={cn('base-resource-description', className)}
        data-technical={technical || undefined}
        data-tone={tone === 'inherit' || tone === 'accent' ? tone : undefined}
      />
    );
  },
);
ResourceListDescription.displayName = 'ResourceListDescription';

/** One native action per row; the consumer owns selection, data and the callback. */
export const ResourceListButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ type = 'button', className, ...props }, ref) => (
  <button
    {...props}
    ref={ref}
    type={type}
    className={cn('base-resource-list-row', className)}
    data-interactive="true"
  />
));
ResourceListButton.displayName = 'ResourceListButton';
