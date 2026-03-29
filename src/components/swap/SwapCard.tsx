'use client';

import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { ArrowDownUp, Loader2, RefreshCw } from 'lucide-react';
import { useSwapPageStore, type WalletAsset } from '@/store/useSwapPageStore';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useSwapTransaction } from '@/hooks/trading/useSwapTransaction';
import { sdk } from '@/lib/sdkClient';
import { toast } from 'sonner';
import { TokenInput } from './TokenInput';
import { TokenPickerModal } from './TokenPickerModal';
import { SwapSettings } from './SwapSettings';
import { SwapRouteInfo } from './SwapRouteInfo';
import { TokenDataSection } from './TokenDataSection';
import type { SwapQuoteResponse } from '@/types/swap';
import type { SwapQuotingResponse } from '@mobula_labs/types';
import { isNativeAddress } from '@/lib/tokens';

const POLL_INTERVAL = 500;

const SOL_NATIVE_ADDR = 'So11111111111111111111111111111111111111111';
const NATIVE_SENTINEL = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

const NATIVE_TOKEN_BY_CHAIN: Record<string, { address: string; symbol: string; name: string; logo: string }> = {
  'solana:solana': {
    address: SOL_NATIVE_ADDR,
    symbol: 'SOL',
    name: 'Solana',
    logo: 'https://assets.coingecko.com/coins/images/4128/standard/solana.png',
  },
  'evm:1': {
    address: NATIVE_SENTINEL,
    symbol: 'ETH',
    name: 'Ethereum',
    logo: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png',
  },
  'evm:8453': {
    address: NATIVE_SENTINEL,
    symbol: 'ETH',
    name: 'Ethereum',
    logo: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png',
  },
  'evm:42161': {
    address: NATIVE_SENTINEL,
    symbol: 'ETH',
    name: 'Ethereum',
    logo: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png',
  },
  'evm:56': {
    address: NATIVE_SENTINEL,
    symbol: 'BNB',
    name: 'BNB',
    logo: 'https://assets.coingecko.com/coins/images/825/standard/bnb-icon2_2x.png',
  },
};

function mapPortfolioAssets(assets: Array<Record<string, unknown>>): WalletAsset[] {
  return assets.flatMap((holding: Record<string, unknown>) => {
    const contracts = holding.contracts_balances as Array<Record<string, unknown>> | undefined;
    if (!contracts || contracts.length === 0) return [];
    const assetInfo = holding.asset as Record<string, unknown> | undefined;
    return contracts.map((contract) => {
      let address = String(contract.address || '');
      let symbol = String(assetInfo?.symbol || holding.symbol || 'Unknown');
      let name = String(assetInfo?.name || holding.name || 'Unknown');
      let logo = (assetInfo?.logo as string) || (holding.logo as string) || null;
      const cId = String(contract.chainId || 'solana:solana');
      const nativeInfo = isNativeAddress(address) ? NATIVE_TOKEN_BY_CHAIN[cId] : undefined;
      if (nativeInfo) {
        address = nativeInfo.address;
        symbol = nativeInfo.symbol;
        name = nativeInfo.name;
        logo = nativeInfo.logo;
      }
      return {
        address, symbol, name,
        decimals: Number(contract.decimals || 9),
        logo,
        chainId: cId,
        balanceUsd: Number(holding.estimated_balance || 0),
        tokenBalance: Number(contract.balance || holding.token_balance || 0),
      };
    });
  }).filter((a) => a.balanceUsd > 0 || a.tokenBalance > 0);
}

