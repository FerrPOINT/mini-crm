import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../lib/utils';

type SectionEdges = 'start' | 'end' | 'both' | 'none';

export interface ContentSectionProps extends React.HTMLAttributes<HTMLElement> {
  /** Retain the owner's native section, form, div or definition group. */
  asChild?: boolean;
  /** Block-axis dividers; this transparent frame does not add a Card surface. */
  dividers?: SectionEdges;
  /** Defaults to the divider edges; override only when content needs both insets. */
  inset?: SectionEdges | 'auto';
  /** Both sizes follow the current branding density. */
  density?: 'default' | 'compact';
}

/** Presentation only: native semantics, layout, resource state and effects stay with the owner. */
export const ContentSection = React.forwardRef<HTMLElement, ContentSectionProps>(
  function ContentSection(
    {
      asChild = false,
      dividers = 'start',
      inset = 'auto',
      density = 'default',
      className,
      ...props
    },
    ref,
  ) {
    const Component = asChild ? Slot : 'section';
    return (
      <Component
        {...props}
        ref={ref}
        className={cn('base-content-section', className)}
        data-dividers={dividers}
        data-inset={inset === 'auto' ? dividers : inset}
        data-density={density}
      />
    );
  },
);
