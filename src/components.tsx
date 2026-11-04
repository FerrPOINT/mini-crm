import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Notice,
  ActionGroup,
  OffsetPageNavigation,
} from './ui';
import { statusLabels, type Status } from './domain';

export function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Не удалось выполнить действие. Попробуйте ещё раз.';
}

export function StatusBadge({ status }: { status: Status }) {
  const tones = {
    new: 'neutral',
    in_progress: 'info',
    in_review: 'warning',
    accepted: 'success',
    rework: 'danger',
  } as const;
  return <Badge tone={tones[status]}>{statusLabels[status]}</Badge>;
}

export function Pagination({
  page,
  count,
  onPage,
  pending = false,
}: {
  page: number;
  count: number;
  onPage: (page: number) => void;
  pending?: boolean;
}) {
  return (
    <OffsetPageNavigation
      label="Страницы списка"
      limit={20}
      offset={page * 20}
      total={count}
      onOffsetChange={(offset) => onPage(offset / 20)}
      singlePage="summary"
      pending={pending}
    />
  );
}

export function Back({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Button asChild variant="ghost">
      <Link to={to}>
        <ArrowLeft size={16} aria-hidden />
        {children}
      </Link>
    </Button>
  );
}

export function FormModal({
  title,
  description,
  children,
  pending,
  onClose,
}: {
  title: string;
  description: string;
  children: ReactNode;
  pending: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function SaveActions({
  pending,
  error,
  onClose,
  disabled = false,
}: {
  pending: boolean;
  error: unknown;
  onClose: () => void;
  disabled?: boolean;
}) {
  return (
    <>
      {error && (
        <Notice tone="danger" role="alert">
          {message(error)}
        </Notice>
      )}
      <ActionGroup>
        <Button type="submit" disabled={pending || disabled}>
          {pending ? 'Сохраняем…' : 'Сохранить'}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
          Отмена
        </Button>
      </ActionGroup>
    </>
  );
}
