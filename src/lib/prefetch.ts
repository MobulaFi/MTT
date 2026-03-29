/**
 * Eager prefetch cache — fire REST calls during render (t=0ms)
 * instead of waiting for useEffect (~16ms + React lifecycle delays).
 *
 * Calls are idempotent: the first invocation starts the fetch,
 * subsequent calls return the cached promise.
 */
import { sdk } from './sdkClient';
import { REST_ENDPOINTS, DEFAULT_REST_ENDPOINT } from '@/config/endpoints';

interface CacheEntry {
  promise: Promise<unknown>;
  ts: number;
}

const cache = new Map<string, CacheEntry>();
const TTL = 30_000;

function getOrFetch(key: string, fetcher: () => Promise<unknown>): Promise<unknown> {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < TTL) return entry.promise;
  const promise = fetcher();
  cache.set(key, { promise, ts: Date.now() });
  promise.catch(() => cache.delete(key));
  return promise;
}

export function prefetchTokenDetails(address: string, blockchain: string): Promise<unknown> {
  return getOrFetch(`td:${blockchain}:${address}`, () =>
    sdk.fetchTokenDetails({ address, blockchain }),
  );
}

export function prefetchMarketDetails(address: string, blockchain: string): Promise<unknown> {
  return getOrFetch(`md:${blockchain}:${address}`, () =>
    sdk.fetchMarketDetails({ address, blockchain }),
  );
}

export function prefetchHolders(tokenAddress: string, blockchain: string): Promise<unknown> {
  return getOrFetch(`holders:${blockchain}:${tokenAddress}`, () =>
    sdk.fetchTokenHolderPositions({ blockchain, address: tokenAddress, limit: 100 }),
  );
}

export function prefetchTopTraders(tokenAddress: string, blockchain: string): Promise<unknown> {
  return getOrFetch(`traders:${blockchain}:${tokenAddress}`, () =>
    sdk.fetchTokenTraderPositions({ address: tokenAddress, blockchain }),
  );
}

export function prefetchMarkets(tokenAddress: string, blockchain: string): Promise<unknown> {
  return getOrFetch(`markets:${blockchain}:${tokenAddress}`, () =>
    sdk.fetchTokenMarkets({ address: tokenAddress, blockchain }),
  );
}

export function prefetchAllTokenData(address: string, blockchain: string): void {
  prefetchTokenDetails(address, blockchain);
  prefetchHolders(address, blockchain);
  prefetchTopTraders(address, blockchain);
  prefetchMarkets(address, blockchain);
}

export function prefetchAllPairData(pairAddress: string, blockchain: string): void {
  prefetchMarketDetails(pairAddress, blockchain).then((res) => {
    const tokenAddress = (res as { data?: { baseToken?: { address?: string } } })?.data?.baseToken?.address;
    if (tokenAddress) {
      prefetchHolders(tokenAddress, blockchain);
      prefetchTopTraders(tokenAddress, blockchain);
      prefetchMarkets(tokenAddress, blockchain);
    }
  });
}

export function invalidatePrefetch(address: string, blockchain: string): void {
  cache.delete(`td:${blockchain}:${address}`);
  cache.delete(`md:${blockchain}:${address}`);
  cache.delete(`holders:${blockchain}:${address}`);
  cache.delete(`traders:${blockchain}:${address}`);
  cache.delete(`markets:${blockchain}:${address}`);
}

export function getRestUrl(): string {
  const defaultRestUrl = REST_ENDPOINTS[DEFAULT_REST_ENDPOINT];
  let restUrl = process.env.NEXT_PUBLIC_MOBULA_API_URL || defaultRestUrl;
  if (typeof document !== 'undefined') {
    const cookie = document.cookie
      .split('; ')
      .find((c) => c.trim().startsWith('customRestUrl='));
    if (cookie) {
      const urlFromCookie = decodeURIComponent(cookie.split('=')[1]).trim();
      if (urlFromCookie) restUrl = urlFromCookie;
    }
  }
  return restUrl;
}

export function getApiKey(): string {
  try {
    const raw = localStorage.getItem('mobula-api-storage');
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { apiKey?: string } };
      const key = parsed.state?.apiKey;
      if (key && typeof key === 'string' && key.trim()) return key.trim();
    }
  } catch {
    // ignore
  }
  return process.env.NEXT_PUBLIC_MOBULA_API_KEY || '';
}

export function prefetchOhlcvData(params: {
  isPair: boolean;
  address: string;
  chainId: string;
  period?: string;
  isUsd?: boolean;
}): Promise<unknown[]> {
  const { isPair, address, chainId, period = '1s', isUsd = true } = params;
  const amount = getOhlcvPrefetchAmount(period);
  // Always fetch fresh OHLCV data — never serve stale candles from cache.
  // Unlike static data (token details, holders), OHLCV changes every second
  // and stale data causes visible chart gaps on token re-visits.
  if (isPair) {
    return sdk.fetchMarketOHLCVHistory({
      address,
      chainId,
      from: 0,
      to: Date.now(),
      amount,
      usd: isUsd,
      period,
    }).then((res) => ((res as { data?: unknown[] })?.data || []));
  }
  return sdk.fetchTokenOHLCVHistory({
    address,
    chainId,
    from: 0,
    to: Date.now(),
    amount,
    usd: isUsd,
    period,
  }).then((res) => ((res as { data?: unknown[] })?.data || []));
}

function getOhlcvPrefetchAmount(_period: string): number {
  return 500;
}

export function prefetchTokenFilters(payload: Record<string, unknown>): Promise<unknown> {
  const key = `tf:${JSON.stringify(payload)}`;
  return getOrFetch(key, async () => {
    const restUrl = getRestUrl();
    const response = await fetch(`${restUrl}/api/2/token/filters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getApiKey(),
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return null;
    return response.json();
  });
}
