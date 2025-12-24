'use client';

import { useEffect } from 'react';
import { getMobulaClient } from '@/lib/mobulaClient';
import { usePairHoldersStore } from '@/features/pair/store/usePairHolderStore';
import type { WssHoldersResponse, MarketTokenHoldersResponse } from '@mobula_labs/types';

const getClient = () => getMobulaClient();

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

    const client = getClient();

    // WSS integration commented out - using REST API only
    // const subscriptionId = client.streams.subscribe(
    //   'holders',
    //   {
    //     tokens: [{ blockchain, address: tokenAddress }],
    //     subscriptionTracking: true,
    //   },
    //   (msg: unknown) => {
    //     const data = msg as WssHoldersResponse;
    //     if (!data?.data?.holders) return;

    //     const { holders, holdersCount } = data.data;
    //     setHoldersCount(holdersCount ?? holders.length);
    //     const freshHolders = holders.slice(0, 50).map(holder => ({
    //       ...holder
    //     }));
    //     setHolders(freshHolders);
    //     setLoading(false);
    //   }
    // );

    // REST API call
    const fetchHolders = async () => {
      try {
        const response: MarketTokenHoldersResponse = await client.fetchMarketTokenHolders({
          blockchain,
          asset: tokenAddress,
          limit: 50,
        });

        if (response?.data) {
          // Map REST API response to WSS format
          const mappedHolders: WssHoldersResponse['data']['holders'] = response.data.map((holder) => ({
            address: holder.address,
            balance: holder.amount,
            balanceRaw: BigInt(holder.amountRaw || '0'),
            nativeBalance: 0,
            nativeBalanceRaw: BigInt(0),
            boughtAmount: 0, // Not available in this API
            boughtAmountRaw: BigInt(0),
            boughtAmountUSD: 0, // Not available in this API
            soldAmount: 0, // Not available in this API
            soldAmountRaw: BigInt(0),
            soldAmountUSD: 0, // Not available in this API
            balanceUSD: holder.amountUSD,
            realizedPnlUSD: 0, // Not available in this API
            unrealizedPnlUSD: 0, // Not available in this API
            tags: holder.tag ? [holder.tag] : [],
            createdAt: null,
            updatedAt: null,
          }));

          setHoldersCount(response.total_count || response.data.length);
          setHolders(mappedHolders);
        }
      } catch (error) {
        console.error('Failed to fetch holders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHolders();

    return () => {
      // WSS cleanup commented out
      // if (subscriptionId) {
      //   client.streams.unsubscribe('holders', subscriptionId);
      // }
      clearHolders();
      setLoading(false);
    };
  }, [tokenAddress, blockchain, setHolders, setHoldersCount, setBlockchain, clearHolders, setLoading]);

  return usePairHoldersStore();
};
