'use client';

import { useEffect, useRef } from 'react';
import { sdk, streams } from '@/lib/sdkClient';
import { usePairHoldersStore } from '@/features/pair/store/usePairHolderStore';
import type { StreamTradeEvent } from '@/features/pair/store/usePairHolderStore';
import type { TokenPositionsResponse } from '@mobula_labs/types';
import { UpdateBatcher } from '@/utils/UpdateBatcher';

export const useCombinedHolders = (tokenAddress: string, blockchain: string) => {
  const {
    setHolders,
    setHoldersCount,
    setBlockchain,
    clearHolders,
    setLoading,
    upsertFromTrades,
  } = usePairHoldersStore();

  // Stable callback ref — avoids recreating the batcher when upsertFromTrades changes
  const callbackRef = useRef(upsertFromTrades);
  callbackRef.current = upsertFromTrades;

  const batcherRef = useRef(
    new UpdateBatcher<StreamTradeEvent>((trades) => {
      if (trades.length === 0) return;
      callbackRef.current(trades);
    }),
  );

  useEffect(() => {
    if (!tokenAddress || !blockchain) return;

    clearHolders();
    setBlockchain(blockchain);
    setLoading(true);

    let subscription: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    const init = async () => {
      // 1. Subscribe first so we don't miss trades during the REST fetch
      subscription = streams.subscribeFastTrade(
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

      // 2. Fetch initial data via REST
      try {
        const response = await sdk.fetchTokenHolderPositions({
          blockchain,
          address: tokenAddress,
          limit: 100,
          useSwapRecipient: true,
          includeFees: true,
        }) as TokenPositionsResponse;

        if (!cancelled && response?.data) {
          setHoldersCount(response.totalCount || response.data.length);
          setHolders(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch holders:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    // Periodic resync every 30s to catch transfers and missed trades
    const pollInterval = setInterval(async () => {
      if (cancelled) return;
      try {
        const response = await sdk.fetchTokenHolderPositions({
          blockchain,
          address: tokenAddress,
          limit: 100,
          useSwapRecipient: true,
          includeFees: true,
        }) as TokenPositionsResponse;

        if (!cancelled && response?.data) {
          setHoldersCount(response.totalCount || response.data.length);
          setHolders(response.data);
        }
      } catch {
        // Silent fail — stream is still live
      }
    }, 30_000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      subscription?.unsubscribe();
      batcherRef.current.clear();
      clearHolders();
      setLoading(false);
    };
  }, [tokenAddress, blockchain, setHolders, setHoldersCount, setBlockchain, clearHolders, setLoading]);

  return usePairHoldersStore();
};
