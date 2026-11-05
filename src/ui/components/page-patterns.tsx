import type { ReactNode, Ref } from 'react';
import { ActionGroup } from './action-group';
import { Label } from './label';
import { Notice } from './notice';
import { cn } from '../lib/utils';

export interface PageHeaderProps {
  title: string;
  /** Compact titles keep their full accessible name while fitting one body-sized line. */
  titleAppearance?: 'default' | 'compact';
  /** Optional recovery target; focus remains controlled by the calling workflow. */
  headingRef?: Ref<HTMLHeadingElement>;
  headingTabIndex?: number;
  leading?: ReactNode;
  context?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({
  title,
  titleAppearance = 'default',
  headingRef,
  headingTabIndex,
  leading,
  context,
  actions,
}: PageHeaderProps) {
  const heading = (
    <h1
      ref={headingRef}
      tabIndex={headingTabIndex}
      className="base-page-title"
      data-appearance={titleAppearance === 'compact' ? 'compact' : undefined}
      title={titleAppearance === 'compact' ? title : undefined}
    >
      {title}
    </h1>
  );
  const hasLeading = Boolean(leading) || leading === 0;
  return (
    <div className="base-page-header">
      <div className={cn('min-w-0', titleAppearance === 'compact' && 'flex-1')}>
        {hasLeading ? (
          <div className="base-page-heading">
            {leading}
            {heading}
          </div>
        ) : (
          heading
        )}
        {context && <div className="mt-1 text-sm text-text-secondary">{context}</div>}
      </div>
      {actions && (
        <ActionGroup align="start" className="base-page-actions">
          {actions}
        </ActionGroup>
      )}
    </div>
  );
}

export function FormField({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: (attrs: {
    id: string;
    required?: boolean;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
  }) => ReactNode;
}) {
  const describedBy =
    [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="base-form-field">
      <Label htmlFor={id}>
        {label}
        {required && <span aria-hidden> *</span>}
      </Label>
      {children({
        id,
        required,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <Notice role="alert" tone="danger" appearance="inline" id={`${id}-error`}>
          {error}
        </Notice>
      )}
    </div>
  );
}
