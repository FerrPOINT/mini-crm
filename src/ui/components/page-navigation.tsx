import { ActionGroup } from './action-group';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './button';
import { useUiLabels } from './labels';

type PageBoundary =
  | { pageCount: number; hasNext?: never }
  | { pageCount?: never; hasNext: boolean };
export type PageNavigationProps = PageBoundary & {
  page: number;
  onPageChange: (page: number) => void;
  label: string;
  previousLabel?: string;
  nextLabel?: string;
  compact?: boolean;
  hideSinglePage?: boolean;
  pending?: boolean;
  /** Blocks navigation for an owner state that is not an in-flight request. */
  disabled?: boolean;
  /** Shared divider and density-aware inset for navigation below content. */
  separated?: boolean;
  className?: string;
  /** Optional owner-supplied count/range, without duplicating navigation controls. */
  summary?: ReactNode;
};

/** Supports counted pages and cursor catalogues; URL/query state belongs to the product. */
export function PageNavigation({
  page,
  pageCount,
  hasNext,
  onPageChange,
  label,
  previousLabel,
  nextLabel,
  compact = false,
  hideSinglePage = false,
  pending = false,
  disabled = false,
  separated = false,
  className,
  summary,
}: PageNavigationProps) {
  const labels = useUiLabels();
  const canNext = pageCount === undefined ? hasNext : page < pageCount;
  if (hideSinglePage && page <= 1 && !canNext) return null;
  const previous = previousLabel ?? labels.previous;
  const next = nextLabel ?? labels.next;
  return (
    <ActionGroup asChild separated={separated} className={className}>
      <nav aria-label={label} className="base-page-navigation">
        <Button
          type="button"
          variant="outline"
          size={compact ? 'icon' : 'sm'}
          aria-label={previous}
          title={compact ? previous : undefined}
          disabled={disabled || pending || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {compact ? <ChevronLeft className="h-4 w-4" aria-hidden="true" /> : previous}
        </Button>
        <span className="text-sm text-text-muted" aria-live="polite">
          {summary !== undefined
            ? summary
            : pageCount === undefined
              ? `${labels.page} ${page}`
              : `${page} / ${pageCount}`}
        </span>
        <Button
          type="button"
          variant="outline"
          size={compact ? 'icon' : 'sm'}
          aria-label={next}
          title={compact ? next : undefined}
          disabled={disabled || pending || !canNext}
          onClick={() => onPageChange(page + 1)}
        >
          {compact ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : next}
        </Button>
      </nav>
    </ActionGroup>
  );
}
