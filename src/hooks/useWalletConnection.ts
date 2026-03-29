'use client';

import { useCallback, useEffect, useRef } from 'react';
import { type Address } from 'viem';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useWalletConnectionStore } from '@/store/useWalletConnectionStore';

interface LinkedWalletAccount {
  type: string;
  address: string;
  chainType?: string;
  walletClientType?: string;
}

function findLinkedWallet(
  accounts: LinkedWalletAccount[] | undefined,
  chainType: string
): string | null {
  if (!accounts) return null;
  const match = accounts.find(
    (a) =>
      a.type === 'wallet' &&
      a.chainType === chainType &&
      (a.walletClientType === 'privy' || a.walletClientType === 'privy-v2')
  );
  return match?.address ?? null;
}

export function useWalletConnection() {
  const { login, logout, authenticated, ready, user } = usePrivy();
  const { wallets } = useWallets();
  const retryRef = useRef<NodeJS.Timeout | null>(null);

  const {
    evmAddress,
    isEvmConnected,
    solanaAddress,
    isSolanaConnected,
    setEvmWallet,
    setSolanaWallet,
    disconnectWallet,
    activeWalletType,
  } = useWalletConnectionStore();

  useEffect(() => {
    if (!ready) return;
    if (retryRef.current) clearTimeout(retryRef.current);

    if (!authenticated || !user) {
      disconnectWallet();
      return;
    }

    const solAddr = findLinkedWallet(user.linkedAccounts as LinkedWalletAccount[], 'solana');
    const evmWallet = wallets.find((w) => w.walletClientType === 'privy');
    const evmAddr = evmWallet?.address ?? findLinkedWallet(user.linkedAccounts as LinkedWalletAccount[], 'ethereum');

    setSolanaWallet(solAddr);
    setEvmWallet(evmAddr ? (evmAddr as Address) : null);

    if (!solAddr && !evmAddr) {
      retryRef.current = setTimeout(() => {
        const store = useWalletConnectionStore.getState();
        if (!store.isSolanaConnected && !store.isEvmConnected) {
          const retrySol = findLinkedWallet(user.linkedAccounts as LinkedWalletAccount[], 'solana');
          const retryEvm = findLinkedWallet(user.linkedAccounts as LinkedWalletAccount[], 'ethereum');
          if (retrySol) store.setSolanaWallet(retrySol);
          if (retryEvm) store.setEvmWallet(retryEvm as Address);
        }
      }, 2000);
    }

    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [authenticated, ready, user, wallets, setEvmWallet, setSolanaWallet, disconnectWallet]);

  const connect = useCallback(() => { login(); }, [login]);

  const disconnect = useCallback(async () => {
    await logout();
    disconnectWallet();
  }, [logout, disconnectWallet]);

  return {
    isConnected: authenticated && (isEvmConnected || isSolanaConnected),
    address: solanaAddress || evmAddress || null,
    ready,
    evmAddress, isEvmConnected,
    solanaAddress, isSolanaConnected,
    activeWalletType,
    currentAddress: solanaAddress || evmAddress || null,
    connect, connectWallet: connect,
    disconnect, disconnectWallet: disconnect,
    isMetaMaskAvailable: true, isPhantomAvailable: true,
    switchChain: async (_chainId: number) => {},
    chainId: null as number | null,
    evmChain: null,
  };
}
