'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getWSManager } from './wsConnectionManager';

interface OHLCVCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades: number;
}

interface PriceUpdate {
  assetId: string;
  price: number;
  bestBid?: number;
  bestAsk?: number;
  spread?: number;
}

interface UsePMLiveChartOptions {
  platform: string;
  marketId: string;
  outcomeId: string;
  period: '1s' | '5s' | '10s' | '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  initialData?: OHLCVCandle[];
  onPriceUpdate?: (update: PriceUpdate) => void;
  enabled?: boolean;
}

function getPeriodMs(period: string): number {
  switch (period) {
    case '1s': return 1000;
    case '5s': return 5 * 1000;
    case '10s': return 10 * 1000;
    case '1m': return 60 * 1000;
    case '5m': return 5 * 60 * 1000;
    case '15m': return 15 * 60 * 1000;
    case '1h': return 60 * 60 * 1000;
    case '4h': return 4 * 60 * 60 * 1000;
    case '1d': return 24 * 60 * 60 * 1000;
    default: return 60 * 60 * 1000;
  }
}

/**
 * Hook that combines WebSocket price updates with OHLCV chart data
 * Builds real-time candles from price updates for ultra-smooth charts
 * Uses shared WebSocket connection manager to prevent "Insufficient resources" errors
 */
export function usePMLiveChart(options: UsePMLiveChartOptions) {
  const { platform, marketId, outcomeId, period, initialData = [], onPriceUpdate, enabled = true } = options;
  
  const [candles, setCandles] = useState<OHLCVCandle[]>(initialData);
  const [latestPrice, setLatestPrice] = useState<number | null>(null);
  const [latestBid, setLatestBid] = useState<number | null>(null);
  const [latestAsk, setLatestAsk] = useState<number | null>(null);
  const currentCandleRef = useRef<OHLCVCandle | null>(null);
  const onPriceUpdateRef = useRef(onPriceUpdate);
  const periodMs = getPeriodMs(period);

  // Keep callback ref updated
  useEffect(() => {
    onPriceUpdateRef.current = onPriceUpdate;
  }, [onPriceUpdate]);

  // Reset candles when period changes (full chart reload on timeframe switch)
  useEffect(() => {
    setCandles([]);
    setLatestPrice(null);
    currentCandleRef.current = null;
  }, [period]);

  // Initialize with initial data (runs after period reset for API-backed periods)
  useEffect(() => {
    if (initialData.length > 0) {
      setCandles(initialData);
      const lastCandle = initialData[initialData.length - 1];
      setLatestPrice(lastCandle.close);
      currentCandleRef.current = { ...lastCandle };
    }
  }, [initialData]);

  // Update candle with new price
  const updateWithPrice = useCallback((price: number, timestamp: number) => {
    // Filter out invalid prices (0, 1, or NaN cause extreme spikes)
    if (price <= 0 || price >= 1 || Number.isNaN(price)) {
      return;
    }
    
    setLatestPrice(price);
    
    const candleTime = Math.floor(timestamp / periodMs) * periodMs;
    
    setCandles((prev) => {
      if (prev.length === 0) {
        // First candle
        const newCandle: OHLCVCandle = {
          time: candleTime,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 0,
          trades: 0,
        };
        currentCandleRef.current = newCandle;
        return [newCandle];
      }

      const lastCandle = prev[prev.length - 1];
      
      // Same candle period - update existing
      if (lastCandle.time === candleTime) {
        const updated: OHLCVCandle = {
          ...lastCandle,
          high: Math.max(lastCandle.high, price),
          low: Math.min(lastCandle.low, price),
          close: price,
        };
        currentCandleRef.current = updated;
        return [...prev.slice(0, -1), updated];
      }
      
      // New candle period
      const newCandle: OHLCVCandle = {
        time: candleTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0,
        trades: 0,
      };
      currentCandleRef.current = newCandle;
      
      // Keep last 500 candles for performance
      return [...prev, newCandle].slice(-500);
    });
  }, [periodMs]);

  // WebSocket price updates via shared manager
  useEffect(() => {
    if (!enabled || !platform || !marketId || !outcomeId) return;

    const manager = getWSManager();
    const subId = `pm-chart-\${platform}-\${marketId}-\${outcomeId}`;

    const handleMessage = (message: unknown) => {
      const msg = message as Record<string, unknown>;
      
      if (msg.event === 'update' && msg.type === 'pm-market') {
        const data = msg.data as Record<string, unknown>;
        if (data?.data) {
          const priceData = data.data as Record<string, unknown>;
          const { assetId, price } = priceData;
          
          // Only update for the selected outcome
          if (assetId === outcomeId && price !== undefined) {
            const timestamp = (data.timestamp as number) || Date.now();
            updateWithPrice(price as number, timestamp);

            // Track live bid/ask for orderbook stream
            const { bestBid, bestAsk } = priceData as unknown as PriceUpdate;
            if (bestBid != null && bestBid > 0 && bestBid < 1) setLatestBid(bestBid);
            if (bestAsk != null && bestAsk > 0 && bestAsk < 1) setLatestAsk(bestAsk);

            if (onPriceUpdateRef.current) {
              onPriceUpdateRef.current(priceData as unknown as PriceUpdate);
            }
          }
        }
      }
    };

    // Subscribe using shared manager
    manager.subscribe(subId, 'pm-market-price', { platform, marketId }, handleMessage);

    return () => {
      manager.unsubscribe(subId);
    };
  }, [enabled, platform, marketId, outcomeId, updateWithPrice]);

  return {
    candles,
    latestPrice,
    latestBid,
    latestAsk,
    currentCandle: currentCandleRef.current,
  };
}
