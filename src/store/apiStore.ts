// src/store/apiStore.ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SubscriptionPayload } from '@mobula_labs/sdk';
import {
  DEFAULT_REST_ENDPOINT,
  DEFAULT_WSS_REGION,
  REST_ENDPOINTS,
} from '@/config/endpoints';
import type { RestEndpointKey, WssRegionKey } from '@/config/endpoints';

export interface CustomUrl {
  key: string;
  url: string;
  label: string;
}

export interface CustomWssUrl {
  type: keyof SubscriptionPayload;
  url: string;
  label: string;
  mode: 'all' | 'individual';
}

interface ApiStore {
  // REST
  currentUrl: string;
  customUrls: CustomUrl[];
  customLabels: Record<string, string>;
  selectedRestUrl: string | null;

  // WSS
  customWssUrls: CustomWssUrl[];
  selectedAllModeWssUrl: string | null;
  selectedIndividualWssType: (keyof SubscriptionPayload) | null;
  selectedWssRegion: WssRegionKey | null;

  // REST Actions
  setCurrentUrl: (url: string) => void;
  addCustomUrl: (url: string, label: string) => void;
  removeCustomUrl: (key: string) => void;
  setCustomLabel: (key: string, label: string) => void;
  getLabel: (key: string, defaultLabel: string) => string;
  getLabelForUrl: (url: string) => string;
  setSelectedRestUrl: (url: string | null) => void;

  // WSS Actions
  addCustomWssUrl: (type: keyof SubscriptionPayload, url: string, label: string, mode?: 'all' | 'individual') => void;
  removeCustomWssUrl: (type: keyof SubscriptionPayload) => void;
  getCustomWssUrls: () => Partial<Record<keyof SubscriptionPayload, string>>;
  removeAllModeWssUrl: (url: string) => void;
  setSelectedAllModeWssUrl: (url: string | null) => void;
  setSelectedIndividualWssType: (type: (keyof SubscriptionPayload) | null) => void;
  setSelectedWssRegion: (region: WssRegionKey | null) => void;
}


const DEFAULT_REST_URL = REST_ENDPOINTS[DEFAULT_REST_ENDPOINT];
const REST_URL_TO_KEY = Object.entries(REST_ENDPOINTS).reduce<Record<string, RestEndpointKey>>(
  (acc, [key, value]) => {
    acc[value] = key as RestEndpointKey;
    return acc;
  },
  {}
);

const storage = typeof window !== 'undefined' ? window.localStorage : undefined;

export const useApiStore = create<ApiStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentUrl: DEFAULT_REST_URL,
      customUrls: [],
      customLabels: {},
      customWssUrls: [],
      selectedAllModeWssUrl: null,
      selectedIndividualWssType: null,
      selectedWssRegion: DEFAULT_WSS_REGION,
      selectedRestUrl: null,

      setCurrentUrl: (url) => set({ currentUrl: url }),

      setSelectedRestUrl: (url) => set({ selectedRestUrl: url }),

      addCustomUrl: (url, label) => {
        const key = 'CUSTOM_' + Date.now();
        set((state) => ({
          customUrls: [...state.customUrls, { key, url, label }],
        }));
      },

      removeCustomUrl: (key) => {
        set((state) => {
          const urlToRemove = state.customUrls.find((u) => u.key === key);
          return {
            customUrls: state.customUrls.filter((u) => u.key !== key),
            currentUrl:
              urlToRemove?.url === state.currentUrl ? DEFAULT_REST_URL : state.currentUrl,
          };
        });
      },

      setCustomLabel: (key, label) => {
        set((state) => ({
          customLabels: { ...state.customLabels, [key]: label },
        }));
      },

      getLabel: (key, defaultLabel) => {
        const state = get();
        return state.customLabels[key] || defaultLabel;
      },

      getLabelForUrl: (url) => {
        const state = get();
        const customUrl = state.customUrls.find((u) => u.url === url);
        if (customUrl) return customUrl.label;

        const key = REST_URL_TO_KEY[url];
        return key ? state.customLabels[key] || key : 'Unknown';
      },


      addCustomWssUrl: (type, url, label, mode = 'individual') => {
        set((state) => {
          const existing = state.customWssUrls.find((c) => c.type === type);
          if (existing) {
            // Replace existing
            return {
              customWssUrls: state.customWssUrls.map((c) =>
                c.type === type ? { type, url, label, mode } : c
              ),
            };
          }
          return { customWssUrls: [...state.customWssUrls, { type, url, label, mode }] };
        });
      },

      removeCustomWssUrl: (type) => {
        set((state) => ({
          customWssUrls: state.customWssUrls.filter((c) => c.type !== type),
        }));
      },

      removeAllModeWssUrl: (url: string) => {
        set((state) => {
          const typesToRemove = state.customWssUrls
            .filter((c) => c.url === url && c.mode === 'all')
            .map((c) => c.type);

          return {
            customWssUrls: state.customWssUrls.filter(
              (c) => !(c.url === url && c.mode === 'all')
            ),
            selectedAllModeWssUrl:
              state.selectedAllModeWssUrl === url ? null : state.selectedAllModeWssUrl,
          };
        });
      },

      setSelectedAllModeWssUrl: (url) => {
        set({ 
          selectedAllModeWssUrl: url,
          selectedIndividualWssType: null,
          selectedWssRegion: null,
        });
      },

      setSelectedIndividualWssType: (type) => {
        set({ 
          selectedIndividualWssType: type,
          selectedAllModeWssUrl: null,
          selectedWssRegion: null,
        });
      },

      setSelectedWssRegion: (region) => {
        set({ 
          selectedWssRegion: region,
          selectedAllModeWssUrl: null,
          selectedIndividualWssType: null,
        });
      },

      getCustomWssUrls: () => {
        const state = get();
        const map: Partial<Record<keyof SubscriptionPayload, string>> = {};
        for (const custom of state.customWssUrls) {
          map[custom.type] = custom.url;
        }
        return map;
      },
    }),
    {
      name: 'mobula-api-storage',
      storage: storage ? createJSONStorage(() => storage) : undefined,
      partialize: (state) => ({
        currentUrl: state.currentUrl,
        customUrls: state.customUrls,
        customLabels: state.customLabels,
        customWssUrls: state.customWssUrls,
        selectedAllModeWssUrl: state.selectedAllModeWssUrl,
        selectedIndividualWssType: state.selectedIndividualWssType,
        selectedWssRegion: state.selectedWssRegion,
        selectedRestUrl: state.selectedRestUrl,
      }),
    }
  )
);