import type { SwapQuotingResponse } from '@mobula_labs/types';

export interface CachedQuote {
  response: SwapQuotingResponse;
  receivedAt: number;
}

const cache = new Map<string, CachedQuote>();
const inFlight = new Set<string>();

function key(address: string, chainId: string, direction: 'buy' | 'sell'): string {
  return `${address}_${chainId}_${direction}`;
}

export function getQuote(address: string, chainId: string, direction: 'buy' | 'sell'): CachedQuote | undefined {
  return cache.get(key(address, chainId, direction));
}

export async function fetchQuote(
  address: string,
  chainId: string,
  direction: 'buy' | 'sell',
  params: {
    walletAddress: string;
    quoteToken: string;
    quotePrice: number;
    buyAmountUSD: number;
    sellPct: number;
    holdingBalance: number;
    slippage: number;
  },
): Promise<SwapQuotingResponse | null> {
  const k = key(address, chainId, direction);

  // Don't spam if already in-flight
  if (inFlight.has(k)) return cache.get(k)?.response ?? null;

  inFlight.add(k);
  try {
    const { sdk } = await import('@/lib/sdkClient');
    let result: unknown = null;

    if (direction === 'buy') {
      if (params.quotePrice <= 0 || params.buyAmountUSD <= 0) return null;
      const tokenAmount = params.buyAmountUSD / params.quotePrice;
      result = await sdk.fetchSwapQuote({
        chainId,
        tokenIn: params.quoteToken,
        tokenOut: address,
        amount: String(tokenAmount) as unknown as number,
        slippage: params.slippage as unknown as number,
        walletAddress: params.walletAddress,
      });
    } else {
      const sellAmount = params.holdingBalance > 0
        ? params.holdingBalance * (params.sellPct / 100)
        : 0;
      if (sellAmount <= 0) return null;
      result = await sdk.fetchSwapQuote({
        chainId,
        tokenIn: address,
        tokenOut: params.quoteToken,
        amount: String(sellAmount) as unknown as number,
        slippage: params.slippage as unknown as number,
        walletAddress: params.walletAddress,
      });
    }

    const typed = result as SwapQuotingResponse | null;
    if (typed?.data) {
      cache.set(k, { response: typed, receivedAt: Date.now() });
    }
    return typed;
  } catch (err) {
    console.error(`[SurgeQuotes] ${direction} error for ${address}:`, err);
    return null;
  } finally {
    inFlight.delete(k);
  }
}
