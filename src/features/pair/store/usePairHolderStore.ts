import { create } from 'zustand';
import type { TokenPositionsOutputResponse } from '@mobula_labs/types';

// Sort field options for the holders table
export type HolderSortField = 
  | 'balance' 
  | 'balanceUSD' 
  | 'bought' 
  | 'sold' 
  | 'pnl' 
  | 'remaining'
  | 'lastActive'
  | 'avgBuy'
  | 'avgSell';

export type SortDirection = 'asc' | 'desc';

interface PairHoldersState {
  holders: TokenPositionsOutputResponse[];
  holdersCount: number;
  loading: boolean;
  blockchain: string;
  tokenPrice: number;
  totalSupply: number;
  
  // Sorting
  sortField: HolderSortField;
  sortDirection: SortDirection;
  
  // Filtering
  labelFilter: string | null;
  
  // Actions
  setHolders: (holders: TokenPositionsOutputResponse[]) => void;
  setHoldersCount: (count: number) => void;
  setBlockchain: (blockchain: string) => void;
  setLoading: (loading: boolean) => void;
  setTokenPrice: (price: number) => void;
  setTotalSupply: (supply: number) => void;
  setSortField: (field: HolderSortField) => void;
  setSortDirection: (direction: SortDirection) => void;
  toggleSort: (field: HolderSortField) => void;
  setLabelFilter: (label: string | null) => void;
  clearHolders: () => void;
}

export const usePairHoldersStore = create<PairHoldersState>((set, get) => ({
  holders: [],
  holdersCount: 0,
  loading: false,
  blockchain: '',
  tokenPrice: 0,
  totalSupply: 0,
  sortField: 'balance',
  sortDirection: 'desc',
  labelFilter: null,
  
  setHolders: (holders) => set({ holders }),
  setHoldersCount: (count) => set({ holdersCount: count }),
  setBlockchain: (blockchain) => set({ blockchain }),
  setLoading: (loading) => set({ loading }),
  setTokenPrice: (price) => set({ tokenPrice: price }),
  setTotalSupply: (supply) => set({ totalSupply: supply }),
  setSortField: (field) => set({ sortField: field }),
  setSortDirection: (direction) => set({ sortDirection: direction }),
  
  toggleSort: (field) => {
    const { sortField, sortDirection } = get();
    if (sortField === field) {
      set({ sortDirection: sortDirection === 'asc' ? 'desc' : 'asc' });
    } else {
      set({ sortField: field, sortDirection: 'desc' });
    }
  },
  
  setLabelFilter: (label) => set({ labelFilter: label }),
  
  clearHolders: () =>
    set({ 
      holders: [], 
      holdersCount: 0, 
      loading: false, 
      blockchain: '',
      tokenPrice: 0,
      totalSupply: 0,
      sortField: 'balance',
      sortDirection: 'desc',
      labelFilter: null,
    }),
}));
