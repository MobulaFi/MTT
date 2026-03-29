import { create } from 'zustand';
import { type Address } from 'viem';
import { DEFAULT_EVM_CHAIN_ID } from '@/config/evmChains';

export type WalletType = 'evm' | 'solana' | null;

interface WalletConnectionState {
  evmAddress: Address | null;
  isEvmConnected: boolean;

  solanaAddress: string | null;
  isSolanaConnected: boolean;

  activeWalletType: WalletType;
  activeEvmChainId: number;

  setEvmWallet: (address: Address | null) => void;
  setSolanaWallet: (address: string | null) => void;
  disconnectWallet: () => void;
  setActiveWallet: (type: WalletType) => void;
  setActiveEvmChainId: (chainId: number) => void;
}

export const useWalletConnectionStore = create<WalletConnectionState>((set) => ({
  evmAddress: null,
  isEvmConnected: false,
  solanaAddress: null,
  isSolanaConnected: false,
  activeWalletType: null,
  activeEvmChainId: DEFAULT_EVM_CHAIN_ID,

  setEvmWallet: (address) =>
    set({
      evmAddress: address,
      isEvmConnected: !!address,
    }),

  setSolanaWallet: (address) =>
    set({
      solanaAddress: address,
      isSolanaConnected: !!address,
    }),

  disconnectWallet: () =>
    set({
      evmAddress: null,
      isEvmConnected: false,
      solanaAddress: null,
      isSolanaConnected: false,
      activeWalletType: null,
    }),

  setActiveWallet: (type) =>
    set({
      activeWalletType: type,
    }),

  setActiveEvmChainId: (chainId) =>
    set({
      activeEvmChainId: chainId,
    }),
}));
