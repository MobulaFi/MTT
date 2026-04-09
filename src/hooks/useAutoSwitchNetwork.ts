'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useWalletConnectionStore } from '@/store/useWalletConnectionStore';

export const MOBULA_TO_EVM_CHAIN_ID: Record<string, number> = {
  'evm:1': 1,
  'evm:10': 10,
  'evm:8453': 8453,
  'evm:42161': 42161,
  'evm:42170': 42170,
  'evm:59144': 59144,
  'evm:324': 324,
  'evm:534352': 534352,
  'evm:5000': 5000,
  'evm:169': 169,
  'evm:81457': 81457,
  'evm:34443': 34443,
  'evm:167000': 167000,
  'evm:56': 56,
  'evm:204': 204,
  'evm:137': 137,
  'evm:1101': 1101,
  'evm:43114': 43114,
  'evm:250': 250,
  'evm:100': 100,
  'evm:1284': 1284,
  'evm:1285': 1285,
  'evm:42220': 42220,
  'evm:1313161554': 1313161554,
  'evm:25': 25,
  'evm:2222': 2222,
  'evm:1088': 1088,
  'evm:4200': 4200,
  'evm:60808': 60808,
  'evm:11501': 11501,
  'evm:200901': 200901,
  'evm:1329': 1329,
  'evm:7000': 7000,
  'evm:7560': 7560,
  'evm:122': 122,
  'evm:1116': 1116,
  'evm:4689': 4689,
  'evm:8217': 8217,
  'evm:1030': 1030,
  'evm:3776': 3776,
  'evm:42766': 42766,
  'evm:195': 195,
  'evm:48899': 48899,
  'evm:1625': 1625,
  'evm:177': 177,
  'solana:101': 101,
};

export function extractChainFromPath(pathname: string): string | null {
  const match = pathname.match(/\/(token|pair)\/([^/]+)\//);
  if (match && match[2]) {
    return match[2];
  }
  return null;
}

export function useAutoSwitchNetwork() {
  const pathname = usePathname();
  const evmChainId = useWalletConnectionStore((state) => state.evmChain?.id ?? null);
  const isEvmConnected = useWalletConnectionStore((state) => state.isEvmConnected);
  const isSolanaConnected = useWalletConnectionStore((state) => state.isSolanaConnected);
  const isConnected = isEvmConnected || isSolanaConnected;
  const chainId = evmChainId;

  const currentMobulaChain = useMemo(() => {
    return pathname ? extractChainFromPath(pathname) : null;
  }, [pathname]);

  const requiredChainId = useMemo(() => {
    if (!currentMobulaChain) return null;
    return MOBULA_TO_EVM_CHAIN_ID[currentMobulaChain] || null;
  }, [currentMobulaChain]);

  const isWrongNetwork = useMemo(() => {
    if (!isConnected || !requiredChainId || !chainId) return false;
    return chainId !== requiredChainId;
  }, [isConnected, requiredChainId, chainId]);

  return {
    currentMobulaChain,
    currentEvmChainId: chainId,
    requiredChainId,
    isWrongNetwork,
  };
}
