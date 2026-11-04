import { PageNavigation } from './page-navigation';
import { useUiLabels } from './labels';
import { cn } from '../lib/utils';

export interface OffsetPageNavigationProps {
  offset: number;
  limit: number;
  total: number;
  onOffsetChange: (offset: number) => void;
  label: string;
  pending?: boolean;
  /** Keep a range summary without inactive controls when the first page is also the last. */
  singlePage?: 'controls' | 'summary';
  className?: string;
}

/** Offset/limit presentation only; requests, filters and URL changes belong to the owner. */
export function OffsetPageNavigation({
  offset,
  limit,
  total,
  onOffsetChange,
  label,
  pending = false,
  singlePage = 'controls',
  className,
}: OffsetPageNavigationProps) {
  const labels = useUiLabels();
  // A valid offset need not be divisible by limit; previous still returns toward zero.
  const page = Math.ceil(offset / limit) + 1;
  const summary =
    offset < total
      ? `${offset + 1}–${Math.min(offset + limit, total)} ${labels.of} ${total}`
      : labels.noRecords;
  // A stale nonzero offset still needs a way back after deletion or a total change.
  if (singlePage === 'summary' && offset === 0 && total <= limit) {
    return (
      <p className={cn('text-sm text-text-muted', className)} aria-live="polite">
        {summary}
      </p>
    );
  }
  return (
    <PageNavigation
      page={page}
      hasNext={offset + limit < total}
      onPageChange={(next) =>
        onOffsetChange(next < page ? Math.max(0, offset - limit) : offset + limit)
      }
      label={label}
      pending={pending}
      className={className}
      summary={summary}
    />
  );
}
