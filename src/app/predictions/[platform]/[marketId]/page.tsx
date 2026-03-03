'use client';

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, ChevronRight, ChevronLeft } from 'lucide-react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import clsx from 'clsx';
import { getMarketDetails, getMarketOHLCV } from '@/features/predictions/api/pmApi';
import type { PMMarket, PMTrade, PMOutcome } from '@/features/predictions/types';
import { Separator } from '@/components/ui/separator';
import { OrderBookPanel } from '@/features/predictions/components/OrderBookPanel';
import {
  LivelineChart,
  CHART_WINDOWS,
  DEFAULT_WINDOW_SECS,
  DEFAULT_PERIOD,
  type ChartPeriod,
} from '@/features/predictions/components/LivelineChart';
import { useMobulaWS } from '@/features/predictions/hooks/useMobulaWS';
import { usePMLiveTrades } from '@/features/predictions/hooks/usePMLiveTrades';
import { usePMLiveChart } from '@/features/predictions/hooks/usePMLiveChart';

// ============================================================================
// Utilities
// ============================================================================

function formatVolume(value: number | undefined | string): string {
  if (value === undefined || value === null || value === 'data_not_ingested') return '--';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '--';
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

function formatPrice(price: number | undefined): string {
  if (price === undefined || price === null) return '--';
  if (price < 0.0001) return price.toExponential(2);
  if (price < 0.01) return price.toFixed(4);
  if (price < 1) return price.toFixed(3);
  return price.toFixed(2);
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr || dateStr === '1970-01-01 00:00:00.000') return '--';
  try {
    // Parse as UTC by appending 'Z'
    const date = new Date(dateStr.replace(' ', 'T') + 'Z');
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '--';
  }
}

function formatTimeRemaining(endDate: string | undefined): string {
  if (!endDate || endDate === '1970-01-01 00:00:00.000') return 'No end date';

  const end = new Date(endDate.replace(' ', 'T') + 'Z');
  const now = new Date();
  const diff = end.getTime() - now.getTime();

  if (diff < 0) return 'Ended';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 30) return `in ${Math.floor(days / 30)}mo`;
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  if (minutes > 0) return `in ${minutes}m`;
  return 'ending soon';
}

