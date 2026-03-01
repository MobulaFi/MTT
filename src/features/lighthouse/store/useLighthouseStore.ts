import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Timeframe = '15min' | '1h' | '6h' | '24h';
export type ActiveTab = 'byChain' | 'byDex' | 'byLaunchpad' | 'byPlatform';
export type SortField = 'volumeUSD' | 'trades' | 'buys' | 'sells' | 'feesPaidUSD';
type SortDirection = 'asc' | 'desc';

interface LighthouseState {
  timeframe: Timeframe;
  activeTab: ActiveTab;
  sortField: SortField;
  sortDirection: SortDirection;
  setTimeframe: (tf: Timeframe) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setSortField: (field: SortField) => void;
  toggleSortDirection: () => void;
}

export const useLighthouseStore = create<LighthouseState>()(
  persist(
    (set) => ({
      timeframe: '1h',
      activeTab: 'byChain',
      sortField: 'volumeUSD',
      sortDirection: 'desc',
      setTimeframe: (timeframe) => set({ timeframe }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setSortField: (field) =>
        set((state) => ({
          sortField: field,
          sortDirection: state.sortField === field && state.sortDirection === 'desc' ? 'asc' : 'desc',
        })),
      toggleSortDirection: () =>
        set((state) => ({ sortDirection: state.sortDirection === 'desc' ? 'asc' : 'desc' })),
    }),
    { name: 'lighthouse-prefs' },
  ),
);
