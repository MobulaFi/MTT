import { WalletActivityV2Response, WalletPositionsResponse } from "@mobula_labs/types";
import { create } from "zustand";


interface WalletPortfolioState {
  data: any;
  isLoading: boolean;
  error: string | null;
  activePositionData: WalletPositionsResponse | null;

  walletActivity: WalletActivityV2Response | null;
  isActivityLoading: boolean;
  activityError: string | null;

  // setters
  setData: (data: any) => void;
  setLoading: (state: boolean) => void;
  setError: (message: string | null) => void;
  setActivePositionData: (data: WalletPositionsResponse) => void;

  setWalletActivity: (data: WalletActivityV2Response) => void;
  setActivityLoading: (state: boolean) => void;
  setActivityError: (message: string | null) => void;

  reset: () => void;
}

export const useWalletPortfolioStore = create<WalletPortfolioState>((set) => ({
  data: null,
  isLoading: false,
  error: null,
  activePositionData: null,

  walletActivity: null,
  isActivityLoading: false,
  activityError: null,

  setData: (data) => set({ data, isLoading: false, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  setActivePositionData: (data) => set({ activePositionData: data }),

  setWalletActivity: (walletActivity) =>
    set({ walletActivity, isActivityLoading: false, activityError: null }),
  setActivityLoading: (isActivityLoading) => set({ isActivityLoading }),
  setActivityError: (activityError) =>
    set({ activityError, isActivityLoading: false }),

  reset: () =>
    set({
      data: null,
      isLoading: false,
      error: null,
      activePositionData: null,
      walletActivity: null,
      isActivityLoading: false,
      activityError: null,
    }),
}));
