'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { usePairTradeStore, type Transaction } from '@/features/pair/store/usePairTradeStore';
import { getMobulaClient } from '@/lib/mobulaClient';
import { UpdateBatcher } from '@/utils/UpdateBatcher';
import { shallow } from 'zustand/shallow';

const getClient = () => getMobulaClient();

interface CombinedTradesParams {
  address: string;
  blockchain: string;
  isPair?: boolean; // default false
}

/**
 * useCombinedTrades — unified hook for both token and pair trades
 * - Supports assetMode true/false depending on isPair
 * - Subscribes to "fast-trade" WebSocket stream
 * - Batches updates via rAF to prevent render storms
 */
export const useCombinedTrades = ({
  address,
  blockchain,
  isPair = false,
}: CombinedTradesParams) => {
  const [wsChartTrades, setWsChartTrades] = useState<Transaction[]>([]);
  // Use granular selector - only subscribe to trades array
  const wsTrades = usePairTradeStore((s) => s.trades);
  const updateTrades = usePairTradeStore((s) => s.updateTrades);
  const clearTrades = usePairTradeStore((s) => s.clearTrades);
  const seenHashesRef = useRef<Set<string>>(new Set());

  // Create batcher for trade updates (batched via rAF for 60fps)
  // This ensures at most 1 store update per animation frame (16ms)
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
      
      // Also update chart trades (separate state, doesn't trigger store subscribers)
      setWsChartTrades((prev) => {
        const existingHashes = new Set(prev.map((t) => t.hash));
        const newTrades = trades.filter((t) => !existingHashes.has(t.hash));
        if (newTrades.length === 0) return prev;
        return [...newTrades, ...prev];
      });
    })
  );

  useEffect(() => {
    if (!address || !blockchain) return;

    clearTrades();
    setWsChartTrades([]);
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

  // Memoize return value to prevent unnecessary re-renders in consuming components
  return useMemo(() => ({ 
    wsTrades, 
    wsChartTrades, 
    setWsChartTrades 
  }), [wsTrades, wsChartTrades]);
};

