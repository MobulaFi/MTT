import { create } from 'zustand';
import { WssMarketDetailsResponseType } from '@mobula_labs/types';

interface HelperState {
  totalSupply: number | null;
  setTotalSupply: (totalSupply: number | null) => void;
}

interface PairState extends HelperState {
  data: WssMarketDetailsResponseType['pairData'] | null;
  isLoading: boolean;
  error: string | null;
  setData: (data: WssMarketDetailsResponseType['pairData']) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const usePairStore = create<PairState>((set) => ({
  data: null,
  isLoading: true,
  error: null,

  // helper state
  totalSupply: null,
  setTotalSupply: (totalSupply) => set({ totalSupply }),

  setData: (data) => set({ data, isLoading: false, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  reset: () => set({ data: null, isLoading: true, error: null, totalSupply: null }),
}));

