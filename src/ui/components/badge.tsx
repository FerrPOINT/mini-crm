import type { HTMLAttributes } from 'react';
import { cn } from '../lib/utils';
import { subjectColorStyle } from '../lib/subject-color';

export function Badge({
  tone = 'neutral',
  appearance = 'badge',
  className,
  children,
  subjectColor,
  style,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'muted' | 'info' | 'success' | 'warning' | 'danger';
  /** Counter is a compact numeric label; the caller owns formatting and hiding zero. */
  appearance?: 'badge' | 'inline' | 'dot' | 'counter';
  /** #RRGGBB data color for a badge label; semantic tones and other appearances stay separate. */
  subjectColor?: string;
}) {
  const colorStyle = appearance === 'badge' ? subjectColorStyle(subjectColor) : undefined;
  return (
    <span
      {...props}
      className={cn('base-badge', className)}
      data-tone={tone}
      data-appearance={appearance}
      data-subject-color={colorStyle ? subjectColor : undefined}
      style={colorStyle ? { ...style, ...colorStyle } : style}
    >
      {appearance === 'dot' && <span aria-hidden="true" className="base-badge-dot" />}
      {children}
    </span>
  );
}
