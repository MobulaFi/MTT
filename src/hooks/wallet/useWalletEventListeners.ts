import { useEffect } from 'react';
import { type Address, type Chain } from 'viem';
import { getChainFromBlockchain } from '@/utils/chainMapping';
import { getMetaMaskProvider } from '@/lib/wallet/utils/getProvider';
import { useWalletConnectionStore } from '@/store/useWalletConnectionStore';
import type { EIP1193Provider } from '@/types/wallet';

interface UseWalletEventListenersParams {
  isEvmConnected: boolean;
  isSolanaConnected: boolean;
  evmChain: Chain | null;
  setEvmWallet: (address: Address | null, chain: Chain | null) => void;
  setSolanaWallet: (address: string | null) => void;
}

export function useWalletEventListeners({
  isEvmConnected,
  isSolanaConnected,
  evmChain,
  setEvmWallet,
  setSolanaWallet,
}: UseWalletEventListenersParams) {
  const isManuallyDisconnected = useWalletConnectionStore((state) => state.isManuallyDisconnected);

  useEffect(() => {
    if (typeof window === 'undefined' || !isEvmConnected || isManuallyDisconnected) return;

    const provider = getMetaMaskProvider();
    if (!provider || !provider.on) return;

    const handleAccountsChanged = async (...args: unknown[]) => {
      // Check if manually disconnected - if so, ignore this event
      const isDisconnected = useWalletConnectionStore.getState().isManuallyDisconnected;
      if (isDisconnected) return;

      // MetaMask passes accounts array as first argument
      let accounts: string[] = [];
      if (args.length > 0 && Array.isArray(args[0])) {
        accounts = args[0] as string[];
      } else if (args.length > 0 && typeof args[0] === 'string') {
        accounts = [args[0] as string];
      }
      
      if (accounts.length === 0) {
        // User disconnected in MetaMask - only update if not manually disconnected
        const stillDisconnected = useWalletConnectionStore.getState().isManuallyDisconnected;
        if (!stillDisconnected) {
          setEvmWallet(null, null);
        }
      } else {
        // Check again before updating
        const stillDisconnected = useWalletConnectionStore.getState().isManuallyDisconnected;
        if (!stillDisconnected) {
          try {
            const currentChainIdHex = await provider.request({
              method: 'eth_chainId',
              params: [],
            }) as string;
            const currentChainId = parseInt(currentChainIdHex.startsWith('0x') ? currentChainIdHex : `0x${currentChainIdHex}`, 16);
            const blockchainId = `evm:${currentChainId}`;
            const currentChain = getChainFromBlockchain(blockchainId);
            setEvmWallet(accounts[0] as Address, currentChain || evmChain);
          } catch {
            const stillDisconnectedCheck = useWalletConnectionStore.getState().isManuallyDisconnected;
            if (!stillDisconnectedCheck) {
              setEvmWallet(accounts[0] as Address, evmChain);
            }
          }
        }
      }
    };

    const handleChainChanged = async (...args: unknown[]) => {
      const chainIdHex = args[0] as string | undefined;
      // Check if manually disconnected - if so, ignore this event
      const isDisconnected = useWalletConnectionStore.getState().isManuallyDisconnected;
      if (isDisconnected) return;

      try {
        // chainChanged event passes chainId as a hex string
        let currentChainIdHex = chainIdHex;
        if (!currentChainIdHex) {
          currentChainIdHex = await provider.request({
            method: 'eth_chainId',
            params: [],
          }) as string;
        }
        const currentChainId = parseInt(currentChainIdHex.startsWith('0x') ? currentChainIdHex : `0x${currentChainIdHex}`, 16);
        const blockchainId = `evm:${currentChainId}`;
        const currentChain = getChainFromBlockchain(blockchainId);
        
        // Check again before updating
        const stillDisconnected = useWalletConnectionStore.getState().isManuallyDisconnected;
        if (!stillDisconnected) {
          const accounts = await provider.request({
            method: 'eth_accounts',
            params: [],
          }) as string[];
          
          if (accounts.length > 0) {
            setEvmWallet(accounts[0] as Address, currentChain || null);
          }
        }
      } catch {
        // Check again before reloading
        const stillDisconnectedCheck = useWalletConnectionStore.getState().isManuallyDisconnected;
        if (!stillDisconnectedCheck) {
          // Reload page on chain change as recommended by MetaMask
          window.location.reload();
        }
      }
    };

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);

    return () => {
      if (provider.removeListener) {
        provider.removeListener('accountsChanged', handleAccountsChanged);
        provider.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [isEvmConnected, evmChain, setEvmWallet, isManuallyDisconnected]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.phantom?.solana || !isSolanaConnected) return;

    const handleAccountChange = (...args: unknown[]) => {
      const publicKey = args[0] as { toString: () => string } | null;
      if (publicKey) {
        setSolanaWallet(publicKey.toString());
      } else {
        setSolanaWallet(null);
      }
    };

    window.phantom.solana.on('accountChanged', handleAccountChange);

    return () => {
      window.phantom?.solana?.off('accountChanged', handleAccountChange);
    };
  }, [isSolanaConnected, setSolanaWallet]);
}

