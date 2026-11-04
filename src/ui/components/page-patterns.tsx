import { ActionGroup } from './action-group';
import { Label } from './label';
import { Notice } from './notice';
import {
  useRef,
  useState,
  type FormEvent,
  type FormHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { AlertTriangle } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from './async-states';
import { cn } from '../lib/utils';
import { useUiLabels } from './labels';
import { Button } from './button';

export type ResourceState =
  | { kind: 'ready' }
  | { kind: 'loading'; message?: string }
  | { kind: 'empty'; message: string; action?: ReactNode }
  | {
      kind: 'not-found' | 'permission-denied';
      title?: string;
      /** The surrounding document owns heading hierarchy; existing callers keep h2. */
      headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
      icon?: ReactNode;
      message?: string;
      back?: ReactNode;
    }
  | { kind: 'error'; message?: string; onRetry?: () => void }
  | { kind: 'partial-error'; message?: string; onRetry?: () => void };

export function resourceErrorState(
  error: unknown,
  onRetry?: () => void,
  options: { hasData?: boolean; message?: string } = {},
): ResourceState {
  const status =
    error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
      ? error.status
      : undefined;
  if (status === 404)
    return {
      kind: 'not-found',
      ...(options.message ? { message: options.message } : {}),
    };
  if (status === 401 || status === 403)
    return {
      kind: 'permission-denied',
      ...(options.message ? { message: options.message } : {}),
    };
  const cancelled =
    error &&
    typeof error === 'object' &&
    (('kind' in error && error.kind === 'cancelled') ||
      ('name' in error && error.name === 'AbortError'));
  const retryable =
    !cancelled &&
    (status === undefined || status === 0 || status === 408 || status === 429 || status >= 500);
  return {
    kind: options.hasData && retryable ? 'partial-error' : 'error',
    message: options.message,
    onRetry: retryable ? onRetry : undefined,
  };
}

export function ResourceStateView({
  state,
  scope = 'page',
  children,
}: {
  state: ResourceState;
  scope?: 'page' | 'local';
  /** Mounted only for ready/partial-error; the owner still manages data and cache lifetime. */
  children?: ReactNode;
}) {
  return (
    <>
      <ResourceStateMessage state={state} scope={scope} />
      {(state.kind === 'ready' || state.kind === 'partial-error') && children}
    </>
  );
}

function ResourceStateMessage({ state, scope }: { state: ResourceState; scope: 'page' | 'local' }) {
  const labels = useUiLabels();
  switch (state.kind) {
    case 'ready':
      return null;
    case 'loading':
      return <LoadingState message={state.message} scope={scope} />;
    case 'empty':
      return <EmptyState message={state.message} action={state.action} />;
    case 'not-found':
    case 'permission-denied': {
      const Heading = `h${state.headingLevel ?? 2}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      const missing = state.kind === 'not-found';
      return (
        <section className="base-terminal-state" data-page-state={state.kind}>
          {state.icon && (
            <span className="base-terminal-icon" aria-hidden>
              {state.icon}
            </span>
          )}
          <Heading className={state.headingLevel === 1 ? 'base-page-title' : 'base-state-title'}>
            {state.title ?? (missing ? labels.notFound : labels.denied)}
          </Heading>
          <p className="base-state-description">
            {state.message ?? (missing ? labels.notFoundMessage : labels.deniedMessage)}
          </p>
          {(Boolean(state.back) || state.back === 0) && (
            <div className="base-terminal-action">{state.back}</div>
          )}
        </section>
      );
    }
    case 'error':
      return (
        <ErrorState
          message={state.message ?? labels.readError}
          onRetry={state.onRetry}
          scope={scope}
        />
      );
    case 'partial-error':
      return (
        <div role="status" data-page-state="partial-error" className="base-partial-state">
          <AlertTriangle className="base-state-icon" aria-hidden />
          <p>{state.message ?? labels.readPartialError}</p>
          {state.onRetry && (
            <Button type="button" size="sm" variant="outline" onClick={state.onRetry}>
              {labels.retry}
            </Button>
          )}
        </div>
      );
  }
}

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

export interface PagePatternProps extends PageHeaderProps {
  children: ReactNode;
  state?: ResourceState;
}
function terminal(state?: ResourceState) {
  return state?.kind === 'not-found' || state?.kind === 'permission-denied';
}
function content(children: ReactNode, state?: ResourceState) {
  return <ResourceStateView state={state ?? { kind: 'ready' }}>{children}</ResourceStateView>;
}
export function ListPage({
  leading,
  headingRef,
  headingTabIndex,
  filters,
  title,
  titleAppearance,
  context,
  actions,
  children,
  state,
}: PagePatternProps & { filters?: ReactNode }) {
  return (
    <section className="base-page-stack">
      <PageHeader
        leading={leading}
        headingRef={headingRef}
        headingTabIndex={headingTabIndex}
        title={title}
        titleAppearance={titleAppearance}
        context={context}
        actions={terminal(state) ? undefined : actions}
      />
      {filters && !terminal(state) && <div className="base-filter-row">{filters}</div>}
      {content(children, state)}
    </section>
  );
}
export function DetailPage({
  leading,
  headingRef,
  headingTabIndex,
  aside,
  asideLabel,
  title,
  titleAppearance,
  context,
  actions,
  children,
  state,
}: PagePatternProps & { aside?: ReactNode; asideLabel?: string }) {
  return (
    <section className="base-page-stack">
      <PageHeader
        leading={leading}
        headingRef={headingRef}
        headingTabIndex={headingTabIndex}
        title={title}
        titleAppearance={titleAppearance}
        context={context}
        actions={terminal(state) ? undefined : actions}
      />
      {content(
        <div className={aside ? 'page-split' : 'min-w-0'}>
          <div className="min-w-0">{children}</div>
          {aside && (
            <aside aria-label={asideLabel} className="min-w-0">
              {aside}
            </aside>
          )}
        </div>,
        state,
      )}
    </section>
  );
}
export function DashboardLayout({
  leading,
  headingRef,
  headingTabIndex,
  title,
  titleAppearance,
  context,
  actions,
  children,
  state,
}: PagePatternProps) {
  return (
    <section className="base-page-stack">
      <PageHeader
        leading={leading}
        headingRef={headingRef}
        headingTabIndex={headingTabIndex}
        title={title}
        titleAppearance={titleAppearance}
        context={context}
        actions={terminal(state) ? undefined : actions}
      />
      {content(children, state)}
    </section>
  );
}
export function AuditLogView(props: PagePatternProps & { filters?: ReactNode }) {
  return <ListPage {...props} />;
}
export interface PendingFormProps extends Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  pending?: boolean;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}
export function PendingForm({
  pending = false,
  onSubmit,
  children,
  className,
  ...props
}: PendingFormProps) {
  const locked = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const busy = pending || submitting;
  function submit(event: FormEvent<HTMLFormElement>) {
    if (pending || locked.current) {
      event.preventDefault();
      return;
    }
    locked.current = true;
    function release() {
      locked.current = false;
      setSubmitting(false);
    }
    try {
      const result = onSubmit?.(event);
      if (result) {
        setSubmitting(true);
        void Promise.resolve(result).then(release, release);
      } else queueMicrotask(release);
    } catch (error) {
      release();
      throw error;
    }
  }
  return (
    <form
      {...props}
      onSubmit={submit}
      aria-busy={busy || undefined}
      className={cn('base-page-stack', className)}
    >
      <fieldset disabled={busy} className="base-page-stack border-0 p-0">
        {children}
      </fieldset>
    </form>
  );
}
export function FormPage({
  leading,
  headingRef,
  headingTabIndex,
  title,
  titleAppearance,
  context,
  actions,
  children,
  state,
  pending,
  onSubmit,
  className,
  ...formProps
}: PagePatternProps & Omit<PendingFormProps, 'title' | 'children'>) {
  return (
    <section className="base-page-stack">
      <PageHeader
        leading={leading}
        headingRef={headingRef}
        headingTabIndex={headingTabIndex}
        title={title}
        titleAppearance={titleAppearance}
        context={context}
      />
      {content(
        <PendingForm {...formProps} pending={pending} onSubmit={onSubmit} className={className}>
          {children}
          {actions && (
            <ActionGroup align="start" className="base-page-actions">
              {actions}
            </ActionGroup>
          )}
        </PendingForm>,
        state,
      )}
    </section>
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
