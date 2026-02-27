import { WalletActivityV2Response, WalletPositionsResponse, TokenTradesResponse } from "@mobula_labs/types";
import { create } from "zustand";

interface WalletHistoryPoint {
  date: string;
  value: number;
}

interface WalletPortfolioState {
  data: unknown;
  isLoading: boolean;
  error: string | null;
  activePositionData: WalletPositionsResponse | null;

  walletActivity: WalletActivityV2Response | null;
  isActivityLoading: boolean;
  activityError: string | null;

  // Wallet history for balance chart
  walletHistory: WalletHistoryPoint[] | null;
  isHistoryLoading: boolean;

  // Asset filter for activity tab (includes token metadata for display since trades endpoint doesn't return full token details)
  assetFilter: { 
    address: string; 
    chainId: string; 
    name: string;
    symbol?: string;
    logo?: string;
    totalSupply?: number;
  } | null;

  // Date filter for activity tab
  dateFilter: { from: Date; to: Date } | null;

  // Filtered token trades (when asset filter is active)
  filteredTrades: TokenTradesResponse | null;
  isFilteredTradesLoading: boolean;

  // setters
  setData: (data: unknown) => void;
  setLoading: (state: boolean) => void;
  setError: (message: string | null) => void;
  setActivePositionData: (data: WalletPositionsResponse) => void;

  setWalletActivity: (data: WalletActivityV2Response) => void;
  setActivityLoading: (state: boolean) => void;
  setActivityError: (message: string | null) => void;

  setWalletHistory: (data: WalletHistoryPoint[]) => void;
  setHistoryLoading: (state: boolean) => void;

  setAssetFilter: (filter: { address: string; chainId: string; name: string; symbol?: string; logo?: string; totalSupply?: number } | null) => void;
  setDateFilter: (filter: { from: Date; to: Date } | null) => void;
  setFilteredTrades: (data: TokenTradesResponse | null) => void;
  setFilteredTradesLoading: (loading: boolean) => void;

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

  walletHistory: null,
  isHistoryLoading: false,

  assetFilter: null,
  dateFilter: null,
  filteredTrades: null,
  isFilteredTradesLoading: false,

  setData: (data) => set({ data, isLoading: false, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  setActivePositionData: (data) => set({ activePositionData: data }),

  setWalletActivity: (walletActivity) =>
    set({ walletActivity, isActivityLoading: false, activityError: null }),
  setActivityLoading: (isActivityLoading) => set({ isActivityLoading }),
  setActivityError: (activityError) =>
    set({ activityError, isActivityLoading: false }),

  setWalletHistory: (walletHistory) => set({ walletHistory, isHistoryLoading: false }),
  setHistoryLoading: (isHistoryLoading) => set({ isHistoryLoading }),

  setAssetFilter: (assetFilter) => set({ assetFilter, filteredTrades: null }),
  setDateFilter: (dateFilter) => set({ dateFilter }),
  setFilteredTrades: (filteredTrades) => set({ filteredTrades, isFilteredTradesLoading: false }),
  setFilteredTradesLoading: (isFilteredTradesLoading) => set({ isFilteredTradesLoading }),

  reset: () =>
    set({
      data: null,
      isLoading: false,
      error: null,
      activePositionData: null,
      walletActivity: null,
      isActivityLoading: false,
      activityError: null,
      walletHistory: null,
      isHistoryLoading: false,
      assetFilter: null,
      dateFilter: null,
      filteredTrades: null,
      isFilteredTradesLoading: false,
    }),
}));
