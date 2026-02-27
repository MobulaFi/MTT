//datafeed.tsx
import { sdk, streams } from '@/lib/sdkClient';
import { formatPureNumber } from '@mobula_labs/sdk';
import type { MarketOHLCVHistoryParams, TokenOHLCVHistoryParams } from '@mobula_labs/types';
import type { Bar, LibrarySymbolInfo, ResolutionString, HistoryCallback, ErrorCallback, PeriodParams } from '../../../public/static/charting_library/datafeed-api';

export const supportedResolutions = ['1s', '5s', '15s', '30s', '1', '5', '15', '30', '60', '240', '1D', '1W', '1M'];

const lastBarsCache = new Map<string, unknown>();
type StreamSubscription = { unsubscribe: () => void };
const activeSubscriptions = new Map<string, { subscription: StreamSubscription; assetKey: string }>();
const pendingRequests = new Map<string, Promise<any[]>>();
const marksCache = new Map<string, Map<string, ChartMark>>();

const getMarksCacheKey = (address: string | undefined, chainId: string) => `${address}-${chainId}`;

export type ChartMetricMode = 'price' | 'marketcap';

export interface ChartMarkCustomColor {
  color: string;
  background: string;
}

export interface ChartMark {
  id: string | number;
  time: number;
  color: 'red' | 'green' | 'blue' | 'yellow' | ChartMarkCustomColor;
  text: string;
  label: string;
  labelFontColor: string;
  minSize: number;
}

