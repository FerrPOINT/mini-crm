import { describe, expect, it } from 'vitest';
import { availableActions, type Profile, type Task } from './domain';

const executor: Profile = { id: 'worker-a', full_name: 'Иван', role: 'executor' };
const manager: Profile = { id: 'manager-a', full_name: 'Анна', role: 'manager' };
const task: Task = {
  id: 'task-a',
  title: 'Монтаж',
  description: '',
  site_id: 'site-a',
  assignee_id: executor.id,
  author_id: manager.id,
  status: 'new',
  created_at: '2026-11-04T10:00:00Z',
  assignee: { full_name: executor.full_name },
  author: { full_name: manager.full_name },
  site: { name: 'Стройка' },
};
describe('visible task actions', () => {
  it.each([
    ['new', [], ['in_progress']],
    ['in_progress', [], ['in_review']],
    ['in_review', ['accepted', 'rework'], []],
    ['rework', [], ['in_progress']],
    ['accepted', [], []],
  ] as const)('matches the role matrix in %s', (status, forManager, forExecutor) => {
    const current = { ...task, status };
    expect(availableActions(current, manager).map((action) => action.status)).toEqual(forManager);
    expect(availableActions(current, executor).map((action) => action.status)).toEqual(forExecutor);
    expect(availableActions(current, { ...executor, id: 'another-executor' })).toEqual([]);
  });
});
