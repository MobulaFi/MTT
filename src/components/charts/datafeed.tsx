//datafeed.tsx

declare global {
  interface Window {
    __tvPaginationLocked?: boolean;
  }
}

import { sdk, streams } from '@/lib/sdkClient';
import { formatPureNumber } from '@mobula_labs/sdk';
import type { MarketOHLCVHistoryParams, TokenOHLCVHistoryParams } from '@mobula_labs/types';
import type { Bar, LibrarySymbolInfo, ResolutionString, HistoryCallback, ErrorCallback, PeriodParams } from '../../../public/static/charting_library/datafeed-api';

export const supportedResolutions: ResolutionString[] = [
  '1S' as ResolutionString,
  '5S' as ResolutionString,
  '15S' as ResolutionString,
  '30S' as ResolutionString,
  '1' as ResolutionString,
  '5' as ResolutionString,
  '15' as ResolutionString,
  '30' as ResolutionString,
  '60' as ResolutionString,
  '240' as ResolutionString,
  '1D' as ResolutionString,
  '1W' as ResolutionString,
  '1M' as ResolutionString,
];

const RETRY_COUNT = 3;
const RETRY_INTERVAL_MS = 50;
const FETCH_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('OHLCV fetch timeout')), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function fetchWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
    try {
      return await withTimeout(fn(), FETCH_TIMEOUT_MS);
    } catch (err: unknown) {
      lastError = err;
      if (attempt < RETRY_COUNT - 1) {
        await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
      }
    }
  }
  throw lastError;
}

/** Start OHLCV fetch immediately — call this BEFORE awaiting TradingView library.
 *  Pass the returned promise to Datafeed({ prefetchPromise }) so getBars uses it. */
export const prefetchOhlcv = (params: {
  isPair: boolean;
  address: string;
  chainId: string;
  period: string;
  isUsd: boolean;
}): Promise<unknown[]> => {
  const { isPair, address, chainId, period, isUsd } = params;
  const amount = getPrefetchAmount(period);
  if (isPair) {
    return fetchWithRetry(() =>
      sdk.fetchMarketOHLCVHistory({
        address,
        chainId,
        from: 0,
        to: Date.now(),
        amount,
        usd: isUsd,
        period,
      } satisfies MarketOHLCVHistoryParams).then((res) => (res as { data?: unknown[] })?.data || []),
    );
  }
  return fetchWithRetry(() =>
    sdk.fetchTokenOHLCVHistory({
      address,
      chainId,
      from: 0,
      to: Date.now(),
      amount,
      usd: isUsd,
      period,
    } satisfies TokenOHLCVHistoryParams).then((res) => (res as { data?: unknown[] })?.data || []),
  );
};

const lastBarsCache = new Map<string, unknown>();
type StreamSubscription = { unsubscribe: () => void };
const activeSubscriptions = new Map<string, { subscription: StreamSubscription; assetKey: string }>();
const pendingRequests = new Map<string, Promise<any[]>>();
const marksCache = new Map<string, Map<string, ChartMark>>();

// Track consecutive empty getBars responses per asset+resolution.
// After EMPTY_THRESHOLD consecutive empties, stop requesting older data
// to prevent infinite pagination on tokens with no/sparse trades.
const consecutiveEmptyBars = new Map<string, number>();
const EMPTY_THRESHOLD = 3;

// Shared bar type used by both local and persistent caches
type CachedBar = { time: number; open: number; high: number; low: number; close: number; volume: number };

// Module-level persistent bar cache — survives Datafeed resets and SPA navigations.
// Prevents re-fetching the same paginated history on every page visit.
const persistentBarCache = new Map<string, CachedBar[]>();
const PERSISTENT_CACHE_MAX_BARS = 6000;
const PERSISTENT_CACHE_MAX_KEYS = 30;

function upsertPersistentCache(key: string, bars: CachedBar[]): void {
  if (bars.length === 0) return;
  const existing = persistentBarCache.get(key) ?? [];
  const barMap = new Map<number, CachedBar>();
  for (const bar of existing) barMap.set(bar.time, bar);
  for (const bar of bars) barMap.set(bar.time, bar);
  const sorted = Array.from(barMap.values()).sort((a, b) => a.time - b.time);
  const trimmed = sorted.length > PERSISTENT_CACHE_MAX_BARS
    ? sorted.slice(sorted.length - PERSISTENT_CACHE_MAX_BARS)
    : sorted;
  if (!persistentBarCache.has(key) && persistentBarCache.size >= PERSISTENT_CACHE_MAX_KEYS) {
    const oldest = persistentBarCache.keys().next().value;
    if (oldest !== undefined) persistentBarCache.delete(oldest);
  }
  persistentBarCache.set(key, trimmed);
}

