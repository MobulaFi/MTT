import { create } from 'zustand';

const TIMEFRAME_KEY = 'mobula-chart-timeframe';

function getPersistedTimeframe(): string {
  try {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(TIMEFRAME_KEY) : null;
    if (stored) return stored;
  } catch { /* SSR / localStorage disabled */ }
  return '1S';
}

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
  timeframe: getPersistedTimeframe(),

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
      // Persist to localStorage for cross-session preference
      try { localStorage.setItem(TIMEFRAME_KEY, timeframe); } catch { /* noop */ }
    }
  },

  reset: () => {
    // Keep the persisted timeframe — don't reset the user's preference
    set({ isChartLoading: true, isChartReady: false });
  },
}));
