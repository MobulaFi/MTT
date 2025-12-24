import type { WalletConnectionResult } from '@/types/wallet';

export class PhantomConnector {
  static async connect(): Promise<WalletConnectionResult> {
    if (typeof window === 'undefined') {
      throw new Error('Window is not available');
    }

    // Get Phantom provider specifically, not MetaMask's ethereum provider
    const getPhantomProvider = () => {
      if ('phantom' in window) {
        const phantomWindow = window as typeof window & {
          phantom?: { 
            solana?: {
              isPhantom?: boolean;
              connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } | string }>;
              disconnect: () => Promise<void>;
              publicKey: { toString: () => string } | string | null;
            };
          };
        };
        return phantomWindow.phantom?.solana;
      }
      return null;
    };

    const provider = getPhantomProvider();
    
    if (!provider) {
      throw new Error('Phantom wallet is not installed. Please install Phantom extension and refresh the page.');
    }

    if (!provider.connect || typeof provider.connect !== 'function') {
      throw new Error('Phantom Solana provider is not properly initialized. Please refresh the page.');
    }

    try {
      // First disconnect if already connected to ensure fresh connection
      if (provider.publicKey) {
        try {
          await provider.disconnect();
        } catch {
          // Ignore disconnect errors
        }
      }

      // Request connection - this will show Phantom popup
      const response = await provider.connect({ onlyIfTrusted: false });

      if (!response) {
        throw new Error('No response from Phantom wallet');
      }

      let publicKey: string;
      if (typeof response.publicKey === 'string') {
        publicKey = response.publicKey;
      } else if (response.publicKey && typeof response.publicKey.toString === 'function') {
        publicKey = response.publicKey.toString();
      } else {
        throw new Error('Invalid public key format from Phantom');
      }

      if (!publicKey || publicKey.length === 0) {
        throw new Error('Empty public key returned from Phantom');
      }

      return { address: publicKey };
    } catch (error) {
      throw error;
    }
  }

  static parseError(error: unknown): Error {
    if (typeof error === 'object' && error !== null) {
      const errorObj = error as { message?: string; code?: number | string };
      
      if (errorObj.code !== undefined) {
        const code = Number(errorObj.code);
        if (code === 4001) {
          return new Error('Connection rejected by user');
        }
        if (code === -32603) {
          return new Error('Wallet internal error. Please try again.');
        }
        if (code === -32002) {
          return new Error('Connection request already pending. Please check your Phantom wallet.');
        }
      }
      
      if (errorObj.message && typeof errorObj.message === 'string') {
        if (this.isUserRejectionError(errorObj.message)) {
          return new Error('Connection rejected by user');
        }
        if (errorObj.message.includes('not installed') || errorObj.message.includes('not available')) {
          return new Error('Phantom wallet is not installed or not available');
        }
        return new Error(`Failed to connect: ${errorObj.message}`);
      }
      
      if (errorObj.code !== undefined) {
        return new Error(`Connection failed with code: ${errorObj.code}`);
      }
    }
  
    if (error instanceof Error) {
      const errorMessage = error.message;
  
      if (this.isUserRejectionError(errorMessage)) {
        return new Error('Connection rejected by user');
      }
  
      if (errorMessage.includes('not installed') || errorMessage.includes('not available')) {
        return new Error('Phantom wallet is not installed or not available');
      }
  
      if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        return new Error('Connection timeout. Please try again.');
      }
  
      return new Error(`Failed to connect: ${errorMessage}`);
    }
  
    return new Error('Unexpected error. Please check your Phantom extension and try again.');
  }

  private static isUserRejectionError(message: string): boolean {
    const rejectionKeywords = [
      'user rejected',
      'user cancelled',
      'user canceled',
      'reject',
      'cancel',
      'denied',
      'declined',
      '4001',
    ];
    const lowerMessage = message.toLowerCase();
    return rejectionKeywords.some(keyword => lowerMessage.includes(keyword));
  }
}