const getMarksCacheKey = (address: string | undefined, chainId: string) => `${address}-${chainId}`;

export function getPrefetchAmount(_period: string): number {
  return 500;
}

export type ChartMetricMode = 'price' | 'marketcap';
export type ChartDebugReason =
  | 'initial_load'
  | 'token_switch'
  | 'timeframe_change'
  | 'metric_change'
  | 'currency_change'
  | 'retry'
  | 'scroll_pagination'
  | 'stream_bootstrap'
  | 'warmup_pre_mount'
  | 'unknown';

export interface ChartDebugContext {
  chartSessionId?: string;
  initAttemptId?: string;
  symbolRequestId?: string;
  assetKey?: string;
  previousAssetKey?: string | null;
  previousResolution?: string | null;
  reason?: ChartDebugReason;
}

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

  // Reset empty counters so pagination restarts for the new context
  const emptyKeysToDelete: string[] = [];
  consecutiveEmptyBars.forEach((_, key) => {
    if (key.startsWith(`${assetId}-`)) {
      emptyKeysToDelete.push(key);
    }
  });
  emptyKeysToDelete.forEach(key => consecutiveEmptyBars.delete(key));

  // Clear persistent bar cache for this asset+metric so stale data is not served
  const persistentKeysToDelete: string[] = [];
  persistentBarCache.forEach((_, key) => {
    if (key.includes(`${assetId}-`) && key.includes(`-${metric}`)) {
      persistentKeysToDelete.push(key);
    }
  });
  persistentKeysToDelete.forEach(key => persistentBarCache.delete(key));
};

interface ChartSettings {
  isUsd: boolean;
  metric: ChartMetricMode;
  circulatingSupply: number;
  scaleDivisor: number;
}

import { normalizeResolution } from '@/utils/normalizeResolution';
export { normalizeResolution };

export interface FirstDataPayload {
  firstBarTime: number;
  lastBarTime: number;
  barsCount: number;
  resolution: string;
}

