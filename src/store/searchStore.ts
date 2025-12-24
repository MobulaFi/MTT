'use client';
import { create } from 'zustand';
import { getMobulaClient } from '@/lib/mobulaClient';
import { PoolType } from '@mobula_labs/sdk';

export type SortByType =
  | 'created_at'
  | 'market_cap'
  | 'volume_1h'
  | 'volume_24h'
  | 'fees_paid_5min'
  | 'fees_paid_1h'
  | 'fees_paid_24h'
  | 'volume_5min'
  | 'holders_count'
  | 'organic_volume_1h'
  | 'total_fees_paid_usd';

export type ModeType = 'trendings' | 'og';
export type TypeType = 'tokens' | 'assets' | 'pairs';

const SORT_PREFERENCE_KEY = 'mtt-search-sort';

const sortByValues: SortByType[] = [
  'created_at',
  'market_cap',
  'volume_1h',
  'volume_24h',
  'fees_paid_5min',
  'fees_paid_1h',
  'fees_paid_24h',
  'volume_5min',
  'holders_count',
  'organic_volume_1h',
  'total_fees_paid_usd',
];

const readStoredSortPreference = (): SortByType | null => {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(SORT_PREFERENCE_KEY);
  if (!stored) return null;
  return sortByValues.includes(stored as SortByType) ? (stored as SortByType) : null;
};

interface SearchState {
  query: string;
  results: any[];
  isLoading: boolean;
  error: string | null;
  sortBy: SortByType | null;
  mode?: ModeType;
  type?: TypeType;
  poolTypes: PoolType[];
  blockchains: string[];
  fetchSearch: (input: string, sortBy?: SortByType | null, mode?: ModeType, type?: TypeType) => Promise<void>;
  setSortBy: (sortBy: SortByType | null) => void;
  setMode: (mode: ModeType | undefined) => void;
  setType: (type: TypeType | undefined) => void;
  setPoolTypes: (poolTypes: PoolType[]) => void;
  setBlockchains: (blockchains: string[]) => void;
  clearSearch: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: 'Eth',
  results: [],
  isLoading: false,
  error: null,
  sortBy: readStoredSortPreference(),
  mode: undefined,
  type: undefined,
  poolTypes: [],
  blockchains: [],

  fetchSearch: async (input, sortBy, mode, type) => {
    if (!input || input.trim().length < 2) {
      set({ results: [], query: input });
      return;
    }

    const client = getMobulaClient();

    const nextSortBy = typeof sortBy !== 'undefined' ? sortBy : get().sortBy;

    set({
      isLoading: true,
      query: input,
      error: null,
      sortBy: nextSortBy ?? null,
      mode: mode ?? get().mode,
      type: type ?? get().type,
    });

    try {
      const params: Record<string, any> = {
        input,
        excludeBonded: undefined,
      };

      if (nextSortBy) {
        params.sortBy = nextSortBy;
      }

      if (get().mode) params.mode = get().mode;
      if (get().type) params.type = get().type;

      const filters: Record<string, any> = {};
      
      if (get().poolTypes.length > 0) {
        filters.poolTypes = get().poolTypes.join(',');
      }
      
      if (get().blockchains.length > 0) {
        filters.blockchains = get().blockchains.join(',');
      }

      if (Object.keys(filters).length > 0) {
        params.filters = JSON.stringify(filters);
      }

      const response = await client.fetchSearchFast(params as Parameters<typeof client.fetchSearchFast>[0]);
      set({ results: response?.data || [], isLoading: false });
    } catch (err: any) {
      set({ error: err instanceof Error ? err.message : 'Search failed', isLoading: false });
    }
  },

  setSortBy: (sortBy) => {
    if (typeof window !== 'undefined') {
      if (sortBy) {
        window.localStorage.setItem(SORT_PREFERENCE_KEY, sortBy);
      } else {
        window.localStorage.removeItem(SORT_PREFERENCE_KEY);
      }
    }
    set({ sortBy });
  },
  setMode: (mode) => set({ mode }),
  setType: (type) => set({ type }),
  setPoolTypes: (poolTypes) => set({ poolTypes }),
  setBlockchains: (blockchains) => set({ blockchains }),

  clearSearch: () =>
    set({
      query: '',
      results: [],
      isLoading: false,
      error: null,
      mode: undefined,
      type: undefined,
      poolTypes: [],
      blockchains: [],
    }),
}));