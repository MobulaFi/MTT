'use client';

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface TrendingToken {
  address: string;
  chainId: string;
  name?: string;
  symbol?: string;
  logo?: string;
  priceUSD?: number;
  marketCapUSD?: number;
  liquidityUSD?: number;
  holdersCount?: number;
  createdAt?: string;
  created_at?: string;
  latestTradeDate?: string;
  source?: string;
  poolAddress?: string;
  bonded?: boolean;
  bondingPercentage?: number;
  socials?: {
    twitter?: string;
    website?: string;
    telegram?: string;
  };
  exchange?: {
    logo?: string;
    name?: string;
  };

  // Price changes
  priceChange5minPercentage?: number;
  priceChange1hPercentage?: number;
  priceChange4hPercentage?: number;
  priceChange24hPercentage?: number;

  // Volume
  volume24hUSD?: number;
  volume1hUSD?: number;

  // Trades
  trades24h?: number;
  trades1h?: number;
  traders24h?: number;
  traders1h?: number;
  buys24h?: number;
  sells24h?: number;

  // Average trade size
  avgTradeSize24hUSD?: number;

  [key: string]: unknown;
}

export type SortField =
  | 'priceUSD'
  | 'priceChange5minPercentage'
  | 'priceChange1hPercentage'
  | 'priceChange4hPercentage'
  | 'priceChange24hPercentage'
  | 'volume24hUSD'
  | 'marketCapUSD'
  | 'holdersCount'
  | 'liquidityUSD'
  | 'trades24h'
  | 'traders24h'
  | 'avgTradeSize24hUSD'
  | 'feesPaid24hUSD'
  | 'totalFeesPaidUSD'
  | 'createdAt'
  | 'latestTradeDate';

export type SortOrder = 'asc' | 'desc';

export interface FilterConfig {
  field: string;
  min?: number;
  max?: number;
}

export type PresetModel = 'trending' | 'surge' | 'new' | 'bonding' | 'bonded' | 'topGainers' | 'explorer';

interface TrendingStoreState {
  tokens: TrendingToken[];
  loading: boolean;
  error: string | null;
  lastUpdated: string;
  isPaused: boolean;

  // Sorting (frontend-side)
  sortField: SortField;
  sortOrder: SortOrder;

  // Backend model & filters
  model: PresetModel;
  backendSortBy: string;
  backendSortOrder: SortOrder;
  filters: FilterConfig[];

  // Filters
  selectedChainIds: string[];
  selectedProtocols: string[];

  // Config popup
  configOpen: boolean;

  // Actions
  setTokens: (tokens: TrendingToken[]) => void;
  mergeToken: (token: TrendingToken) => void;
  removeToken: (address: string, chainId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  togglePause: () => void;
  setLastUpdated: (time: string) => void;
  setSortField: (field: SortField) => void;
  setSortOrder: (order: SortOrder) => void;
  toggleSort: (field: SortField) => void;
  setModel: (model: PresetModel) => void;
  setBackendSortBy: (sortBy: string) => void;
  setBackendSortOrder: (order: SortOrder) => void;
  setFilters: (filters: FilterConfig[]) => void;
  setSelectedChainIds: (chainIds: string[]) => void;
  setSelectedProtocols: (protocols: string[]) => void;
  setConfigOpen: (open: boolean) => void;
}

// Fields that should never be overwritten with empty/falsy values
const PROTECTED_FIELDS = new Set(['name', 'symbol', 'logo', 'tokenName', 'tokenSymbol']);

export const useTrendingStore = create<TrendingStoreState>()(
  devtools(
    persist(
      (set) => ({
        tokens: [],
        loading: true,
        error: null,
        lastUpdated: '',
        isPaused: false,

        sortField: 'feesPaid24hUSD',
        sortOrder: 'desc',

        model: 'trending',
        backendSortBy: '',
        backendSortOrder: 'desc',
        filters: [],

        selectedChainIds: ['solana:solana'],
        selectedProtocols: [],

        configOpen: false,

        setTokens: (tokens) =>
          set({
            tokens,
            loading: false,
            lastUpdated: new Date().toLocaleTimeString('en-US', { hour12: false }),
          }),

        mergeToken: (token) =>
          set((state) => {
            const key = `${token.address}_${token.chainId}`;
            const idx = state.tokens.findIndex(
              (t) => `${t.address}_${t.chainId}` === key
            );
            const now = new Date().toLocaleTimeString('en-US', { hour12: false });

            if (idx !== -1) {
              const updated = [...state.tokens];
              const existing = updated[idx];
              const merged: Record<string, unknown> = { ...existing };
              const partial = token as Record<string, unknown>;
              for (const k in partial) {
                const v = partial[k];
                if (v == null) continue;
                if (PROTECTED_FIELDS.has(k) && v === '') continue;
                merged[k] = v;
              }
              updated[idx] = merged as TrendingToken;
              return { tokens: updated, lastUpdated: now };
            }
            return {
              tokens: [...state.tokens, token],
              lastUpdated: now,
            };
          }),

        removeToken: (address, chainId) =>
          set((state) => ({
            tokens: state.tokens.filter(
              (t) => !(t.address === address && t.chainId === chainId)
            ),
          })),

        setLoading: (loading) => set({ loading }),
        setError: (error) => set({ error, loading: false }),
        togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
        setLastUpdated: (time) => set({ lastUpdated: time }),
        setSortField: (sortField) => set({ sortField }),
        setSortOrder: (sortOrder) => set({ sortOrder }),
        toggleSort: (field) =>
          set((state) => {
            if (state.sortField === field) {
              return { sortOrder: state.sortOrder === 'desc' ? 'asc' : 'desc' };
            }
            return { sortField: field, sortOrder: 'desc' };
          }),
        setModel: (model) => set({ model }),
        setBackendSortBy: (backendSortBy) => set({ backendSortBy }),
        setBackendSortOrder: (backendSortOrder) => set({ backendSortOrder }),
        setFilters: (filters) => set({ filters }),
        setSelectedChainIds: (selectedChainIds) => set({ selectedChainIds }),
        setSelectedProtocols: (selectedProtocols) => set({ selectedProtocols }),
        setConfigOpen: (configOpen) => set({ configOpen }),
      }),
      {
        name: 'TrendingStore-v6',
        partialize: (state) => ({
          selectedChainIds: state.selectedChainIds,
          selectedProtocols: state.selectedProtocols,
          model: state.model,
          backendSortBy: state.backendSortBy,
          backendSortOrder: state.backendSortOrder,
          filters: state.filters,
          sortField: state.sortField,
          sortOrder: state.sortOrder,
        }),
      }
    ),
    { name: 'TrendingStore' }
  )
);
