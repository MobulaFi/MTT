import { create } from 'zustand';
import type { WssHoldersResponse } from '@mobula_labs/types';

interface PairHoldersState {
  holders: WssHoldersResponse['data']['holders'];
  holdersCount: number;
  loading: boolean;
  blockchain: string;
  setHolders: (holders: WssHoldersResponse['data']['holders']) => void;
  setHoldersCount: (count: number) => void;
  setBlockchain: (blockchain: string) => void;
  setLoading: (loading: boolean) => void;
  clearHolders: () => void;
}

export const usePairHoldersStore = create<PairHoldersState>((set) => ({
  holders: [],
  holdersCount: 0,
  loading: false,
  blockchain: '',
  
  setHolders: (holders) => set({ holders }),
  setHoldersCount: (count) => set({ holdersCount: count }),
  setBlockchain: (blockchain) => set({ blockchain }),
  setLoading: (loading) => set({ loading }),
  clearHolders: () =>
    set({ holders: [], holdersCount: 0, loading: false, blockchain: '' }),
}));

