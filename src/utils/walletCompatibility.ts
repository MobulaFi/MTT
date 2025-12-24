/**
 * Utility functions to check wallet compatibility with blockchain
 */

export type WalletProvider = 'metamask' | 'phantom' | null;
export type BlockchainType = 'solana' | 'evm';

/**
 * Determines if a blockchain string is Solana or EVM
 */
export function getBlockchainType(blockchain: string | undefined): BlockchainType {
  if (!blockchain) return 'evm';
  
  const blockchainLower = blockchain.toLowerCase();
  return blockchainLower.includes('solana') ? 'solana' : 'evm';
}

/**
 * Checks if the connected wallet is compatible with the current blockchain
 */
export function isWalletCompatible(
  activeProvider: WalletProvider,
  blockchain: string | undefined
): boolean {
  if (!activeProvider || !blockchain) return false;
  
  const blockchainType = getBlockchainType(blockchain);
  
  if (blockchainType === 'solana') {
    return activeProvider === 'phantom';
  } else {
    return activeProvider === 'metamask';
  }
}

/**
 * Gets the required wallet provider for a blockchain
 */
export function getRequiredWallet(blockchain: string | undefined): WalletProvider {
  const blockchainType = getBlockchainType(blockchain);
  return blockchainType === 'solana' ? 'phantom' : 'metamask';
}

/**
 * Gets a friendly message about wallet compatibility
 */
export function getWalletCompatibilityMessage(
  activeProvider: WalletProvider,
  blockchain: string | undefined
): string {
  const blockchainType = getBlockchainType(blockchain);
  const requiredWallet = blockchainType === 'solana' ? 'Phantom' : 'MetaMask';
  const currentWallet = activeProvider === 'phantom' ? 'Phantom' : 'MetaMask';
  
  return `This is a ${blockchainType.toUpperCase()} token. Please connect with ${requiredWallet} instead of ${currentWallet}.`;
}

