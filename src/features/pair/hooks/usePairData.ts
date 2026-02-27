'use client';
import { useEffect, useRef } from 'react';
import { streams } from '@/lib/sdkClient';
import { usePairStore } from '@/features/pair/store/pairStore';
import type { WssMarketDetailsResponseType } from '@mobula_labs/types';
import { UpdateBatcher } from '@/utils/UpdateBatcher';

export function usePairData(
  address: string,
  blockchain: string,
  initialData?: WssMarketDetailsResponseType['pairData'] | null
) {
  const { setData, setLoading, setError, reset, setTotalSupply } = usePairStore();

  // Create batcher for pair updates (batched via rAF for 60fps)
  const pairBatcherRef = useRef<UpdateBatcher<WssMarketDetailsResponseType['pairData']>>(
    new UpdateBatcher((updates) => {
      // Apply the most recent update
      if (updates.length > 0) {
        const latestUpdate = updates[updates.length - 1];
        if (latestUpdate) {
          setData(latestUpdate);
          setTotalSupply(latestUpdate.base?.totalSupply ?? null);
        }
      }
    })
  );

  useEffect(() => {
    setError(null);
    pairBatcherRef.current.clear();

    // Use SSR data if available
    if (initialData) {
      setData(initialData);
      setTotalSupply(initialData.base?.totalSupply ?? null);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // Subscribe to pair updates (streams wrapper handles server/client mode)
    let subscription: ReturnType<typeof streams.subscribeMarketDetails> | null = null;

    try {
      subscription = streams.subscribeMarketDetails(
        { pools: [{ blockchain, address }] },
        (tradeUpdate: unknown) => {
          const data = tradeUpdate as WssMarketDetailsResponseType;
          if (data?.pairData) {
            pairBatcherRef.current.add(data.pairData);
          }
        }
      );
    } catch (error) {
      console.error('Failed to subscribe to pair updates:', error);
      if (!initialData) {
        setError(error instanceof Error ? error.message : 'Failed to load pair data');
      }
    }

    // Cleanup subscription on unmount or dependency change
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
      pairBatcherRef.current.clear();
      reset();
    };
  }, [address, blockchain, initialData, setData, setLoading, setError, reset, setTotalSupply]);
}

