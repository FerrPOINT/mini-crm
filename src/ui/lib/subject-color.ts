import type { CSSProperties } from 'react';
import { foreground, isHex } from './branding-colors.js';

type SubjectStyle = CSSProperties & {
  '--base-subject-background': string;
  '--base-subject-foreground': string;
};

/** Missing colors inherit the containing badge; invalid supplied colors reset
 * to neutral theme tokens rather than leaking CSS or inheriting another label.
 */
export function subjectColorStyle(color: string | undefined): SubjectStyle | undefined {
  if (color === undefined) return undefined;
  return isHex(color)
    ? {
        '--base-subject-background': color,
        '--base-subject-foreground': foreground(color),
      }
    : {
        '--base-subject-background': 'var(--color-surface-raised)',
        '--base-subject-foreground': 'var(--color-text-primary)',
      };
}
