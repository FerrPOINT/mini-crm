import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../lib/utils';

type ResourceListTextProps = React.HTMLAttributes<HTMLSpanElement> & {
  /** Preserve the caller's heading or paragraph semantics without adding a wrapper. */
  asChild?: boolean;
  /** Literal resource IDs, revisions and paths use the shared monospace token. */
  technical?: boolean;
  /** Inherit the surrounding link/status color, or emphasize a resource identifier. */
  tone?: 'default' | 'inherit' | 'accent';
};

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
