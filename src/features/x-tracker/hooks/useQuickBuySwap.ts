'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/lib/sdkClient';
import { useSwapTransaction, makeSwapToast } from '@/hooks/trading/useSwapTransaction';
import { useWalletConnectionStore } from '@/store/useWalletConnectionStore';
import { useTradingPanelStore } from '@/store/useTradingPanelStore';
import { useXTrackerStore } from '../store/useXTrackerStore';
import type { ResolvedToken } from './useTokenResolver';
import type { SwapQuoteResponse } from '@/types/swap';

const SOL_NATIVE = 'So11111111111111111111111111111111';
const ETH_NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

function getNativeToken(chainId: string): string {
  if (chainId.toLowerCase().includes('solana')) return SOL_NATIVE;
  return ETH_NATIVE;
}

export function useQuickBuySwap() {
  const [loadingTokens, setLoadingTokens] = useState<Set<string>>(new Set());
  const abortRef = useRef<Map<string, AbortController>>(new Map());

  const solanaAddress = useWalletConnectionStore((s) => s.solanaAddress);
  const evmAddress = useWalletConnectionStore((s) => s.evmAddress);
  const slippage = useTradingPanelStore((s) => s.slippage);

  const { signAndSendTransaction } = useSwapTransaction({
    onSuccess: (txHash) => {
      console.log('[QuickBuy] Success:', txHash);
    },
  });

  const executeBuy = useCallback(async (token: ResolvedToken, amountSol: number) => {
    const tokenKey = `${token.chainId}:${token.address}`;

    // Prevent double-click
    if (loadingTokens.has(tokenKey)) return;

    const isSolana = token.chainId.toLowerCase().includes('solana');
    const walletAddress = isSolana ? solanaAddress : evmAddress;

    if (!walletAddress) {
      toast.error('Connect your wallet first');
      return;
    }

    setLoadingTokens((prev) => new Set(prev).add(tokenKey));

    try {
      const tokenIn = getNativeToken(token.chainId);

      const quoteResponse = await sdk.fetchSwapQuote({
        chainId: token.chainId,
        tokenIn,
        tokenOut: token.address,
        amount: amountSol,
        slippage: slippage || 1,
        walletAddress,
        onlyRouters: 'mobula',
      }) as SwapQuoteResponse;

      if (!quoteResponse?.data) {
        toast.error(`No route found for ${token.symbol}`);
        return;
      }

      await signAndSendTransaction(quoteResponse, token.chainId, 'buy');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Quick buy failed';
      if (!msg.includes('AbortError')) {
        toast.error(`${token.symbol}: ${msg.slice(0, 80)}`);
      }
    } finally {
      setLoadingTokens((prev) => {
        const next = new Set(prev);
        next.delete(tokenKey);
        return next;
      });
    }
  }, [solanaAddress, evmAddress, slippage, signAndSendTransaction, loadingTokens]);

  const isLoading = useCallback(
    (token: ResolvedToken) => loadingTokens.has(`${token.chainId}:${token.address}`),
    [loadingTokens],
  );

  return { executeBuy, isLoading };
}
