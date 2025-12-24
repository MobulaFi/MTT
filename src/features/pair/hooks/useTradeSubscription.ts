'use client';

import { useEffect, useRef } from 'react';
import { usePairTradeStore } from '@/features/pair/store/usePairTradeStore';
import { getMobulaClient } from '@/lib/mobulaClient';
import { UpdateBatcher } from '@/utils/UpdateBatcher';
import type { Transaction } from '@/features/pair/store/usePairTradeStore';

const getClient = () => getMobulaClient();

interface TradeSubscriptionParams {
  address: string;
  blockchain: string;
  isPair?: boolean;
}

/**
 * useTradeSubscription — sets up WebSocket subscription for trades WITHOUT subscribing to store
 * This prevents parent components from re-rendering when trades update
 * Only use this when you need to set up the subscription but don't need the trade data
 */
export const useTradeSubscription = ({
  address,
  blockchain,
  isPair = false,
}: TradeSubscriptionParams) => {
  // Get store actions WITHOUT subscribing to state (using getState to avoid subscription)
  const updateTrades = usePairTradeStore((s) => s.updateTrades);
  const clearTrades = usePairTradeStore((s) => s.clearTrades);
  const seenHashesRef = useRef<Set<string>>(new Set());

  // Create batcher for trade updates (batched via rAF for 60fps)
  const tradeBatcherRef = useRef<UpdateBatcher<Transaction>>(
    new UpdateBatcher((trades) => {
      if (trades.length === 0) return;
      
      // Batch apply all trades at once - single store update per frame
      updateTrades((prev) => {
        const existingHashes = new Set(prev.map((t) => t.hash));
        const newTrades = trades.filter((t) => !existingHashes.has(t.hash));
        
        // Only create new array if there are actually new trades
        if (newTrades.length === 0) {
          return prev; // Return same reference if no new trades
        }
        
        return [...newTrades, ...prev].slice(0, 100); // Keep last 100
      });
    })
  );

  useEffect(() => {
    if (!address || !blockchain) return;

    clearTrades();
    seenHashesRef.current.clear();
    tradeBatcherRef.current.clear();

    const client = getClient();

    const subscriptionId = client.streams.subscribe(
      'fast-trade',
      {
        assetMode: !isPair,
        items: [{ blockchain, address }],
        subscriptionTracking: true,
      },
      (trade: unknown) => {
        const tradeData = trade as Transaction | { hash?: string; event?: string; [key: string]: unknown };
        
        // Skip if invalid or event message
        if (!tradeData || (typeof tradeData === 'object' && 'event' in tradeData && tradeData.event) || !('hash' in tradeData) || !tradeData.hash) {
          return;
        }

        // Skip duplicates
        if (seenHashesRef.current.has(tradeData.hash)) {
          return;
        }
        seenHashesRef.current.add(tradeData.hash);

        // Queue trade instead of immediate update (batched via rAF)
        tradeBatcherRef.current.add(tradeData as Transaction);
      },
    );

    return () => {
      client.streams.unsubscribe('fast-trade', subscriptionId);
      tradeBatcherRef.current.clear();
    };
  }, [address, blockchain, isPair, updateTrades, clearTrades]);
};

