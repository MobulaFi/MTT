'use client';

import { useEffect, useRef } from 'react';
import { sdk, streams } from '@/lib/sdkClient';
import { usePairHoldersStore } from '@/features/pair/store/usePairHolderStore';
import type { StreamTradeEvent } from '@/features/pair/store/usePairHolderStore';
import type { TokenPositionsResponse } from '@mobula_labs/types';
import { UpdateBatcher } from '@/utils/UpdateBatcher';

/** Map blockchain name → multi-event stream config */
function getStreamConfig(blockchain: string): {
  streamType: 'stream-svm' | 'stream-evm';
  chainId: string;
} | null {
  const name = blockchain.toLowerCase();
  if (name === 'solana') return { streamType: 'stream-svm', chainId: 'solana:solana' };
  if (name === 'ethereum') return { streamType: 'stream-evm', chainId: 'evm:1' };
  if (name.includes('bnb') || name.includes('bsc') || name.includes('bep20'))
    return { streamType: 'stream-evm', chainId: 'evm:56' };
  if (name === 'base') return { streamType: 'stream-evm', chainId: 'evm:8453' };
  if (name === 'arbitrum') return { streamType: 'stream-evm', chainId: 'evm:42161' };
  if (name === 'polygon') return { streamType: 'stream-evm', chainId: 'evm:137' };
  if (name === 'avalanche') return { streamType: 'stream-evm', chainId: 'evm:43114' };
  return null;
}

/** Map a swap-enriched event from the multi-event stream to StreamTradeEvent */
function mapSwapToTradeEvent(raw: Record<string, unknown>): StreamTradeEvent | null {
  const type = raw.type as string;
  if (type !== 'buy' && type !== 'sell') return null;

  const sender = (raw.sender as string) || (raw.transactionSenderAddress as string);
  if (!sender) return null;

  const hash = (raw.hash as string) || (raw.transactionHash as string);
  if (!hash) return null;

  // Determine which token is base to pick the right post-balance fields
  const baseToken = raw.baseToken as string | undefined;
  const addressToken0 = raw.addressToken0 as string | undefined;
  const isToken0Base = baseToken && addressToken0 && baseToken === addressToken0;

  const postBalanceBaseToken = isToken0Base
    ? (raw.rawPostBalance0 as string) ?? null
    : (raw.rawPostBalance1 as string) ?? null;
  const postBalanceRecipientBaseToken = isToken0Base
    ? (raw.rawPostBalanceRecipient0 as string) ?? null
    : (raw.rawPostBalanceRecipient1 as string) ?? null;

  return {
    sender,
    swapRecipient: (raw.swapRecipient as string) ?? null,
    type,
    tokenAmount: Number(raw.tokenAmount) || 0,
    tokenAmountUsd: Number(raw.tokenAmountUSD) || 0,
    tokenPrice: Number(raw.tokenPrice) || 0,
    timestamp: raw.date ? new Date(raw.date as string | number).getTime() : Date.now(),
    blockchain: (raw.blockchain as string) || '',
    hash,
    labels: raw.labels as string[] | undefined,
    postBalanceBaseToken,
    postBalanceRecipientBaseToken,
    tokenAmountRaw: raw.tokenAmountRaw?.toString(),
  };
}

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
      const config = getStreamConfig(blockchain);

      if (config) {
        // Use multi-event stream — has both sender and recipient post-balances
        subscription = streams.subscribe(
          config.streamType,
          {
            chainIds: [config.chainId],
            events: ['swap-enriched'],
            filters: {
              or: [
                { eq: { addressToken0: tokenAddress } },
                { eq: { addressToken1: tokenAddress } },
              ],
            },
          },
          (event: unknown) => {
            // Multi-event stream wraps data in { data, chainId, subscriptionId }
            const envelope = event as Record<string, unknown>;
            const swapData = (envelope.data ?? envelope) as Record<string, unknown>;
            if (!swapData || swapData.event) return;

            const trade = mapSwapToTradeEvent(swapData);
            if (!trade) return;

            console.log('[holders-stream] swap-enriched:', {
              hash: trade.hash,
              type: trade.type,
              sender: trade.sender,
              swapRecipient: trade.swapRecipient,
              tokenAmount: trade.tokenAmount,
              postBalanceBaseToken: trade.postBalanceBaseToken,
              postBalanceRecipientBaseToken: trade.postBalanceRecipientBaseToken,
            });
            batcherRef.current.add(trade);
          },
        );
      } else {
        // Fallback: fast-trade for unsupported chains
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
      }

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
