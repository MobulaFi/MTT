import { create } from "zustand";

interface WalletModalState {
  isOpen: boolean;
  walletAddress: string | null;
  txHash: string | null;
  blockchain: string | null;
  openWalletModal: (params: {
    walletAddress: string;
    txHash: string;
    blockchain: string;
  }) => void;
  closeWalletModal: () => void;
}

export const useWalletModalStore = create<WalletModalState>((set) => ({
  isOpen: false,
  walletAddress: null,
  txHash: null,
  blockchain: null,

  openWalletModal: ({ walletAddress, txHash, blockchain }) =>
    set({ isOpen: true, walletAddress, txHash, blockchain }),

  closeWalletModal: () =>
    set({ isOpen: false, walletAddress: null, txHash: null, blockchain: null }),
}));
