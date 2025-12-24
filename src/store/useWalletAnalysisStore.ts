// src/store/useWalletAnalysisStore.ts
import { WalletAnalysisResponse } from "@mobula_labs/types";
import { create } from "zustand";

export type Timeframe = "1d" | "7d" | "30d" | "90d";

interface WalletAnalysisState {
  timeframe: Timeframe;
  data: WalletAnalysisResponse | null;
  loading: boolean;
  setTimeframe: (timeframe: Timeframe) => void;
  setData: (data: WalletAnalysisResponse | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useWalletAnalysisStore = create<WalletAnalysisState>((set) => ({
  timeframe: "1d",
  data: null,
  loading: false,
  setTimeframe: (timeframe) => set({ timeframe }),
  setData: (data) => set({ data }),
  setLoading: (loading) => set({ loading }),
}));
