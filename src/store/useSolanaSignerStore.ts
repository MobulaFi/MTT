import { create } from 'zustand';

interface SolanaWalletRef {
  address: string;
  signTransaction: (input: {
    transaction: Uint8Array;
    chain?: string;
  }) => Promise<{ signedTransaction: Uint8Array }>;
}

interface SolanaSignerState {
  wallet: SolanaWalletRef | null;
  setWallet: (wallet: SolanaWalletRef | null) => void;
}

export const useSolanaSignerStore = create<SolanaSignerState>((set) => ({
  wallet: null,
  setWallet: (wallet) => set({ wallet }),
}));
