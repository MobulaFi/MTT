'use client';

import { useEffect, useRef } from 'react';
import { streams } from '@/lib/sdkClient';
import { prefetchTokenDetails } from '@/lib/prefetch';
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

  // Fire REST fetch eagerly during render (t=0ms) via prefetch cache.
  // Always fetch even when the store was hydrated by navigateToToken — list-page
  // data (Pulse/Trending) may have different field names or missing fields.
  if (address && blockchain && !initialData) {
    prefetchTokenDetails(address, blockchain);
  }

  useEffect(() => {
    if (!address || !blockchain) return;

    let cancelled = false;
    setError(null);
    tokenBatcherRef.current.clear();

    // Use SSR data if available
    if (initialData) {
      setToken(initialData);
      setTokenLoading(false);
    } else {
      // If navigateToToken already hydrated the store with list page data,
      // show it immediately (no loading spinner) but still fetch full token
      // details — Pulse/list data may have different field names or missing fields.
      const existingToken = useTokenStore.getState().token;
      if (existingToken) {
        setTokenLoading(false);
      } else {
        setTokenLoading(true);
      }
      // Always fetch full token details via REST to replace partial list-page data
      prefetchTokenDetails(address, blockchain)
        .then((res: any) => {
          if (cancelled) return;
          if (res?.data) {
            setToken(res.data);
            setTokenLoading(false);
          }
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          console.error('Failed to fetch token details:', err);
        });
    }

    // Subscribe to live updates via WebSocket
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
      cancelled = true;
      if (subscription) {
        subscription.unsubscribe();
      }
      tokenBatcherRef.current.clear();
      reset();
    };
  }, [address, blockchain, initialData, setToken, setTokenLoading, setError, reset]);
}
