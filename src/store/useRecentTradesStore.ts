import { create } from 'zustand';

export interface RecentTrade {
  txHash: string;
  chainId: string;
  direction: 'buy' | 'sell';
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenLogo: string | null;
  tokenDecimals: number;
  quoteAddress: string;
  quoteSymbol: string;
  quoteName: string;
  quoteLogo: string | null;
  amountIn: number;
  amountOut: number;
  amountUsd: number;
  priceUsd: number;
  timestamp: number;
}

interface RecentTradesState {
  trades: RecentTrade[];
  addTrade: (trade: RecentTrade) => void;
  clear: () => void;
}

// Keep trades for 5 minutes max
const MAX_TRADE_AGE_MS = 5 * 60 * 1000;
const MAX_TRADES = 50;

export const useRecentTradesStore = create<RecentTradesState>((set) => ({
  trades: [],

  addTrade: (trade) =>
    set((state) => {
      const now = Date.now();
      // Remove expired trades and add new one
      const fresh = state.trades.filter(
        (t) => now - t.timestamp < MAX_TRADE_AGE_MS && t.txHash !== trade.txHash
      );
      return { trades: [trade, ...fresh].slice(0, MAX_TRADES) };
    }),

  clear: () => set({ trades: [] }),
}));
