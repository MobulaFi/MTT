import React from 'react';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { CircleCheckIcon, OctagonXIcon } from 'lucide-react';
import { sdk } from '@/lib/sdkClient';
import { useWalletConnectionStore } from '@/store/useWalletConnectionStore';
import { useTradingPanelStore } from '@/store/useTradingPanelStore';
import { useSolanaSignerStore } from '@/store/useSolanaSignerStore';
import { useUserPortfolioStore } from '@/store/useUserPortfolioStore';
import { useTradingDataStore } from '@/store/useTradingDataStore';
import { fetchSolanaTokenBalance } from '@/lib/solanaBalance';
import { useNavigationStore } from '@/store/useNavigationStore';
import { useRecentTradesStore } from '@/store/useRecentTradesStore';
import { useWallets } from '@privy-io/react-auth';
import { getNativeAddress } from '@/lib/tokens';
import { toBlockchain } from '@/lib/format';
import type { SwapQuoteResponse, SolanaTransaction } from '@/types/swap';

export type SwapDirection = 'buy' | 'sell';

interface UseSwapTransactionParams {
  onSuccess?: (txHash: string) => void;
  onError?: (error: Error) => void;
}

export function fmtPnl(v: number): string {
  const sign = v >= 0 ? '+' : '';
  if (Math.abs(v) >= 1000) return `${sign}$${(v / 1000).toFixed(1)}k`;
  if (Math.abs(v) >= 1) return `${sign}$${v.toFixed(2)}`;
  return `${sign}$${v.toFixed(4)}`;
}

const h = React.createElement;

function playTradeSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => ctx.close();
  } catch {}
}

export function makeSwapToast(label: string, symbol: string, elapsed: string, tradePnl: number | null, borderColor: string, portfolioUrl: string, pending?: boolean) {
  const pnlColor = tradePnl !== null ? (tradePnl >= 0 ? '#0ECB81' : '#EA3943') : undefined;
  if (!pending) playTradeSound();
  return () => h('div', {
    className: pending ? '' : 'trade-toast-shake',
    onClick: () => { useNavigationStore.getState().navigateToPage('/portfolio'); },
    style: {
      display: 'flex', alignItems: 'center', gap: '10px',
      background: '#111111', border: '1px solid #161616', borderLeft: `3px solid ${borderColor}`,
      borderRadius: '8px', padding: '12px 16px', cursor: 'pointer',
      color: '#FCFCFC', minWidth: '300px',
    },
  },
    pending
      ? h('div', { style: { width: 16, height: 16, borderRadius: '50%', border: '2px solid #3A3A3A', borderTopColor: '#9CA3AF', animation: 'spin 0.8s linear infinite', flexShrink: 0 } })
      : h(CircleCheckIcon, { style: { width: 16, height: 16, color: '#0ECB81', flexShrink: 0 } }),
    h('div', { style: { flex: 1, minWidth: 0 } },
      h('div', { style: { fontSize: '14px', fontWeight: 600 } }, `${label} ${symbol}`),
      h('div', { style: { fontSize: '12px', color: '#9CA3AF', marginTop: '2px' } }, elapsed),
    ),
    pending
      ? h('div', { style: { fontSize: '12px', fontWeight: 500, color: '#9CA3AF', flexShrink: 0 } }, 'Pending...')
      : tradePnl !== null
        ? h('div', { style: { fontSize: '16px', fontWeight: 700, color: pnlColor, flexShrink: 0 } }, fmtPnl(tradePnl))
        : null,
  );
}

function makeErrorToast(title: string, desc: string) {
  return () => h('div', {
    style: {
      display: 'flex', alignItems: 'center', gap: '10px',
      background: '#111111', border: '1px solid #161616', borderLeft: '3px solid #EA3943',
      borderRadius: '8px', padding: '12px 16px',
      color: '#FCFCFC', minWidth: '300px',
    },
  },
    h(OctagonXIcon, { style: { width: 16, height: 16, color: '#EA3943', flexShrink: 0 } }),
    h('div', { style: { flex: 1, minWidth: 0 } },
      h('div', { style: { fontSize: '14px', fontWeight: 600 } }, title),
      h('div', { style: { fontSize: '12px', color: '#9CA3AF', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, desc),
    ),
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms),
    ),
  ]);
}

