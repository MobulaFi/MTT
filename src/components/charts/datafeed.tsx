import { getMobulaClient } from '@/lib/mobulaClient';

export const supportedResolutions = ['1s', '5s', '15s', '30s', '1', '5', '15', '60', '1D', '1W', '1M'];

const lastBarsCache = new Map();
const activeSubscriptions = new Map<string, string>();
const pendingRequests = new Map<string, Promise<any>>();

const getClient = () => getMobulaClient();

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
  quote?: { symbol?: string };
  priceUSD?: number;
  isPair?: boolean;
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

export const Datafeed = (
  initialBaseAsset: BaseAsset,
  isUsd = false,
) => {
  const baseAssetRef = new BaseAssetRef(initialBaseAsset);

  return {
    updateBaseAsset: (newAsset: BaseAsset) => {
      baseAssetRef.update(newAsset);
    },

    onReady: (cb: (config: any) => void) =>
      setTimeout(() => {
        cb({
          supported_resolutions: supportedResolutions,
          supports_search: false,
          supports_group_request: false,
          supports_marks: false,
          supports_timescale_marks: false,
          supports_time: true,
        });
      }, 0),

    resolveSymbol: (symbolName: string, onResolve: (info: any) => void) => {
      setTimeout(() => {
        const price = baseAssetRef.current.priceUSD ?? 1;
        const info = {
          name: symbolName,
          description: '',
          type: 'crypto',
          session: '24x7',
          timezone: 'Etc/UTC',
          ticker: symbolName,
          minmov: 1,
          pricescale: Math.min(10 ** String(Math.round(10000 / price)).length, 1e16),
          has_intraday: true,
          has_seconds: true,
          has_daily: true,
          has_weekly_and_monthly: true,
          intraday_multipliers: ['1', '5', '15', '60'],
          seconds_multipliers: ['1', '5', '15', '30'],
          daily_multipliers: ['1'],
          supported_resolution: supportedResolutions,
          volume_precision: 2,
          data_status: 'streaming',
        };
        onResolve(info);
      }, 0);
    },

    getBars: async (
      _info: any,
      resolution: string,
      params: any,
      onResult: (bars: any[], meta: { noData: boolean }) => void
    ) => {
      const current = baseAssetRef.current;
      const assetId = current.isPair ? current.address : current.asset;
      const normalizedResolution = normalizeResolution(resolution);
      const key = `${assetId}-${normalizedResolution}-${params.from}-${params.to}`;
      const cacheKey = `${assetId}-${normalizedResolution}`;

      // TradingView provides timestamps in seconds, convert to ms
      const fromMs = params.from * 1000;
      const toMs = params.to * 1000;

      try {
        if (pendingRequests.has(key)) {
          const bars = await pendingRequests.get(key)!;
          onResult(bars, { noData: !bars.length });
          return;
        }

        const client = getClient();
        
        const requestParams: any = {
          from: fromMs,
          to: toMs,
          amount: params.countBack,
          usd: `${isUsd}`,
          period: normalizedResolution,
          blockchain: current.chainId
        };

        if (current.isPair) {
          requestParams.address = current.address;
          requestParams.mode = 'pool';
        } else {
          requestParams.asset = current.asset;
          requestParams.mode = 'asset';
        }

        const req = client
          .fetchMarketHistoricalPairData(requestParams)
          .then((res) => res.data || []);

        pendingRequests.set(key, req);
        const bars = await req;

        setTimeout(() => {
          pendingRequests.delete(key);
        }, 200);
        
        onResult(bars, { noData: !bars.length });

        if (bars.length > 0) {
          const lastBar = bars[bars.length - 1];
          const cachedBar = lastBarsCache.get(cacheKey);
          
          if (!cachedBar || lastBar.time >= cachedBar.time) {
            lastBarsCache.set(cacheKey, lastBar);
          }
        }
      } catch (err) {
        console.error('Error fetching bars:', err);
        onResult([], { noData: true });
        pendingRequests.delete(key);
      }
    },

    subscribeBars: async (
      _info: any,
      resolution: string,
      onRealtime: (bar: any) => void,
      subscriberUID: string
    ) => {
      const client = getClient();
      if (!client) return;
    
      const current = baseAssetRef.current;
      const assetId = current.isPair ? current.address : current.asset;
      const key = `${assetId}-${subscriberUID}`;
      const normalizedResolution = normalizeResolution(resolution);
      const cacheKey = `${assetId}-${normalizedResolution}`;
    
      if (activeSubscriptions.has(key)) {
        try {
          await client.streams.unsubscribe('ohlcv', activeSubscriptions.get(key)!);
        } catch {}
        activeSubscriptions.delete(key);
      }
    
      const computedPeriod = normalizedResolution;
    
      const lastBar = lastBarsCache.get(cacheKey);
      const lastBarTime = lastBar?.time 
        ? (typeof lastBar.time === 'number' && lastBar.time > 10000000000 
            ? lastBar.time / 1000
            : lastBar.time)
        : null;
    
      let firstCandleHandled = false;
      const pendingCandles: any[] = [];
    
      const getResolutionSeconds = (res: string): number => {
        if (res === '1M') return 2592000;
        const lower = res.toLowerCase();
        if (lower === '1d') return 86400;
        if (lower === '1w') return 604800;
        if (lower.endsWith('s')) {
          return parseInt(lower.replace('s', ''), 10);
        }
        if (lower.endsWith('h')) {
          return parseInt(lower.replace('h', ''), 10) * 3600;
        }
        if (lower.endsWith('m')) {
          return parseInt(lower.replace('m', ''), 10) * 60;
        }
        const numeric = Number(res);
        if (!Number.isNaN(numeric)) {
          return numeric * 60;
        }
        return 60;
      };
    
      try {
        const subscribeParams: any = {
          period: computedPeriod,
          chainId: current.chainId,
        };
    
        if (current.isPair) {
          subscribeParams.address = current.address;
        } else {
          subscribeParams.asset = current.asset;
        }
    
        const subId = client.streams.subscribe(
          'ohlcv',
          subscribeParams,
          (candle: any) => {
            if (!candle?.time) return;
    
            const candleTime = typeof candle.time === 'number' && candle.time > 10000000000 
              ? candle.time / 1000
              : candle.time;
    
            if (!firstCandleHandled) {
              pendingCandles.push(candle);
              
              if (pendingCandles.length > 1) return;
    
              const firstCandle = pendingCandles[0];
              const firstCandleTime = typeof firstCandle.time === 'number' && firstCandle.time > 10000000000 
                ? firstCandle.time / 1000
                : firstCandle.time;
    
              if (lastBarTime && lastBar && firstCandleTime > lastBarTime) {
                const lastPrice =
                  lastBar.close ??
                  lastBar.open ??
                  firstCandle.open ??
                  firstCandle.close ??
                  0;

                const updatedOpen = lastPrice;
                const updatedHigh = Math.max(firstCandle.high ?? updatedOpen, updatedOpen);
                const updatedLow = Math.min(firstCandle.low ?? updatedOpen, updatedOpen);

                firstCandle.open = updatedOpen;
                firstCandle.high = updatedHigh;
                firstCandle.low = updatedLow;
              }
    
              firstCandleHandled = true;
              for (const pendingCandle of pendingCandles) {
                onRealtime(pendingCandle);
                lastBarsCache.set(cacheKey, pendingCandle);
              }
              pendingCandles.length = 0;
            } else {
              onRealtime(candle);
              lastBarsCache.set(cacheKey, candle);
            }
          }
        );
        
        activeSubscriptions.set(key, subId);
      } catch (err) {
        console.error('Error subscribing to OHLCV stream', err);
      }
    },

    unsubscribeBars: async (subscriberUID: string) => {
      const client = getClient();
      const current = baseAssetRef.current;
      const assetId = current.isPair ? current.address : current.asset;
      const key = `${assetId}-${subscriberUID}`;
      const subId = activeSubscriptions.get(key);

      if (subId && client) {
        try {
          await client.streams.unsubscribe('ohlcv', subId);
        } catch (err) {
          console.error('Unsubscribe error:', err);
        }
        activeSubscriptions.delete(key);
      }
    },
  };
};