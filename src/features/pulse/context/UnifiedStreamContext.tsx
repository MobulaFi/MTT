'use client';

import { createContext, useContext, type ReactNode, useMemo } from 'react';
import { usePulseV2 } from '@/features/pulse/hooks/usePulseV2';
import { useTokenFilters } from '@/features/pulse/hooks/useTokenFilters';
import { useApiStore, type StreamMode } from '@/store/apiStore';

/**
 * Unified stream interface that both pulse-v2 and token-filters implement
 * Note: Pause is handled at UI level only (freeze display on hover), no backend pause operations
 */
interface UnifiedStreamContextValue {
  // Data & Status
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  isHydrated: boolean;

  // Subscription States
  isStreaming: boolean;

  // Actions
  applyFilters(): void;
  resetFilters(): void;

  // Mode info
  currentMode: StreamMode;
  setMode: (mode: StreamMode) => void;

  // Debug Info
  debugInfo: {
    payloadStr: string;
    lastMessage: string;
    messageCount: number;
  };
}

const UnifiedStreamContext = createContext<UnifiedStreamContextValue | null>(null);

interface UnifiedStreamProviderProps {
  children: ReactNode;
}

/**
 * Provider component that manages both pulse-v2 and token-filters streams
 * Only one stream is active at a time based on the mode setting
 */
export function UnifiedStreamProvider({ children }: UnifiedStreamProviderProps) {
  const streamMode = useApiStore((state) => state.streamMode);
  const setStreamMode = useApiStore((state) => state.setStreamMode);

  // Both hooks are called but only one is enabled at a time
  const pulseV2 = usePulseV2('default', 'solana', { enabled: streamMode === 'pulse-v2' });
  const tokenFilters = useTokenFilters({ enabled: streamMode === 'token-filters' });

  const value = useMemo((): UnifiedStreamContextValue => {
    if (streamMode === 'token-filters') {
      return {
        loading: tokenFilters.loading,
        error: tokenFilters.error,
        isConnected: tokenFilters.isConnected,
        isHydrated: tokenFilters.isHydrated,
        isStreaming: tokenFilters.isStreaming,
        applyFilters: tokenFilters.applyFilters,
        resetFilters: tokenFilters.resetFilters,
        currentMode: streamMode,
        setMode: setStreamMode,
        debugInfo: tokenFilters.debugInfo,
      };
    }

    // pulse-v2 mode (default)
    return {
      loading: pulseV2.loading,
      error: pulseV2.error,
      isConnected: pulseV2.isConnected,
      isHydrated: pulseV2.isHydrated,
      isStreaming: pulseV2.isStreaming,
      applyFilters: pulseV2.applyFilters,
      resetFilters: pulseV2.resetFilters,
      currentMode: streamMode,
      setMode: setStreamMode,
      debugInfo: {
        payloadStr: pulseV2.debugInfo.payloadStr,
        lastMessage: pulseV2.debugInfo.lastMessage,
        messageCount: pulseV2.debugInfo.messageCount,
      },
    };
  }, [streamMode, setStreamMode, pulseV2, tokenFilters]);

  return (
    <UnifiedStreamContext.Provider value={value}>
      {children}
    </UnifiedStreamContext.Provider>
  );
}

export function useUnifiedStreamContext() {
  const context = useContext(UnifiedStreamContext);

  if (!context) {
    throw new Error('useUnifiedStreamContext must be used inside UnifiedStreamProvider');
  }

  return context;
}
