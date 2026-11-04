import { MutationCache, QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
    mutationCache: new MutationCache({
      onSuccess: async () => {
        // Initial reads can still contain a snapshot from before the committed write.
        await client.cancelQueries();
        await client.invalidateQueries();
      },
    }),
  });
  return client;
}
