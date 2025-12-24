import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FilterState {
  // Protocol filters
  protocols: {
    pumpfun: boolean;
    boop: boolean;
    moonshot: boolean;
    gte: boolean;
    pumpswap: boolean;
  };

  // Keyword filters
  searchKeywords: string;
  excludeKeywords: string;

  // Range filters
  bcurveMin: string;
  bcurveMax: string;
  ageMin: string;
  ageMax: string;
  top10HoldersMin: string;
  top10HoldersMax: string;
  devHoldingMin: string;
  devHoldingMax: string;
  snipersMin: string;
  snipersMax: string;

  // Audit filters
  dexPaid: boolean;
  caEndsPump: boolean;

  // Active section
  activeSection: string;

  // Actions
  setProtocol: (protocol: string, value: boolean) => void;
  setSearchKeywords: (keywords: string) => void;
  setExcludeKeywords: (keywords: string) => void;
  setBcurveRange: (min: string, max: string) => void;
  setAgeRange: (min: string, max: string) => void;
  setTop10HoldersRange: (min: string, max: string) => void;
  setDevHoldingRange: (min: string, max: string) => void;
  setSnipersRange: (min: string, max: string) => void;
  setDexPaid: (value: boolean) => void;
  setCaEndsPump: (value: boolean) => void;
  setActiveSection: (section: string) => void;
  resetFilters: (section?: string) => void;
  applyFilters: () => void;
}

const defaultFilters = {
  protocols: {
    pumpfun: true,
    boop: false,
    moonshot: false,
    gte: false,
    pumpswap: true,
  },
  searchKeywords: '',
  excludeKeywords: '',
  bcurveMin: '',
  bcurveMax: '',
  ageMin: '',
  ageMax: '',
  top10HoldersMin: '',
  top10HoldersMax: '',
  devHoldingMin: '',
  devHoldingMax: '',
  snipersMin: '',
  snipersMax: '',
  dexPaid: false,
  caEndsPump: false,
  activeSection: 'New Pairs',
};

export const usePulseTokenFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      ...defaultFilters,

      setProtocol: (protocol: string, value: boolean) =>
        set((state) => ({
          protocols: { ...state.protocols, [protocol]: value },
        })),

      setSearchKeywords: (keywords: string) => set({ searchKeywords: keywords }),
      setExcludeKeywords: (keywords: string) => set({ excludeKeywords: keywords }),

      setBcurveRange: (min: string, max: string) => set({ bcurveMin: min, bcurveMax: max }),

      setAgeRange: (min: string, max: string) => set({ ageMin: min, ageMax: max }),

      setTop10HoldersRange: (min: string, max: string) => set({ top10HoldersMin: min, top10HoldersMax: max }),

      setDevHoldingRange: (min: string, max: string) => set({ devHoldingMin: min, devHoldingMax: max }),

      setSnipersRange: (min: string, max: string) => set({ snipersMin: min, snipersMax: max }),

      setDexPaid: (value: boolean) => set({ dexPaid: value }),
      setCaEndsPump: (value: boolean) => set({ caEndsPump: value }),
      setActiveSection: (section: string) => set({ activeSection: section }),

      resetFilters: (section?: string) => {
        if (section) {
          set({ ...defaultFilters, activeSection: section });
        } else {
          set(defaultFilters);
        }
      },

      applyFilters: () => {
        // This will trigger re-filtering in components that use the store
        set((state) => ({ ...state }));
      },
    }),
    {
      name: 'pulse-filters',
    },
  ),
);

export function getFilterCount(filters: FilterState): number {
  let count = 0;

  // Count selected protocols
  count += Object.values(filters.protocols).filter(Boolean).length;

  // Count other filters
  if (filters.searchKeywords) count++;
  if (filters.excludeKeywords) count++;
  if (filters.bcurveMin || filters.bcurveMax) count++;
  if (filters.ageMin || filters.ageMax) count++;
  if (filters.top10HoldersMin || filters.top10HoldersMax) count++;
  if (filters.devHoldingMin || filters.devHoldingMax) count++;
  if (filters.snipersMin || filters.snipersMax) count++;
  if (filters.dexPaid) count++;
  if (filters.caEndsPump) count++;

  return count;
}