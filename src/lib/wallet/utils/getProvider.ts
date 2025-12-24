import type { EIP1193Provider } from '@/types/wallet';
import { eip6963Store } from '../providers/eip6963Store';

/**
 * Get MetaMask provider using EIP-6963, with fallback to window.ethereum
 */
export function getMetaMaskProvider(): EIP1193Provider | null {
  if (typeof window === 'undefined') return null;

  // Try EIP-6963 first
  const eip6963Provider = eip6963Store.getMetaMaskProvider();
  if (eip6963Provider?.provider) {
    return eip6963Provider.provider as EIP1193Provider;
  }

  // Fallback to window.ethereum
  if (window.ethereum) {
    return window.ethereum as EIP1193Provider;
  }

  return null;
}


