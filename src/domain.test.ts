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
  it('offers only assigned executor transitions', () => {
    expect(availableActions(task, executor).map((action) => action.status)).toEqual([
      'in_progress',
    ]);
    expect(
      availableActions({ ...task, status: 'rework' }, executor).map((action) => action.status),
    ).toEqual(['in_progress']);
    expect(
      availableActions({ ...task, status: 'in_progress' }, executor).map((action) => action.status),
    ).toEqual(['in_review']);
    expect(availableActions(task, { ...executor, id: 'worker-b' })).toEqual([]);
  });
  it('allows manager decisions only during review and leaves terminal tasks read-only', () => {
    expect(
      availableActions({ ...task, status: 'in_review' }, manager).map((action) => action.status),
    ).toEqual(['accepted', 'rework']);
    expect(availableActions(task, manager)).toEqual([]);
    for (const actor of [manager, executor])
      expect(availableActions({ ...task, status: 'accepted' }, actor)).toEqual([]);
    expect(availableActions({ ...task, status: 'in_review' }, executor)).toEqual([]);
  });
});
