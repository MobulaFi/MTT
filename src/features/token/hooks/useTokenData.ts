'use client';

import { useEffect, useRef } from 'react';
import { getMobulaClient } from '@/lib/mobulaClient';
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

    const client = getMobulaClient();
    let subscriptionId: string | null = null;

    setError(null);
    tokenBatcherRef.current.clear();

    if (initialData) {
      setToken(initialData);
    } else {
      setTokenLoading(true);
    }

    try {
      subscriptionId = client.streams.subscribe(
        'token-details',
        { tokens: [{ blockchain, address }] },
        (update: unknown) => {
          const data = update as WssTokenDetailsResponseType;
          if (data?.tokenData) {
            // Queue update instead of immediate processing (batched via rAF)
            tokenBatcherRef.current.add(data.tokenData);
          }
        }
      );
    } catch (error) {
      console.error('Failed to subscribe to token updates:', error);
      setError(error instanceof Error ? error.message : 'Failed to load token data');
      setTokenLoading(false);
    }

    return () => {
      if (subscriptionId && typeof client.streams.unsubscribe === 'function') {
        try {
          client.streams.unsubscribe('token-details', subscriptionId);
        } catch (error) {
          console.error('Failed to unsubscribe:', error);
        }
      }
      tokenBatcherRef.current.clear();
      reset();
    };
  }, [address, blockchain, initialData, setToken, setTokenLoading, setError, reset]);
}