const clearCacheForMetric = (assetId: string | undefined, metric: ChartMetricMode) => {
  const keysToDelete: string[] = [];
  
  lastBarsCache.forEach((_, key) => {
    if (key.includes(`${assetId}-`) && key.includes(`-${metric}`)) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => lastBarsCache.delete(key));
  const requestKeysToDelete: string[] = [];
  pendingRequests.forEach((_, key) => {
    if (key.includes(`${assetId}-`)) {
      requestKeysToDelete.push(key);
    }
  });

  requestKeysToDelete.forEach(key => pendingRequests.delete(key));
};

interface ChartSettings {
  isUsd: boolean;
  metric: ChartMetricMode;
  circulatingSupply: number;
  scaleDivisor: number;
}

const normalizeResolution = (resolution: string): string => {
  switch (resolution) {
    case '1S':
    case '1s':
      return '1s';
    case '5S':
    case '5s':
      return '5s';
    case '15S':
    case '15s':
      return '15s';
    case '30S':
    case '30s':
      return '30s';
    case '1':
    case '1m':
      return '1m';
    case '5':
    case '5m':
      return '5m';
    case '15':
    case '15m':
      return '15m';
    case '30':
    case '30m':
      return '30m';
    case '60':
    case '1h':
      return '1h';
    case '240':
    case '4h':
      return '4h';
    case '1D':
    case '1d':
      return '1d';
    case '1W':
    case '1w':
      return '1w';
    case '1M':
    case '1month':
      return '1M';
    default:
      return resolution;
  }
};

type BaseAsset = {
  asset?: string;
  address?: string;
  chainId: string;
  symbol?: string;
  base?: { symbol?: string };
  quote?: { symbol?: string; priceUSD?: number };
  priceUSD?: number;
  isPair?: boolean;
  circulatingSupply?: number;
};

class BaseAssetRef {
  current: BaseAsset;
  constructor(initialAsset: BaseAsset) {
    this.current = initialAsset;
  }
  update(newAsset: BaseAsset) {
    this.current = newAsset;
  }
}

const buildSettingsKey = (assetId: string | undefined, resolution: string, settings: ChartSettings) => {
  const currency = settings.isUsd ? 'usd' : 'quote';
  return `${assetId ?? 'unknown'}-${resolution}-${currency}-${settings.metric}`;
};

const buildRequestKey = (
  assetId: string | undefined,
  resolution: string,
  params: { from: number; to: number },
  settings: ChartSettings,
) => `${buildSettingsKey(assetId, resolution, settings)}-${params.from}-${params.to}`;

// Transform OHLCV data from API format (v, o, h, l, c, t) to TradingView format (time, open, high, low, close, volume)
const transformOHLCVBar = (bar: { v?: number; o?: number; h?: number; l?: number; c?: number; t?: number; time?: number; open?: number; high?: number; low?: number; close?: number; volume?: number }): Bar => {
  // If already in TradingView format, return as is
  if (bar.time !== undefined && (bar.volume !== undefined || bar.v === undefined)) {
    return {
      time: bar.time,
      open: bar.open ?? 0,
      high: bar.high ?? 0,
      low: bar.low ?? 0,
      close: bar.close ?? 0,
      volume: bar.volume ?? bar.v ?? 0,
    };
  }
  
  // Transform from API format (v, o, h, l, c, t) to TradingView format
  return {
    time: bar.t ?? bar.time ?? 0,
    open: bar.o ?? bar.open ?? 0,
    high: bar.h ?? bar.high ?? 0,
    low: bar.l ?? bar.low ?? 0,
    close: bar.c ?? bar.close ?? 0,
    volume: bar.v ?? bar.volume ?? 0,
  };
};

const applyMetricToBar = (bar: any, settings: ChartSettings): Bar => {
  // First transform to TradingView format if needed
  const transformedBar = transformOHLCVBar(bar);
  
  if (settings.metric !== 'marketcap') {
    return transformedBar;
  }

  const supply = settings.circulatingSupply;
  if (!supply || supply <= 0) {
    return transformedBar;
  }

  const open = Number(transformedBar.open) || 0;
  const high = Number(transformedBar.high) || 0;
  const low = Number(transformedBar.low) || 0;
  const close = Number(transformedBar.close) || 0;

  const mcBar: Bar = {
    ...transformedBar,
    open: open * supply,
    high: high * supply,
    low: low * supply,
    close: close * supply,
  };

  return mcBar;
};

const applyMetricToBars = (bars: any[], settings: ChartSettings) => bars.map((bar) => applyMetricToBar(bar, settings));

interface DatafeedOptions {
  isUsd?: boolean;
  metricMode?: ChartMetricMode;
  deployer?: string;
  userAddress?: string;
}

export const Datafeed = (
  initialBaseAsset: BaseAsset,
  options: DatafeedOptions = {},
) => {
  const baseAssetRef = new BaseAssetRef(initialBaseAsset);
  const marksOptionsRef = {
    current: {
      deployer: options.deployer,
      userAddress: options.userAddress,
    },
  };
  const settingsRef = {
    current: {
      isUsd: options.isUsd ?? false,
      metric: options.metricMode ?? 'price',
      circulatingSupply: initialBaseAsset.circulatingSupply ?? 0,
      scaleDivisor: 1,
    } satisfies ChartSettings,
  };

  const updateSupply = (supply?: number) => {
    settingsRef.current.circulatingSupply = supply ?? 0;
  };

  return {
    updateBaseAsset: (newAsset: BaseAsset) => {
      baseAssetRef.update(newAsset);
      updateSupply(newAsset.circulatingSupply);
    },

    setCurrencyMode: (nextIsUsd: boolean) => {
      settingsRef.current.isUsd = nextIsUsd;
    },

    setMetricMode: (mode: ChartMetricMode) => {
      const current = baseAssetRef.current;
      const assetId = current.isPair ? current.address : current.asset;
      settingsRef.current.metric = mode;
      clearCacheForMetric(assetId, mode);
      const keysToDelete: string[] = [];
      lastBarsCache.forEach((_, key) => {
        if (key.includes(`${assetId}-`)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => lastBarsCache.delete(key));
      
      // Unsubscribe from all active subscriptions
      activeSubscriptions.forEach((sub, uid) => {
        try {
          sub.subscription.unsubscribe();
        } catch { }
        activeSubscriptions.delete(uid);
      });
    },

    setCirculatingSupply: updateSupply,

    onReady: (cb: (config: any) => void) => {
      console.log('[Datafeed Debug] onReady called');
      setTimeout(() => {
        console.log('[Datafeed Debug] onReady callback executing');
        cb({
          supported_resolutions: supportedResolutions,
          supports_search: false,
          supports_group_request: false,
          supports_marks: true,
          supports_timescale_marks: false,
          supports_time: true,
        });
      }, 0);
    },

    searchSymbols: (
      _userInput: string,
      _exchange: string,
      _symbolType: string,
      onResult: (result: never[]) => void,
    ) => {
      onResult([]);
    },

    resolveSymbol: (symbolName: string, onResolve: (info: any) => void) => {
      console.log('[Datafeed Debug] resolveSymbol called:', symbolName);
      setTimeout(() => {
        const price = baseAssetRef.current.priceUSD ?? 1;
        const supply = settingsRef.current.circulatingSupply;
        const metric = settingsRef.current.metric;
        let cleanSymbolName = symbolName.split('?')[0];
        cleanSymbolName = cleanSymbolName.replace(/_(MCAP|PRICE)_\d+$/, '');
        if (cleanSymbolName.endsWith('_MCAP') || cleanSymbolName.endsWith('_PRICE')) {
          cleanSymbolName = cleanSymbolName.replace(/_(MCAP|PRICE)$/, '');
        }

        const effectiveValue = metric === 'marketcap' && supply > 0
          ? price * supply
          : price;

        let pricescale: number;
        let scaleDivisor = 1;
        const magnitude = Math.floor(Math.log10(Math.max(effectiveValue, 0.0001)));

        if (metric === 'marketcap' && supply > 0) {
          pricescale = 100;
        } else {
          if (magnitude >= 0) {
            pricescale = 100;
          } else {
            pricescale = Math.pow(10, Math.abs(magnitude) + 4);
          }
          pricescale = Math.min(Math.max(pricescale, 100), 1e16);
        }

        if (metric === 'marketcap') {
          settingsRef.current.scaleDivisor = scaleDivisor;
        } else {
          settingsRef.current.scaleDivisor = 1;
        }

        const displayName = metric === 'marketcap'
          ? `${cleanSymbolName} MC`
          : cleanSymbolName;

        const info = {
          name: displayName,
          description: metric === 'marketcap'
            ? 'MarketCap'
            : 'Price in USD',
          type: 'crypto',
          session: '24x7',
          timezone: 'Etc/UTC',
          ticker: symbolName,
          minmov: 1,
          pricescale: pricescale,
          format: metric === 'marketcap' ? 'volume' : 'price',
          has_intraday: true,
          has_seconds: true,
          has_daily: true,
          has_weekly_and_monthly: true,
          intraday_multipliers: ['1', '5', '15', '30', '60', '240'],
          seconds_multipliers: ['1', '5', '15', '30'],
          daily_multipliers: ['1'],
          supported_resolution: supportedResolutions,
          volume_precision: 2,
          data_status: 'streaming',
        };
        onResolve(info);
      }, 0);
    },

    getBars: (
      _symbolInfo: LibrarySymbolInfo,
      resolution: ResolutionString,
      periodParams: PeriodParams,
      onResult: HistoryCallback,
      onError: ErrorCallback,
    ) => {
      console.log('[Datafeed Debug] getBars called', { resolution, periodParams });
      const current = baseAssetRef.current;
      const assetId = current.isPair ? current.address : current.asset;
      const normalizedResolution = normalizeResolution(resolution);
      const settingsSnapshot: ChartSettings = { ...settingsRef.current };
      const requestKey = buildRequestKey(assetId, normalizedResolution, periodParams, settingsSnapshot);
      const cacheKey = buildSettingsKey(assetId, normalizedResolution, settingsSnapshot);

      const fromMs = periodParams.from * 1000;
      const toMs = periodParams.to * 1000;

      console.log('[Datafeed Debug] Fetching data for:', { assetId, isPair: current.isPair, chainId: current.chainId });

      try {
        if (pendingRequests.has(requestKey) && settingsSnapshot.metric === 'price') {
          pendingRequests.get(requestKey)!.then((cachedBars) => {
            onResult(cachedBars, { noData: !cachedBars.length });
          }).catch((err) => {
            console.error('[Datafeed Debug] Error in cached request:', err);
            onError('Failed to fetch cached bars');
          });
          return;
        }

        if (settingsSnapshot.metric === 'marketcap') {
          pendingRequests.delete(requestKey);
          lastBarsCache.delete(cacheKey);
        }

        // Use new v2 endpoints
        let rawPromise: Promise<unknown[]>;
        
        if (current.isPair) {
          // Use market-ohlcv-history for pairs (by pool address)
          const requestParams: MarketOHLCVHistoryParams = {
            address: current.address!,
            chainId: current.chainId,
            from: fromMs,
            to: toMs,
            amount: periodParams.countBack,
            usd: settingsSnapshot.isUsd,
            period: normalizedResolution,
          };
          
          console.log('[Datafeed Debug] Fetching market OHLCV history with params:', requestParams);
          rawPromise = sdk.fetchMarketOHLCVHistory(requestParams).then((res) => (res as { data?: unknown[] })?.data || []);
        } else {
          // Use token-ohlcv-history for assets (by token address)
          const requestParams: TokenOHLCVHistoryParams = {
            address: current.asset!,
            chainId: current.chainId,
            from: fromMs,
            to: toMs,
            amount: periodParams.countBack,
            usd: settingsSnapshot.isUsd,
            period: normalizedResolution,
          };
          
          console.log('[Datafeed Debug] Fetching token OHLCV history with params:', requestParams);
          rawPromise = sdk.fetchTokenOHLCVHistory(requestParams).then((res) => (res as { data?: unknown[] })?.data || []);
        }
        
        const processedPromise = rawPromise.then((bars) => applyMetricToBars(bars, settingsSnapshot));

        pendingRequests.set(requestKey, processedPromise);

        Promise.all([rawPromise, processedPromise])
          .then(([rawBars, processedBars]) => {
            console.log('[Datafeed Debug] Got bars:', { count: processedBars.length, hasData: processedBars.length > 0 });
            onResult(processedBars, { noData: !processedBars.length });

            if (rawBars.length > 0) {
              // Transform the last bar to TradingView format before caching
              const lastRawBar = rawBars[rawBars.length - 1] as Record<string, unknown>;
              const lastBar = transformOHLCVBar(lastRawBar);
              const cachedBar = lastBarsCache.get(cacheKey) as Record<string, unknown> | undefined;

              if (!cachedBar || (lastBar.time as number) >= (cachedBar.time as number)) {
                lastBarsCache.set(cacheKey, lastBar);
              }
            }

            setTimeout(() => {
              pendingRequests.delete(requestKey);
            }, 200);
          })
          .catch((err) => {
            console.error('[Datafeed Debug] Error fetching bars:', err);
            onError(err instanceof Error ? err.message : 'Failed to fetch bars');
            pendingRequests.delete(requestKey);
          });
      } catch (err) {
        console.error('[Datafeed Debug] Error in getBars:', err);
        onError(err instanceof Error ? err.message : 'Failed to fetch bars');
        pendingRequests.delete(requestKey);
      }
    },

    subscribeBars: (
      _symbolInfo: LibrarySymbolInfo,
      resolution: ResolutionString,
      onTick: (bar: Bar) => void,
      listenerGuid: string,
      onResetCacheNeededCallback: () => void,
    ) => {
      const current = baseAssetRef.current;
      const assetId = current.isPair ? current.address : current.asset;
      const normalizedResolution = normalizeResolution(resolution);
      const settingsSnapshot: ChartSettings = { ...settingsRef.current };
      const cacheKey = buildSettingsKey(assetId, normalizedResolution, settingsSnapshot);
      const subscriptionAssetKey = `${cacheKey}-${current.isPair ? 'pair' : 'asset'}`;

      const existing = activeSubscriptions.get(listenerGuid);
      if (existing?.assetKey === subscriptionAssetKey) {
        return;
      }

      if (existing) {
        existing.subscription.unsubscribe();
        activeSubscriptions.delete(listenerGuid);
      }

      const emitProcessedCandle = (rawCandle: Bar | Record<string, unknown>) => {
        const currentSettings: ChartSettings = { ...settingsRef.current };
        const processed = applyMetricToBar({ ...rawCandle }, currentSettings);
        onTick(processed);
        const currentCacheKey = buildSettingsKey(assetId, normalizedResolution, currentSettings);
        // Store as Record for cache compatibility
        lastBarsCache.set(currentCacheKey, rawCandle as Record<string, unknown>);
      };

      let lastBar = lastBarsCache.get(cacheKey) as Bar | Record<string, unknown> | undefined;
      let firstCandleReceived = false;

      try {
        const subscribeParams: { period: string; chainId: string; usd: string; address?: string; asset?: string; mode?: 'pair' | 'asset' } = {
          period: normalizedResolution,
          chainId: current.chainId,
          usd: `${settingsSnapshot.isUsd}`,
        };

        if (current.isPair) {
          subscribeParams.address = current.address;
          subscribeParams.mode = 'pair';
        } else {
          subscribeParams.asset = current.asset;
          subscribeParams.mode = 'asset';
        }

        const subscription = streams.subscribeOhlcv(subscribeParams, (candle: unknown) => {
          // Transform candle data to ensure it has the correct format with volume
          const rawCandle = candle as Record<string, unknown>;
          const candleData = transformOHLCVBar(rawCandle);
          
          if (!candleData.time) return;

          if (!firstCandleReceived) {
            firstCandleReceived = true;

            if (lastBar?.time && lastBar?.close != null) {
              const normalizeTime = (t: number) => t > 10_000_000_000 ? t : t * 1000;
              const lastBarTimeMs = normalizeTime(lastBar.time as number);
              const candleTimeMs = normalizeTime(candleData.time as number);

              if (candleTimeMs > lastBarTimeMs) {
                const startPrice = lastBar.close as number;
                const endPrice = (candleData.open ?? candleData.close ?? startPrice) as number;
                const bridgeTime = (lastBarTimeMs + candleTimeMs) / 2;

                const bridgeBar = {
                  time: bridgeTime,
                  open: startPrice,
                  high: Math.max(startPrice, endPrice),
                  low: Math.min(startPrice, endPrice),
                  close: endPrice,
                  volume: 0,
                };

                emitProcessedCandle(bridgeBar);
                lastBar = bridgeBar;
              }
            }
          }
          emitProcessedCandle(candleData);
          lastBar = candleData as Bar;
        });

        activeSubscriptions.set(listenerGuid, { subscription, assetKey: subscriptionAssetKey });
      } catch (err) {
        console.error('Error subscribing to OHLCV stream', err);
      }
    },

    unsubscribeBars: (listenerGuid: string) => {
      const existing = activeSubscriptions.get(listenerGuid);

      if (existing) {
        existing.subscription.unsubscribe();
      }

      activeSubscriptions.delete(listenerGuid);
    },

    getMarks: async (
      _symbolInfo: { ticker?: string },
      _from: number,
      _to: number,
      onDataCallback: (marks: ChartMark[]) => void,
      _resolution: string,
    ) => {
      const { deployer, userAddress } = marksOptionsRef.current;
      const current = baseAssetRef.current;
      const address = current.isPair ? current.address : current.asset;

      if (!deployer && !userAddress) {
        onDataCallback([]);
        return;
      }

      try {
        const transactionSenderAddresses: string[] = [];
        if (deployer) transactionSenderAddresses.push(deployer);
        if (userAddress && userAddress.toLowerCase() !== deployer?.toLowerCase()) {
          transactionSenderAddresses.push(userAddress);
        }

        const requestParams = {
          address: address || '',
          blockchain: current.chainId,
          transactionSenderAddresses: transactionSenderAddresses.join(','),
          limit: 100,
          mode: (current.isPair ? 'pair' : 'asset'),
          formatted: true,
        };

        const response = await sdk.fetchTokenTrades(requestParams as Parameters<typeof sdk.fetchTokenTrades>[0]);

        interface TradeData {
          hash: string;
          date: number | string;
          type: string;
          tokenAmount?: number;
          tokenAmountUsd?: number;
          tokenPrice?: number;
          sender?: string;
        }

        const trades = (response as { data?: TradeData[] })?.data || [];

        const cacheKey = getMarksCacheKey(address, current.chainId);
        if (!marksCache.has(cacheKey)) {
          marksCache.set(cacheKey, new Map());
        }
        const assetMarksCache = marksCache.get(cacheKey)!;

        trades.forEach((trade: TradeData) => {
          const markId = trade.hash;
          
          if (assetMarksCache.has(markId)) {
            return;
          }

          const isDeployer = deployer && trade.sender?.toLowerCase() === deployer.toLowerCase();
          const isBuy = trade.type?.toLowerCase() === 'buy';

          const color =isBuy 
          ? { color: '#ffffff', background: '#18C722' } 
          : { color: '#ffffff', background: '#f51818' };

          let label: string;
          let labelFontColor: string;

          if (isDeployer) {
            label = isBuy ? 'DB' : 'DS';
            labelFontColor = '#ffffff';
          } else {
            label = isBuy ? 'UB' : 'US';
            labelFontColor = '#ffffff';
          }

          const tradeTime = typeof trade.date === 'number' 
            ? (trade.date > 10_000_000_000 ? Math.floor(trade.date / 1000) : trade.date)
            : Math.floor(new Date(trade.date).getTime() / 1000);

          const pricePerToken = trade.tokenPrice ?? 
            (trade.tokenAmount && trade.tokenAmountUsd ? trade.tokenAmountUsd / trade.tokenAmount : 0);

          const formattedAmount = trade.tokenAmountUsd ? formatPureNumber(trade.tokenAmountUsd, { minFractionDigits: 2, maxFractionDigits: 2 }) : '?';
          const formattedPrice = pricePerToken ? formatPureNumber(pricePerToken) : '?';

          const mark: ChartMark = {
            id: markId,
            time: tradeTime,
            color,
            text: `${isDeployer ? 'Dev' : 'User'} ${isBuy ? 'bought' : 'sold'} $${formattedAmount} at $${formattedPrice} USD`,
            label,
            labelFontColor,
            minSize: 20,
          };

          assetMarksCache.set(markId, mark);
        });

        const allMarks = Array.from(assetMarksCache.values());
        onDataCallback(allMarks);
      } catch (err) {
        console.error('Error fetching marks:', err);
        onDataCallback([]);
      }
    },

    updateMarksOptions: (newDeployer?: string, newUserAddress?: string) => {
      const current = baseAssetRef.current;
      const address = current.isPair ? current.address : current.asset;
      
      // Clear marks cache when user address changes to force re-fetch
      const cacheKey = getMarksCacheKey(address, current.chainId);
      if (marksCache.has(cacheKey)) {
        marksCache.delete(cacheKey);
      }
      
      marksOptionsRef.current.deployer = newDeployer;
      marksOptionsRef.current.userAddress = newUserAddress;
    },
  };
};

