import { ActionGroup } from './action-group';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

/** In-page heading; counters, refresh state and actions remain owner-supplied content. */
export interface SectionHeaderProps {
  title: ReactNode;
  headingId?: string;
  /** The caller owns the document outline; PageHeader remains the sole page h1. */
  level?: 2 | 3 | 4 | 5 | 6;
  context?: ReactNode;
  actions?: ReactNode;
  /** Shared divider and density-aware inset below the section heading. */
  separated?: boolean;
  /** Product spacing and placement, without redefining the heading appearance. */
  className?: string;
}

export function SectionHeader({
  title,
  headingId,
  level = 2,
  context,
  actions,
  separated = false,
  className,
}: SectionHeaderProps) {
  const headingLevel = [2, 3, 4, 5, 6].includes(level) ? level : 2;
  const Heading = `h${headingLevel}` as const;
  const showContext = Boolean(context) || context === 0;
  const showActions = Boolean(actions) || actions === 0;
  return (
    <div
      className={cn('base-section-header', className)}
      data-separated={separated ? 'true' : undefined}
    >
      <div className="base-section-heading">
        <Heading id={headingId} className="base-section-title" data-level={headingLevel}>
          {title}
        </Heading>
        {showContext && <div className="base-section-context">{context}</div>}
      </div>
      {showActions && (
        <ActionGroup align="start" className="base-page-actions">
          {actions}
        </ActionGroup>
      )}
    </div>
  );
}
