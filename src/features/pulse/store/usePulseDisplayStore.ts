import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type CustomizeRowsConfig = {
  marketCap: boolean;
  volume: boolean;
  tx: boolean;
  fees: boolean;
  socials: boolean;
  holders: boolean;
  proTraders: boolean;
  devMigrations: boolean;
  top10Holdings: boolean;
  devHoldings: boolean;
  snipersHoldings: boolean;
  insidersHoldings: boolean;
  bundlersHoldings: boolean;
  dexPaid: boolean;
};

const REQUIRED_STAT_ROWS: Array<keyof CustomizeRowsConfig> = [
  'holders',
  'top10Holdings',
  'devHoldings',
  'snipersHoldings',
  'insidersHoldings',
  'bundlersHoldings',
];

const ensureStatDefaults = (rows: CustomizeRowsConfig): CustomizeRowsConfig => {
  const next = { ...rows };
  REQUIRED_STAT_ROWS.forEach((row) => {
    if (typeof next[row] !== 'boolean') {
      next[row] = true;
    }
  });
  return next;
};

export interface DisplayState {
  // Metrics
  metricSize: 'small' | 'large';

  // Quick Buy
  quickBuySize: 'small' | 'large' | 'mega';

  // Toggle options
  greyButtons: boolean;
  hideSearchBar: boolean;
  hideHiddenTokens: boolean;
  squareImages: boolean;
  compactTables: boolean;

  // Customize rows
  customizeRows: CustomizeRowsConfig;

  // Actions
  setMetricSize: (size: 'small' | 'large') => void;
  setQuickBuySize: (size: 'small' | 'large' | 'mega') => void;
  setGreyButtons: (value: boolean) => void;
  setHideSearchBar: (value: boolean) => void;
  setHideHiddenTokens: (value: boolean) => void;
  setSquareImages: (value: boolean) => void;
  setCompactTables: (value: boolean) => void;
  toggleCustomizeRow: (row: string) => void;
}

const defaultCustomizeRows: CustomizeRowsConfig = ensureStatDefaults({
  marketCap: true,
  volume: true,
  tx: true,
  socials: false,
  fees: true,
  holders: true,
  proTraders: true,
  devMigrations: true,
  top10Holdings: true,
  devHoldings: true,
  snipersHoldings: true,
  insidersHoldings: true,
  bundlersHoldings: true,
  dexPaid: false,
});

export const usePulseDisplayStore = create<DisplayState>()(
  persist(
    (set, get) => ({
      // Default values
      metricSize: 'large',
      quickBuySize: 'small',
      greyButtons: false,
      hideSearchBar: false,
      hideHiddenTokens: false,
      squareImages: false,
      compactTables: false,
      customizeRows: defaultCustomizeRows,

      // Actions
      setMetricSize: (size) => set({ metricSize: size }),
      setQuickBuySize: (size) => set({ quickBuySize: size }),
      setGreyButtons: (value) => set({ greyButtons: value }),
      setHideSearchBar: (value) => set({ hideSearchBar: value }),
      setHideHiddenTokens: (value) => set({ hideHiddenTokens: value }),
      setSquareImages: (value) => set({ squareImages: value }),
      setCompactTables: (value) => set({ compactTables: value }),
      toggleCustomizeRow: (row) =>
        set((state) => ({
          customizeRows: {
            ...state.customizeRows,
            [row]: !state.customizeRows[row as keyof typeof state.customizeRows],
          },
        })),
    }),
    {
      name: 'pulse-display-settings',
      version: 1,
      migrate: (persistedState, _version) => {
        const state = persistedState as DisplayState | undefined;
        if (!state) {
          return state;
        }
        return {
          ...state,
          customizeRows: ensureStatDefaults(state.customizeRows),
        };
      },
    },
  ),
);