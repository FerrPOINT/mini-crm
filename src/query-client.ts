import { QueryClient, type QueryKey } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
  });
}

export async function refreshQueries(client: QueryClient, keys: readonly QueryKey[]) {
  // Cancel snapshots started before the write before fetching the committed state.
  await Promise.all(keys.map((queryKey) => client.cancelQueries({ queryKey })));
  await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
}
