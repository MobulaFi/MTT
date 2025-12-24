'use client';
import { useEffect, useRef } from 'react';
import { getMobulaClient } from '@/lib/mobulaClient';
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
    const client = getMobulaClient();
    setError(null);
    pairBatcherRef.current.clear();

    // Initialize from SSR or cached data
    if (initialData) {
      setData(initialData);
      setTotalSupply(initialData.base?.totalSupply ?? null);
    } else {
      setLoading(true);
    }

    let subscriptionId: string | null = null;

    try {
      subscriptionId = client.streams.subscribe(
        'market-details',
        { pools: [{ blockchain, address }] },
        (tradeUpdate: unknown) => {
          const data = tradeUpdate as WssMarketDetailsResponseType;
          if (data?.pairData) {
            // Queue update instead of immediate processing (batched via rAF)
            pairBatcherRef.current.add(data.pairData);
          }
        }
      );
    } catch (error) {
      console.error('Failed to subscribe to pair updates:', error);
      setError(error instanceof Error ? error.message : 'Failed to load pair data');
    }

    // Cleanup subscription on unmount or dependency change
    return () => {
      if (subscriptionId && typeof client.streams.unsubscribe === 'function') {
        try {
          client.streams.unsubscribe('market-details', subscriptionId);
        } catch (error) {
          console.error('Failed to unsubscribe:', error);
        }
      }
      pairBatcherRef.current.clear();
      reset();
    };
  }, [address, blockchain, initialData, setData, setLoading, setError, reset, setTotalSupply]);
}

