'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { usePulseV2 } from '@/features/pulse/hooks/usePulseV2';

type PulseStreamContextValue = ReturnType<typeof usePulseV2>;

const PulseStreamContext = createContext<PulseStreamContextValue | null>(null);

interface PulseStreamProviderProps {
  children: ReactNode;
}

export function PulseStreamProvider({ children }: PulseStreamProviderProps) {
  const pulseStream = usePulseV2('default', 'solana', { enabled: true });

  return (
    <PulseStreamContext.Provider value={pulseStream}>
      {children}
    </PulseStreamContext.Provider>
  );
}

export function usePulseStreamContext() {
  const context = useContext(PulseStreamContext);

  if (!context) {
    throw new Error('usePulseStreamContext must be used inside PulseStreamProvider');
  }

  return context;
}


