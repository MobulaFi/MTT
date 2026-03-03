'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getWSManager } from './wsConnectionManager';

interface PriceUpdate {
  type: 'price';
  platform: string;
  marketId: string;
  data: {
    assetId: string;
    price: number;
    bestBid?: number;
    bestAsk?: number;
    spread?: number;
  };
  timestamp: number;
}

interface UseMobulaWSOptions {
  platform: string;
  marketId: string;
  apiKey?: string;
  onPriceUpdate?: (update: PriceUpdate) => void;
  enabled?: boolean;
}

/**
 * Hook to receive real-time PM updates via Mobula WebSocket API
 * Uses shared WebSocket connection manager to prevent "Insufficient resources" errors
 */
export function useMobulaWS(options: UseMobulaWSOptions) {
  const { platform, marketId, onPriceUpdate, enabled = true } = options;
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const onPriceUpdateRef = useRef(onPriceUpdate);
  
  // Keep callback ref updated
  useEffect(() => {
    onPriceUpdateRef.current = onPriceUpdate;
  }, [onPriceUpdate]);

  useEffect(() => {
    if (!enabled || !platform || !marketId) return;

    const manager = getWSManager();
    const subId = `pm-price-${platform}-${marketId}`;

    const handleMessage = (message: unknown) => {
      const msg = message as Record<string, unknown>;
      
      // Handle subscription confirmation
      if (msg.event === 'subscribed' && msg.type === 'pm-market') {
        console.log('[MobulaWS] Subscription confirmed:', msg.subscriptionId);
        setSubscriptionId(msg.subscriptionId as string);
        setConnected(true);
        setError(null);
        return;
      }
      
      // Handle price updates
      if (msg.event === 'update' && msg.type === 'pm-market') {
        if (onPriceUpdateRef.current && msg.data) {
          onPriceUpdateRef.current(msg.data as PriceUpdate);
        }
        return;
      }
      
      // Handle errors
      if (msg.event === 'error') {
        console.error('[MobulaWS] Error from server:', msg);
        setError((msg.message as string) || 'Server error');
      }
    };

    // Subscribe using shared manager
    manager.subscribe(subId, 'pm-market-price', { platform, marketId }, handleMessage);

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
  }, [enabled, platform, marketId]);

  const disconnect = useCallback(() => {
    const manager = getWSManager();
    const subId = `pm-price-${platform}-${marketId}`;
    manager.unsubscribe(subId);
    setConnected(false);
    setSubscriptionId(null);
  }, [platform, marketId]);

  const reconnect = useCallback(() => {
    const manager = getWSManager();
    manager.connect();
  }, []);

  return {
    connected,
    subscriptionId,
    error,
    disconnect,
    reconnect,
  };
}
