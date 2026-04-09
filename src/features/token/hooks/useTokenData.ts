'use client';

import { useEffect, useRef } from 'react';
import { streams } from '@/lib/sdkClient';
import { useTokenStore } from '@/features/token/store/useTokenStore';
import type { WssTokenDetailsResponseType } from '@mobula_labs/types';
import { UpdateBatcher } from '@/utils/UpdateBatcher';

export function useTokenData(
  address: string,
  blockchain: string,
  initialData?: WssTokenDetailsResponseType['tokenData'] | null
) {
  const { setToken, setTokenLoading, setError, reset } = useTokenStore();

  // Create batcher for token updates (batched via rAF for 60fps)
  const tokenBatcherRef = useRef<UpdateBatcher<WssTokenDetailsResponseType['tokenData']>>(
    new UpdateBatcher((updates) => {
      // Apply the most recent update
      if (updates.length > 0) {
        const latestUpdate = updates[updates.length - 1];
        setToken(latestUpdate);
        setTokenLoading(false);
      }
    })
  );

  useEffect(() => {
    if (!address || !blockchain) return;

    setError(null);
    tokenBatcherRef.current.clear();

    // Use SSR data if available
    if (initialData) {
      setToken(initialData);
      setTokenLoading(false);
    } else {
      setTokenLoading(true);
    }

    // Subscribe to token updates (streams wrapper handles server/client mode)
    let subscription: ReturnType<typeof streams.subscribeTokenDetails> | null = null;
    
    try {
      subscription = streams.subscribeTokenDetails(
        { tokens: [{ blockchain, address }] },
        (update: unknown) => {
          const data = update as WssTokenDetailsResponseType;
          if (data?.tokenData) {
            tokenBatcherRef.current.add(data.tokenData);
          }
        }
      );
    } catch (error) {
      console.error('Failed to subscribe to token updates:', error);
      if (!initialData) {
        setError(error instanceof Error ? error.message : 'Failed to load token data');
        setTokenLoading(false);
      }
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
      tokenBatcherRef.current.clear();
      reset();
    };
  }, [address, blockchain, initialData, setToken, setTokenLoading, setError, reset]);
}

