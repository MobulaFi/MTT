'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { PMMarket, PMCategory } from '../types';

export type PMViewName = 'trending' | 'new' | 'closing';

export interface PMSectionState {
  markets: PMMarket[];
  loading: boolean;
  error: string | null;
  lastUpdate: number;
  searchQuery: string;
}

export interface PMStoreState {
  // State
  sections: Record<PMViewName, PMSectionState>;
  categories: PMCategory[];
  selectedCategory: string | null;
  
  // Actions
  setMarkets(view: PMViewName, markets: PMMarket[]): void;
  setLoading(view: PMViewName, loading: boolean): void;
  setError(view: PMViewName, error: string | null): void;
  clearView(view: PMViewName): void;
  setSearchQuery(view: PMViewName, query: string): void;
  setCategories(categories: PMCategory[]): void;
  setSelectedCategory(category: string | null): void;
  getFilteredMarkets(view: PMViewName): PMMarket[];
}

const createInitialSectionState = (): PMSectionState => ({
  markets: [],
  loading: true,
  error: null,
  lastUpdate: 0,
  searchQuery: '',
});

export const usePMStore = create<PMStoreState>()(
  devtools(
    immer((set, get) => ({
      sections: {
        trending: createInitialSectionState(),
        new: createInitialSectionState(),
        closing: createInitialSectionState(),
      },
      categories: [],
      selectedCategory: null,

      setMarkets: (view, markets) =>
        set((state) => {
          state.sections[view].markets = markets;
          state.sections[view].lastUpdate = Date.now();
          state.sections[view].loading = false;
        }),

      setLoading: (view, loading) =>
        set((state) => {
          state.sections[view].loading = loading;
        }),

      setError: (view, error) =>
        set((state) => {
          state.sections[view].error = error;
          state.sections[view].loading = false;
        }),

      clearView: (view) =>
        set((state) => {
          state.sections[view] = createInitialSectionState();
        }),

      setSearchQuery: (view, query) =>
        set((state) => {
          state.sections[view].searchQuery = query;
        }),

      setCategories: (categories) =>
        set((state) => {
          state.categories = categories;
        }),

      setSelectedCategory: (category) =>
        set((state) => {
          state.selectedCategory = category;
        }),

      getFilteredMarkets: (view) => {
        const state = get();
        const section = state.sections[view];
        const query = section.searchQuery.toLowerCase().trim();
        
        if (!query) return section.markets;
        
        return section.markets.filter((market) =>
          market.question.toLowerCase().includes(query) ||
          market.category.toLowerCase().includes(query) ||
          market.platform.toLowerCase().includes(query)
        );
      },
    })),
    { name: 'pm-store' }
  )
);
