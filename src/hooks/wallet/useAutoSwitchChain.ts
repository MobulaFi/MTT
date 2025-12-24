'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getBlockchainFromUrl } from '@/utils/getBlockchainFromUrl';
import { getMetaMaskProvider } from '@/lib/wallet/utils/getProvider';
import { useWalletConnectionStore } from '@/store/useWalletConnectionStore';
import type { Chain } from 'viem';

/**
 * Hook to automatically switch MetaMask chain when URL changes
 * Watches for blockchain changes in the URL and switches MetaMask accordingly
 * Uses wallet_switchEthereumChain and wallet_addEthereumChain as per MetaMask docs
 */
export function useAutoSwitchChain() {
  const pathname = usePathname();
  const isEvmConnected = useWalletConnectionStore((state) => state.isEvmConnected);
  const evmChain = useWalletConnectionStore((state) => state.evmChain);
  const setEvmWallet = useWalletConnectionStore((state) => state.setEvmWallet);
  const evmAddress = useWalletConnectionStore((state) => state.evmAddress);
  const lastSwitchedChainRef = useRef<string | null>(null);

  useEffect(() => {
    const blockchainFromUrl = getBlockchainFromUrl();
    
    // Only handle EVM chains
    if (!blockchainFromUrl?.startsWith('evm:')) {
      lastSwitchedChainRef.current = null;
      return;
    }

    // Reset ref if blockchain changed (user navigated to different chain)
    // Also reset if we haven't switched yet (first time on this page)
    if (lastSwitchedChainRef.current !== blockchainFromUrl) {
      if (lastSwitchedChainRef.current) {
      }
      lastSwitchedChainRef.current = null;
    } else {
      // Already switched to this chain, but verify MetaMask is actually on it
    }

    // Only switch if wallet is connected
    if (!isEvmConnected || !evmAddress) {
      return;
    }

    const provider = getMetaMaskProvider();
    if (!provider) {
      return;
    }


    // Check if we need to switch chains
    const switchChain = async () => {
      try {
        // Get current chain from MetaMask
        const currentChainIdHex = await provider.request({
          method: 'eth_chainId',
          params: [],
        }) as string;


        // Convert blockchain ID (e.g., "evm:143") to chain ID hex (e.g., "0x8f")
        const chainIdNum = parseInt(blockchainFromUrl.replace('evm:', ''));
        if (isNaN(chainIdNum)) {
          console.warn(`[useAutoSwitchChain] Invalid blockchain ID: ${blockchainFromUrl}`);
          return;
        }

        const targetChainIdHex = `0x${chainIdNum.toString(16)}`;

        // If already on the correct chain, no need to switch
        if (currentChainIdHex.toLowerCase() === targetChainIdHex.toLowerCase()) {
          lastSwitchedChainRef.current = blockchainFromUrl;
          return;
        }

        // Always attempt to switch if chains are different

        // Always use wallet_switchEthereumChain directly (don't use mapping)
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: targetChainIdHex }],
          });
          // Update with basic chain info
          setEvmWallet(evmAddress, { id: chainIdNum } as Chain);
          lastSwitchedChainRef.current = blockchainFromUrl;
        } catch (switchError: unknown) {
          console.error('[useAutoSwitchChain] Switch error:', switchError);
          
          // Extract error details
          let errorCode: unknown = undefined;
          let errorMessage = 'Unknown error';
          
          if (switchError && typeof switchError === 'object') {
            errorCode = (switchError as { code?: unknown })?.code;
            if ('message' in switchError) {
              errorMessage = String((switchError as { message: unknown }).message);
            } else if (switchError instanceof Error) {
              errorMessage = switchError.message;
            }
          } else if (switchError instanceof Error) {
            errorMessage = switchError.message;
          }
          
          const isChainNotAdded = errorCode === 4902 || errorCode === -32603 || 
                                 errorMessage.includes('Unrecognized chain') ||
                                 errorMessage.includes('not added');
          
          if (isChainNotAdded) {
            
            // Try to fetch chain info from our API route (which proxies chainlist.org)
            try {
              const chainListResponse = await fetch(`/api/chain-info?chainId=${chainIdNum}`);
              
              if (chainListResponse.ok) {
                const chainData = await chainListResponse.json();
                // Extract RPC URLs - filter out WebSocket URLs and invalid URLs
                const rpcUrls = chainData.rpc
                  ?.map((rpc: { url: string }) => rpc.url)
                  .filter((url: string) => 
                    url && 
                    !url.includes('${') && 
                    !url.startsWith('wss://') &&
                    (url.startsWith('https://') || url.startsWith('http://'))
                  ) || [];
                
                if (rpcUrls.length > 0) {
                  await provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                      chainId: targetChainIdHex,
                      chainName: chainData.name || `Chain ${chainIdNum}`,
                      nativeCurrency: chainData.nativeCurrency || { name: 'ETH', symbol: 'ETH', decimals: 18 },
                      rpcUrls: rpcUrls.slice(0, 2), // Use first 2 RPC URLs
                      blockExplorerUrls: chainData.explorers?.map((exp: { url: string }) => exp.url).filter(Boolean) || [],
                    }],
                  });
                  
                  // After adding, try to switch again
                  await provider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: targetChainIdHex }],
                  });
                  
                  setEvmWallet(evmAddress, { id: chainIdNum } as Chain);
                  lastSwitchedChainRef.current = blockchainFromUrl;
                } else {
                  console.warn(`[useAutoSwitchChain] No RPC URLs found for chain ${blockchainFromUrl} on chainlist.org`);
                }
              } else {
                console.warn(`[useAutoSwitchChain] Chain ${blockchainFromUrl} not found on chainlist.org. User needs to add it manually.`);
              }
            } catch (fetchError) {
              console.warn(`[useAutoSwitchChain] Failed to fetch chain info from chainlist.org:`, fetchError);
              console.warn(`[useAutoSwitchChain] User needs to add chain ${blockchainFromUrl} manually in MetaMask.`);
            }
          } else {
            console.warn(`[useAutoSwitchChain] Failed to switch chain. Code: ${errorCode}, Message: ${errorMessage}`);
          }
        }
      } catch (error) {
        // Log error details for debugging
        console.error('[useAutoSwitchChain] Error in switchChain:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorCode = (error as { code?: unknown })?.code;
        console.warn(`[useAutoSwitchChain] Failed to switch chain. Code: ${errorCode}, Message: ${errorMessage}`);
      }
    };

    switchChain();
  }, [pathname, isEvmConnected, evmAddress, setEvmWallet]);
}

