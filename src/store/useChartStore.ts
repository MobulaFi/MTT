import { create } from 'zustand';

interface ChartStore {
  isChartLoading: boolean;
  isChartReady: boolean;
  timeframe: string;
  triggerChartLoading: () => void;
  chartLoaded: () => void;
  setIsChartReady: () => void;
  setTimeframe: (timeframe: string) => void;
  reset: () => void;
}

export const useChartStore = create<ChartStore>((set, get) => ({
  isChartLoading: true,
  isChartReady: false,
  timeframe: '1S',

  triggerChartLoading: () => {
    // Only trigger loading if chart is not already ready
    if (!get().isChartReady) {
      set({ isChartLoading: true });
    }
  },

  chartLoaded: () => {
    // Only update if state actually changed
    const current = get();
    if (current.isChartLoading || !current.isChartReady) {
      set({ isChartLoading: false, isChartReady: true });
    }
  },

  setIsChartReady: () => {
    // Only update if state actually changed
    const current = get();
    if (!current.isChartReady || current.isChartLoading) {
      set({ isChartReady: true, isChartLoading: false });
    }
  },

  setTimeframe: (timeframe: string) => {
    // Only update if timeframe actually changed
    if (get().timeframe !== timeframe) {
      set({ timeframe });
    }
  },

  reset: () => {
    set({ isChartLoading: true, isChartReady: false, timeframe: '1S' });
  },
}));