export function useSwapTransaction({ onSuccess, onError }: UseSwapTransactionParams = {}) {
  const evmAddress = useWalletConnectionStore((state) => state.evmAddress);
  const solanaAddress = useWalletConnectionStore((state) => state.solanaAddress);
  const solanaSwapSettings = useTradingPanelStore((s) => s.solanaSwapSettings);
  const triggerBalanceRefresh = useTradingPanelStore((s) => s.triggerBalanceRefresh);
  const privySolWallet = useSolanaSignerStore((s) => s.wallet);
  const { wallets: evmWallets } = useWallets();

  const getPrivyEvmWallet = useCallback(() => {
    return evmWallets.find((w) => w.walletClientType === 'privy') ?? null;
  }, [evmWallets]);

  const getSolanaAddress = useCallback(() => solanaAddress ?? null, [solanaAddress]);
  const getEvmAddress = useCallback(() => evmAddress ?? null, [evmAddress]);

  const signAndSendSolanaTransaction = useCallback(async (
    solanaTx: SolanaTransaction
  ): Promise<string> => {
    if (!solanaAddress) {
      throw new Error('No Solana wallet available. Please sign in first.');
    }

    if (!privySolWallet) {
      throw new Error('Privy Solana wallet not ready. Please wait a moment and try again.');
    }

    const serializedTx = solanaTx.serialized;
    if (!serializedTx) {
      throw new Error('No serialized transaction found in quote response');
    }

    console.log('[Swap] Signing Solana tx, length:', serializedTx.length);
    const txBytes = new Uint8Array(Buffer.from(serializedTx, 'base64'));

    console.log('[Swap] Calling privySolWallet.signTransaction...');
    const { signedTransaction } = await withTimeout(
      privySolWallet.signTransaction({
        transaction: txBytes,
        chain: 'solana:mainnet',
      }),
      15_000,
      'Solana signing',
    );
    console.log('[Swap] Signed OK, sending...');

    const signedTxBase64 = Buffer.from(signedTransaction).toString('base64');

    const sendResult = await sdk.swapSend({
      chainId: 'solana:solana',
      signedTransaction: signedTxBase64,
    }) as { data?: { hash?: string; transactionHash?: string }; hash?: string; error?: string; message?: string };
    console.log('[Swap] Send result:', JSON.stringify(sendResult).slice(0, 200));

    const hash = sendResult.data?.hash || sendResult.data?.transactionHash || sendResult.hash;
    if (hash) return hash;

    throw new Error(sendResult.error || sendResult.message || 'Transaction failed');
  }, [solanaAddress, privySolWallet]);

  const signAndSendEvmTransaction = useCallback(async (
    evmTx: { to: string; data: string; value: string; gas?: string },
    chainId?: string
  ): Promise<string> => {
    const wallet = getPrivyEvmWallet();
    if (!wallet) {
      throw new Error('No EVM wallet available. Please sign in first.');
    }

    // Switch to the correct chain BEFORE getting the provider.
    if (chainId) {
      const numericId = chainId.includes(':') ? parseInt(chainId.split(':')[1]) : parseInt(chainId);
      if (!isNaN(numericId)) {
        try {
          console.log('[Swap] Switching EVM chain to:', numericId);
          await withTimeout(wallet.switchChain(numericId), 10_000, 'EVM chain switch');
          console.log('[Swap] Chain switched OK');
        } catch (switchError: unknown) {
          console.error('[Swap] Chain switch failed:', switchError);
          throw new Error(`Failed to switch to chain ${chainId}: ${switchError instanceof Error ? switchError.message : String(switchError)}`);
        }
      }
    }

    console.log('[Swap] Getting EVM provider...');
    const provider = await withTimeout(wallet.getEthereumProvider(), 10_000, 'EVM provider');

    const txParams = {
      from: evmAddress,
      to: evmTx.to,
      data: evmTx.data,
      value: evmTx.value || '0x0',
      ...(evmTx.gas ? { gas: evmTx.gas } : {}),
    };

    // Pre-flight gas estimation — catch revert errors before Privy's internal
    // estimation (which throws uncaught promise rejections on failure)
    if (!txParams.gas) {
      console.log('[Swap] Pre-flight gas estimation...');
      try {
        const estimatedGas = await withTimeout(
          provider.request({ method: 'eth_estimateGas', params: [txParams] }),
          10_000,
          'Gas estimation',
        );
        console.log('[Swap] Estimated gas:', estimatedGas);
        // Add 20% buffer
        const gasHex = estimatedGas as string;
        const gasBigInt = BigInt(gasHex);
        const buffered = gasBigInt + (gasBigInt * 20n / 100n);
        txParams.gas = '0x' + buffered.toString(16);
      } catch (gasError: unknown) {
        const msg = gasError instanceof Error ? gasError.message : String(gasError);
        console.error('[Swap] Gas estimation failed:', msg);
        // Extract useful info from viem error
        if (msg.includes('reverted') || msg.includes('revert')) {
          throw new Error('Transaction would revert on-chain. The quote may be stale or the route invalid.');
        }
        throw new Error(`Gas estimation failed: ${msg.slice(0, 120)}`);
      }
    }

    console.log('[Swap] Sending EVM tx with gas:', txParams.gas);
    const txHash = await withTimeout(
      provider.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      }),
      30_000,
      'EVM transaction',
    );
    console.log('[Swap] EVM tx hash:', txHash);

    return txHash as string;
  }, [getPrivyEvmWallet, evmAddress]);

  const signAndSendTransaction = useCallback(async (
    quoteResponse: SwapQuoteResponse,
    chainId: string,
    direction?: SwapDirection,
    options?: { skipToast?: boolean },
  ): Promise<string | void> => {
    if (!quoteResponse.data) {
      throw new Error('Invalid quote response');
    }

    const isSolana = chainId.toLowerCase().includes('solana');
    const isBuy = direction === 'buy';

    // Get token info for toast
    const baseToken = useTradingDataStore.getState().baseToken;
    const tokenSymbol = baseToken?.symbol ?? '';
    const tokenAddress = baseToken?.address ?? '';

    // Get position data
    const positions = useUserPortfolioStore.getState().positions;
    const position = tokenAddress
      ? positions.find((p) => p.address.toLowerCase() === tokenAddress.toLowerCase())
      : undefined;

    // Capture buy series for instant sell PnL computation
    const buySeries = direction === 'sell' ? useTradingPanelStore.getState().buySeries : null;

    // Extract estimated amountOutUSD from the quoting endpoint for PnL
    const quoteData = quoteResponse.data as Record<string, unknown>;
    const quoteAmountOutUSD = (quoteData.amountOutUSD as number) || 0;

    // skipToast mode: caller handles all UI feedback
    const skipToast = options?.skipToast === true;

    // Instant "Processing" toast with spinner
    const toastId = skipToast ? null : toast.loading('Processing...', { duration: Infinity });

    // Safety timeout: dismiss toast after 30s to prevent infinite processing
    const safetyTimeout = toastId ? setTimeout(() => {
      toast.dismiss(toastId);
      toast.custom(makeErrorToast('Timeout', 'Transaction took too long. Check your wallet.'), { duration: 4000, unstyled: true, style: { background: 'transparent', border: 'none', padding: 0, boxShadow: 'none' } });
    }, 30_000) : null;

    const signStartTime = Date.now();

    try {
      let txHash: string;

      const dataKeys = Object.keys(quoteResponse.data as Record<string, unknown>);
      console.log('[Swap] isSolana:', isSolana, 'chainId:', chainId, 'data keys:', dataKeys, 'has solana tx:', !!(quoteResponse.data as Record<string, unknown>).solana, 'has evm tx:', !!(quoteResponse.data as Record<string, unknown>).evm);
      if (isSolana && quoteResponse.data.solana?.transaction) {
        txHash = await signAndSendSolanaTransaction(quoteResponse.data.solana.transaction);
      } else if (!isSolana && quoteResponse.data.evm?.transaction) {
        const evmTx = quoteResponse.data.evm.transaction as { to: string; data: string; value: string; gas?: string };
        txHash = await signAndSendEvmTransaction(evmTx, chainId);
      } else {
        // Fallback: check if there's any transaction in the other field
        if (!isSolana && quoteResponse.data.solana?.transaction) {
          console.warn('[Swap] Chain says EVM but quote has Solana tx — using Solana path');
          txHash = await signAndSendSolanaTransaction(quoteResponse.data.solana.transaction);
        } else if (isSolana && quoteResponse.data.evm?.transaction) {
          console.warn('[Swap] Chain says Solana but quote has EVM tx — using EVM path');
          const evmTx = quoteResponse.data.evm.transaction as { to: string; data: string; value: string; gas?: string };
          txHash = await signAndSendEvmTransaction(evmTx, chainId);
        } else {
          console.error('[Swap] No transaction data! data:', JSON.stringify(quoteResponse.data).slice(0, 500));
          throw new Error('No transaction data found in quote response');
        }
      }

      if (safetyTimeout) clearTimeout(safetyTimeout);

      // Compute amounts for trade record + PnL (needed before toast)
      const quoteToken = useTradingDataStore.getState().quoteToken;
      const panelState = useTradingPanelStore.getState();
      const rawBuyAmount = panelState.buyAmount;

      let tokenAmount = 0;
      let usdAmount = 0;
      if (isBuy) {
        usdAmount = parseFloat(rawBuyAmount.replace('$', '')) || 0;
        if (position?.priceUSD && position.priceUSD > 0) {
          tokenAmount = usdAmount / position.priceUSD;
        }
      } else {
        if (rawBuyAmount.includes('%')) {
          const pct = parseFloat(rawBuyAmount.replace('%', '')) / 100;
          tokenAmount = position ? position.balance * Math.min(pct, 1) : 0;
        } else {
          tokenAmount = parseFloat(rawBuyAmount.replace('$', '')) || 0;
        }
        usdAmount = position?.priceUSD ? tokenAmount * position.priceUSD : 0;
      }

      if (!skipToast) {
        const elapsedMs = Date.now() - signStartTime;
        const elapsed = elapsedMs >= 1000 ? `${(elapsedMs / 1000).toFixed(1)}s` : `${elapsedMs}ms`;
        const label = direction ? (isBuy ? 'Bought' : 'Sold') : 'Swapped';
        const borderColor = isBuy ? '#0ECB81' : direction === 'sell' ? '#EA3943' : '#6366f1';
        const portfolioUrl = `/portfolio?highlightTx=${txHash}&dir=${direction ?? ''}`;

        toast.dismiss(toastId!);

        // Compute sell PnL from quote amountOutUSD vs cost basis
        // Fallback to locally-computed usdAmount if API didn't return amountOutUSD
        const sellProceeds = quoteAmountOutUSD > 0 ? quoteAmountOutUSD : usdAmount;
        let tradePnl: number | null = null;
        if (direction === 'sell' && sellProceeds > 0) {
          let costBasis = 0;

          if (buySeries && buySeries.tokenAddress === tokenAddress && buySeries.totalUSD > 0) {
            // In-session buySeries: PnL = sell proceeds - accumulated buy cost
            costBasis = buySeries.totalUSD;
          } else if (position && position.avgBuyPriceUSD > 0 && tokenAmount > 0) {
            // Fallback: use portfolio position avgBuyPriceUSD as cost basis
            costBasis = position.avgBuyPriceUSD * tokenAmount;
          } else {
            // Last resort: use positionStats from WSS
            const stats = useTradingPanelStore.getState().positionStats;
            if (stats && stats.avgBuyPriceUSD > 0 && tokenAmount > 0) {
              costBasis = stats.avgBuyPriceUSD * tokenAmount;
            }
          }

          console.log('[Swap PnL Debug]', {
            quoteAmountOutUSD,
            sellProceeds,
            costBasis,
            source: buySeries?.tokenAddress === tokenAddress ? 'buySeries' : position?.avgBuyPriceUSD ? 'portfolio' : 'positionStats',
            buySeriesUSD: buySeries?.totalUSD,
            avgBuyPrice: position?.avgBuyPriceUSD,
            tokenAmount,
          });

          if (costBasis > 0) {
            tradePnl = sellProceeds - costBasis;
            console.log('[Swap PnL] pnl:', tradePnl);
          }
        }

        toast.custom(
          makeSwapToast(label, tokenSymbol, elapsed, tradePnl, borderColor, portfolioUrl),
          { duration: 4000, unstyled: true, style: { background: 'transparent', border: 'none', padding: 0, boxShadow: 'none' } },
        );
      }

      // Accumulate buy USD amount for PnL computation on future sells
      if (isBuy && tokenAddress && usdAmount > 0) {
        useTradingPanelStore.getState().addBuyToSeries(tokenAddress, usdAmount, tokenAmount);
        console.log('[Swap] Buy accumulated:', usdAmount, 'USD for', tokenAddress);
      }

      useRecentTradesStore.getState().addTrade({
        txHash,
        chainId,
        direction: direction === 'sell' ? 'sell' : 'buy',
        tokenAddress: baseToken?.address ?? '',
        tokenSymbol: baseToken?.symbol ?? '',
        tokenName: baseToken?.name ?? '',
        tokenLogo: baseToken?.logo ?? null,
        tokenDecimals: baseToken?.decimals ?? 9,
        quoteAddress: quoteToken?.address ?? '',
        quoteSymbol: quoteToken?.symbol ?? '',
        quoteName: quoteToken?.name ?? '',
        quoteLogo: quoteToken?.logo ?? null,
        amountIn: isBuy ? usdAmount : tokenAmount,
        amountOut: isBuy ? tokenAmount : usdAmount,
        amountUsd: usdAmount,
        priceUsd: position?.priceUSD ?? 0,
        timestamp: Date.now(),
      });

      // INSTANT optimistic update — adjust balances locally before WSS/REST confirm
      if (direction && tokenAddress && usdAmount > 0) {
        const nativeAddress = getNativeAddress(isSolana ? 'solana' : 'evm');
        const nativePos = positions.find((p) => p.address.toLowerCase() === nativeAddress.toLowerCase());
        const nativePriceUSD = nativePos?.priceUSD ?? 0;

        // 1. Update portfolio positions bar
        useUserPortfolioStore.getState().applyOptimisticSwapUpdate({
          direction,
          tokenAddress,
          tokenSymbol,
          tokenLogo: baseToken?.logo ?? null,
          tokenBlockchain: isSolana ? 'solana' : toBlockchain(chainId),
          tokenChainId: chainId,
          tokenAmountDelta: tokenAmount,
          usdAmountDelta: usdAmount,
          nativeAddress,
          nativePriceUSD,
        });

        // 2. Update TRADING PANEL balances (buyBalance = SOL, sellBalance = token)
        //    Without this, buyBalance stays stale after swap → next buy fails "not enough funds"
        const panelState = useTradingPanelStore.getState();
        const currentBuyBal = parseFloat(panelState.buyBalance) || 0;
        const currentSellBal = parseFloat(panelState.sellBalance) || 0;

        if (isBuy) {
          // BUY: spent SOL, gained token
          const solSpent = nativePriceUSD > 0 ? usdAmount / nativePriceUSD : 0;
          panelState.setBuyBalance(Math.max(0, currentBuyBal - solSpent).toString());
          panelState.setSellBalance((currentSellBal + tokenAmount).toString(), false);
        } else {
          // SELL: spent token, gained SOL
          const solGained = nativePriceUSD > 0 ? usdAmount / nativePriceUSD : 0;
          panelState.setBuyBalance((currentBuyBal + solGained).toString());
          panelState.setSellBalance(Math.max(0, currentSellBal - tokenAmount).toString(), false);
        }
      }

      // Mark trade to prevent WSS from overwriting balance with stale data for 5s
      useTradingPanelStore.getState().markTrade();

      // Delay REST refresh — WSS handles instant update, REST is for reconciliation.
      // Immediate REST call causes race conditions (stale data resurrects sold tokens,
      // REST response drops positions not yet indexed).
      setTimeout(() => triggerBalanceRefresh(), 5000);
      if (isSolana && tokenAddress) {
        const wallet = useWalletConnectionStore.getState().solanaAddress;
        if (wallet) {
          // Retry RPC balance fetch with increasing delays to catch confirmation
          const refreshSellBalance = async () => {
            for (const delayMs of [2000, 4000]) {
              await new Promise((r) => setTimeout(r, delayMs));
              const bal = await fetchSolanaTokenBalance(wallet, tokenAddress);
              if (bal !== null) {
                useTradingPanelStore.getState().setSellBalance(bal.toString(), false);
                break;
              }
            }
          };
          refreshSellBalance();
        }
      }
      onSuccess?.(txHash);

      if (skipToast) return txHash;
    } catch (error) {
      if (safetyTimeout) clearTimeout(safetyTimeout);
      const errorMessage = error instanceof Error ? error.message : 'Swap failed';
      const msgLower = errorMessage.toLowerCase();
      console.error('[Swap] Error:', errorMessage);

      // Detect specific error types
      const isSlippage = msgLower.includes('slippage') || msgLower.includes('exceeds desired') || msgLower.includes('too little received') || msgLower.includes('0x1771') || msgLower.includes('exceededslippage');
      const isInsufficientFunds = msgLower.includes('insufficient') || msgLower.includes('lamport') || msgLower.includes('not enough') || msgLower.includes('balance too low');

      const toastTitle = isSlippage
        ? 'Slippage Exceeded'
        : isInsufficientFunds
          ? 'Not enough funds broky'
          : 'Swap failed';

      // Extract requestId from quote
      const requestId = (quoteResponse.data as Record<string, unknown>)?.requestId as string | undefined;

      // Auto-copy debug info to clipboard
      const debugInfo = [
        'I got this error, please help me debug:',
        '',
        `Error: ${errorMessage}`,
        requestId ? `Request ID: ${requestId}` : '',
        `Token: ${tokenSymbol} (${tokenAddress})`,
        `Chain: ${chainId}`,
        `Direction: ${direction ?? 'unknown'}`,
        `Time: ${new Date().toISOString()}`,
      ].filter(Boolean).join('\n');

      navigator.clipboard.writeText(debugInfo).catch(() => {});

      const desc = requestId
        ? `${errorMessage.substring(0, 60)}... · ${requestId.slice(0, 8)}`
        : errorMessage.length > 80 ? errorMessage.substring(0, 80) + '...' : errorMessage;

      // Dismiss loading, then show error toast
      if (toastId) toast.dismiss(toastId);
      if (!skipToast) {
        toast.custom(makeErrorToast(`${toastTitle} — copied`, desc), { duration: 3000, unstyled: true, style: { background: 'transparent', border: 'none', padding: 0, boxShadow: 'none' } });
      }

      if (onError) onError(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [signAndSendSolanaTransaction, signAndSendEvmTransaction, triggerBalanceRefresh, onSuccess, onError]);

  return {
    signAndSendTransaction,
    signAndSendSolanaTransaction,
    signAndSendEvmTransaction,
    getSolanaAddress,
    getEvmAddress,
    solanaSwapSettings,
  };
}
