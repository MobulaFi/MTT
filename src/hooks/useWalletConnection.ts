'use client';

import { useCallback } from 'react';
import { type Address } from 'viem';
import { useWalletConnectionStore } from '@/store/useWalletConnectionStore';
import { MetaMaskConnector, PhantomConnector } from '@/lib/wallet/connectors';
import { useWalletAvailability } from './wallet/useWalletAvailability';
import { useWalletEventListeners } from './wallet/useWalletEventListeners';
import { useAutoSwitchChain } from './wallet/useAutoSwitchChain';

export function useWalletConnection() {
  const {
    evmAddress,
    evmChain,
    isEvmConnected,
    solanaAddress,
    isSolanaConnected,
    setEvmWallet,
    setSolanaWallet,
    disconnectWallet,
    activeWalletType,
    activeProvider,
  } = useWalletConnectionStore();

  const { isMetaMaskAvailable, isPhantomAvailable } = useWalletAvailability();

  useWalletEventListeners({
    isEvmConnected,
    isSolanaConnected,
    evmChain,
    setEvmWallet,
    setSolanaWallet,
  });

  useAutoSwitchChain();

  const connectMetaMask = useCallback(async () => {
    try {
      // Clear manual disconnect flag and disconnect first to ensure fresh connection
      const { setManuallyDisconnected } = useWalletConnectionStore.getState();
      setManuallyDisconnected(false);
      
      // Disconnect first if connected
      if (evmAddress) {
        setEvmWallet(null, null);
        // Small delay to ensure state is cleared
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Connect - this will request fresh permission and return current account
      const result = await MetaMaskConnector.connect();
      
      // Verify we got a valid address
      if (!result.address) {
        throw new Error('No address returned from MetaMask');
      }
      
      setEvmWallet(result.address as Address, result.chain || null);
      return result;
    } catch (error) {
      // On error, ensure we're disconnected
      setEvmWallet(null, null);
      throw MetaMaskConnector.parseError(error);
    }
  }, [setEvmWallet, evmAddress]);

  const connectPhantom = useCallback(async () => {
    try {
      const result = await PhantomConnector.connect();
      setSolanaWallet(result.address as string);
      return result;
    } catch (error) {
      throw PhantomConnector.parseError(error);
    }
  }, [setSolanaWallet]);

  const disconnectEvm = useCallback(async () => {
    const { setManuallyDisconnected } = useWalletConnectionStore.getState();
    // Set manual disconnect flag first to prevent event listeners from reconnecting
    setManuallyDisconnected(true);
    
    // Try to revoke MetaMask permissions to fully disconnect
    const { getMetaMaskProvider } = await import('@/lib/wallet/utils/getProvider');
    const provider = getMetaMaskProvider();
    if (provider) {
      try {
        // Try to revoke permissions if the method exists
        // This will fully disconnect from MetaMask and require re-approval on next connect
        await provider.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }],
        });
      } catch (error) {
        // Ignore errors - wallet_revokePermissions might not be supported in all MetaMask versions
        // or might fail, but we still want to disconnect locally
      }
    }
    
    if (evmAddress) {
      setEvmWallet(null, null);
    }
  }, [evmAddress, setEvmWallet]);

  const disconnectSolana = useCallback(async () => {
    if (window.phantom?.solana) {
      try {
        await window.phantom.solana.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
    setSolanaWallet(null);
  }, [setSolanaWallet]);

  const disconnect = useCallback(async () => {
    await Promise.all([disconnectEvm(), disconnectSolana()]);
    disconnectWallet();
  }, [disconnectEvm, disconnectSolana, disconnectWallet]);

  const connectWallet = useCallback(async (provider: 'metamask' | 'phantom') => {
    if (provider === 'metamask') {
      return await connectMetaMask();
    } else {
      return await connectPhantom();
    }
  }, [connectMetaMask, connectPhantom]);

  return {
    // Connection state
    isConnected: isEvmConnected || isSolanaConnected,
    address: evmAddress || solanaAddress || null,
    chainId: evmChain?.id || null,
    
    // EVM state
    evmAddress,
    evmChain,
    isEvmConnected,
    
    // Solana state
    solanaAddress,
    isSolanaConnected,
    
    // Active wallet info
    activeWalletType,
    activeProvider,
    currentAddress: evmAddress || solanaAddress || null,
    
    // Connection methods
    connectWallet,
    connectMetaMask,
    connectPhantom,
    
    // Disconnection methods
    disconnect,
    disconnectWallet: disconnect,
    disconnectEvm,
    disconnectSolana,
    
    // Provider availability
    isMetaMaskAvailable,
    isPhantomAvailable,
  };
}

// Re-export ChainSwitcher for backward compatibility
export { ChainSwitcher } from '@/lib/wallet/utils';
