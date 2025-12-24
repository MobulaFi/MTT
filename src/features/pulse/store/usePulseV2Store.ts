import { create } from 'zustand';
import type { PulseViewData } from '@mobula_labs/types';
import type { PulseToken } from './usePulseDataStore';

type WssPulseV2ResponseType =
  | {
      type: 'init';
      payload: {
        new?: PulseViewData;
        bonding?: PulseViewData;
        bonded?: PulseViewData;
      };
    }
  | {
      type: 'update-token';
      payload: {
        viewName: string;
        token: PulseToken;
      };
    };

export interface PulseV2StoreState {
  // Data
  data: WssPulseV2ResponseType | null;
  historicalData: WssPulseV2ResponseType[];
  
  // Loading/Error states
  loading: boolean;
  error: string | null;
  
  // Actions
  setData: (data: WssPulseV2ResponseType) => void;
  addHistoricalData: (data: WssPulseV2ResponseType) => void;
  clearHistoricalData: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const usePulseV2Store = create<PulseV2StoreState>((set) => ({
  data: null,
  historicalData: [],
  loading: false,
  error: null,

  setData: (data) =>
    set((state) => ({
      data,
      loading: false,
      error: null,
    })),

  addHistoricalData: (data) =>
    set((state) => ({
      historicalData: [...state.historicalData, data],
    })),

  clearHistoricalData: () =>
    set({
      historicalData: [],
    }),

  setLoading: (loading) =>
    set({
      loading,
    }),

  setError: (error) =>
    set({
      error,
      loading: false,
    }),

  reset: () =>
    set({
      data: null,
      historicalData: [],
      loading: false,
      error: null,
    }),
}));