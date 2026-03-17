'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { DossierProvider } from '@/context/DossierContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
  }));
  return (
    <QueryClientProvider client={queryClient}>
      <DossierProvider>{children}</DossierProvider>
    </QueryClientProvider>
  );
}