export const getResolutionMs = (resolution: string): number => {
  switch (resolution) {
    case '1s': return 1_000;
    case '5s': return 5_000;
    case '15s': return 15_000;
    case '30s': return 30_000;
    case '1m': return 60_000;
    case '5m': return 5 * 60_000;
    case '15m': return 15 * 60_000;
    case '30m': return 30 * 60_000;
    case '1h': return 60 * 60_000;
    case '4h': return 4 * 60 * 60_000;
    case '1d': return 24 * 60 * 60_000;
    case '1w': return 7 * 24 * 60 * 60_000;
    case '1M': return 30 * 24 * 60 * 60_000;
    default: return 60_000;
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
  const toNumber = (value: number | string | undefined): number => {
    const parsed = typeof value === 'string' ? Number(value) : (value ?? Number.NaN);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // If already in TradingView format, return as is
  if (bar.time !== undefined && (bar.volume !== undefined || bar.v === undefined)) {
    return {
      time: toNumber(bar.time),
      open: toNumber(bar.open),
      high: toNumber(bar.high),
      low: toNumber(bar.low),
      close: toNumber(bar.close),
      volume: toNumber(bar.volume ?? bar.v),
    };
  }
  
  // Transform from API format (v, o, h, l, c, t) to TradingView format
  return {
    time: toNumber(bar.t ?? bar.time),
    open: toNumber(bar.o ?? bar.open),
    high: toNumber(bar.h ?? bar.high),
    low: toNumber(bar.l ?? bar.low),
    close: toNumber(bar.c ?? bar.close),
    volume: toNumber(bar.v ?? bar.volume),
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

const applyMetricToBars = (bars: any[], settings: ChartSettings) =>
  bars
    .map((bar) => applyMetricToBar(bar, settings))
    .filter((bar) =>
      Number.isFinite(bar.time) &&
      Number.isFinite(bar.open) &&
      Number.isFinite(bar.high) &&
      Number.isFinite(bar.low) &&
      Number.isFinite(bar.close) &&
      bar.time > 0,
    )
    .sort((a, b) => a.time - b.time);

interface DatafeedOptions {
  isUsd?: boolean;
  metricMode?: ChartMetricMode;
  deployer?: string;
  userAddress?: string;
  onFirstData?: (payload: FirstDataPayload) => void;
  prefetchPromise?: Promise<unknown[]> | null;
  getDebugContext?: () => ChartDebugContext;
  /** When true, getBars returns empty data immediately without API calls (used for pre-mount warmup) */
  warmup?: boolean;
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

  let firstDataFired = false;
  let onFirstData = options.onFirstData;
  let prefetchPromise: Promise<unknown[]> | null = options.prefetchPromise ?? null;

  let localBarCache: CachedBar[] = [];
  let localBarCacheKey = '';
  let isWarmup = !!options.warmup;
  // Generation counter: incremented on resetFirstData / token switch.
  // Cache mutations check this to discard stale work.
  let cacheGeneration = 0;
  // Amount constants: initial load gets 500 bars, scroll pagination gets 300.
  const INITIAL_AMOUNT = 500;
  const PAGINATION_AMOUNT = 300;
  // Track in-flight firstDataRequest to deduplicate concurrent calls.
  // TV's _ensureRequestedTo bypasses the pagination lock when cache is empty,
  // causing a second getBars(firstDataRequest) before the first resolves.
  let pendingFirstDataResult: { key: string; promise: Promise<Bar[]> } | null = null;

  const emitDebug = (level: string, event: string, payload?: Record<string, unknown>) => {
    if (level === 'error') console.error('[datafeed]', event, payload);
    else if (level === 'warn') console.warn('[datafeed]', event, payload);
  };


  const updateSupply = (supply?: number) => {
    settingsRef.current.circulatingSupply = supply ?? 0;
  };

  return {
    updateBaseAsset: (newAsset: BaseAsset) => {
      const previousAsset = baseAssetRef.current;
      baseAssetRef.update(newAsset);
      updateSupply(newAsset.circulatingSupply);
    },

    /** Reset so onFirstData fires again on next getBars (used on SPA navigation) */
    resetFirstData: () => {
      firstDataFired = false;
      localBarCache = [];
      localBarCacheKey = '';
      cacheGeneration++;
      window.__tvPaginationLocked = true;
      pendingFirstDataResult = null;
      pendingRequests.clear();
      consecutiveEmptyBars.clear();
      // Clear all persistent bar caches to force fresh fetches.
      persistentBarCache.clear();
      // Clear lastBarsCache to prevent stale bridge bars in subscribeBars
      // when switching tokens (old last bar would create bridge to new stream).
      lastBarsCache.clear();
      // Unsubscribe all active stream subscriptions so old token's
      // candles don't leak into the new chart during the transition.
      activeSubscriptions.forEach((sub) => {
        try { sub.subscription.unsubscribe(); } catch { /* noop */ }
      });
      activeSubscriptions.clear();
    },

    unlockPagination: () => {
      window.__tvPaginationLocked = false;
    },

    createGuardedUnlock: () => {
      let called = false;
      return () => {
        if (called) return;
        called = true;
        window.__tvPaginationLocked = false;
      };
    },

    /** Update the onFirstData callback (needed when widget is reused across navigations) */
    setOnFirstData: (cb: ((payload: FirstDataPayload) => void) | undefined) => {
      onFirstData = cb;
    },

    setDebugContext: (_nextGetDebugContext: (() => ChartDebugContext) | undefined) => {
      // no-op: debug logging removed for performance
    },

    /** Set a new prefetch promise for the next getBars call */
    setPrefetchPromise: (p: Promise<unknown[]> | null) => {
      prefetchPromise = p;
    },

    setCurrencyMode: (nextIsUsd: boolean) => {
      settingsRef.current.isUsd = nextIsUsd;
    },

    setMetricMode: (mode: ChartMetricMode) => {
      const previousMode = settingsRef.current.metric;
      if (previousMode === mode) return;

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

      // Only unsubscribe when the metric actually changed — the subscription
      // key embeds the metric mode, so TradingView will call subscribeBars again
      // with the new key, which creates a fresh subscription.
      activeSubscriptions.forEach((sub, uid) => {
        try {
          sub.subscription.unsubscribe();
        } catch { }
        activeSubscriptions.delete(uid);
      });
    },

    setCirculatingSupply: updateSupply,

    onReady: (cb: (config: any) => void) => {

      queueMicrotask(() => {

        cb({
          supported_resolutions: supportedResolutions,
          supports_search: false,
          supports_group_request: false,
          supports_marks: true,
          supports_timescale_marks: false,
          supports_time: true,
        });
      });
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
      queueMicrotask(() => {
        const price = baseAssetRef.current.priceUSD ?? 1;
        const supply = settingsRef.current.circulatingSupply;
        const metric = settingsRef.current.metric;
        let cleanSymbolName = symbolName.split('?')[0];
        // Strip address suffix (e.g., ":31ubth4H") added for uniqueness
        cleanSymbolName = cleanSymbolName.replace(/[~:][a-zA-Z0-9]+$/, '');
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

        if (!Number.isFinite(pricescale) || pricescale <= 0 || !cleanSymbolName) {
          // invalid pricescale — fallback will be applied
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
          supported_resolutions: supportedResolutions,
          volume_precision: 2,
          data_status: 'streaming',
        };
        onResolve(info);
      });
    },

    /** Disable warmup mode — subsequent getBars will make real API calls */
    setWarmup: (v: boolean) => {
      isWarmup = v;
      // warmup state changed
    },

    getBars: (
      _symbolInfo: LibrarySymbolInfo,
      resolution: ResolutionString,
      periodParams: PeriodParams,
      onResult: HistoryCallback,
      onError: ErrorCallback,
    ) => {
      // CRITICAL: Never call onResult synchronously from getBars.
      // TradingView's internal flow is: getBars → onResult → _processBars →
      // _processPendingSubscribers → _ensureRequestedTo → getBars (re-entry).
      // Synchronous onResult creates an infinite call stack that freezes the UI.
      // setTimeout(0) breaks the synchronous chain by deferring to the next task.
      const deferOnResult: HistoryCallback = (bars, meta) => {
        setTimeout(() => onResult(bars, meta), 0);
      };

      // Warmup mode: return empty data immediately, no API calls
      if (isWarmup) {
        deferOnResult([], { noData: true });
        return;
      }
      const current = baseAssetRef.current;
      const assetId = current.isPair ? current.address : current.asset;
      const normalizedResolution = normalizeResolution(resolution);
      const settingsSnapshot: ChartSettings = { ...settingsRef.current };
      const requestKey = buildRequestKey(assetId, normalizedResolution, periodParams, settingsSnapshot);
      const cacheKey = buildSettingsKey(assetId, normalizedResolution, settingsSnapshot);

      const fromMs = periodParams.from * 1000;
      const toMs = periodParams.to * 1000;

      const emptyKey = `${assetId}-${normalizedResolution}`;
      const startedAt = Date.now();

      emitDebug('info', 'get_bars_start', {
        resolutionNormalized: normalizedResolution,
        firstDataRequest: periodParams.firstDataRequest,
        toMs,
      });

      try {
        if (periodParams.firstDataRequest) {
          consecutiveEmptyBars.delete(emptyKey);
        }

        // NOTE: No localBarCache shortcut for firstDataRequest.
        // TV's "full update" (after incremental failure) re-calls getBars with
        // firstDataRequest=true. localBarCache misses subscription bars that TV
        // already has in its internal cache → _putToCache detects partial overlap
        // (our newest bar < TV cache's newest bar) → clears TV cache → blank chart.
        // Always fetch fresh data from API for firstDataRequest.

        if ((consecutiveEmptyBars.get(emptyKey) ?? 0) >= EMPTY_THRESHOLD) {
          deferOnResult([], { noData: true });
          return;
        }

        if (!periodParams.firstDataRequest && localBarCacheKey === cacheKey && localBarCache.length > 0) {
          // Strict < toMs: TV's `to` = oldest cached bar time. Returning bars
          // at exactly `to` would overlap with cache[0] → _putToCache fail.
          const cachedSlice = localBarCache.filter(
            (b) => b.time < toMs,
          );
          if (cachedSlice.length > 0) {
            deferOnResult(cachedSlice, { noData: false });
            return;
          }
          if (toMs <= localBarCache[0].time) {
            const persisted = persistentBarCache.get(cacheKey);
            if (persisted && persisted.length > 0) {
              const persistedSlice = persisted.filter((b) => b.time < toMs);
              if (persistedSlice.length > 0) {
                localBarCache = [...persistedSlice, ...localBarCache];
                deferOnResult(persistedSlice, { noData: false });
                return;
              }
            }
          }
        }

        // NOTE: pendingRequests dedup removed — returning stale data from a
        // concurrent request causes _putToCache overlap when the stream has
        // modified TV's cache between callbacks → "Incremental update failed" loop.

        if (settingsSnapshot.metric === 'marketcap') {
          pendingRequests.delete(requestKey);
          lastBarsCache.delete(cacheKey);
        }


        const fetchOhlcv = (fetchFrom: number, fetchTo: number, amount: number): Promise<unknown[]> => {
          if (current.isPair) {
            return fetchWithRetry(() =>
              sdk.fetchMarketOHLCVHistory({
                address: current.address!,
                chainId: current.chainId,
                from: fetchFrom,
                to: fetchTo,
                amount,
                usd: settingsSnapshot.isUsd,
                period: normalizedResolution,
              } satisfies MarketOHLCVHistoryParams).then((res) => (res as { data?: unknown[] })?.data || []),
            );
          }
          return fetchWithRetry(() =>
            sdk.fetchTokenOHLCVHistory({
              address: current.asset!,
              chainId: current.chainId,
              from: fetchFrom,
              to: fetchTo,
              amount,
              usd: settingsSnapshot.isUsd,
              period: normalizedResolution,
            } satisfies TokenOHLCVHistoryParams).then((res) => (res as { data?: unknown[] })?.data || []),
          );
        };

        let fetchTo: number;
        let amount: number;

        if (periodParams.firstDataRequest) {
          fetchTo = toMs;
          amount = INITIAL_AMOUNT;
        } else {
          fetchTo = toMs;
          amount = PAGINATION_AMOUNT;
        }

        const fetchGeneration = cacheGeneration;

        let rawPromise: Promise<unknown[]>;
        if (periodParams.firstDataRequest && prefetchPromise) {
          rawPromise = prefetchPromise;
          prefetchPromise = null;
        } else if (periodParams.firstDataRequest && pendingFirstDataResult?.key === cacheKey) {
          // TV's _ensureRequestedTo fires a second getBars(firstDataRequest)
          // while the first is still in-flight (cache empty → lock bypassed).
          // Reuse the same result promise to avoid a duplicate API call.
          const pendingResult = pendingFirstDataResult.promise;
          pendingResult.then((bars) => {
            if (fetchGeneration !== cacheGeneration) {
              deferOnResult([], { noData: true });
              return;
            }
            deferOnResult(bars, { noData: bars.length === 0 });
          }).catch(() => {
            deferOnResult([], { noData: true });
          });
          return;
        } else {
          rawPromise = fetchOhlcv(0, fetchTo, amount);
        }

        // Single promise chain: process → onResult → cache (no redundant Promise.all)
        const isFirstFetch = periodParams.firstDataRequest;
        const resultPromise = rawPromise.then((rawBars) => {
          // Stale response from previous token — discard and notify TV
          // so it doesn't stay stuck with _requesting=true.
          if (fetchGeneration !== cacheGeneration) {
            deferOnResult([], { noData: true });
            return [];
          }

          const processedBars = applyMetricToBars(rawBars, settingsSnapshot);

          // Track consecutive empty responses to detect tokens with no data
          if (processedBars.length === 0) {
            consecutiveEmptyBars.set(emptyKey, (consecutiveEmptyBars.get(emptyKey) ?? 0) + 1);
          } else {
            consecutiveEmptyBars.delete(emptyKey);
          }

          // ─── Cache update ───
          const newCachedBars: CachedBar[] = processedBars.map((b) => ({
            time: b.time as number,
            open: b.open as number,
            high: b.high as number,
            low: b.low as number,
            close: b.close as number,
            volume: b.volume as number,
          }));

          if (isFirstFetch) {
            localBarCache = newCachedBars;
            localBarCacheKey = cacheKey;
          } else if (localBarCacheKey === cacheKey) {
            // Prepend older bars fetched during backward pagination
            const existingOldest = localBarCache[0]?.time ?? Infinity;
            const olderBars = newCachedBars.filter((b) => b.time < existingOldest);
            if (olderBars.length > 0) {
              localBarCache = [...olderBars, ...localBarCache];
            }
          }

          if (newCachedBars.length > 0) {
            upsertPersistentCache(cacheKey, newCachedBars);
          }

          // ─── Build response for TV ───
          // TV's _putToCache rejects when returned bars overlap with its cache:
          //   if (e[e.length-1].time >= this._cache.bars[0].time) → clear + fail
          // For pagination, TV passes `to` = oldest cached bar time (in seconds).
          // Use strict < toMs to guarantee NO overlap with TV's cache[0].
          // For firstDataRequest, allow all bars up to now.
          const clampedBars = processedBars.filter((b) => {
            const t = typeof b.time === 'number' ? b.time : (b as Bar).time as number;
            return isFirstFetch ? t <= toMs : t < toMs;
          });

          // Stitch continuity at pagination join: compare the newest clamped
          // bar against the oldest existing bar to detect discontinuities.
          // Only stitch if the gap is within a reasonable range (≤ 3 candle
          // intervals) — larger gaps represent real sparse data and should
          // NOT be bridged (that creates fake price movement).
          if (!isFirstFetch && localBarCacheKey === cacheKey && clampedBars.length > 0) {
            const newestClamped = clampedBars[clampedBars.length - 1];
            const existingStart = localBarCache.find(
              (b) => newestClamped && b.time > (newestClamped.time as number),
            );
            if (
              newestClamped &&
              existingStart &&
              (newestClamped.close as number) !== 0 &&
              (existingStart.open as number) !== 0
            ) {
              const resMs = getResolutionMs(normalizedResolution);
              const gapMs = existingStart.time - (newestClamped.time as number);
              // Only stitch small gaps — large ones are real data gaps
              if (gapMs <= resMs * 3) {
                const nc = newestClamped.close as number;
                const eo = existingStart.open as number;
                const relDelta = Math.abs(nc - eo) / Math.max(eo, 1e-12);
                if (relDelta > 0.001) {
                  existingStart.open = nc;
                  existingStart.high = Math.max(nc, existingStart.high);
                  existingStart.low = Math.min(nc, existingStart.low);
                  const stitchBar: Bar = {
                    time: existingStart.time,
                    open: existingStart.open,
                    high: existingStart.high,
                    low: existingStart.low,
                    close: existingStart.close,
                    volume: existingStart.volume,
                  } as Bar;
                  clampedBars.push(stitchBar);
                  upsertPersistentCache(cacheKey, [{
                    time: stitchBar.time as number,
                    open: stitchBar.open as number,
                    high: stitchBar.high as number,
                    low: stitchBar.low as number,
                    close: stitchBar.close as number,
                    volume: stitchBar.volume as number,
                  }]);
                }
              }
            }
          }

          deferOnResult(clampedBars as Bar[], { noData: clampedBars.length === 0 });

          if (!firstDataFired && processedBars.length > 0) {
            firstDataFired = true;
            const firstDataPayload = {
              firstBarTime: processedBars[0]?.time ?? 0,
              lastBarTime: processedBars[processedBars.length - 1]?.time ?? 0,
              barsCount: processedBars.length,
              resolution: normalizedResolution,
            };
            queueMicrotask(() => {
              onFirstData?.(firstDataPayload);
            });
          }

          // Safety: if first fetch returned empty, unlock pagination
          // so TV isn't permanently blocked (onFirstData won't fire for empty data)
          if (isFirstFetch && !firstDataFired) {
            window.__tvPaginationLocked = false;
          }

          if (rawBars.length > 0) {
            const lastRawBar = rawBars[rawBars.length - 1] as Record<string, unknown>;
            const lastBar = transformOHLCVBar(lastRawBar);
            const cachedBar = lastBarsCache.get(cacheKey) as Record<string, unknown> | undefined;

            if (!cachedBar || (lastBar.time as number) >= (cachedBar.time as number)) {
              lastBarsCache.set(cacheKey, lastBar);
            }
          }

          setTimeout(() => pendingRequests.delete(requestKey), 200);
          return processedBars;
        });

        pendingRequests.set(requestKey, resultPromise);

        // Track firstDataRequest so concurrent duplicate calls can reuse it
        if (isFirstFetch) {
          pendingFirstDataResult = { key: cacheKey, promise: resultPromise };
          resultPromise.finally(() => {
            if (pendingFirstDataResult?.promise === resultPromise) {
              pendingFirstDataResult = null;
            }
          });
        }

        resultPromise.catch((err) => {
          // Stale error from previous token — still notify TV to unblock thread
          if (fetchGeneration !== cacheGeneration) {
            deferOnResult([], { noData: true });
            return;
          }

          emitDebug('error', 'get_bars_error', {
            requestKey,
            resolutionNormalized: normalizedResolution,
            error: err instanceof Error ? err.message : 'Failed to fetch bars',
          });
          // Transient errors (timeout, network) should not permanently stop
          // pagination. Use the empty counter so TradingView retries up to
          // EMPTY_THRESHOLD times before giving up.
          consecutiveEmptyBars.set(emptyKey, (consecutiveEmptyBars.get(emptyKey) ?? 0) + 1);
          const errorCount = consecutiveEmptyBars.get(emptyKey) ?? 0;
          deferOnResult([], { noData: errorCount >= EMPTY_THRESHOLD });
          pendingRequests.delete(requestKey);
        });
      } catch (err) {
        emitDebug('error', 'get_bars_error', {
          requestKey,
          resolutionNormalized: normalizedResolution,
          error: err instanceof Error ? err.message : 'Failed to fetch bars',
        });
        consecutiveEmptyBars.set(emptyKey, (consecutiveEmptyBars.get(emptyKey) ?? 0) + 1);
        const catchEmptyCount = consecutiveEmptyBars.get(emptyKey) ?? 0;
        deferOnResult([], { noData: catchEmptyCount >= EMPTY_THRESHOLD });
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

      if (isWarmup || assetId === '__warmup__') {
        return;
      }

      const existing = activeSubscriptions.get(listenerGuid);
      if (existing?.assetKey === subscriptionAssetKey) {
        return;
      }

      if (existing) {
        existing.subscription.unsubscribe();
        activeSubscriptions.delete(listenerGuid);
      }

      // Capture generation at subscription time to detect stale callbacks
      const subscriptionGeneration = cacheGeneration;

      const emitProcessedCandle = (rawCandle: Bar | Record<string, unknown>) => {
        // Discard candles from a stale subscription (token switched since subscribe)
        if (subscriptionGeneration !== cacheGeneration) return;
        const currentSettings: ChartSettings = { ...settingsRef.current };
        const processed = applyMetricToBar({ ...rawCandle }, currentSettings);
        onTick(processed);
        const currentCacheKey = buildSettingsKey(assetId, normalizedResolution, currentSettings);
        // Store as Record for cache compatibility
        lastBarsCache.set(currentCacheKey, rawCandle as Record<string, unknown>);
      };

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
          // Discard if token switched since this subscription was created
          if (subscriptionGeneration !== cacheGeneration) return;

          // Transform candle data to ensure it has the correct format with volume
          const rawCandle = candle as Record<string, unknown>;
          const candleData = transformOHLCVBar(rawCandle);

          if (!candleData.time) {
            return;
          }

          // Skip candles with zero/null prices (e.g., empty initial entry from
          // backend when no trade data exists in the lookback window).
          // Emitting price=0 to TradingView would break the Y-axis scale.
          if (!candleData.close || candleData.close === 0) {
            return;
          }

          if (!firstCandleReceived) {
            firstCandleReceived = true;

            // Read lastBar from cache NOW (not at subscribe time) to ensure we
            // have the latest historical bar from getBars, not a stale bar from
            // a previous token that was cleared by resetFirstData().
            const lastBar = lastBarsCache.get(cacheKey) as Bar | Record<string, unknown> | undefined;

            if (lastBar?.time && lastBar?.close != null) {
              const normalizeTime = (t: number) => t > 10_000_000_000 ? t : t * 1000;
              const lastBarTimeMs = normalizeTime(lastBar.time as number);
              const candleTimeMs = normalizeTime(candleData.time as number);
              const resolutionMs = getResolutionMs(normalizedResolution);

              // Only bridge if the gap is within a reasonable range (< 3 candles).
              // Larger gaps indicate sparse data — bridging would create fake candles.
              if (candleTimeMs > lastBarTimeMs && (candleTimeMs - lastBarTimeMs) <= resolutionMs * 3) {
                const startPrice = lastBar.close as number;
                const endPrice = (candleData.open ?? candleData.close ?? startPrice) as number;
                // Align bridge bar to the next candle boundary after lastBar
                const bridgeTime = lastBarTimeMs + resolutionMs;

                const bridgeBar = {
                  time: bridgeTime,
                  open: startPrice,
                  high: Math.max(startPrice, endPrice),
                  low: Math.min(startPrice, endPrice),
                  close: endPrice,
                  volume: 0,
                };

                emitProcessedCandle(bridgeBar);
              }
            }
          }
          emitProcessedCandle(candleData);
        });

        activeSubscriptions.set(listenerGuid, { subscription, assetKey: subscriptionAssetKey });
      } catch {
        // Subscription failure — silent, TradingView will retry
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

    /** Returns the oldest bar time in ms from the local cache, or null if empty */
    getOldestBarTime: (): number | null => {
      if (localBarCache.length === 0) return null;
      return localBarCache[0].time;
    },

    /** Returns total cached bar count */
    getCachedBarCount: (): number => localBarCache.length,

    /**
     * Pre-fetch older bars into localBarCache so that when TradingView
     * requests them via getBars (scroll pagination), they're already available.
     * Called from the scroll listener at ~80% to avoid visible loading.
     */
    prefetchOlderBars: (resolution: string) => {
      const current = baseAssetRef.current;
      const assetId = current.isPair ? current.address : current.asset;
      const normalizedRes = normalizeResolution(resolution);
      const settingsSnapshot: ChartSettings = { ...settingsRef.current };
      const cacheKey = buildSettingsKey(assetId, normalizedRes, settingsSnapshot);

      // Don't prefetch if already at end of data
      const emptyKey = `${assetId}-${normalizedRes}`;
      if ((consecutiveEmptyBars.get(emptyKey) ?? 0) >= EMPTY_THRESHOLD) return;

      // Don't prefetch if no data yet
      if (localBarCache.length === 0 || localBarCacheKey !== cacheKey) return;

      const oldestBarTime = localBarCache[0].time;
      const prefetchRequestKey = `prefetch-${cacheKey}-${oldestBarTime}`;

      // Don't duplicate an in-flight prefetch
      if (pendingRequests.has(prefetchRequestKey)) return;

      const fetchGeneration = cacheGeneration;

      const fetchFn = (): Promise<unknown[]> => {
        if (current.isPair) {
          return fetchWithRetry(() =>
            sdk.fetchMarketOHLCVHistory({
              address: current.address!,
              chainId: current.chainId,
              from: 0,
              to: oldestBarTime,
              amount: PAGINATION_AMOUNT,
              usd: settingsSnapshot.isUsd,
              period: normalizedRes,
            } satisfies MarketOHLCVHistoryParams).then((res) => (res as { data?: unknown[] })?.data || []),
          );
        }
        return fetchWithRetry(() =>
          sdk.fetchTokenOHLCVHistory({
            address: current.asset!,
            chainId: current.chainId,
            from: 0,
            to: oldestBarTime,
            amount: PAGINATION_AMOUNT,
            usd: settingsSnapshot.isUsd,
            period: normalizedRes,
          } satisfies TokenOHLCVHistoryParams).then((res) => (res as { data?: unknown[] })?.data || []),
        );
      };

      const prefetchPromiseResult = fetchFn().then((rawBars) => {
        if (fetchGeneration !== cacheGeneration) return [];
        const processedBars = applyMetricToBars(rawBars, settingsSnapshot);

        // NOTE: Do NOT touch consecutiveEmptyBars here.
        // This counter is only for getBars flow — the prefetch is silent
        // and should not push the threshold that stops pagination.

        const newCachedBars: CachedBar[] = processedBars.map((b) => ({
          time: b.time as number,
          open: b.open as number,
          high: b.high as number,
          low: b.low as number,
          close: b.close as number,
          volume: b.volume as number,
        }));

        // Prepend to local cache
        if (localBarCacheKey === cacheKey && newCachedBars.length > 0) {
          const existingOldest = localBarCache[0]?.time ?? Infinity;
          const olderBars = newCachedBars.filter((b) => b.time < existingOldest);
          if (olderBars.length > 0) {
            localBarCache = [...olderBars, ...localBarCache];
          }
        }

        if (newCachedBars.length > 0) {
          upsertPersistentCache(cacheKey, newCachedBars);
        }

        setTimeout(() => pendingRequests.delete(prefetchRequestKey), 200);
        return processedBars;
      }).catch(() => {
        pendingRequests.delete(prefetchRequestKey);
        return [];
      });

      pendingRequests.set(prefetchRequestKey, prefetchPromiseResult);
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

