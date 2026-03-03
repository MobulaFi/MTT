'use client';

import { memo, useEffect, useState, useMemo, useCallback } from 'react';
import type { PMMarket, PMOutcome } from '../types';
import { getMarketBook } from '../api/pmApi';

interface OrderBookPanelProps {
  market: PMMarket;
  platform: string;
  marketId: string;
}

interface BookLevel {
  price: number;
  size: number;
}

interface BookData {
  bids: BookLevel[];
  asks: BookLevel[];
}

type FilterMode = 'both' | 'bids' | 'asks';

/**
 * Format size with space as thousands separator (European-style)
 */
function formatSize(value: number): string {
  return Math.round(value).toLocaleString('fr-FR');
}

/**
 * Format price as cents with 1 decimal (e.g. "38.0¢")
 */
function formatPriceCents(price: number): string {
  return `${(price * 100).toFixed(1)}\u00A2`;
}

/**
 * Compute cumulative totals for book levels
 */
function withTotals(levels: BookLevel[]): Array<BookLevel & { total: number }> {
  let cumulative = 0;
  return levels.map((level) => {
    cumulative += level.size;
    return { ...level, total: cumulative };
  });
}

export const OrderBookPanel = memo(function OrderBookPanel({
  market,
  platform,
  marketId,
}: OrderBookPanelProps) {
  const [book, setBook] = useState<BookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('both');

  const yesOutcome = market.outcomes?.find(
    (o: PMOutcome) => o.label.toLowerCase() === 'yes',
  );

  const fetchBook = useCallback(async () => {
    if (!yesOutcome?.platformOutcomeId) return;
    try {
      const data = await getMarketBook(platform, marketId, yesOutcome.platformOutcomeId);
      setBook(data);
    } catch (error) {
      console.error('Failed to fetch orderbook:', error);
    } finally {
      setLoading(false);
    }
  }, [platform, marketId, yesOutcome?.platformOutcomeId]);

  useEffect(() => {
    fetchBook();
    const interval = setInterval(fetchBook, 5000);
    return () => clearInterval(interval);
  }, [fetchBook]);

  // Bids sorted high→low, asks sorted low→high
  const bids = useMemo(() => {
    if (!book?.bids) return [];
    const sorted = [...book.bids].sort((a, b) => b.price - a.price).slice(0, 8);
    return withTotals(sorted);
  }, [book?.bids]);

  const asks = useMemo(() => {
    if (!book?.asks) return [];
    const sorted = [...book.asks].sort((a, b) => a.price - b.price).slice(0, 8);
    return withTotals(sorted);
  }, [book?.asks]);

  const maxTotal = useMemo(() => {
    const bidMax = bids.length > 0 ? bids[bids.length - 1].total : 0;
    const askMax = asks.length > 0 ? asks[asks.length - 1].total : 0;
    return Math.max(bidMax, askMax, 1);
  }, [bids, asks]);

  const bestBid = bids.length > 0 ? bids[0].price : 0;
  const bestAsk = asks.length > 0 ? asks[0].price : 0;
  const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-xs text-textTertiary">Loading order book...</span>
      </div>
    );
  }

  if (!book || (bids.length === 0 && asks.length === 0)) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-xs text-textTertiary">No order book data available</span>
      </div>
    );
  }

  const showBids = filter === 'both' || filter === 'bids';
  const showAsks = filter === 'both' || filter === 'asks';

  return (
    <div className="flex flex-col h-full">
      {/* Sub-header: filter toggles + column headers */}
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left: filter toggles */}
        <div className="flex items-center gap-4">
          {(['both', 'bids', 'asks'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`text-[13px] capitalize transition-colors ${
                filter === mode
                  ? 'text-success font-semibold'
                  : 'text-[#6B6F76] hover:text-textPrimary'
              }`}
            >
              {mode === 'both' ? 'Both' : mode === 'bids' ? 'Bids' : 'Asks'}
            </button>
          ))}
        </div>

        {/* Right: column headers */}
        <div className="flex items-center gap-8 text-[12px] text-[#6B6F76]">
          <span>Price</span>
          <span>Size</span>
          <span>Total</span>
        </div>
      </div>

      {/* Order book content */}
      <div className="flex-1 overflow-y-auto px-4">
        {/* BIDS (top half) */}
        {showBids && (
          <div>
            {bids.map((level, idx) => {
              const depthPercent = (level.total / maxTotal) * 100;
              return (
                <div
                  key={`bid-${idx}`}
                  className="relative flex items-center justify-between h-[28px]"
                >
                  {/* Depth bar - fills from right */}
                  <div
                    className="absolute inset-y-0 right-0"
                    style={{
                      width: `${depthPercent}%`,
                      background: 'rgba(34, 197, 94, 0.08)',
                    }}
                  />
                  {/* Content */}
                  <span className="relative z-10 text-[13px] text-success font-mono tabular-nums">
                    {formatPriceCents(level.price)}
                  </span>
                  <div className="relative z-10 flex items-center gap-8">
                    <span className="text-[13px] text-white font-mono tabular-nums text-right min-w-[60px]">
                      {formatSize(level.size)}
                    </span>
                    <span className="text-[13px] text-textSecondary font-mono tabular-nums text-right min-w-[60px]">
                      {formatSize(level.total)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SPREAD INDICATOR */}
        {showBids && showAsks && spread > 0 && (
          <div className="flex items-center justify-center py-1.5 border-y border-borderDefault/30 my-0.5">
            <span className="text-[12px] text-[#6B6F76] font-mono tabular-nums">
              {formatPriceCents(bestBid)} | {formatPriceCents(bestAsk)}{' '}
              <span className="ml-2">Spread: {formatPriceCents(spread)}</span>
            </span>
          </div>
        )}

        {/* ASKS (bottom half) */}
        {showAsks && (
          <div>
            {asks.map((level, idx) => {
              const depthPercent = (level.total / maxTotal) * 100;
              return (
                <div
                  key={`ask-${idx}`}
                  className="relative flex items-center justify-between h-[28px]"
                >
                  {/* Depth bar - fills from right, red tint */}
                  <div
                    className="absolute inset-y-0 right-0"
                    style={{
                      width: `${depthPercent}%`,
                      background: 'rgba(239, 68, 68, 0.08)',
                    }}
                  />
                  {/* Content */}
                  <span className="relative z-10 text-[13px] text-error font-mono tabular-nums">
                    {formatPriceCents(level.price)}
                  </span>
                  <div className="relative z-10 flex items-center gap-8">
                    <span className="text-[13px] text-white font-mono tabular-nums text-right min-w-[60px]">
                      {formatSize(level.size)}
                    </span>
                    <span className="text-[13px] text-textSecondary font-mono tabular-nums text-right min-w-[60px]">
                      {formatSize(level.total)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
