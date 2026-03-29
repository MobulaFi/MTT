'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useTokenFilters } from '@/features/pulse/hooks/useTokenFilters';

type TokenFiltersStreamContextValue = ReturnType<typeof useTokenFilters>;

const TokenFiltersStreamContext = createContext<TokenFiltersStreamContextValue | null>(null);

interface TokenFiltersStreamProviderProps {
  children: ReactNode;
}

export function TokenFiltersStreamProvider({ children }: TokenFiltersStreamProviderProps) {
  const tokenFiltersStream = useTokenFilters({ enabled: true });

  return (
    <TokenFiltersStreamContext.Provider value={tokenFiltersStream}>
      {children}
    </TokenFiltersStreamContext.Provider>
  );
}

export function useTokenFiltersStreamContext() {
  const context = useContext(TokenFiltersStreamContext);

  if (!context) {
    throw new Error('useTokenFiltersStreamContext must be used inside TokenFiltersStreamProvider');
  }

  return context;
}
