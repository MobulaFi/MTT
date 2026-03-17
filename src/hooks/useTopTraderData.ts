// hooks/useTopTradersData.ts
import { useEffect, useCallback, useRef } from 'react';
import { useTopTradersStore } from '@/store/useTopTraderStore';
import { sdk, streams } from '@/lib/sdkClient';
import type { TokenPositionsParams, TokenPositionsResponse } from '@mobula_labs/types';
import type { StreamTradeEvent } from '@/features/pair/store/usePairHolderStore';
import { UpdateBatcher } from '@/utils/UpdateBatcher';

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
    setTokenAddress,
    setBlockchain,
    setFilters,
    setFilter: setStoreFilter,
    clearFilters: clearStoreFilters,
    upsertFromTrades,
    reset,
  } = useTopTradersStore();

  const isFetchingRef = useRef(false);
  const lastFetchParamsRef = useRef<string>('');
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  // Stable callback ref — avoids recreating the batcher
  const callbackRef = useRef(upsertFromTrades);
  callbackRef.current = upsertFromTrades;

  const batcherRef = useRef(
    new UpdateBatcher<StreamTradeEvent>((trades) => {
      if (trades.length === 0) return;
      callbackRef.current(trades);
    }),
  );

  const fetchTopTraders = useCallback(
    async (customFilters?: TopTradersFilters) => {
      if (!tokenAddress || !blockchain) {
        console.warn('[useTopTradersData] Missing required params:', { tokenAddress, blockchain });
        return;
      }

      const filtersToUse = customFilters !== undefined ? customFilters : filters;

      const fetchKey = JSON.stringify({ tokenAddress, blockchain, filters: filtersToUse });

      if (isFetchingRef.current && lastFetchParamsRef.current === fetchKey) {
        return;
      }

      isFetchingRef.current = true;
      lastFetchParamsRef.current = fetchKey;

      setLoading(true);
      setError(null);
      setTokenAddress(tokenAddress);
      setBlockchain(blockchain);
      setFilters(filtersToUse);

      try {
        const requestParams: TokenPositionsParams = {
          address: tokenAddress,
          blockchain: blockchain,
          useSwapRecipient: true,
          includeFees: true,
        };

        if (filtersToUse.label) {
          requestParams.label = filtersToUse.label as TokenPositionsParams['label'];
        }
        if (filtersToUse.limit) {
          requestParams.limit = filtersToUse.limit;
        }
        if (filtersToUse.walletAddresses && filtersToUse.walletAddresses.length > 0) {
          requestParams.walletAddresses = filtersToUse.walletAddresses;
        }

        const response = await sdk.fetchTokenTraderPositions(requestParams) as TokenPositionsResponse;

        if (response?.data) {
          setData(response);
          setLoading(false);
        } else {
          console.warn('[useTopTradersData] Empty response');
          setError('No data received from API');
          setLoading(false);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch top traders';
        console.error('[useTopTradersData] Error:', {
          error: err,
          message: errorMessage,
        });
        setError(errorMessage);
        setLoading(false);
      } finally {
        isFetchingRef.current = false;
      }
    },
    [tokenAddress, blockchain, filters, setData, setLoading, setError, setTokenAddress, setBlockchain, setFilters]
  );

  const setFilter = useCallback(
    (key: keyof TopTradersFilters, value: any) => {
      const newFilters = { ...filters, [key]: value };

      setStoreFilter(key, value);

      fetchTopTraders(newFilters);
    },
    [filters, setStoreFilter, fetchTopTraders]
  );

  const clearFilters = useCallback(() => {
    clearStoreFilters();

    fetchTopTraders({});
  }, [filters, clearStoreFilters, fetchTopTraders]);

  useEffect(() => {
    if (!tokenAddress || !blockchain) {
      console.warn('[useTopTradersData] Skipping initial fetch - missing params');
      return;
    }

    const init = async () => {
      // 1. Subscribe first so we don't miss trades during the REST fetch
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = streams.subscribeFastTrade(
        {
          assetMode: true,
          items: [{ blockchain, address: tokenAddress }],
        },
        (trade: unknown) => {
          const data = trade as StreamTradeEvent;
          if (!data || data.event || !data.hash || !data.sender) return;
          batcherRef.current.add(data);
        },
      );

      // 2. Fetch initial data
      await fetchTopTraders({});
    };

    init();

    // Periodic resync every 30s to catch transfers and missed trades
    const pollInterval = setInterval(() => {
      fetchTopTraders({});
    }, 30_000);

    return () => {
      clearInterval(pollInterval);
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
      batcherRef.current.clear();
      reset();
    };
  }, [tokenAddress, blockchain, reset]);

  return {
    data,
    filters,
    isLoading,
    error,
    setFilter,
    clearFilters,
    refetch: () => fetchTopTraders(filters),
  };
}