export default function SwapCard() {
  const {
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    chainId,
    slippage,
    quote,
    isQuoteLoading,
    quoteError,
    isSwapping,
    tokenInPriceUSD,
    tokenOutPriceUSD,
    walletAssets,
    swapTokens,
    setAmountOut,
    setQuote,
    setQuoteLoading,
    setQuoteError,
    setSwapping,
    setTokenInPriceUSD,
    setTokenOutPriceUSD,
    setWalletAssets,
    setWalletPortfolioLoading,
  } = useSwapPageStore();

  const { isConnected, solanaAddress, evmAddress, connect } = useWalletConnection();
  const { signAndSendTransaction } = useSwapTransaction();

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const swapWalletAddress = useMemo(() => {
    if (chainId.includes('solana')) return solanaAddress || null;
    return evmAddress || null;
  }, [chainId, solanaAddress, evmAddress]);

  // Use refs for latest values so polling always reads fresh state
  const latestRef = useRef({ tokenIn, tokenOut, amountIn, slippage, chainId, swapWalletAddress });
  latestRef.current = { tokenIn, tokenOut, amountIn, slippage, chainId, swapWalletAddress };

  const doFetchQuote = useCallback(async (isPolling: boolean) => {
    if (isPolling && isFetchingRef.current) return;

    const { tokenIn: tIn, tokenOut: tOut, amountIn: aIn, slippage: sl, chainId: cId, swapWalletAddress: wa } = latestRef.current;
    if (!tIn || !tOut || !aIn || parseFloat(aIn) <= 0) return;

    isFetchingRef.current = true;
    if (!isPolling) setQuoteLoading(true);
    if (isPolling) setIsRefreshing(true);

    try {
      // walletAddress is required by the API — use a dummy if not connected
      const wallet = wa || '11111111111111111111111111111111';
      const quoteResponse = (await sdk.fetchSwapQuote({
        chainId: cId,
        tokenIn: tIn.address,
        tokenOut: tOut.address,
        amount: parseFloat(aIn) as unknown as number,
        slippage: sl as unknown as number,
        walletAddress: wallet,
        onlyRouters: 'mobula',
      })) as SwapQuotingResponse;

      console.log('[SwapCard] Quote response:', JSON.stringify(quoteResponse).slice(0, 500));
      if (quoteResponse?.data) {
        setQuote(quoteResponse);
        // Try multiple possible field names for the output amount
        const data = quoteResponse.data as Record<string, unknown>;
        const out = data.amountOutTokens ?? data.amountOut ?? data.outputAmount;
        if (out !== undefined && out !== null) setAmountOut(String(out));
      } else if (!isPolling) {
        console.warn('[SwapCard] No data in quote response:', quoteResponse);
        setQuoteError('No quote available');
      }
    } catch (err) {
      console.error('[SwapCard] Quote fetch error:', err);
      if (!isPolling) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch quote';
        setQuoteError(msg);
        setQuote(null);
        setAmountOut('');
      }
    } finally {
      isFetchingRef.current = false;
      if (!isPolling) setQuoteLoading(false);
      setIsRefreshing(false);
    }
  }, [setQuote, setAmountOut, setQuoteLoading, setQuoteError]);

  // Debounce + poll on input changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (pollRef.current) clearInterval(pollRef.current);

    if (!tokenIn || !tokenOut || !amountIn || parseFloat(amountIn) <= 0) {
      setQuote(null);
      setAmountOut('');
      setQuoteError(null);
      return;
    }

    setQuoteLoading(true);

    debounceRef.current = setTimeout(() => {
      doFetchQuote(false);

      // Start polling
      pollRef.current = setInterval(() => {
        doFetchQuote(true);
      }, POLL_INTERVAL);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [tokenIn?.address, tokenOut?.address, amountIn, slippage, chainId, swapWalletAddress, doFetchQuote]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Fetch token USD prices when tokens change
  useEffect(() => {
    if (!tokenIn) { setTokenInPriceUSD(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await sdk.fetchTokenDetails({
          address: tokenIn.address,
          blockchain: tokenIn.chainId,
          currencies: 'USD',
        }) as { data?: { priceUSD?: number } };
        if (!cancelled && res?.data?.priceUSD) {
          setTokenInPriceUSD(res.data.priceUSD);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [tokenIn?.address, tokenIn?.chainId, setTokenInPriceUSD]);

  useEffect(() => {
    if (!tokenOut) { setTokenOutPriceUSD(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await sdk.fetchTokenDetails({
          address: tokenOut.address,
          blockchain: tokenOut.chainId,
          currencies: 'USD',
        }) as { data?: { priceUSD?: number } };
        if (!cancelled && res?.data?.priceUSD) {
          setTokenOutPriceUSD(res.data.priceUSD);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [tokenOut?.address, tokenOut?.chainId, setTokenOutPriceUSD]);

  // Re-usable wallet portfolio fetcher
  const fetchWalletPortfolio = useCallback(async () => {
    const walletAddr = solanaAddress || evmAddress;
    if (!walletAddr) return;

    setWalletPortfolioLoading(true);
    try {
      const blockchains = chainId.includes('solana') ? 'solana' : undefined;
      const res = await sdk.fetchWalletPortfolio({
        wallet: walletAddr,
        ...(blockchains ? { blockchains } : {}),
      }) as { data?: { assets?: Array<Record<string, unknown>> } };

      const assets = res?.data?.assets;
      if (!assets || !Array.isArray(assets)) {
        setWalletAssets([]);
        return;
      }

      setWalletAssets(mapPortfolioAssets(assets));
    } catch {
      setWalletAssets([]);
    } finally {
      setWalletPortfolioLoading(false);
    }
  }, [solanaAddress, evmAddress, chainId, setWalletAssets, setWalletPortfolioLoading]);

  // Fetch wallet portfolio when wallet is connected
  useEffect(() => {
    const walletAddr = solanaAddress || evmAddress;
    if (!walletAddr) {
      setWalletAssets([]);
      return;
    }
    fetchWalletPortfolio();
  }, [solanaAddress, evmAddress, chainId, fetchWalletPortfolio, setWalletAssets]);

  // Look up balances from wallet portfolio for current tokens
  const tokenInBalance = useMemo(() => {
    if (!tokenIn || walletAssets.length === 0) return null;
    const asset = walletAssets.find(
      (a) => a.address.toLowerCase() === tokenIn.address.toLowerCase() && a.chainId === tokenIn.chainId
    );
    return asset ? String(asset.tokenBalance) : null;
  }, [tokenIn, walletAssets]);

  const tokenOutBalance = useMemo(() => {
    if (!tokenOut || walletAssets.length === 0) return null;
    const asset = walletAssets.find(
      (a) => a.address.toLowerCase() === tokenOut.address.toLowerCase() && a.chainId === tokenOut.chainId
    );
    return asset ? String(asset.tokenBalance) : null;
  }, [tokenOut, walletAssets]);

  // If we have prices for both tokens and no quote yet, estimate amountOut locally
  useEffect(() => {
    if (!amountOut && amountIn && parseFloat(amountIn) > 0 && tokenInPriceUSD && tokenOutPriceUSD && tokenOutPriceUSD > 0 && !quote) {
      const estimated = (parseFloat(amountIn) * tokenInPriceUSD) / tokenOutPriceUSD;
      setAmountOut(estimated.toFixed(6));
    }
  }, [amountIn, tokenInPriceUSD, tokenOutPriceUSD, quote, amountOut, setAmountOut]);

  // Compute USD values: use quote data if available, otherwise price * amount
  const amountInUsd = useMemo(() => {
    const quoteUsd = (quote?.data as Record<string, unknown> | undefined)?.amountInUSD as number | undefined;
    if (quoteUsd) return quoteUsd;
    if (tokenInPriceUSD && amountIn && parseFloat(amountIn) > 0) {
      return tokenInPriceUSD * parseFloat(amountIn);
    }
    return null;
  }, [quote?.data, tokenInPriceUSD, amountIn]);

  const amountOutUsd = useMemo(() => {
    const quoteUsd = (quote?.data as Record<string, unknown> | undefined)?.amountOutUSD as number | undefined;
    if (quoteUsd) return quoteUsd;
    if (tokenOutPriceUSD && amountOut && parseFloat(amountOut) > 0) {
      return tokenOutPriceUSD * parseFloat(amountOut);
    }
    return null;
  }, [quote?.data, tokenOutPriceUSD, amountOut]);

  const buttonState = useMemo(() => {
    if (!isConnected) return { text: 'Connect Wallet', disabled: false, action: 'connect' as const };
    if (!tokenIn || !tokenOut) return { text: 'Select a token', disabled: true, action: 'none' as const };
    if (!amountIn || parseFloat(amountIn) <= 0) return { text: 'Enter an amount', disabled: true, action: 'none' as const };
    if (isQuoteLoading && !quote) return { text: 'Fetching quote...', disabled: true, action: 'none' as const };
    if (quoteError) return { text: quoteError, disabled: true, action: 'none' as const };
    if (isSwapping) return { text: 'Confirming...', disabled: true, action: 'none' as const };
    if (!quote) return { text: 'Swap', disabled: true, action: 'none' as const };
    return { text: 'Swap', disabled: false, action: 'swap' as const };
  }, [isConnected, tokenIn, tokenOut, amountIn, isQuoteLoading, quoteError, isSwapping, quote]);

  const handleButtonClick = useCallback(async () => {
    if (buttonState.action === 'connect') {
      connect();
      return;
    }
    if (buttonState.action !== 'swap' || !quote || !tokenIn) return;

    try {
      setSwapping(true);
      await signAndSendTransaction(
        quote as SwapQuoteResponse & { data: NonNullable<SwapQuoteResponse['data']> },
        chainId
      );

      // Re-fetch wallet portfolio after successful swap (delay for chain settlement)
      setTimeout(() => {
        fetchWalletPortfolio();
      }, 2000);
    } catch {
      // Error toast already handled by useSwapTransaction
    } finally {
      setSwapping(false);
    }
  }, [buttonState, quote, tokenIn, chainId, signAndSendTransaction, connect, setSwapping, fetchWalletPortfolio]);

  return (
    <>
      <div className="w-full max-w-[560px]">
        {/* Main Swap Card */}
        <div className="bg-bgSecondary rounded-2xl border border-borderDefault shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-2">
            <h2 className="text-lg font-bold text-textPrimary">Swap</h2>
            <div className="flex items-center gap-2">
              {isRefreshing && (
                <RefreshCw size={14} className="text-textTertiary animate-spin" />
              )}
              <SwapSettings />
            </div>
          </div>

          {/* Token In */}
          <TokenInput mode="from" balance={tokenInBalance} usdValue={amountInUsd} />

          {/* Swap Direction Button */}
          <div className="flex justify-center -my-3 relative z-10">
            <button
              onClick={swapTokens}
              className="w-10 h-10 rounded-full bg-bgTertiary border-[3px] border-bgSecondary flex items-center justify-center group transition-all hover:rotate-180 duration-300 hover:bg-bgHighlight"
              aria-label="Swap direction"
            >
              <ArrowDownUp
                size={16}
                className="text-textTertiary group-hover:text-success transition-colors"
              />
            </button>
          </div>

          {/* Token Out */}
          <TokenInput mode="to" balance={tokenOutBalance} usdValue={amountOutUsd} />

          {/* Swap Button */}
          <div className="px-5 pb-5 pt-3">
            <button
              onClick={handleButtonClick}
              disabled={buttonState.disabled}
              className={`w-full py-4 rounded-xl text-base font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                buttonState.disabled
                  ? 'bg-bgTertiary text-textTertiary cursor-not-allowed'
                  : buttonState.action === 'connect'
                  ? 'bg-success text-white hover:brightness-110 active:scale-[0.98] shadow-lg shadow-success/25'
                  : 'bg-success text-white hover:brightness-110 active:scale-[0.98] shadow-lg shadow-success/25'
              }`}
            >
              {isSwapping && <Loader2 size={18} className="animate-spin" />}
              {buttonState.text}
            </button>
          </div>

          {/* Route Info */}
          <SwapRouteInfo />
        </div>

        {/* Token Data Below Card */}
        <TokenDataSection />

        {/* Footer */}
        <div className="mt-4 px-1">
          <div className="flex items-center justify-between text-[11px] text-textTertiary">
            <span>Powered by Hawk</span>
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isRefreshing ? 'bg-warning' : 'bg-success'} animate-pulse`} />
              {isRefreshing ? 'Updating...' : 'Live'}
            </span>
          </div>
        </div>
      </div>

      <TokenPickerModal />
    </>
  );
}
