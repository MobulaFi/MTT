'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import SafeImage from '@/components/SafeImage';
import { fmtUsd, timeAgoShort } from '@/lib/format';
import type { ActivityEntry } from '../hooks/usePortfolioData';
import { FiInfo } from 'react-icons/fi';
import { sdk } from '@/lib/sdkClient';
import { getExplorerTxUrl } from '@/utils/chainMapping';
import { useRecentTradesStore, type RecentTrade } from '@/store/useRecentTradesStore';

interface ActivityFeedProps {
  activities: ActivityEntry[];
  isLoading: boolean;
  marketCapMap?: Map<string, number>;
}

function getTokenForRow(row: { tokenIn?: { symbol: string; address: string; chainId: string } | undefined; tokenOut?: { symbol: string; address: string; chainId: string } | undefined }) {
  const NATIVE = ['SOL', 'ETH', 'USDC', 'USDT'];
  const isNativeIn = NATIVE.includes(row.tokenIn?.symbol ?? '');
  const isNativeOut = NATIVE.includes(row.tokenOut?.symbol ?? '');
  const isBuy = !isNativeIn && isNativeOut;
  return { token: isBuy ? row.tokenIn : row.tokenOut, isBuy };
}

export function ActivityFeed({ activities, isLoading, marketCapMap }: ActivityFeedProps) {
  const searchParams = useSearchParams();
  const highlightTx = searchParams.get('highlightTx');
  const highlightDir = searchParams.get('dir');
  const [supplyMap, setSupplyMap] = useState<Map<string, number>>(new Map());
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const [highlightActive, setHighlightActive] = useState(false);
  const fetchedTokensRef = useRef<Set<string>>(new Set());

  // Recent trades from global store for instant display
  const recentTrades = useRecentTradesStore((s) => s.trades);

  const rows = useMemo(
    () => {
      const apiRows = activities.flatMap((entry) =>
        entry.actions
          .filter((a) => a.model === 'swap')
          .map((action, i) => {
            const amountIn = action.swapAmountIn ?? 0;
            const amountOut = action.swapAmountOut ?? 0;

            // Trade-time prices: prefer swap-specific prices, then derive from swapAmountUsd
            let priceIn = action.swapPriceUsdTokenIn || 0;
            let priceOut = action.swapPriceUsdTokenOut || 0;

            // Derive trade-time prices from swapAmountUsd (USD value at time of swap)
            if (action.swapAmountUsd && action.swapAmountUsd > 0) {
              if (priceIn === 0 && amountIn > 0) priceIn = action.swapAmountUsd / amountIn;
              if (priceOut === 0 && amountOut > 0) priceOut = action.swapAmountUsd / amountOut;
            }

            // Cross-derive from each other
            if (priceIn > 0 && priceOut === 0 && amountIn > 0 && amountOut > 0) {
              priceOut = (amountIn * priceIn) / amountOut;
            } else if (priceOut > 0 && priceIn === 0 && amountIn > 0 && amountOut > 0) {
              priceIn = (amountOut * priceOut) / amountIn;
            }

            // Last resort: current price from asset (not ideal for trade-time mcap)
            if (priceIn === 0) priceIn = (action.swapAssetIn as Record<string, number> | undefined)?.price || 0;
            if (priceOut === 0) priceOut = (action.swapAssetOut as Record<string, number> | undefined)?.price || 0;

            const amountUsd = action.swapAmountUsd || (amountIn * priceIn) || (amountOut * priceOut) || 0;

            // API returns "contract" not "address" — normalize here
            const assetIn = action.swapAssetIn;
            const assetOut = action.swapAssetOut;
            const normIn = assetIn ? { ...assetIn, address: assetIn.address || (assetIn as Record<string, string>).contract || '' } : undefined;
            const normOut = assetOut ? { ...assetOut, address: assetOut.address || (assetOut as Record<string, string>).contract || '' } : undefined;

            return {
              key: `${entry.txHash}_${i}`,
              txHash: entry.txHash,
              chainId: entry.chainId,
              date: entry.txDateIso,
              dateMs: entry.txDateMs,
              tokenIn: normIn,
              tokenOut: normOut,
              amountIn,
              amountOut,
              amountUsd,
              priceIn,
              priceOut,
            };
          }),
      );

      // Merge recent trades (instant display), deduplicate by txHash
      if (recentTrades.length > 0) {
        const existingHashes = new Set(apiRows.map((r) => r.txHash.toLowerCase()));
        const recentRows = recentTrades
          .filter((rt: RecentTrade) => !existingHashes.has(rt.txHash.toLowerCase()))
          .map((rt: RecentTrade) => {
            const isBuy = rt.direction === 'buy';
            return {
              key: `${rt.txHash}_recent`,
              txHash: rt.txHash,
              chainId: rt.chainId,
              date: new Date(rt.timestamp).toISOString(),
              dateMs: rt.timestamp,
              tokenIn: isBuy
                ? { symbol: rt.tokenSymbol, name: rt.tokenName, logo: rt.tokenLogo, address: rt.tokenAddress, chainId: rt.chainId }
                : { symbol: rt.quoteSymbol, name: rt.quoteName, logo: rt.quoteLogo, address: rt.quoteAddress, chainId: rt.chainId },
              tokenOut: isBuy
                ? { symbol: rt.quoteSymbol, name: rt.quoteName, logo: rt.quoteLogo, address: rt.quoteAddress, chainId: rt.chainId }
                : { symbol: rt.tokenSymbol, name: rt.tokenName, logo: rt.tokenLogo, address: rt.tokenAddress, chainId: rt.chainId },
              amountIn: rt.amountIn,
              amountOut: rt.amountOut,
              amountUsd: rt.amountUsd,
              priceIn: isBuy ? rt.priceUsd : 0,
              priceOut: isBuy ? 0 : rt.priceUsd,
            };
          });
        return [...recentRows, ...apiRows];
      }

      return apiRows;
    },
    [activities, recentTrades],
  );

  // Auto-scroll + flash animation on highlighted trade
  useEffect(() => {
    if (!highlightTx || rows.length === 0) return;
    const hasMatch = rows.some((r) => r.txHash === highlightTx);
    if (hasMatch) {
      setHighlightActive(true);
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      const timer = setTimeout(() => setHighlightActive(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [highlightTx, rows]);

  // Fetch token supply for trade-time mcap calculation (supply × trade price per row)
  useEffect(() => {
    if (rows.length === 0) return;

    const toFetch: Array<{ key: string; address: string; chainId: string }> = [];

    for (const row of rows) {
      const { token } = getTokenForRow(row);
      if (!token?.address) continue;
      const chainId = token.chainId || row.chainId;
      const key = `${token.address}_${chainId}`;

      if (fetchedTokensRef.current.has(key)) continue;
      if (supplyMap.has(key)) continue;

      fetchedTokensRef.current.add(key);
      toFetch.push({ key, address: token.address, chainId });
    }

    if (toFetch.length === 0) return;

    const fetchSupplies = async () => {
      const results = new Map<string, number>();

      await Promise.allSettled(
        toFetch.slice(0, 20).map(async ({ key, address, chainId }) => {
          try {
            const res = (await sdk.fetchTokenDetails({
              address,
              blockchain: chainId,
            })) as { data?: Record<string, unknown> };

            const d = res?.data;
            const supply = (d?.circulatingSupply as number) || (d?.totalSupply as number);

            if (supply && supply > 0) {
              results.set(key, supply);
            }
          } catch {
            // silently skip
          }
        }),
      );

      if (results.size > 0) {
        setSupplyMap((prev) => {
          const next = new Map(prev);
          for (const [k, v] of results) next.set(k, v);
          return next;
        });
      }
    };

    fetchSupplies();
  }, [rows, supplyMap]);

  const getTradeTimeMcap = (token: { address?: string; chainId?: string } | undefined, rowChainId: string, tradePrice: number): number | null => {
    if (!token?.address || tradePrice <= 0) return null;
    const chainId = token.chainId || rowChainId;
    const key = `${token.address}_${chainId}`;
    const supply = supplyMap.get(key);
    if (supply && supply > 0) return supply * tradePrice;
    return null;
  };

  const maxAmountUsd = Math.max(...rows.map((r) => r.amountUsd || 1), 1);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-5 h-12 flex items-center flex-shrink-0 border-b border-borderDefault">
        <span className="text-base font-medium text-white">Activity</span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[0.5fr_1.2fr_1fr_0.8fr_0.4fr] gap-3 px-5 py-3 flex-shrink-0 border-b border-borderDefault/40 text-sm text-textTertiary">
        <span>Type</span>
        <span>Token</span>
        <span className="flex items-center gap-1">
          Amount
          <FiInfo size={12} className="text-textTertiary/50" />
        </span>
        <span className="flex items-center gap-1">
          Market Cap
          <FiInfo size={12} className="text-textTertiary/50" />
        </span>
        <span>Age</span>
      </div>

      {/* Rows */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-5 gap-3 px-5 py-3.5 animate-pulse">
              <div className="h-5 bg-bgTertiary rounded" />
              <div className="h-5 bg-bgTertiary rounded" />
              <div className="h-5 bg-bgTertiary rounded" />
              <div className="h-5 bg-bgTertiary rounded" />
              <div className="h-5 bg-bgTertiary rounded" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-textTertiary">
            No activity found
          </div>
        ) : (
          rows.slice(0, 50).map((row) => {
            const { token, isBuy } = getTokenForRow(row);
            const barWidth = Math.min((row.amountUsd / maxAmountUsd) * 100, 100);
            const tradePrice = token?.address === row.tokenIn?.address ? row.priceIn : row.priceOut;
            const mcap = getTradeTimeMcap(token, row.chainId, tradePrice);

            const isHighlighted = highlightActive && row.txHash === highlightTx;
            const highlightColor = highlightDir === 'buy' ? 'rgba(24, 199, 34, 0.25)' : 'rgba(244, 91, 91, 0.25)';

            return (
              <div
                key={row.key}
                ref={isHighlighted ? highlightRef : undefined}
                onClick={() => {
                  window.open(getExplorerTxUrl(row.chainId, row.txHash), '_blank');
                }}
                className={`grid grid-cols-[0.5fr_1.2fr_1fr_0.8fr_0.4fr] gap-3 px-5 py-3 hover:bg-bgTableHover transition-colors border-b border-borderDefault/20 items-center cursor-pointer ${isHighlighted ? 'activity-highlight' : ''}`}
                style={isHighlighted ? { '--highlight-color': highlightColor } as React.CSSProperties : undefined}
              >
                {/* Type */}
                <span className={`text-sm font-semibold ${isBuy ? 'text-success' : 'text-error'}`}>
                  {isBuy ? 'Buy' : 'Sell'}
                </span>

                {/* Token */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-bgTertiary">
                    {token?.logo ? (
                      <SafeImage
                        src={token.logo}
                        alt={token.symbol}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-textTertiary">
                        {token?.symbol?.charAt(0) ?? '?'}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate leading-tight">
                      {token?.symbol ?? '???'}
                    </p>
                    <p className="text-xs text-textTertiary truncate leading-tight">{token?.name ?? ''}</p>
                  </div>
                </div>

                {/* Amount in USD */}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-1 rounded-full flex-shrink-0 ${isBuy ? 'bg-success' : 'bg-error'}`}
                    style={{ height: `${Math.max(barWidth / 5, 4)}px` }}
                  />
                  <span className="text-sm text-white font-mono leading-tight">{fmtUsd(row.amountUsd)}</span>
                </div>

                {/* Market cap */}
                <span className="text-sm text-textSecondary leading-tight">
                  {mcap != null ? fmtUsd(mcap) : '-'}
                </span>

                {/* Age */}
                <span className="text-sm text-textTertiary leading-tight">{timeAgoShort(row.date)}</span>
              </div>
            );
          })
        )}
      </div>

      <style jsx>{`
        @keyframes highlightFlash {
          0% { background-color: var(--highlight-color); }
          50% { background-color: transparent; }
          100% { background-color: var(--highlight-color); }
        }
        .activity-highlight {
          animation: highlightFlash 1.25s ease-in-out 2;
        }
      `}</style>
    </div>
  );
}
