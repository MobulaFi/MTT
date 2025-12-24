import { type Chain } from 'viem';
import { getChainFromBlockchain, getChainConfig } from '@/utils/chainMapping';
import { getMetaMaskProvider } from './getProvider';
import type { EIP1193Provider } from '@/types/wallet';

export class ChainSwitcher {
  static async switchOrAddChain(blockchainId: string, provider?: EIP1193Provider | null): Promise<Chain | null> {
    const metaMaskProvider = provider || getMetaMaskProvider();
    if (typeof window === 'undefined' || !metaMaskProvider) return null;

    const chain = getChainFromBlockchain(blockchainId);
    const chainConfig = getChainConfig(blockchainId);

    // If chain is not in mapping, try to switch by chain ID only
    if (!chain || !chainConfig) {
      // Extract chain ID from blockchain ID (e.g., "evm:6342" -> 6342 -> "0x18ba")
      if (blockchainId.startsWith('evm:')) {
        const chainIdNum = parseInt(blockchainId.replace('evm:', ''));
        if (!isNaN(chainIdNum)) {
          const chainIdHex = `0x${chainIdNum.toString(16)}`;
          try {
            await this.switchChain(chainIdHex, metaMaskProvider);
            // Return a basic chain object
            return { id: chainIdNum } as Chain;
          } catch (error: unknown) {
            // If chain not added, we can't add it without config, so return null
            if (this.isChainNotAddedError(error)) {
              console.warn(`Chain ${blockchainId} is not configured. Please add it to chainMapping.ts`);
              return null;
            }
            throw error;
          }
        }
      }
      return null;
    }

    try {
      await this.switchChain(chainConfig.chainId, metaMaskProvider);
      return chain;
    } catch (error: unknown) {
      if (this.isChainNotAddedError(error)) {
        await this.addChain(chainConfig, metaMaskProvider);
        await this.switchChain(chainConfig.chainId, metaMaskProvider);
        return chain;
      }
      throw error;
    }
  }

  static async ensureCorrectChain(blockchainId: string, provider?: EIP1193Provider | null): Promise<Chain> {
    const metaMaskProvider = provider || getMetaMaskProvider();
    if (typeof window === 'undefined' || !metaMaskProvider) {
      throw new Error('Ethereum provider not available');
    }

    const chain = getChainFromBlockchain(blockchainId);
    const chainConfig = getChainConfig(blockchainId);

    if (!chain || !chainConfig) {
      throw new Error(`Chain configuration not found for ${blockchainId}`);
    }

    const currentChainIdHex = await metaMaskProvider.request({
      method: 'eth_chainId',
      params: [],
    }) as string;

    const targetChainIdHex = chainConfig.chainId;

    if (currentChainIdHex.toLowerCase() === targetChainIdHex.toLowerCase()) {
      return chain;
    }

    try {
      await this.switchChain(targetChainIdHex, metaMaskProvider);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const newChainIdHex = await metaMaskProvider.request({
        method: 'eth_chainId',
        params: [],
      }) as string;
      
      if (newChainIdHex.toLowerCase() !== targetChainIdHex.toLowerCase()) {
        throw new Error(`Failed to switch to chain ${chainConfig.chainName}. Please switch manually in your wallet.`);
      }
      
      return chain;
    } catch (error: unknown) {
      if (this.isChainNotAddedError(error)) {
        try {
          await this.addChain(chainConfig, metaMaskProvider);
          await this.switchChain(targetChainIdHex, metaMaskProvider);
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const newChainIdHex = await metaMaskProvider.request({
            method: 'eth_chainId',
            params: [],
          }) as string;
          
          if (newChainIdHex.toLowerCase() !== targetChainIdHex.toLowerCase()) {
            throw new Error(`Failed to switch to chain ${chainConfig.chainName}. Please switch manually in your wallet.`);
          }
          
          return chain;
        } catch (addError: unknown) {
          const errorMessage = addError instanceof Error ? addError.message : 'Failed to add or switch chain';
          throw new Error(`Failed to switch to ${chainConfig.chainName}: ${errorMessage}`);
        }
      }
      
      if (this.isUserRejectionError(error)) {
        throw new Error('Chain switch was rejected. Please approve the chain switch to continue.');
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to switch to ${chainConfig.chainName}: ${errorMessage}`);
    }
  }

  private static isUserRejectionError(error: unknown): boolean {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = (error as { code: unknown }).code;
      return code === 4001 || code === '4001';
    }
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('user rejected') || message.includes('user denied') || message.includes('rejected');
    }
    return false;
  }

  private static async switchChain(chainId: string, provider: EIP1193Provider): Promise<void> {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });
  }

  private static async addChain(config: ReturnType<typeof getChainConfig>, provider: EIP1193Provider): Promise<void> {
    if (!config) return;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: config.chainId,
        chainName: config.chainName,
        nativeCurrency: config.nativeCurrency,
        rpcUrls: config.rpcUrls,
        blockExplorerUrls: config.blockExplorerUrls,
      }],
    });
  }

  private static isChainNotAddedError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === 4902 || error.code === -32603)
    );
  }
}

