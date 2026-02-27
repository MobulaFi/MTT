'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';

// Stub chain IDs (no Particle UA)
const CHAIN_ID_MAP: Record<string, number> = {
  ethereum: 1,
  polygon: 137,
  bsc: 56,
  arbitrum: 42161,
  base: 8453,
  optimism: 10,
  avalanche: 43114,
  solana: 101,
  fantom: 250,
  gnosis: 100,
  linea: 59144,
  scroll: 534352,
  mantle: 5000,
  blast: 81457,
  mode: 34443,
  zksync: 324,
};

const SUPPORTED_TOKEN_TYPE = { ETH: 'ETH', SOL: 'SOL', BNB: 'BNB', POL: 'POL', AVAX: 'AVAX', MNT: 'MNT' } as const;

// Native token addresses
const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';
const SOLANA_NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000';

interface CrossChainSwapParams {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  amount: string;
  amountInUSD?: string;
}

interface UseCrossChainSwapResult {
  isLoading: boolean;
  error: string | null;
  executeBuy: (params: CrossChainSwapParams) => Promise<string | null>;
  executeSell: (params: CrossChainSwapParams) => Promise<string | null>;
  executeTransfer: (params: {
    chain: string;
    token: string;
    amount: string;
    receiver: string;
  }) => Promise<string | null>;
  executeConvert: (params: {
    tokenType: keyof typeof SUPPORTED_TOKEN_TYPE;
    amount: string;
    toChain: string;
  }) => Promise<string | null>;
}

const notAvailable = async (): Promise<string | null> => {
  toast.error('Cross-chain swap is not available with the current wallet.');
  return null;
};

export function useCrossChainSwap(): UseCrossChainSwapResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeBuy = useCallback(async (): Promise<string | null> => notAvailable(), []);
  const executeSell = useCallback(async (): Promise<string | null> => notAvailable(), []);
  const executeTransfer = useCallback(async (): Promise<string | null> => notAvailable(), []);
  const executeConvert = useCallback(async (): Promise<string | null> => notAvailable(), []);

  return {
    isLoading,
    error,
    executeBuy,
    executeSell,
    executeTransfer,
    executeConvert,
  };
}

export { CHAIN_ID_MAP, NATIVE_TOKEN_ADDRESS, SOLANA_NATIVE_ADDRESS };
