// store/topTradersStore.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { TokenPositionsResponse } from '@mobula_labs/types';
import type { StreamTradeEvent } from '@/features/pair/store/usePairHolderStore';
import { applyTradesToPositions } from '@/utils/applyTradesToPositions';

interface TopTradersFilters {
  label?: string;
  limit?: number;
  walletAddresses?: string[];
}

interface TopTradersState {
  data: TokenPositionsResponse;

  tokenAddress: string | null;
  blockchain: string | null;

  filters: TopTradersFilters;

  isLoading: boolean;
  error: string | null;

  setData: (data: TokenPositionsResponse) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setTokenAddress: (tokenAddress: string) => void;
  setBlockchain: (blockchain: string) => void;
  setFilters: (filters: TopTradersFilters) => void;
  setFilter: (key: keyof TopTradersFilters, value: any) => void;
  clearFilters: () => void;
  upsertFromTrades: (trades: StreamTradeEvent[]) => void;
  reset: () => void;
}

const initialState: Pick<TopTradersState, 'data' | 'tokenAddress' | 'blockchain' | 'filters' | 'isLoading' | 'error'> = {
  data: { data: [], totalCount: 0 } as TokenPositionsResponse,
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

    upsertFromTrades: (trades) => set((state) => {
      const items = state.data?.data;
      if (!items || items.length === 0) return state;

      const { positions } = applyTradesToPositions(items, trades);

      return { data: { ...state.data, data: positions } };
    }),

    reset: () => set(initialState),
  }))
);
