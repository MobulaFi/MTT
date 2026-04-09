// store/topTradersStore.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { TokenPositionsOutputResponse } from '@mobula_labs/types';

interface TopTradersFilters {
  label?: string;
  limit?: number;
  walletAddresses?: string[];
}

interface TopTradersData {
  data: TokenPositionsOutputResponse[];
  totalCount: number;
}

interface TopTradersState {
  data: TopTradersData;

  tokenAddress: string | null;
  blockchain: string | null;

  filters: TopTradersFilters;

  isLoading: boolean;
  error: string | null;

  setData: (data: TopTradersData) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setTokenAddress: (tokenAddress: string) => void;
  setBlockchain: (blockchain: string) => void;
  setFilters: (filters: TopTradersFilters) => void;
  setFilter: (key: keyof TopTradersFilters, value: unknown) => void;
  clearFilters: () => void;
  upsertHolder: (holder: TokenPositionsOutputResponse) => void;
  removeHolder: (walletAddress: string) => void;
  reset: () => void;
}

const initialState: Pick<TopTradersState, 'data' | 'tokenAddress' | 'blockchain' | 'filters' | 'isLoading' | 'error'> = {
  data: { data: [], totalCount: 0 },
  tokenAddress: null,
  blockchain: null,
  filters: {},
  isLoading: false,
  error: null,
};

export const useTopTradersStore = create<TopTradersState>()(
  subscribeWithSelector((set) => ({
    ...initialState,

    setData: (data) => set({ data, error: null }),

    setLoading: (isLoading) => set({ isLoading }),

    setError: (error) => set({ error, isLoading: false }),

    setTokenAddress: (tokenAddress) => set({ tokenAddress }),

    setBlockchain: (blockchain) => set({ blockchain }),

    setFilters: (filters) => set({ filters }),

    setFilter: (key, value) => set((state) => ({
      filters: { ...state.filters, [key]: value }
    })),

    clearFilters: () => set({ filters: {} }),

    upsertHolder: (holder) => set((state) => {
      const items = [...state.data.data];
      const idx = items.findIndex((h) => h.walletAddress === holder.walletAddress);
      if (idx >= 0) {
        items[idx] = holder;
      } else {
        items.push(holder);
      }
      // Re-sort by realized PnL (top traders view)
      items.sort((a, b) => Number(b.realizedPnlUSD || 0) - Number(a.realizedPnlUSD || 0));
      return { data: { ...state.data, data: items, totalCount: items.length } };
    }),

    removeHolder: (walletAddress) => set((state) => {
      const items = state.data.data.filter((h) => h.walletAddress !== walletAddress);
      return { data: { ...state.data, data: items, totalCount: items.length } };
    }),

    reset: () => set(initialState),
  }))
);
