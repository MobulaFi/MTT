import { create } from "zustand";

interface WalletModalState {
  isOpen: boolean;
  walletAddress: string | null;
  txHash: string | null;
  blockchain: string | null;
  // Flag to prevent re-sync from URL after intentional close
  justClosed: boolean;
  openWalletModal: (params: {
    walletAddress: string;
    txHash?: string;
    blockchain?: string;
  }) => void;
  closeWalletModal: () => void;
  syncFromUrl: (params: {
    walletAddress: string | null;
    blockchain: string | null;
  }) => void;
  clearJustClosed: () => void;
}

// Helper to check if wallet type matches the blockchain
// Returns the blockchain only if compatible, null otherwise
const resolveBlockchain = (walletAddress: string, blockchain: string | null | undefined): string | null => {
  if (!blockchain) return null;
  const isEvmWallet = /^0x[a-fA-F0-9]{40}$/i.test(walletAddress);
  const isSolanaChain = blockchain.toLowerCase().startsWith('solana');
  // EVM wallet + Solana chain = mismatch → clear blockchain
  if (isEvmWallet && isSolanaChain) return null;
  // Solana wallet + EVM chain = mismatch → clear blockchain
  if (!isEvmWallet && blockchain.toLowerCase().startsWith('evm')) return null;
  return blockchain;
};

// Helper to update URL without navigation
const updateUrlParam = (walletAddress: string | null) => {
  if (typeof window === 'undefined') return;
  
  const url = new URL(window.location.href);
  if (walletAddress) {
    url.searchParams.set('popup', walletAddress);
  } else {
    url.searchParams.delete('popup');
  }
  window.history.replaceState({}, '', url.toString());
};

export const useWalletModalStore = create<WalletModalState>((set) => ({
  isOpen: false,
  walletAddress: null,
  txHash: null,
  blockchain: null,
  justClosed: false,

  openWalletModal: ({ walletAddress, txHash, blockchain }) => {
    updateUrlParam(walletAddress);
    set({ isOpen: true, walletAddress, txHash: txHash ?? null, blockchain: resolveBlockchain(walletAddress, blockchain), justClosed: false });
  },

  closeWalletModal: () => {
    updateUrlParam(null);
    set({ isOpen: false, walletAddress: null, txHash: null, blockchain: null, justClosed: true });
  },

  syncFromUrl: ({ walletAddress, blockchain }) => {
    if (walletAddress) {
      set({ isOpen: true, walletAddress, txHash: null, blockchain: resolveBlockchain(walletAddress, blockchain), justClosed: false });
    }
  },

  clearJustClosed: () => set({ justClosed: false }),
}));
