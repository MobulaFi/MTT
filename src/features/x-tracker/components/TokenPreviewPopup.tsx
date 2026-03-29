'use client';

import { memo, useState, useCallback, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from '@/components/ui/hover-card';
import { sdk } from '@/lib/sdkClient';
import { useXTrackerStore } from '../store/useXTrackerStore';
import QuickBuyButton from './QuickBuyButton';
import type { ResolvedToken } from '../hooks/useTokenResolver';

interface TokenMarketData {
  priceUSD: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  liquidity: number;
}

// Module-level cache for market data
const marketDataCache = new Map<string, TokenMarketData>();

function formatUsd(v: number): string {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.0001) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(6)}`;
}

function formatPriceUsd(v: number): string {
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.0001) return `$${v.toFixed(4)}`;
  if (v >= 0.00000001) return `$${v.toFixed(8)}`;
  return `$${v.toExponential(2)}`;
}

interface TokenPreviewPopupProps {
  token: ResolvedToken;
  children: ReactNode;
}

function TokenPreviewPopup({ token, children }: TokenPreviewPopupProps) {
  const [marketData, setMarketData] = useState<TokenMarketData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const quickBuyPresets = useXTrackerStore((s) => s.quickBuyPresets);
  const quickBuyEnabled = useXTrackerStore((s) => s.quickBuyEnabled);

  const cacheKey = `${token.chainId}:${token.address}`;

  const fetchMarketData = useCallback(async () => {
    const cached = marketDataCache.get(cacheKey);
    if (cached) {
      setMarketData(cached);
      return;
    }

    setLoading(true);
    setError(false);
    try {
      const response = await sdk.fetchTokenDetails({
        address: token.address,
        blockchain: token.chainId,
      }) as { data?: Record<string, unknown> };

      const d = response?.data;
      if (d) {
        const data: TokenMarketData = {
          priceUSD: Number(d.priceUSD ?? d.price ?? 0),
          priceChange24h: Number(d.priceChange24h ?? d.priceChange24hPercent ?? 0),
          marketCap: Number(d.marketCapUSD ?? d.marketCap ?? 0),
          volume24h: Number(d.volume24hUSD ?? d.volume24h ?? d.volume ?? 0),
          liquidity: Number(d.liquidityUSD ?? d.liquidity ?? 0),
        };
        marketDataCache.set(cacheKey, data);
        setMarketData(data);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [cacheKey, token.address, token.chainId]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open && !marketData && !loading) {
        fetchMarketData();
      }
    },
    [fetchMarketData, marketData, loading],
  );

  return (
    <HoverCard openDelay={150} closeDelay={100} onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="w-[280px] border-borderDefault bg-bgPrimary shadow-2xl p-0 z-[200]"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          {token.logo ? (
            <img src={token.logo} alt="" className="w-6 h-6 rounded-full" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-bgContainer flex items-center justify-center text-[10px] font-bold text-textTertiary">
              {token.symbol.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-textPrimary truncate">
                {token.name}
              </span>
              <span className="text-xs text-textTertiary">${token.symbol}</span>
            </div>
          </div>
        </div>

        {/* Market data */}
        <div className="px-3 pb-2">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 size={16} className="animate-spin text-textTertiary" />
            </div>
          ) : error ? (
            <p className="text-xs text-textTertiary py-2">Failed to load data</p>
          ) : marketData ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <div>
                <p className="text-[10px] text-textTertiary uppercase tracking-wide">Price</p>
                <p className="text-sm font-semibold text-textPrimary">
                  {formatPriceUsd(marketData.priceUSD)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-textTertiary uppercase tracking-wide">24h</p>
                <p
                  className={`text-sm font-semibold ${
                    marketData.priceChange24h >= 0 ? 'text-success' : 'text-error'
                  }`}
                >
                  {marketData.priceChange24h >= 0 ? '+' : ''}
                  {marketData.priceChange24h.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-textTertiary uppercase tracking-wide">MCap</p>
                <p className="text-xs font-medium text-textSecondary">
                  {marketData.marketCap > 0 ? formatUsd(marketData.marketCap) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-textTertiary uppercase tracking-wide">Vol 24h</p>
                <p className="text-xs font-medium text-textSecondary">
                  {marketData.volume24h > 0 ? formatUsd(marketData.volume24h) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-textTertiary uppercase tracking-wide">Liquidity</p>
                <p className="text-xs font-medium text-textSecondary">
                  {marketData.liquidity > 0 ? formatUsd(marketData.liquidity) : '—'}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Quick buy buttons */}
        {quickBuyEnabled && (
          <div className="flex items-center gap-1.5 px-3 pb-3 pt-1 border-t border-borderDefault/50">
            <span className="text-[10px] text-textTertiary mr-1">Buy:</span>
            {quickBuyPresets.map((amt) => (
              <QuickBuyButton key={amt} token={token} amountSol={amt} />
            ))}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

export default memo(TokenPreviewPopup);
