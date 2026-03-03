// Prediction Markets API Client

import type {
  PMMarket,
  PMCategory,
  PMTrade,
  PMSearchParams,
  PMSearchResponse,
  PMTrendingResponse,
  PMCategoriesResponse,
} from '../types';

// Use the Next.js API proxy to avoid CORS/localhost issues when accessing via Coder
// The proxy routes requests server-side to the actual PM API
const PM_API_BASE = '/api/pm';

/**
 * Get all prediction market categories
 */
export async function getCategories(): Promise<PMCategory[]> {
  const res = await fetch(`${PM_API_BASE}/categories`);
  if (!res.ok) throw new Error('Failed to fetch categories');
  const data: PMCategoriesResponse = await res.json();
  return data.data;
}

/**
 * Search prediction markets
 */
export async function searchMarkets(params: PMSearchParams = {}): Promise<PMSearchResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.query) searchParams.set('query', params.query);
  if (params.platform) searchParams.set('platform', params.platform);
  if (params.category) searchParams.set('category', params.category);
  if (params.status) searchParams.set('status', params.status);
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.offset) searchParams.set('offset', params.offset.toString());

  const res = await fetch(`${PM_API_BASE}/search?${searchParams.toString()}`);
  if (!res.ok) throw new Error('Failed to search markets');
  return res.json();
}

/**
 * Get trending markets
 */
export async function getTrendingMarkets(
  period: '24h' | '7d' | '30d' = '24h',
  category?: string,
  limit = 20
): Promise<PMMarket[]> {
  const params = new URLSearchParams({ period, limit: limit.toString() });
  if (category) params.set('category', category);

  const res = await fetch(`${PM_API_BASE}/trending?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch trending markets');
  const data: PMTrendingResponse = await res.json();
  return data.data;
}

/**
 * Get market details
 */
export async function getMarketDetails(platform: string, marketId: string): Promise<PMMarket> {
  const params = new URLSearchParams({ platform, marketId });
  const res = await fetch(`${PM_API_BASE}/market/details?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch market details');
  const data = await res.json();
  return data.data;
}

/**
 * Get market prices
 */
export async function getMarketPrices(platform: string, marketId: string) {
  const params = new URLSearchParams({ platform, marketId });
  const res = await fetch(`${PM_API_BASE}/market/price?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch market prices');
  const data = await res.json();
  return data.data;
}

/**
 * Get market OHLCV data
 */
export async function getMarketOHLCV(
  platform: string,
  marketId: string,
  outcomeId: string,
  period: '1s' | '5s' | '10s' | '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h',
  limit = 100
) {
  const params = new URLSearchParams({
    platform,
    marketId,
    outcomeId,
    period,
    limit: limit.toString(),
  });
  const res = await fetch(`${PM_API_BASE}/market/ohlcv?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch OHLCV data');
  const data = await res.json();
  return data.data;
}

/**
 * Get market trades
 */
export async function getMarketTrades(
  platform: string,
  marketId: string,
  outcomeId?: string,
  limit = 20
): Promise<PMTrade[]> {
  const params = new URLSearchParams({ platform, marketId, limit: limit.toString() });
  if (outcomeId) params.set('outcomeId', outcomeId);

  const res = await fetch(`${PM_API_BASE}/market/trades?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch trades');
  const data = await res.json();
  
  // Map API response to PMTrade format
  return (data.data || []).map((trade: Record<string, unknown>) => ({
    tradeId: trade.id as string,
    txHash: (trade.txHash as string) || '',
    outcomeId: trade.outcomeId as string,
    outcomeLabel: (trade.outcomeLabel as string) || '',
    side: ((trade.side as string) || '').toLowerCase() as 'buy' | 'sell',
    price: trade.price as number,
    size: trade.size as number,
    amountUSD: trade.amountUSD as number,
    maker: trade.maker as string | undefined,
    taker: trade.taker as string | undefined,
    timestamp: typeof trade.timestamp === 'number' 
      ? new Date(trade.timestamp).toISOString()
      : (trade.timestamp as string),
  }));
}

/**
 * Get market orderbook depth (bid/ask spread over time)
 */
export async function getMarketOrderbook(
  platform: string,
  marketId: string,
  outcomeId: string,
  period: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '5m',
  limit = 100
) {
  const params = new URLSearchParams({
    platform,
    marketId,
    outcomeId,
    period,
    limit: limit.toString(),
  });
  const res = await fetch(`${PM_API_BASE}/market/orderbook?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch orderbook data');
  const data = await res.json();
  return data.data;
}

/**
 * Get market order book (bids/asks at price levels)
 */
export async function getMarketBook(
  platform: string,
  marketId: string,
  outcomeId: string,
): Promise<{ bids: Array<{ price: number; size: number }>; asks: Array<{ price: number; size: number }> }> {
  const params = new URLSearchParams({ platform, marketId, outcomeId });
  const res = await fetch(`${PM_API_BASE}/market/book?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch order book');
  const data = await res.json();
  return data.data;
}
