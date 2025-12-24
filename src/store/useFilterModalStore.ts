// store/useFilterModalStore.ts
"use client";
import { create } from "zustand";

interface FilterValues {
  wallet?: string;
  type: "all" | "buy" | "sell";
  min?: number;
  max?: number;
}

interface FilterModalState {
  isOpen: boolean;
  currentFilters: FilterValues;
  openModal: () => void;
  closeModal: () => void;
  setFilters: (filters: Partial<FilterValues>) => void;
  resetFilters: () => void;
}

export const useFilterModalStore = create<FilterModalState>((set, get) => ({
  isOpen: false,
  currentFilters: { type: "all" },
  openModal: () => set({ isOpen: true }),
  closeModal: () => set({ isOpen: false }),
  setFilters: (filters) =>
    set((state) => {
      const newFilters = { ...state.currentFilters, ...filters };
      // Only update if filters actually changed (deep comparison)
      const current = state.currentFilters;
      if (
        current.wallet === newFilters.wallet &&
        current.type === newFilters.type &&
        current.min === newFilters.min &&
        current.max === newFilters.max
      ) {
        return state; // Return same state if no change
      }
      return { currentFilters: newFilters };
    }),
  resetFilters: () => {
    const current = get().currentFilters;
    // Only update if not already reset
    if (current.type !== "all" || current.wallet !== undefined || current.min !== undefined || current.max !== undefined) {
      set({ currentFilters: { type: "all" } });
    }
  },
}));