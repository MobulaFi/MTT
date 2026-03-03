'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { PMTrade } from '../types';

interface PMUpdate {
  type: 'trade' | 'price';
  platform: string;
  marketId: string;
  outcomeId?: string;
  data: any;
}

interface UsePMLiveOptions {
  platform: string;
  marketId: string;
  onTrade?: (trade: PMTrade) => void;
  onPriceUpdate?: (update: any) => void;
  enabled?: boolean;
}

/**
 * Hook to receive real-time PM updates via WebSocket
 * Connects to Polymarket WebSocket for live trades and prices
 */
export function usePMLive(options: UsePMLiveOptions) {
  const { platform, marketId, onTrade, onPriceUpdate, enabled = true } = options;
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (!enabled || !platform || !marketId) return;
    
    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      // Use Polymarket WebSocket directly
      const ws = new WebSocket('wss://ws-subscriptions-clob.polymarket.com/ws/market');
      
      ws.onopen = () => {
        setConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        
        // Note: We can't subscribe without token IDs (assets_ids)
        // The parent component should fetch market details first to get outcome IDs
        // For now, just mark as connected - updates will come when parent calls subscribeToOutcomes
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle last_trade_price events
          if (data.event_type === 'last_trade_price') {
            if (onTrade) {
              const trade: PMTrade = {
                tradeId: `${data.asset_id}-${data.timestamp}`,
                txHash: '',
                outcomeId: data.asset_id,
                outcomeLabel: '',
                side: data.side === 'BUY' ? 'buy' : 'sell',
                price: parseFloat(data.price),
                size: parseFloat(data.size),
                amountUSD: parseFloat(data.price) * parseFloat(data.size),
                timestamp: new Date(data.timestamp * 1000).toISOString(),
              };
              onTrade(trade);
            }
          }
          
          // Handle price change events
          if (data.event_type === 'price_change' && onPriceUpdate) {
            onPriceUpdate({
              outcomeId: data.asset_id,
              price: parseFloat(data.price),
              timestamp: data.timestamp,
            });
          }

          // Handle book events for price updates
          if (data.event_type === 'book' && onPriceUpdate) {
            // Book events contain bid/ask updates
            if (data.bids && data.bids.length > 0) {
              const bestBid = Math.max(...data.bids.map((b: any) => parseFloat(b.price)));
              onPriceUpdate({
                outcomeId: data.asset_id,
                bestBid,
                timestamp: Date.now() / 1000,
              });
            }
            if (data.asks && data.asks.length > 0) {
              const bestAsk = Math.min(...data.asks.map((a: any) => parseFloat(a.price)));
              onPriceUpdate({
                outcomeId: data.asset_id,
                bestAsk,
                timestamp: Date.now() / 1000,
              });
            }
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setError('Connection error');
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        // Attempt reconnect with exponential backoff
        if (enabled && reconnectAttempts.current < 10) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [enabled, platform, marketId, onTrade, onPriceUpdate]);

  // Connect on mount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, enabled]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setConnected(false);
  }, []);

  // Expose method to subscribe to specific outcome token IDs
  const subscribeToOutcomes = useCallback((tokenIds: string[]) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not ready, cannot subscribe');
      return;
    }

    try {
      // Use Polymarket's subscription format
      wsRef.current.send(JSON.stringify({
        assets_ids: tokenIds,
        type: 'market'
      }));
    } catch (err) {
      console.error('Failed to subscribe to outcomes:', err);
    }
  }, []);

  return {
    connected,
    error,
    disconnect,
    reconnect: connect,
    subscribeToOutcomes,
  };
}
