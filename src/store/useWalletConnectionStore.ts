import { create } from 'zustand';
import { type Address, type Chain } from 'viem';
import type { WalletType, WalletProvider } from '@/types/wallet';

export type { WalletType, WalletProvider };

interface WalletConnectionState {
  // EVM wallet state
  evmAddress: Address | null;
  evmChain: Chain | null;
  isEvmConnected: boolean;
  
  // Solana wallet state
  solanaAddress: string | null;
  isSolanaConnected: boolean;
  
  // Current active wallet
  activeWalletType: WalletType;
  activeProvider: WalletProvider;
  
  // Manual disconnect flag to prevent auto-reconnect
  isManuallyDisconnected: boolean;
  
  // Actions
  setEvmWallet: (address: Address | null, chain: Chain | null) => void;
  setSolanaWallet: (address: string | null) => void;
  disconnectWallet: () => void;
  setActiveWallet: (type: WalletType, provider: WalletProvider) => void;
  setManuallyDisconnected: (value: boolean) => void;
}

export const useWalletConnectionStore = create<WalletConnectionState>((set) => ({
  evmAddress: null,
  evmChain: null,
  isEvmConnected: false,
  solanaAddress: null,
  isSolanaConnected: false,
  activeWalletType: null,
  activeProvider: null,
  isManuallyDisconnected: false,
  
  setEvmWallet: (address, chain) =>
    set({
      evmAddress: address,
      evmChain: chain,
      isEvmConnected: !!address,
      activeWalletType: address ? 'evm' : null,
      activeProvider: address ? 'metamask' : null,
      // Clear manual disconnect flag when connecting
      isManuallyDisconnected: false,
    }),
  
  setSolanaWallet: (address) =>
    set({
      solanaAddress: address,
      isSolanaConnected: !!address,
      activeWalletType: address ? 'solana' : null,
      activeProvider: address ? 'phantom' : null,
      // Clear manual disconnect flag when connecting
      isManuallyDisconnected: false,
    }),
  
  disconnectWallet: () =>
    set({
      evmAddress: null,
      evmChain: null,
      isEvmConnected: false,
      solanaAddress: null,
      isSolanaConnected: false,
      activeWalletType: null,
      activeProvider: null,
      isManuallyDisconnected: true,
    }),
  
  setActiveWallet: (type, provider) =>
    set({
      activeWalletType: type,
      activeProvider: provider,
    }),
  
  setManuallyDisconnected: (value) =>
    set({
      isManuallyDisconnected: value,
    }),
}));


