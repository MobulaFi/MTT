// src/store/useWalletFilterStore.ts
import { create } from 'zustand';

interface WalletFilterState {
  filteredWallet: string | null;
  setFilteredWallet: (wallet: string | null) => void;
}

export const useWalletFilterStore = create<WalletFilterState>((set) => ({
  filteredWallet: null,
  setFilteredWallet: (wallet) => set({ filteredWallet: wallet }),
}));
