'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getWSManager } from './wsConnectionManager';
import { getMarketTrades } from '../api/pmApi';
import type { PMTrade } from '../types';

interface UsePMLiveTradesOptions {
  platform: string;
  marketId: string;
  apiKey?: string;
  onTradeUpdate?: (trade: PMTrade) => void;
  enabled?: boolean;
  maxTrades?: number;
}

/**
 * Hook to receive real-time trade updates via shared WebSocket manager.
 * Falls back to REST polling if WebSocket not available.
 * Maintains a live feed of trades.
 */
export function usePMLiveTrades(options: UsePMLiveTradesOptions) {
  const { platform, marketId, onTradeUpdate, enabled = true, maxTrades = 50 } = options;
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<PMTrade[]>([]);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const onTradeUpdateRef = useRef(onTradeUpdate);
  const initialLoadRef = useRef(false);

  // Keep callback ref updated without triggering reconnect
  useEffect(() => {
    onTradeUpdateRef.current = onTradeUpdate;
  }, [onTradeUpdate]);

  const addTrade = useCallback((newTrade: PMTrade) => {
    setTrades((prev) => {
      // Check if trade already exists
      const exists = prev.some(t => t.tradeId === newTrade.tradeId);
      if (exists) return prev;
      
      // Add new trade at the beginning and limit to maxTrades
      const updated = [newTrade, ...prev].slice(0, maxTrades);
      return updated;
    });
    
    if (onTradeUpdateRef.current) {
      onTradeUpdateRef.current(newTrade);
    }
  }, [maxTrades]);

  // Load initial trades via REST API
  useEffect(() => {
    if (!enabled || !platform || !marketId || initialLoadRef.current) return;
    
    const loadInitialTrades = async () => {
      try {
        setLoading(true);
        const fetchedTrades = await getMarketTrades(platform, marketId, undefined, maxTrades);
        if (fetchedTrades && fetchedTrades.length > 0) {
          setTrades(fetchedTrades);
        }
        initialLoadRef.current = true;
      } catch (err) {
        console.error('[usePMLiveTrades] Error loading initial trades:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialTrades();
  }, [enabled, platform, marketId, maxTrades]);

  // Subscribe to WebSocket for real-time updates
  useEffect(() => {
    if (!enabled || !platform || !marketId) return;

    const manager = getWSManager();
    const subId = `pm-trades-${platform}-${marketId}`;

    const handleMessage = (message: unknown) => {
      const msg = message as Record<string, unknown>;
      
      // Handle subscription confirmation
      if (msg.event === 'subscribed' && msg.type === 'pm-market-trades') {
        console.log('[PMLiveTrades] Subscription confirmed:', msg.subscriptionId);
        setSubscriptionId(msg.subscriptionId as string);
        setConnected(true);
        setError(null);
        return;
      }
      
      // Handle trade updates
      if (msg.event === 'update' && msg.type === 'pm-market-trades') {
        const updateData = msg.data as Record<string, unknown>;
        if (updateData?.data) {
          const tradeData = updateData.data as Record<string, unknown>;
          // Convert to PMTrade format
          const trade: PMTrade = {
            tradeId: tradeData.tradeId as string,
            txHash: '',
            outcomeId: tradeData.outcomeId as string,
            outcomeLabel: '',
            side: ((tradeData.side as string) || '').toLowerCase() as 'buy' | 'sell',
            price: tradeData.price as number,
            size: tradeData.size as number,
            amountUSD: (tradeData.amountUsd || tradeData.amountUSD) as number,
            timestamp: typeof tradeData.timestamp === 'number' 
              ? new Date(tradeData.timestamp).toISOString()
              : (tradeData.timestamp as string),
          };
          addTrade(trade);
        }
        return;
      }
      
      // Handle errors
      if (msg.event === 'error') {
        console.error('[PMLiveTrades] Error from server:', msg);
        setError((msg.message as string) || 'Server error');
      }
    };

    // Subscribe using shared manager
    manager.subscribe(subId, 'pm-market-trades', { platform, marketId }, handleMessage);

    // Listen for connection state changes
    const unsubscribe = manager.onConnectionChange((isConnected) => {
      setConnected(isConnected);
      if (!isConnected) {
        setSubscriptionId(null);
      }
    });

    // Set initial state
    setConnected(manager.isConnected());

    return () => {
      manager.unsubscribe(subId);
      unsubscribe();
    };
  }, [enabled, platform, marketId, addTrade]);

  const disconnect = useCallback(() => {
    const manager = getWSManager();
    const subId = `pm-trades-${platform}-${marketId}`;
    manager.unsubscribe(subId);
    setConnected(false);
    setSubscriptionId(null);
  }, [platform, marketId]);

  const clearTrades = useCallback(() => {
    setTrades([]);
    initialLoadRef.current = false;
  }, []);

  const reconnect = useCallback(() => {
    const manager = getWSManager();
    manager.connect();
  }, []);

  return {
    connected,
    subscriptionId,
    error,
    trades,
    loading,
    addTrade,
    clearTrades,
    disconnect,
    reconnect,
  };
}
