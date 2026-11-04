import { expect, it } from 'vitest';
import { QueryObserver } from '@tanstack/react-query';
import { createQueryClient } from './query-client';

it('refreshes a read already in flight before a successful write', async () => {
  const client = createQueryClient();
  let releaseOld!: (rows: string[]) => void;
  const oldRead = new Promise<string[]>((resolve) => {
    releaseOld = resolve;
  });
  let reads = 0;
  const observer = new QueryObserver(client, {
    queryKey: ['history', 'task-a'],
    queryFn: () => (++reads === 1 ? oldRead : Promise.resolve(['created', 'accepted'])),
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    expect(reads).toBe(1);
    const mutation = client
      .getMutationCache()
      .build(client, { mutationFn: async () => 'accepted' });
    const saving = mutation.execute(undefined);
    await new Promise((resolve) => setTimeout(resolve, 0));
    releaseOld(['created']);
    await saving;
    expect(client.getQueryData(['history', 'task-a'])).toEqual(['created', 'accepted']);
  } finally {
    unsubscribe();
    client.clear();
  }
});

it('also refreshes a previously loaded list after a write', async () => {
  const client = createQueryClient();
  let rows = ['first task'];
  const observer = new QueryObserver(client, { queryKey: ['tasks'], queryFn: async () => rows });
  const unsubscribe = observer.subscribe(() => {});
  try {
    await observer.refetch();
    const mutation = client.getMutationCache().build(client, {
      mutationFn: async () => {
        rows = ['first task', 'new task'];
      },
    });
    await mutation.execute(undefined);
    expect(client.getQueryData(['tasks'])).toEqual(['first task', 'new task']);
  } finally {
    unsubscribe();
    client.clear();
  }
});