function getCountdown(endDate: string | undefined): { days: number; hours: number; minutes: number; seconds: number } | null {
  if (!endDate || endDate === '1970-01-01 00:00:00.000') return null;
  const end = new Date(endDate.replace(' ', 'T') + 'Z');
  const diff = end.getTime() - Date.now();
  if (diff < 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

function getTimeAgo(timestamp: string): string {
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diff = now - time;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ============================================================================
// Components
// ============================================================================

const VerticalDivider = () => (
  <div className="flex flex-col h-12 justify-center">
    <Separator orientation="vertical" className="h-full w-px bg-borderPrimary" />
  </div>
);

const MetricDisplay = memo(function MetricDisplay({
  label,
  value,
  valueColor
}: {
  label: string;
  value?: string;
  valueColor?: string;
}) {
  return (
    <div className="flex flex-col space-y-1 w-[100px] min-w-[100px] text-center">
      <span className="text-grayNeutral font-menlo text-[11px] font-bold leading-[14px] uppercase">
        {label}
      </span>
      <span className={clsx(
        "flex items-center justify-center gap-1 font-menlo text-[15px] font-bold leading-[18px] truncate",
        valueColor || "text-white"
      )}>
        {value ?? '--'}
      </span>
    </div>
  );
});

const CountdownTimer = memo(function CountdownTimer({ endDate }: { endDate: string | undefined }) {
  const [countdown, setCountdown] = useState(getCountdown(endDate));

  useEffect(() => {
    if (!endDate) return;
    const timer = setInterval(() => setCountdown(getCountdown(endDate)), 1000);
    return () => clearInterval(timer);
  }, [endDate]);

  if (!countdown) return <span className="text-xs text-textTertiary">No end date</span>;

  return (
    <div className="flex items-center gap-3">
      {[
        { value: countdown.days, label: 'd' },
        { value: countdown.hours, label: 'h' },
        { value: countdown.minutes, label: 'm' },
        { value: countdown.seconds, label: 's' },
      ].map((unit) => (
        <div key={unit.label} className="flex items-baseline gap-0.5">
          <span className="text-lg font-bold text-textPrimary tabular-nums">{unit.value}</span>
          <span className="text-[10px] text-textTertiary">{unit.label}</span>
        </div>
      ))}
    </div>
  );
});

const PositionCalculator = memo(function PositionCalculator({
  yesPrice,
  noPrice,
}: {
  yesPrice: number;
  noPrice: number;
}) {
  const [amount, setAmount] = useState('100');
  const [selectedSide, setSelectedSide] = useState<'yes' | 'no'>('yes');

  const amountNum = parseFloat(amount) || 0;
  const price = selectedSide === 'yes' ? yesPrice : noPrice;
  const shares = price > 0 ? amountNum / price : 0;
  const payout = shares;
  const profit = payout - amountNum;
  const roi = amountNum > 0 ? (profit / amountNum) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => setSelectedSide('yes')}
          className={clsx(
            'flex-1 py-1.5 rounded text-xs font-bold transition-colors',
            selectedSide === 'yes' ? 'bg-success text-black' : 'bg-bgOverlay text-textTertiary hover:text-textPrimary',
          )}
        >
          Yes
        </button>
        <button
          onClick={() => setSelectedSide('no')}
          className={clsx(
            'flex-1 py-1.5 rounded text-xs font-bold transition-colors',
            selectedSide === 'no' ? 'bg-danger text-white' : 'bg-bgOverlay text-textTertiary hover:text-textPrimary',
          )}
        >
          No
        </button>
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-textTertiary text-sm">$</span>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-bgOverlay border border-borderDefault rounded-lg pl-7 pr-3 py-2 text-sm text-textPrimary focus:outline-none focus:border-borderSecondary"
          min="0"
        />
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-textTertiary">Price</span>
          <span className="font-medium">{(price * 100).toFixed(1)}c</span>
        </div>
        <div className="flex justify-between">
          <span className="text-textTertiary">Shares</span>
          <span className="font-medium">{shares.toFixed(1)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-textTertiary">Payout if correct</span>
          <span className="font-medium text-success">${payout.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-textTertiary">ROI</span>
          <span className={clsx('font-medium', roi > 0 ? 'text-success' : 'text-danger')}>
            {roi > 0 ? '+' : ''}{roi.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// Sub-components
// ============================================================================

const TradesPanel = memo(function TradesPanel({
  trades,
  compact = false,
}: {
  trades: PMTrade[];
  compact?: boolean;
}) {
  const [flashingTrades, setFlashingTrades] = useState<Set<string>>(new Set());
  const prevTradesRef = useRef<PMTrade[]>([]);

  useEffect(() => {
    if (prevTradesRef.current.length > 0 && trades.length > 0) {
      const prevIds = new Set(prevTradesRef.current.map((t) => t.tradeId));
      const newTradeIds = trades.filter((t) => !prevIds.has(t.tradeId)).map((t) => t.tradeId);
      if (newTradeIds.length > 0) {
        setFlashingTrades(new Set(newTradeIds));
        setTimeout(() => setFlashingTrades(new Set()), 500);
      }
    }
    prevTradesRef.current = trades;
  }, [trades]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="grid grid-cols-4 gap-2 px-3 py-2 text-[10px] text-textTertiary font-medium border-b border-borderDefault/50">
        <div>Amount</div>
        <div>Price</div>
        <div>Side</div>
        <div className="text-right">Age</div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-borderDefault scrollbar-track-transparent">
        {trades.map((trade) => {
          const isFlashing = flashingTrades.has(trade.tradeId);
          return (
            <div
              key={trade.tradeId}
              className={clsx(
                'grid grid-cols-4 gap-2 px-3 py-1.5 hover:bg-bgOverlay text-[11px] border-b border-borderDefault/30 transition-all duration-300',
                isFlashing && (trade.side === 'buy' ? 'bg-success/20' : 'bg-danger/20'),
              )}
            >
              <div className={trade.side === 'buy' ? 'text-success font-medium' : 'text-danger font-medium'}>
                ${trade.amountUSD.toFixed(2)}
              </div>
              <div className="text-textSecondary">{(trade.price * 100).toFixed(2)}%</div>
              <div className={clsx('truncate font-medium', trade.side === 'buy' ? 'text-success' : 'text-danger')}>
                {trade.outcomeLabel}
              </div>
              <div className="text-textTertiary text-right">{getTimeAgo(trade.timestamp)}</div>
            </div>
          );
        })}
        {trades.length === 0 && (
          <div className="text-center py-8 text-textTertiary text-xs">No trades yet</div>
        )}
      </div>
    </div>
  );
});

const MarketStatsPanel = memo(function MarketStatsPanel({ market }: { market: PMMarket }) {
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-bgContainer p-3 rounded-lg">
          <div className="text-xs text-textTertiary mb-1">24h Volume</div>
          <div className="text-lg font-bold">{formatVolume(market.stats?.volume24h)}</div>
        </div>
        <div className="bg-bgContainer p-3 rounded-lg">
          <div className="text-xs text-textTertiary mb-1">Total Volume</div>
          <div className="text-lg font-bold">{formatVolume(market.stats?.totalVolume)}</div>
        </div>
        <div className="bg-bgContainer p-3 rounded-lg">
          <div className="text-xs text-textTertiary mb-1">Liquidity</div>
          <div className="text-lg font-bold text-success">{formatVolume(market.stats?.totalLiquidity)}</div>
        </div>
        <div className="bg-bgContainer p-3 rounded-lg">
          <div className="text-xs text-textTertiary mb-1">Total Trades</div>
          <div className="text-lg font-bold">{market.stats?.tradesCount?.toLocaleString() || '--'}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-bgContainer p-3 rounded-lg">
          <div className="text-xs text-textTertiary mb-1">Created</div>
          <div className="text-sm font-medium">{formatDate(market.metadata?.createdAt)}</div>
        </div>
        <div className="bg-bgContainer p-3 rounded-lg">
          <div className="text-xs text-textTertiary mb-1">End Date</div>
          <div className="text-sm font-medium">{formatDate(market.metadata?.resolutionDate)}</div>
        </div>
      </div>
      <div className="bg-bgContainer p-4 rounded-lg">
        <div className="text-xs text-textTertiary mb-2">Description</div>
        <div className="text-sm text-textSecondary">{market.description || 'No description available.'}</div>
      </div>
    </div>
  );
});

const OutcomesPanel = memo(function OutcomesPanel({ market }: { market: PMMarket }) {
  const yesOutcome = market.outcomes?.find((o: PMOutcome) => o.label.toLowerCase() === 'yes');
  const noOutcome = market.outcomes?.find((o: PMOutcome) => o.label.toLowerCase() === 'no');
  const yesPercent = yesOutcome ? Math.round(yesOutcome.price * 100) : 0;
  const noPercent = noOutcome ? Math.round(noOutcome.price * 100) : 0;

  return (
    <div className="p-4 space-y-6">
      {/* YES / NO cards */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-bgContainer p-4 rounded-lg border border-success/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-success font-bold text-lg">YES</span>
            <span className="text-2xl font-bold text-success">{yesPercent}%</span>
          </div>
          <div className="h-3 bg-bgOverlay rounded-full overflow-hidden">
            <div className="h-full bg-success transition-all duration-500" style={{ width: `${yesPercent}%` }} />
          </div>
          <div className="mt-2 text-xs text-textTertiary">Price: ${formatPrice(yesOutcome?.price)}</div>
        </div>
        <div className="bg-bgContainer p-4 rounded-lg border border-danger/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-danger font-bold text-lg">NO</span>
            <span className="text-2xl font-bold text-danger">{noPercent}%</span>
          </div>
          <div className="h-3 bg-bgOverlay rounded-full overflow-hidden">
            <div className="h-full bg-danger transition-all duration-500" style={{ width: `${noPercent}%` }} />
          </div>
          <div className="mt-2 text-xs text-textTertiary">Price: ${formatPrice(noOutcome?.price)}</div>
        </div>
      </div>

      {market.outcomes && market.outcomes.length > 2 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-textTertiary">All Outcomes</div>
          {market.outcomes.map((outcome: PMOutcome, idx: number) => (
            <div key={`${outcome.id}-${idx}`} className="flex items-center justify-between bg-bgContainer p-3 rounded-lg">
              <span className="text-sm">{outcome.label}</span>
              <span className="font-bold">{Math.round(outcome.price * 100)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Market Overview */}
      <div>
        <h4 className="text-xs font-bold text-textTertiary uppercase mb-3">Market Overview</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-bgContainer p-3 rounded-lg">
            <div className="text-[10px] text-textTertiary mb-1">24h Volume</div>
            <div className="text-sm font-bold">{formatVolume(market.stats?.volume24h)}</div>
          </div>
          <div className="bg-bgContainer p-3 rounded-lg">
            <div className="text-[10px] text-textTertiary mb-1">Total Volume</div>
            <div className="text-sm font-bold">{formatVolume(market.stats?.totalVolume)}</div>
          </div>
          <div className="bg-bgContainer p-3 rounded-lg">
            <div className="text-[10px] text-textTertiary mb-1">Liquidity</div>
            <div className="text-sm font-bold text-success">{formatVolume(market.stats?.totalLiquidity)}</div>
          </div>
          <div className="bg-bgContainer p-3 rounded-lg">
            <div className="text-[10px] text-textTertiary mb-1">Total Trades</div>
            <div className="text-sm font-bold">{market.stats?.tradesCount?.toLocaleString() || '--'}</div>
          </div>
        </div>
      </div>

      {/* Price Movement */}
      <div>
        <h4 className="text-xs font-bold text-textTertiary uppercase mb-3">Price Movement</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-bgContainer p-3 rounded-lg">
            <div className="text-[10px] text-textTertiary mb-1">24h Change</div>
            <div className="text-sm font-bold">
              {market.volumeChange24h !== undefined
                ? <span className={market.volumeChange24h >= 0 ? 'text-success' : 'text-danger'}>
                    {market.volumeChange24h >= 0 ? '+' : ''}{market.volumeChange24h.toFixed(1)}%
                  </span>
                : '--'}
            </div>
          </div>
          <div className="bg-bgContainer p-3 rounded-lg">
            <div className="text-[10px] text-textTertiary mb-1">7d Volume</div>
            <div className="text-sm font-bold">{formatVolume(market.stats?.volume7d)}</div>
          </div>
          <div className="bg-bgContainer p-3 rounded-lg">
            <div className="text-[10px] text-textTertiary mb-1">Created</div>
            <div className="text-sm font-medium">{formatDate(market.metadata?.createdAt)}</div>
          </div>
        </div>
      </div>

      {/* All-Time & Holders */}
      <div>
        <h4 className="text-xs font-bold text-textTertiary uppercase mb-3">All-Time & Holders</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-bgContainer p-3 rounded-lg">
            <div className="text-[10px] text-textTertiary mb-1">Yes Holders</div>
            <div className="text-sm font-bold">
              {yesOutcome?.holders ? Number(yesOutcome.holders).toLocaleString() : '--'}
            </div>
          </div>
          <div className="bg-bgContainer p-3 rounded-lg">
            <div className="text-[10px] text-textTertiary mb-1">No Holders</div>
            <div className="text-sm font-bold">
              {noOutcome?.holders ? Number(noOutcome.holders).toLocaleString() : '--'}
            </div>
          </div>
          <div className="bg-bgContainer p-3 rounded-lg">
            <div className="text-[10px] text-textTertiary mb-1">Open Interest</div>
            <div className="text-sm font-bold">
              {market.stats?.totalOpenInterest ? formatVolume(Number(market.stats.totalOpenInterest)) : '--'}
            </div>
          </div>
          <div className="bg-bgContainer p-3 rounded-lg">
            <div className="text-[10px] text-textTertiary mb-1">End Date</div>
            <div className="text-sm font-medium">{formatDate(market.metadata?.resolutionDate)}</div>
          </div>
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// Main Page Component
// ============================================================================

export default function MarketDetailPage() {
  const params = useParams();
  const router = useRouter();
  
  const platform = params.platform as string;
  const marketId = params.marketId as string;

  const [market, setMarket] = useState<PMMarket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialOHLCV, setInitialOHLCV] = useState<Array<{ time: number; open: number; high: number; low: number; close: number; volume: number; trades: number }>>([]);
  const [showTrades, setShowTrades] = useState(true);
  const [selectedTab, setSelectedTab] = useState('outcomes');
  const [activeSecs, setActiveSecs] = useState(DEFAULT_WINDOW_SECS);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>(DEFAULT_PERIOD);

  const handleWindowChange = useCallback((secs: number, period: ChartPeriod) => {
    setActiveSecs(secs);
    setChartPeriod(period);
  }, []);

  // Get the YES outcome for charting
  const yesOutcome = market?.outcomes?.find((o: PMOutcome) => o.label.toLowerCase() === 'yes');

  // WebSocket for real-time price updates
  const handleLivePriceUpdate = useCallback((update: any) => {
    // Update market prices in real-time
    if (market && update.data?.assetId) {
      setMarket((prev) => {
        if (!prev?.outcomes) return prev;
        const updatedOutcomes = prev.outcomes.map((outcome: PMOutcome) => {
          // Match by platformOutcomeId (token ID)
          if (outcome.platformOutcomeId === update.data.assetId) {
            return {
              ...outcome,
              price: update.data.price ?? outcome.price,
            };
          }
          return outcome;
        });
        return { ...prev, outcomes: updatedOutcomes };
      });
    }
  }, [market]);

  const { connected: wsConnected } = useMobulaWS({
    platform,
    marketId,
    onPriceUpdate: handleLivePriceUpdate,
    enabled: !!market,
  });

  // WebSocket for real-time trades (no more polling!)
  const { trades, connected: tradesConnected } = usePMLiveTrades({
    platform,
    marketId,
    enabled: !!market,
    maxTrades: 100,
  });

  // WebSocket for real-time chart with live candle updates
  const { candles: liveCandles, latestPrice } = usePMLiveChart({
    platform,
    marketId,
    outcomeId: yesOutcome?.platformOutcomeId || '',
    period: chartPeriod,
    initialData: initialOHLCV,
    enabled: !!market && !!yesOutcome,
  });

  const fetchMarket = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMarketDetails(platform, marketId);
      setMarket(data);
      setError(null);

      // Pre-load chart data with the default period so chart renders immediately
      const yesOut = data.outcomes?.find((o: PMOutcome) => o.label.toLowerCase() === 'yes');
      if (yesOut) {
        try {
          const ohlcv = await getMarketOHLCV(platform, marketId, yesOut.platformOutcomeId, DEFAULT_PERIOD, 500);
          if (ohlcv && ohlcv.length > 0) {
            setInitialOHLCV(ohlcv);
          }
        } catch (ohlcvErr) {
          console.error('Failed to load OHLCV data:', ohlcvErr);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load market');
    } finally {
      setLoading(false);
    }
  }, [platform, marketId]);

  // Load initial market data
  useEffect(() => {
    fetchMarket();
  }, [fetchMarket]);

  // Reload OHLCV when user switches chart period (skip initial load — fetchMarket handles it)
  const initialChartLoadDone = useRef(false);
  useEffect(() => {
    if (!market || !yesOutcome) return;

    // Skip the first run — fetchMarket already loaded the default period data
    if (!initialChartLoadDone.current) {
      initialChartLoadDone.current = true;
      return;
    }

    const loadChartData = async () => {
      setInitialOHLCV([]);

      const limitByPeriod: Record<string, number> = {
        '1s':  500,
        '5s':  500,
        '10s': 500,
        '1m':  500,
        '5m':  500,
        '15m': 500,
        '1h':  720,
        '4h':  720,
        '1d':  365,
      };
      const limit = limitByPeriod[chartPeriod] ?? 200;

      try {
        const ohlcv = await getMarketOHLCV(platform, marketId, yesOutcome.platformOutcomeId, chartPeriod, limit);
        if (ohlcv && ohlcv.length > 0) {
          setInitialOHLCV(ohlcv);
        }
      } catch (err) {
        console.error('Failed to load chart data:', err);
      }
    };

    loadChartData();
  }, [platform, marketId, yesOutcome?.platformOutcomeId, chartPeriod]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bgPrimary flex items-center justify-center">
        <div className="text-textSecondary">Loading market...</div>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="min-h-screen bg-bgPrimary p-4">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-textSecondary hover:text-textPrimary mb-4">
          <ArrowLeft size={18} />
          Back
        </button>
        <div className="text-danger text-center py-8">{error || 'Market not found'}</div>
      </div>
    );
  }

  const yesPercent = yesOutcome ? Math.round(yesOutcome.price * 100) : 0;

  const tabs = [
    { value: 'outcomes', label: 'Outcomes' },
    { value: 'stats', label: 'Market Stats' },
    { value: 'orderbook', label: 'Order Book' },
    { value: 'trades', label: `Trades (${trades.length})` },
    { value: 'discussions', label: 'Discussions (0)' },
    { value: 'holders', label: 'Top Holders' },
    { value: 'positions', label: 'Positions' },
    { value: 'activity', label: 'Activity' },
  ];

  return (
    <main className="flex flex-col lg:flex-row w-full min-h-screen overflow-y-auto">
      {/* Main content area */}
      <div className="w-full lg:w-[80%] flex flex-col border-r border-borderDefault">
        {/* Header - DataHeader style */}
        <div className="border-b border-borderDefault px-4 py-3">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center flex-1 justify-start gap-6">
              {/* Back + Token Info */}
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => router.back()} 
                  className="p-2 hover:bg-bgContainer rounded-lg transition-colors"
                >
                  <ArrowLeft size={18} className="text-textSecondary" />
                </button>
                <div className="relative w-12 h-12">
                  <div className="w-full h-full rounded overflow-hidden bg-bgPrimary flex items-center justify-center">
                    {(market.metadata?.image || market.image) ? (
                      <img
                        src={market.metadata?.image || market.image || ''}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-xl font-semibold text-blue-400 select-none">${market.question.charAt(0).toUpperCase()}</span>`;
                        }}
                      />
                    ) : (
                      <span className="text-xl font-semibold text-blue-400 select-none">
                        {market.question.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 overflow-hidden min-w-[200px] max-w-[400px]">
                  <span className="text-textPrimary text-[14px] font-medium truncate">
                    {market.question}
                  </span>
                  <div className="flex items-center gap-2 text-textTertiary text-xs">
                    <span className="capitalize">{market.platform}</span>
                    <span>•</span>
                    <span>{market.category}</span>
                    <span>•</span>
                    <span>{formatTimeRemaining(market.metadata?.resolutionDate)}</span>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="flex items-center ml-2 gap-0 border border-borderDefault rounded-lg overflow-hidden">
                <MetricDisplay label="YES PRICE" value={`${yesPercent}%`} valueColor="text-success" />
                <VerticalDivider />
                <MetricDisplay label="24H VOL" value={formatVolume(market.stats?.volume24h)} />
                <VerticalDivider />
                <MetricDisplay label="TOTAL VOL" value={formatVolume(market.stats?.totalVolume)} />
                <VerticalDivider />
                <MetricDisplay label="LIQUIDITY" value={formatVolume(market.stats?.totalLiquidity)} valueColor="text-success" />
              </div>
              
              {/* Live indicator */}
              {wsConnected && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-success/10 rounded-md">
                  <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  <span className="text-success text-[10px] font-medium uppercase">Live</span>
                </div>
              )}
            </div>

            {/* Trade Button */}
            <a
              href={`https://polymarket.com/event/${market.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-success text-black font-bold rounded-lg text-sm hover:bg-success/90 transition-colors"
            >
              <ExternalLink size={14} />
              Trade on Polymarket
            </a>
          </div>
        </div>

        {/* Chart + Trades Resizable */}
        <div className="flex-1 overflow-hidden">
          <PanelGroup direction="vertical" className="h-full">
            {/* Chart Panel */}
            <Panel defaultSize={60} minSize={30} maxSize={80}>
              <div className="flex h-full w-full">
                {/* Chart */}
                <div className={clsx(
                  'relative flex-1 bg-bgDarkest border-b border-borderDefault overflow-hidden',
                  !showTrades && 'w-full',
                )}>
                  {/* Minimal chart header — time windows + LIVE are rendered inside Liveline */}
                  <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 px-4 py-1.5 bg-bgDarkest/70 backdrop-blur-sm border-b border-borderDefault/30 pointer-events-none">
                    <span className="text-[11px] font-medium text-textTertiary">YES Probability</span>
                    {wsConnected && (
                      <span className="flex items-center gap-1 text-[10px] text-success">
                        <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                        LIVE
                      </span>
                    )}
                  </div>

                  <div className="absolute inset-0 pt-8">
                    <LivelineChart
                      candles={liveCandles}
                      latestPrice={latestPrice}
                      trades={trades}
                      activeSecs={activeSecs}
                      onWindowChange={handleWindowChange}
                    />
                  </div>

                  {/* Toggle trades button */}
                  {!showTrades && (
                    <button
                      onClick={() => setShowTrades(true)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-4 h-10 bg-bgTertiary hover:bg-borderDefault border-l border-t border-b border-borderTertiary rounded-l-lg flex items-center justify-center text-gray-400 hover:text-white transition-all shadow-lg"
                    >
                      <ChevronLeft size={16} />
                    </button>
                  )}
                </div>

                {/* Trades Sidebar */}
                {showTrades && (
                  <div className="w-[20%] min-w-[200px] bg-bgPrimary border-l border-borderDefault flex flex-col">
                    <div className="h-10 flex items-center justify-between px-3 border-b border-bgContainer flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-grayGhost">TRADES</span>
                        {tradesConnected && (
                          <span className="flex items-center gap-1 text-[9px] text-success">
                            <span className="w-1 h-1 bg-success rounded-full animate-pulse" />
                            LIVE
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setShowTrades(false)}
                        className="text-grayGhost bg-bgTertiary rounded-full p-1 hover:text-textPrimary hover:bg-opacity-40 transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <TradesPanel trades={trades} compact />
                    </div>
                  </div>
                )}
              </div>
            </Panel>

            {/* Resize Handle */}
            <PanelResizeHandle className="relative h-[6px] group cursor-row-resize flex items-center justify-center bg-bgContainer hover:bg-borderDefault transition-all duration-200 z-20">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-1 w-10 bg-grayGhost rounded-full group-hover:bg-primary group-hover:w-20 group-hover:h-1.5 transition-all duration-200" />
              </div>
            </PanelResizeHandle>

            {/* Tabs Panel */}
            <Panel defaultSize={40} minSize={20} maxSize={60}>
              <div className="h-full flex flex-col bg-bgPrimary border-t border-borderDefault overflow-hidden">
                {/* Tab Bar */}
                <div className="border-b min-h-10 border-borderDefault flex-shrink-0 flex items-center px-0">
                  {tabs.map((tab) => (
                    <button
                      key={tab.value}
                      onClick={() => setSelectedTab(tab.value)}
                      className={clsx(
                        'relative px-4 py-2 text-xs font-medium transition-colors border-b-2',
                        selectedTab === tab.value
                          ? 'text-white border-white'
                          : 'text-textTertiary border-transparent hover:text-white hover:border-borderPrimary'
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-borderDefault scrollbar-track-transparent">
                  {selectedTab === 'outcomes' && <OutcomesPanel market={market} />}
                  {selectedTab === 'stats' && <MarketStatsPanel market={market} />}
                  {selectedTab === 'orderbook' && <OrderBookPanel market={market} platform={platform} marketId={marketId} />}
                  {selectedTab === 'trades' && <TradesPanel trades={trades} />}
                  {selectedTab === 'discussions' && (
                    <div className="flex flex-col items-center justify-center py-12 text-textTertiary">
                      <p className="text-sm">No discussions yet</p>
                      <p className="text-xs mt-1">Discussions coming soon</p>
                    </div>
                  )}
                  {selectedTab === 'holders' && (
                    <div className="flex flex-col items-center justify-center py-12 text-textTertiary">
                      <p className="text-sm">Top holders data coming soon</p>
                    </div>
                  )}
                  {selectedTab === 'positions' && (
                    <div className="flex flex-col items-center justify-center py-12 text-textTertiary">
                      <p className="text-sm">Positions tracking coming soon</p>
                    </div>
                  )}
                  {selectedTab === 'activity' && (
                    <div className="flex flex-col items-center justify-center py-12 text-textTertiary">
                      <p className="text-sm">Activity feed coming soon</p>
                    </div>
                  )}
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </div>
      </div>

      {/* Right Sidebar - Stats Card */}
      <aside className="w-full lg:w-[20%] bg-bgPrimary flex flex-col border-l border-borderDefault overflow-y-auto scrollbar-hide">
        {/* Countdown */}
        <div className="p-4 border-b border-borderDefault">
          <CountdownTimer endDate={market.metadata?.resolutionDate} />
        </div>

        {/* Market Info */}
        <div className="p-4 border-b border-borderDefault">
          <h3 className="text-sm font-bold mb-4">Market Info</h3>

          {/* YES/NO Bars */}
          <div className="space-y-3 mb-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-success font-medium">YES</span>
                <span className="text-xs font-bold text-success">{yesPercent}%</span>
              </div>
              <div className="h-2 bg-bgOverlay rounded-full overflow-hidden">
                <div className="h-full bg-success transition-all duration-500" style={{ width: `${yesPercent}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-danger font-medium">NO</span>
                <span className="text-xs font-bold text-danger">{100 - yesPercent}%</span>
              </div>
              <div className="h-2 bg-bgOverlay rounded-full overflow-hidden">
                <div className="h-full bg-danger transition-all duration-500" style={{ width: `${100 - yesPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex justify-between text-xs">
              <span className="text-textTertiary">Status</span>
              <span className="font-medium capitalize text-success">{market.status}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-textTertiary">Platform</span>
              <span className="font-medium capitalize">{market.platform}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-textTertiary">Category</span>
              <span className="font-medium">{market.category}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-textTertiary">24h Volume</span>
              <span className="font-medium">{formatVolume(market.stats?.volume24h)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-textTertiary">Total Volume</span>
              <span className="font-medium">{formatVolume(market.stats?.totalVolume)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-textTertiary">Liquidity</span>
              <span className="font-medium text-success">{formatVolume(market.stats?.totalLiquidity)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-textTertiary">Total Trades</span>
              <span className="font-medium">{market.stats?.tradesCount?.toLocaleString() || '--'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-textTertiary">Created</span>
              <span className="font-medium">{formatDate(market.metadata?.createdAt)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-textTertiary">End Date</span>
              <span className="font-medium">{formatDate(market.metadata?.resolutionDate)}</span>
            </div>
          </div>
        </div>

        {/* Rules */}
        {market.description && (
          <div className="p-4 border-b border-borderDefault">
            <h3 className="text-sm font-bold mb-2">Rules</h3>
            <p className="text-xs text-textSecondary leading-relaxed line-clamp-4">
              {market.description}
            </p>
            {market.description.length > 200 && (
              <button className="text-xs text-success mt-1 hover:underline">Read more</button>
            )}
          </div>
        )}

        {/* Position Calculator */}
        <div className="p-4 border-b border-borderDefault">
          <h3 className="text-sm font-bold mb-3">Position Calculator</h3>
          <PositionCalculator
            yesPrice={yesOutcome?.price ?? 0}
            noPrice={market.outcomes?.find((o: PMOutcome) => o.label.toLowerCase() === 'no')?.price ?? 0}
          />
        </div>

        {/* Trade CTA */}
        <div className="p-4 border-b border-borderDefault">
          <a
            href={`https://polymarket.com/event/${market.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-success text-black font-bold rounded-lg text-sm hover:bg-success/90 transition-colors"
          >
            <ExternalLink size={14} />
            Trade on Polymarket
          </a>
        </div>

        {/* Related Markets */}
        <div className="p-4">
          <h3 className="text-sm font-bold mb-3">Related Markets</h3>
          <div className="text-xs text-textTertiary">
            <p>Related markets coming soon</p>
          </div>
        </div>
      </aside>
    </main>
  );
}
