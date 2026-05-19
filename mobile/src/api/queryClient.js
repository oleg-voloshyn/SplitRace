import { QueryClient } from '@tanstack/react-query';

// Module-scoped singleton so non-React code (logout, push handlers) can clear
// caches without threading a ref through context.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000
    }
  }
});

export { queryClient };
