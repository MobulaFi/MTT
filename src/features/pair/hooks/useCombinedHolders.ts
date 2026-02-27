'use client';

import { useEffect } from 'react';
import { sdk } from '@/lib/sdkClient';
import { usePairHoldersStore } from '@/features/pair/store/usePairHolderStore';
import type { TokenPositionsResponse } from '@mobula_labs/types';

export const useCombinedHolders = (tokenAddress: string, blockchain: string) => {
  const {
    setHolders,
    setHoldersCount,
    setBlockchain,
    clearHolders,
    setLoading,
  } = usePairHoldersStore();

  useEffect(() => {
    if (!tokenAddress || !blockchain) return;

    clearHolders();
    setBlockchain(blockchain);
    setLoading(true);

    // REST API call using the correct endpoint
    const fetchHolders = async () => {
      try {
        const response = await sdk.fetchTokenHolderPositions({
          blockchain,
          address: tokenAddress,
          limit: 100,
        }) as TokenPositionsResponse;

        if (response?.data) {
          setHoldersCount(response.totalCount || response.data.length);
          setHolders(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch holders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHolders();

    return () => {
      clearHolders();
      setLoading(false);
    };
  }, [tokenAddress, blockchain, setHolders, setHoldersCount, setBlockchain, clearHolders, setLoading]);

  return usePairHoldersStore();
};
