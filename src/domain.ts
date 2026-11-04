import type { Database } from './database.types';

export type Role = Database['public']['Enums']['app_role'];
export type Status = Database['public']['Enums']['task_status'];
export interface Profile {
  id: string;
  full_name: string;
  role: Role;
}
export interface Site {
  id: string;
  name: string;
  address: string;
  created_at: string;
}
export interface Task {
  id: string;
  title: string;
  description: string;
  site_id: string;
  assignee_id: string;
  status: Status;
  author_id: string;
  created_at: string;
  assignee: { full_name: string } | null;
  author: { full_name: string } | null;
  site: { name: string } | null;
}
export interface HistoryEntry {
  id: number;
  task_id: string;
  actor_id: string;
  from_status: Status | null;
  to_status: Status;
  comment: string | null;
  created_at: string;
  actor: { full_name: string } | null;
}
export const statusLabels: Record<Status, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  in_review: 'На проверке',
  accepted: 'Принята',
  rework: 'На доработке',
};
export const roleLabels: Record<Role, string> = { manager: 'Постановщик', executor: 'Исполнитель' };
export function availableActions(task: Task, user: Profile): { status: Status; label: string }[] {
  if (user.role === 'manager')
    return task.status === 'in_review'
      ? [
          { status: 'accepted', label: 'Принять задачу' },
          { status: 'rework', label: 'Вернуть на доработку' },
        ]
      : [];
  if (task.assignee_id !== user.id) return [];
  if (task.status === 'new' || task.status === 'rework')
    return [{ status: 'in_progress', label: 'Взять в работу' }];
  if (task.status === 'in_progress')
    return [{ status: 'in_review', label: 'Отправить на проверку' }];
  return [];
}
export function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}
