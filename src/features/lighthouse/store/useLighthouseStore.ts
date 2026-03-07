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

  // Floating panel
  isFloating: boolean;
  windowPosition: { x: number; y: number };
  isDragging: boolean;

  setTimeframe: (tf: Timeframe) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setSortField: (field: SortField) => void;
  toggleSortDirection: () => void;

  setFloating: (floating: boolean) => void;
  setWindowPosition: (position: { x: number; y: number }) => void;
  setIsDragging: (isDragging: boolean) => void;
}

export const useLighthouseStore = create<LighthouseState>()(
  persist(
    (set) => ({
      timeframe: '1h',
      activeTab: 'byChain',
      sortField: 'volumeUSD',
      sortDirection: 'desc',

      isFloating: false,
      windowPosition: { x: 50, y: 100 },
      isDragging: false,

      setTimeframe: (timeframe) => set({ timeframe }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setSortField: (field) =>
        set((state) => ({
          sortField: field,
          sortDirection: state.sortField === field && state.sortDirection === 'desc' ? 'asc' : 'desc',
        })),
      toggleSortDirection: () =>
        set((state) => ({ sortDirection: state.sortDirection === 'desc' ? 'asc' : 'desc' })),

      setFloating: (floating) => set({ isFloating: floating }),
      setWindowPosition: (position) => set({ windowPosition: position }),
      setIsDragging: (isDragging) => set({ isDragging }),
    }),
    {
      name: 'lighthouse-prefs',
      partialize: (state) => ({
        timeframe: state.timeframe,
        activeTab: state.activeTab,
        sortField: state.sortField,
        sortDirection: state.sortDirection,
        windowPosition: state.windowPosition,
      }),
    },
  ),
);
