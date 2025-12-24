// store/useTradesPanelStore.ts
"use client";
import { create } from "zustand";

interface TradesPanelState {
  showTrades: boolean;
  toggleTrades: () => void;
  setShowTrades: (show: boolean) => void;
}

export const useTradesPanelStore = create<TradesPanelState>((set) => ({
  showTrades: true,
  toggleTrades: () => set((state) => ({ showTrades: !state.showTrades })),
  setShowTrades: (show) => set({ showTrades: show }),
}));