import { createWalletClient, custom, type Address, type Chain } from 'viem';
import { mainnet } from 'viem/chains';
import { getBlockchainFromUrl } from '@/utils/getBlockchainFromUrl';
import { ChainSwitcher } from '../utils/chainSwitcher';
import { getMetaMaskProvider } from '../utils/getProvider';
import type { WalletConnectionResult, EIP1193Provider } from '@/types/wallet';

export class MetaMaskConnector {
  static async connect(): Promise<WalletConnectionResult> {
    const provider = getMetaMaskProvider();
    
    if (!provider) {
      throw new Error('MetaMask is not installed');
    }

    // Always request fresh accounts - eth_requestAccounts returns the currently selected account
    // This will prompt for permission if not already granted, and always returns the active account
    // We request accounts first to ensure we get the currently selected account
    let accounts: string[] = [];
    try {
      // Request accounts - this will return the currently active account in MetaMask
      // If permission is already granted, it returns immediately with current account
      // If not granted, it prompts for permission
      accounts = await provider.request({
        method: 'eth_requestAccounts',
        params: [],
      }) as string[];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('locked') || errorMessage.includes('Please unlock')) {
        throw new Error('MetaMask is locked. Please unlock your wallet and try again.');
      }
      if (this.isUserRejectionError(errorMessage)) {
        throw new Error('Connection rejected by user');
      }
      throw error;
    }

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned. Please approve the connection in MetaMask.');
    }

    // eth_requestAccounts always returns the currently selected account in MetaMask
    // The first account in the array is the active/selected account
    // This is the account the user has selected in MetaMask, not a cached one
    const addressToUse = accounts[0];

    const blockchainFromUrl = getBlockchainFromUrl();
    let targetChain: Chain = mainnet;

    if (blockchainFromUrl?.startsWith('evm:')) {
      try {
        const chain = await ChainSwitcher.switchOrAddChain(blockchainFromUrl, provider);
        if (chain) targetChain = chain;
      } catch (error) {
        // Fallback to current chain if switch fails
      }
    }

    const walletClient = createWalletClient({
      chain: targetChain,
      transport: custom(provider),
    });

    const address = addressToUse as Address;
    const currentChainId = await walletClient.getChainId();
    const actualChain = targetChain.id === currentChainId ? targetChain : mainnet;

    return { address, chain: actualChain };
  }

  static parseError(error: unknown): Error {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (this.isUserRejectionError(errorMessage)) {
      return new Error('Connection rejected by user');
    }
    if (errorMessage.includes('not installed')) {
      return new Error('MetaMask is not installed');
    }
    return new Error(`Connection failed: ${errorMessage}`);
  }

  private static isUserRejectionError(message: string): boolean {
    const rejectionKeywords = ['reject', 'deny', 'cancel', 'User rejected', 'user rejected'];
    return rejectionKeywords.some(keyword => message.includes(keyword));
  }
}

