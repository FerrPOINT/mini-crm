import { useLayoutEffect, useRef, useState, type AriaAttributes } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from './dialog';
import { useUiLabels } from './labels';
import { PageNavigation } from './page-navigation';
import { restoreDialogFocus } from '../lib/dialog-focus';

import type { ChoiceOption } from './choice-types';
export interface SearchableSelectProps extends Pick<
  AriaAttributes,
  'aria-invalid' | 'aria-describedby'
> {
  id?: string;
  label: string;
  value: string;
  selectedLabel?: string;
  placeholder: string;
  options: ChoiceOption[];
  search?: string;
  onSearch?: (search: string) => void;
  offset: number;
  pageSize: number;
  total?: number;
  hasNext?: boolean;
  onPage: (offset: number) => void;
  onChange: (value: string) => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  disabled?: boolean;
  allowEmpty?: boolean;
}

/** A paged choice dialog uses native buttons and Radix focus management, not a second form. */
export function SearchableSelect({
  id,
  label,
  value,
  selectedLabel,
  placeholder,
  options,
  search = '',
  onSearch,
  offset,
  pageSize,
  total,
  hasNext,
  onPage,
  onChange,
  loading,
  error,
  onRetry,
  disabled,
  allowEmpty = true,
  ...accessibility
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const requestFocus = useRef<{
    direction: 0 | 1 | null;
    offset: number;
    initiator: HTMLElement;
  } | null>(null);
  const labels = useUiLabels();
  const selected = selectedLabel ?? options.find((option) => option.value === value)?.label;
  const page = Math.ceil(offset / pageSize) + 1;
  const more = total === undefined ? hasNext === true : offset + pageSize < total;
  const summary =
    total === undefined
      ? undefined
      : total === 0
        ? `0 ${labels.options}`
        : options.length
          ? `${offset + 1}–${Math.min(offset + options.length, total)} ${labels.of} ${total}`
          : labels.noRecords;
  useLayoutEffect(() => {
    if (!open) {
      requestFocus.current = null;
      return;
    }
    const request = requestFocus.current;
    const content = contentRef.current;
    if (!request || !content) return;
    const active = content.ownerDocument.activeElement;
    // A user who moved elsewhere owns the new focus position.
    if (
      active !== content.ownerDocument.body &&
      active !== content &&
      active !== request.initiator
    ) {
      requestFocus.current = null;
      return;
    }
    if (loading) {
      content.focus({ preventScroll: true });
      return;
    }
    if (!error && offset !== request.offset) return;
    requestFocus.current = null;
    if (error) {
      restoreDialogFocus([retryRef, contentRef]);
      return;
    }
    if (request.direction === null) {
      restoreDialogFocus([
        searchRef,
        {
          current:
            optionsRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? null,
        },
        contentRef,
      ]);
      return;
    }
    const buttons = footerRef.current?.querySelectorAll<HTMLButtonElement>('button');
    restoreDialogFocus([
      { current: buttons?.[request.direction] ?? null },
      { current: buttons?.[1 - request.direction] ?? null },
      searchRef,
      contentRef,
    ]);
  }, [open, loading, error, offset, options, more]);
  function changePage(next: number) {
    const nextOffset = next < page ? Math.max(0, offset - pageSize) : offset + pageSize;
    const active = contentRef.current?.ownerDocument.activeElement;
    requestFocus.current =
      active && footerRef.current?.contains(active)
        ? {
            direction: next < page ? 0 : 1,
            offset: nextOffset,
            initiator: active as HTMLElement,
          }
        : null;
    onPage(nextOffset);
  }
  function retry() {
    const active = contentRef.current?.ownerDocument.activeElement;
    requestFocus.current =
      active === retryRef.current && active
        ? { direction: null, offset, initiator: active as HTMLElement }
        : null;
    onRetry?.();
  }
  function choose(next: string) {
    requestFocus.current = null;
    onChange(next);
    setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          {...accessibility}
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={`${label}: ${value ? (selected ?? labels.selectUnavailable) : placeholder}`}
          title={value ? (selected ?? labels.selectUnavailable) : placeholder}
          className="base-choice-trigger"
        >
          <span className="base-choice-summary">
            {value ? (selected ?? labels.selectUnavailable) : placeholder}
          </span>
          <ChevronDown aria-hidden className="h-4 w-4 shrink-0" />
        </Button>
      </DialogTrigger>
      <DialogContent ref={contentRef} tabIndex={-1}>
        <DialogTitle>{label}</DialogTitle>
        <DialogDescription>
          {onSearch ? labels.selectDescription : labels.chooseOne}
        </DialogDescription>
        {onSearch && (
          <Input
            ref={searchRef}
            type="search"
            aria-label={`${labels.search}: ${label}`}
            placeholder={labels.searchPlaceholder}
            value={search}
            onChange={(event) => {
              requestFocus.current = null;
              onSearch(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.preventDefault();
            }}
          />
        )}
        <div
          ref={optionsRef}
          className="max-h-[45dvh] space-y-1 overflow-y-auto"
          aria-busy={loading || undefined}
        >
          {allowEmpty && (
            <button type="button" className="base-choice-option w-full" onClick={() => choose('')}>
              {!value && (
                <span className="base-choice-indicator" aria-hidden="true">
                  <Check className="h-4 w-4" />
                </span>
              )}
              {placeholder}
            </button>
          )}
          {error ? (
            <div role="alert" className="space-y-2">
              <p>{error}</p>
              {onRetry && (
                <Button ref={retryRef} type="button" variant="outline" onClick={retry}>
                  {labels.retry}
                </Button>
              )}
            </div>
          ) : loading ? (
            <p role="status">{labels.loading}</p>
          ) : options.length ? (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                className="base-choice-option w-full"
                disabled={option.disabled}
                aria-pressed={option.value === value}
                onClick={() => choose(option.value)}
              >
                {option.value === value && (
                  <span className="base-choice-indicator" aria-hidden="true">
                    <Check className="h-4 w-4" />
                  </span>
                )}
                {option.label}
              </button>
            ))
          ) : (
            <p role="status">
              {offset > 0 || more
                ? labels.noPageOptions
                : search
                  ? labels.noResults
                  : labels.noOptions}
            </p>
          )}
        </div>
        <div ref={footerRef} hidden={loading || Boolean(error)}>
          {!loading &&
            !error &&
            (offset > 0 || more ? (
              <PageNavigation
                label={label}
                page={page}
                hasNext={more}
                summary={summary}
                onPageChange={changePage}
              />
            ) : (
              <p className="text-sm text-text-muted">{summary ?? `${labels.page} ${page}`}</p>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
