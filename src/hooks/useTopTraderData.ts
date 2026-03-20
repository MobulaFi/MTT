// hooks/useTopTradersData.ts
import { useEffect, useCallback } from 'react';
import { useTopTradersStore } from '@/store/useTopTraderStore';
import { streams as streamWrapper } from '@/lib/sdkClient';
import type { TokenPositionsOutputResponse } from '@mobula_labs/types';

interface UseTopTradersDataParams {
  tokenAddress: string;
  blockchain: string;
}

interface TopTradersFilters {
  label?: string;
  limit?: number;
  walletAddresses?: string[];
}

export function useTopTradersData({ tokenAddress, blockchain }: UseTopTradersDataParams) {
  const {
    data,
    filters,
    isLoading,
    error,
    setData,
    setLoading,
    setError,
    setFilter: setStoreFilter,
    clearFilters: clearStoreFilters,
    upsertHolder,
    removeHolder,
    reset,
  } = useTopTradersStore();

  useEffect(() => {
    if (!tokenAddress || !blockchain) return;

    reset();
    setLoading(true);

    let cancelled = false;

    // Subscribe to holders stream with sortBy: 'realizedPnl' for top traders
    // Use the streams wrapper so it auto-routes to SSE in server mode
    const sub = streamWrapper.subscribe(
      'holders',
      {
        tokens: [{ address: tokenAddress, blockchain }],
        sortBy: 'realizedPnl',
      },
      (msg: unknown) => {
        if (cancelled) return;

        const message = msg as {
          type?: string;
          event?: string;
          data?: {
            tokenKey?: string;
            holders?: TokenPositionsOutputResponse[];
          } & TokenPositionsOutputResponse;
          subscriptionId?: string;
        };

        const type = message.type || message.event;

        switch (type) {
          case 'init': {
            const holders = message.data?.holders || [];
            setData({ data: holders, totalCount: holders.length });
            setLoading(false);
            break;
          }

          case 'update': {
            const updateData = message.data;
            if (!updateData?.walletAddress) break;

            const balance = Number(updateData.tokenAmount) || 0;
            if (balance <= 0) {
              removeHolder(updateData.walletAddress);
            } else {
              upsertHolder(updateData as TokenPositionsOutputResponse);
            }
            break;
          }

          case 'sync': {
            const holders = message.data?.holders || [];
            setData({ data: holders, totalCount: holders.length });
            break;
          }

          case 'subscribed':
          case 'error':
            if (type === 'error') {
              setError('Stream error');
              setLoading(false);
            }
            break;

          default:
            break;
        }
      },
    );

    return () => {
      cancelled = true;
      sub.unsubscribe();
      reset();
    };
  }, [tokenAddress, blockchain, reset, setData, setLoading, setError, upsertHolder, removeHolder]);

  const setFilter = useCallback(
    (key: keyof TopTradersFilters, value: unknown) => {
      setStoreFilter(key, value);
    },
    [setStoreFilter]
  );

  const clearFilters = useCallback(() => {
    clearStoreFilters();
  }, [clearStoreFilters]);

  return {
    data,
    filters,
    isLoading,
    error,
    setFilter,
    clearFilters,
    refetch: () => {},
  };
}
