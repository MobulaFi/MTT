// src/store/usePulseFilterStore.ts
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

export type Section = 'new-pairs' | 'final-stretch' | 'migrated';

export interface RangeValue {
  min: string;
  max: string;
}

export interface RangeValueWithUnit {
  min: string;
  max: string;
  unit: string;
}

export interface AuditsState {
  dexPaid: boolean;
  caEndsInPump: boolean;
  age: RangeValueWithUnit;
  top10HoldersPercent: RangeValue;
  devHoldingPercent: RangeValue;
  snipersPercent: RangeValue;
  insidersPercent: RangeValue;
  bundlePercent: RangeValue;
  holders: RangeValue;
  proTraders: RangeValue;
  devMigration: RangeValue;
  devPairsCreated: RangeValue;
}

export interface MetricsState {
  liquidity: RangeValue;
  volume: RangeValue;
  marketCap: RangeValue;
  bCurvePercent: RangeValue;
  globalFeesPaid: RangeValue;
  txns: RangeValue;
  numBuys: RangeValue;
  numSells: RangeValue;
}

export interface SocialsState {
  twitterReuses: RangeValue;
  tweetAge: RangeValueWithUnit;
  twitter: boolean;
  website: boolean;
  telegram: boolean;
  atLeastOneSocial: boolean;
  onlyPumpLive: boolean;
}

export interface SectionState {
  chainIds: string[];
  protocols: string[];
  includeKeywords: string;
  excludeKeywords: string;
  audits: AuditsState;
  metrics: MetricsState;
  socials: SocialsState;
}

const DEFAULT_CHAIN_IDS = ['solana:solana'];

const DEFAULT_AUDITS: AuditsState = {
  dexPaid: false,
  caEndsInPump: false,
  age: { min: '', max: '', unit: 'H' },
  top10HoldersPercent: { min: '', max: '' },
  devHoldingPercent: { min: '', max: '' },
  snipersPercent: { min: '', max: '' },
  insidersPercent: { min: '', max: '' },
  bundlePercent: { min: '', max: '' },
  holders: { min: '', max: '' },
  proTraders: { min: '', max: '' },
  devMigration: { min: '', max: '' },
  devPairsCreated: { min: '', max: '' },
};

const DEFAULT_METRICS: MetricsState = {
  liquidity: { min: '', max: '' },
  volume: { min: '', max: '' },
  marketCap: { min: '', max: '' },
  bCurvePercent: { min: '', max: '' },
  globalFeesPaid: { min: '', max: '' },
  txns: { min: '', max: '' },
  numBuys: { min: '', max: '' },
  numSells: { min: '', max: '' },
};

const DEFAULT_SOCIALS: SocialsState = {
  twitterReuses: { min: '', max: '' },
  tweetAge: { min: '', max: '', unit: 'D' },
  twitter: false,
  website: false,
  telegram: false,
  atLeastOneSocial: false,
  onlyPumpLive: false,
};

const defaultSection = (): SectionState => ({
  chainIds: DEFAULT_CHAIN_IDS,
  protocols: [],
  includeKeywords: '',
  excludeKeywords: '',
  audits: DEFAULT_AUDITS,
  metrics: DEFAULT_METRICS,
  socials: DEFAULT_SOCIALS,
});

interface PulseFilterStore {
  // Data
  sections: Record<Section, SectionState>;
  appliedSections: Record<Section, SectionState>;
  filtersVersion: number;
  appliedFiltersTrigger: number;

  // Actions
  setSection<K extends keyof SectionState>(
    section: Section,
    key: K,
    value: SectionState[K]
  ): void;

  resetSection(section: Section): void;
  applyFilters(): void;
  resetFilters(): void;
}

const cloneSections = (sections: Record<Section, SectionState>): Record<Section, SectionState> =>
  JSON.parse(JSON.stringify(sections));

const storage = typeof window !== 'undefined' ? window.localStorage : undefined;

export const usePulseFilterStore = create<PulseFilterStore>()(
  devtools(
    persist(
      (set, get) => ({
        sections: {
          'new-pairs': defaultSection(),
          'final-stretch': defaultSection(),
          migrated: defaultSection(),
        },
        appliedSections: cloneSections({
          'new-pairs': defaultSection(),
          'final-stretch': defaultSection(),
          migrated: defaultSection(),
        }),

        filtersVersion: 0,
        appliedFiltersTrigger: 0,

        setSection(section, key, value) {
          set((state) => ({
            sections: {
              ...state.sections,
              [section]: {
                ...state.sections[section],
                [key]: value,
              },
            },
          }));
        },

        resetSection(section) {
          set((state) => ({
            sections: {
              ...state.sections,
              [section]: defaultSection(),
            },
          }));
        },

        applyFilters() {
          set((state) => ({
            appliedSections: cloneSections(state.sections),
            filtersVersion: state.filtersVersion + 1,
            appliedFiltersTrigger: state.appliedFiltersTrigger + 1,
          }));
        },

        resetFilters() {
          const resetSections = {
            'new-pairs': defaultSection(),
            'final-stretch': defaultSection(),
            migrated: defaultSection(),
          };
          set((state) => ({
            sections: resetSections,
            appliedSections: cloneSections(resetSections),
            filtersVersion: state.filtersVersion + 1,
            appliedFiltersTrigger: state.appliedFiltersTrigger + 1,
          }));
        },
      }),
      {
        name: 'pulse-filter-store',
        storage: storage ? createJSONStorage(() => storage) : undefined,
        partialize: (state) => ({
          sections: state.sections,
          appliedSections: state.appliedSections,
        }),
        onRehydrateStorage: () => (state) => {
        },
      }
    ),
    { name: 'PulseFilterStore' }
  )
);