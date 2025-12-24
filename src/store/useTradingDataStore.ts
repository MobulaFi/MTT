import { create } from 'zustand';

interface TradingToken {
  address: string;
  symbol: string;
  name?: string | null;
  logo?: string | null;
  blockchain: string;
  decimals?: number;
}

interface TradingDataState {
  baseToken: TradingToken | null;
  quoteToken: TradingToken | null;
  pairAddress: string | null;
  setBaseToken: (token: TradingToken | null) => void;
  setQuoteToken: (token: TradingToken | null) => void;
  setPairAddress: (address: string | null) => void;
  reset: () => void;
}

export const useTradingDataStore = create<TradingDataState>((set) => ({
  baseToken: null,
  quoteToken: null,
  pairAddress: null,
  setBaseToken: (token) => set({ baseToken: token }),
  setQuoteToken: (token) => set({ quoteToken: token }),
  setPairAddress: (address) => set({ pairAddress: address }),
  reset: () => set({ baseToken: null, quoteToken: null, pairAddress: null }),
}));

