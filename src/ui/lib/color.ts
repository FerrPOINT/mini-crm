import { foreground } from './branding-colors.js';

/** Choose black or white text for a #RRGGBB subject color, without changing it.
 * Invalid strings retain the existing black fallback; validate stored colors at
 * their source. This shares the branding compiler's contrast implementation.
 */
export function readableForeground(color: string): '#000000' | '#ffffff' {
  return foreground(color);
}
