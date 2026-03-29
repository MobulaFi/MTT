import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Edit2, Check, ChevronDown } from 'lucide-react';
import { useTradingPanelStore } from '@/store/useTradingPanelStore';
import type { OwnedToken } from '@/store/useTradingPanelStore';
import { useShallow } from 'zustand/react/shallow';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useSwapQuoteStore } from '@/store/useSwapQuoteStore';
import { useTradingDataStore } from '@/store/useTradingDataStore';
import { useUserPortfolioStore } from '@/store/useUserPortfolioStore';
import { sdk } from '@/lib/sdkClient';
import { useWalletPosition } from '@/hooks/useWalletPosition';
import { useSwapTransaction } from '@/hooks/trading/useSwapTransaction';
import { toast } from 'sonner';
import { formatPureNumber } from '@mobula_labs/sdk';
import { extractChainFromPath } from '@/hooks/useAutoSwitchNetwork';
import { usePathname } from 'next/navigation';
import type { SwapQuoteResponse } from '@/types/swap';

import { NATIVE_TOKEN_ADDRESS, SOLANA_NATIVE_ADDRESS, isNativeAddress } from '@/lib/tokens';
import { fmtUsd, fmtBalance } from '@/lib/format';
import { fetchSolanaTokenBalance } from '@/lib/solanaBalance';

const BACKGROUND_POLL_MS = 1_000;
const QUOTE_FRESHNESS_MS = 1_000;

function fmtPnl(v: number): string {
  return `${v >= 0 ? '+' : ''}${fmtUsd(v)}`;
}

function pnlPct(pnl: number, cost: number): string {
  if (!cost || cost === 0) return '';
  const pct = (pnl / cost) * 100;
  return `(${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`;
}

function TokenLogo({ src, symbol, size = 20 }: { src: string | null; symbol: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div
        className="rounded-full bg-gradient-to-br from-textTertiary/30 to-textTertiary/10 flex items-center justify-center text-textTertiary font-mono font-bold shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {symbol.charAt(0)}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={symbol}
      width={size}
      height={size}
      className="rounded-full shrink-0 object-cover"
      style={{ width: size, height: size }}
      onError={() => setErr(true)}
    />
  );
}

/* ─── Currency Selector Dropdown ─── */
function CurrencySelector({
  selectedToken,
  nativeSymbol,
  ownedTokens,
  onSelect,
  disabled,
}: {
  selectedToken: OwnedToken | null;
  nativeSymbol: string;
  ownedTokens: OwnedToken[];
  onSelect: (token: OwnedToken | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const displaySymbol = selectedToken?.symbol || nativeSymbol;
  const displayLogo = selectedToken?.logo ?? null;

  const nonNativeTokens = ownedTokens.filter((t) => !isNativeAddress(t.address));
  const nativeToken = ownedTokens.find((t) => isNativeAddress(t.address));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-1 px-1.5 h-6 rounded bg-bgTertiary/60 hover:bg-bgTertiary border border-borderDefault/50 transition-all group disabled:opacity-50"
      >
        <TokenLogo src={displayLogo} symbol={displaySymbol} size={14} />
        <span className="text-[10px] font-mono font-semibold text-textSecondary max-w-[48px] truncate">
          {displaySymbol}
        </span>
        {!disabled && (
          <ChevronDown
            size={10}
            className={`text-textTertiary transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {open && (
        <div
          className="fixed w-64 max-h-72 overflow-y-auto rounded-lg border border-borderDefault bg-bgPrimary shadow-2xl shadow-black/60 animate-in fade-in-0 zoom-in-95 duration-150"
          style={{
            zIndex: 99999,
            top: ref.current ? ref.current.getBoundingClientRect().bottom + 4 : 0,
            left: ref.current
              ? Math.min(
                  ref.current.getBoundingClientRect().right - 256,
                  window.innerWidth - 270
                )
              : 0,
          }}
        >
          <div className="p-1.5 space-y-0.5">
            {/* Native token */}
            <button
              onClick={() => { onSelect(null); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors ${
                !selectedToken
                  ? 'bg-success/8 ring-1 ring-success/20'
                  : 'hover:bg-bgTertiary/80'
              }`}
            >
              <TokenLogo src={nativeToken?.logo ?? null} symbol={nativeSymbol} size={24} />
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-mono font-bold text-textPrimary">{nativeSymbol}</span>
                  <span className="text-[9px] text-textTertiary font-mono px-1 py-0.5 rounded bg-bgTertiary/50">NATIVE</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-textSecondary font-mono">{fmtBalance(nativeToken?.balance ?? 0)}</span>
                  <span className="text-[10px] text-textTertiary font-mono">{fmtUsd(nativeToken?.balanceUSD ?? 0)}</span>
                </div>
              </div>
              {!selectedToken && <Check size={14} className="text-success shrink-0" />}
            </button>

            {nonNativeTokens.length > 0 && (
              <div className="h-px bg-borderDefault/30 mx-2 my-1" />
            )}

            {nonNativeTokens.map((token) => {
              const isSelected = selectedToken?.address.toLowerCase() === token.address.toLowerCase();
              return (
                <button
                  key={`${token.blockchain}:${token.address}`}
                  onClick={() => { onSelect(token); setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors ${
                    isSelected
                      ? 'bg-success/8 ring-1 ring-success/20'
                      : 'hover:bg-bgTertiary/80'
                  }`}
                >
                  <TokenLogo src={token.logo} symbol={token.symbol} size={24} />
                  <div className="flex-1 text-left min-w-0">
                    <span className="text-[12px] font-mono font-bold text-textPrimary block truncate">{token.symbol}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-textSecondary font-mono">{fmtBalance(token.balance)}</span>
                      <span className="text-[10px] text-textTertiary font-mono">{fmtUsd(token.balanceUSD)}</span>
                    </div>
                  </div>
                  {isSelected && <Check size={14} className="text-success shrink-0" />}
                </button>
              );
            })}

            {nonNativeTokens.length === 0 && (
              <div className="px-2 py-4 text-center text-[10px] text-textTertiary font-mono">
                No other tokens in wallet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const ProTab = () => {
  // Only subscribe to state values used for rendering — skip UI state (isMinimized, etc.)
  const {
    tradingMode, buyAmount, customBuyAmounts, customSellPercentages,
    slippage, buyBalance, sellBalance, isSellBalanceEstimated, positionStats,
    tradingCurrency, ownedTokens,
  } = useTradingPanelStore(useShallow((s) => ({
    tradingMode: s.tradingMode,
    buyAmount: s.buyAmount,
    customBuyAmounts: s.customBuyAmounts,
    customSellPercentages: s.customSellPercentages,
    slippage: s.slippage,
    buyBalance: s.buyBalance,
    sellBalance: s.sellBalance,
    isSellBalanceEstimated: s.isSellBalanceEstimated,
    positionStats: s.positionStats,
    tradingCurrency: s.tradingCurrency,
    ownedTokens: s.ownedTokens,
  })));
  // Actions via getState() — stable references, no re-renders
  const tradingActions = useTradingPanelStore.getState;

  const { isConnected, address, evmAddress, solanaAddress, connect } = useWalletConnection();
  const { setLoading, setError } = useSwapQuoteStore();
  const { baseToken } = useTradingDataStore();
  const pathname = usePathname();

  const tokenChain = baseToken?.blockchain ?? null;
  const tokenChainLower = tokenChain?.toLowerCase() ?? '';
  const isTokenOnSolana = tokenChainLower.startsWith('solana');
  const isTokenOnEvm = !isTokenOnSolana && tokenChainLower !== '';

  const swapWalletAddress = useMemo(() => {
    if (isTokenOnSolana) return solanaAddress || null;
    if (isTokenOnEvm) return evmAddress || null;
    // Fallback: try URL, then default to evmAddress (EVM is more common for this fallback)
    const urlChain = pathname ? extractChainFromPath(pathname) : null;
    if (urlChain?.toLowerCase().startsWith('solana')) return solanaAddress || null;
    return evmAddress || solanaAddress || null;
  }, [isTokenOnSolana, isTokenOnEvm, solanaAddress, evmAddress, pathname]);

  const { signAndSendTransaction } = useSwapTransaction();
  useWalletPosition();

  const nativeSymbol = isTokenOnSolana ? 'SOL' : 'ETH';
  const tokenSymbol = baseToken?.symbol || '???';
  const currencySymbol = tradingCurrency?.symbol || nativeSymbol;
  const currencyAddress = tradingCurrency?.address || (isTokenOnSolana ? SOLANA_NATIVE_ADDRESS : NATIVE_TOKEN_ADDRESS);
  const currencyPrice = tradingCurrency?.priceUSD || ownedTokens.find((t) => isNativeAddress(t.address))?.priceUSD || 0;

  const walletBalance = tradingMode === 'buy' ? buyBalance : sellBalance;

  const handleCurrencySelect = useCallback((token: OwnedToken | null) => {
    tradingActions().setTradingCurrency(token);
    if (token) {
      tradingActions().setBuyBalance(token.balance.toString());
    }
  }, []);

  // Auto-switch to sell+100% if user has a balance, or buy with default amount
  const autoSwitchedRef = useRef(false);
  const prevBaseTokenRef = useRef<string | null>(null);
  const autoSwitchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // When token changes: reset state and immediately decide buy/sell from portfolio
  useEffect(() => {
    const key = baseToken?.address ?? null;
    if (key === prevBaseTokenRef.current) return;
    prevBaseTokenRef.current = key;
    autoSwitchedRef.current = false;

    // Reset sell balance and positionStats for new token
    tradingActions().setSellBalance('0');
    tradingActions().setPositionStats(null);
    if (autoSwitchTimerRef.current) clearTimeout(autoSwitchTimerRef.current);

    if (!key) return;

    // Immediately check portfolio for this token's balance — no WSS wait
    const portfolioPositions = useUserPortfolioStore.getState().positions;
    const pos = portfolioPositions.find(
      (p) => p.address.toLowerCase() === key.toLowerCase(),
    );

    if (pos && pos.balance > 0) {
      autoSwitchedRef.current = true;
      tradingActions().setSellBalance(pos.balance.toString());
      tradingActions().setTradingMode('sell');
      tradingActions().setBuyAmount(pos.balance.toString());
      return;
    }

    if (!isConnected) {
      // Not connected → buy mode immediately
      autoSwitchedRef.current = true;
      tradingActions().setTradingMode('buy');
      if (customBuyAmounts.length > 0) {
        tradingActions().setBuyAmount(`${Math.min(...customBuyAmounts)}`);
      }
      return;
    }

    // Portfolio says 0 — but WSS might know better (newly bought token not yet indexed).
    // Short 500ms grace period, then default to buy.
    autoSwitchTimerRef.current = setTimeout(() => {
      if (autoSwitchedRef.current) return;
      autoSwitchedRef.current = true;
      tradingActions().setTradingMode('buy');
      if (customBuyAmounts.length > 0) {
        tradingActions().setBuyAmount(`${Math.min(...customBuyAmounts)}`);
      }
    }, 500);

    return () => { if (autoSwitchTimerRef.current) clearTimeout(autoSwitchTimerRef.current); };
  }, [baseToken?.address, isConnected, customBuyAmounts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Secondary: if WSS/portfolio updates sellBalance after initial check, reconsider
  useEffect(() => {
    if (autoSwitchedRef.current || !baseToken) return;

    const bal = parseFloat(sellBalance || '0');
    if (bal > 0) {
      autoSwitchedRef.current = true;
      if (autoSwitchTimerRef.current) clearTimeout(autoSwitchTimerRef.current);
      tradingActions().setTradingMode('sell');
      tradingActions().setBuyAmount(bal.toString());
    }
  }, [sellBalance, baseToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const [isEditingSize, setIsEditingSize] = useState(false);
  const [tempSizeValue, setTempSizeValue] = useState(buyAmount.replace('$', ''));
  const [isEditingAmounts, setIsEditingAmounts] = useState(false);
  const [tempAmountValues, setTempAmountValues] = useState<{ [key: number]: string }>({});

  const cachedQuoteRef = useRef<{ response: SwapQuoteResponse; receivedAt: number } | null>(null);
  const hoverPromiseRef = useRef<Promise<SwapQuoteResponse | null> | null>(null);
  const isFetchingRef = useRef(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const latestParamsRef = useRef({ baseToken, tradingMode, buyAmount, slippage, swapWalletAddress, currencyAddress, currencyPrice });
  latestParamsRef.current = { baseToken, tradingMode, buyAmount, slippage, swapWalletAddress, currencyAddress, currencyPrice };

  const [quoteAmountUsd, setQuoteAmountUsd] = useState<number | null>(null);

  const computeQuoteUsd = useCallback((data: SwapQuoteResponse['data']): number | null => {
    if (!data) return null;
    // Use the USD value returned by the quoting endpoint (server-side enrichment).
    // This is stable — no client-side price × amount multiplication that oscillates
    // with live WSS price updates.
    const d = data as Record<string, unknown>;
    const outUsd = d.amountOutUSD as number | undefined;
    if (outUsd && outUsd > 0) return outUsd;
    const inUsd = d.amountInUSD as number | undefined;
    if (inUsd && inUsd > 0) return inUsd;
    return null;
  }, []);

  const fetchQuote = useCallback(async (): Promise<SwapQuoteResponse | null> => {
    const { baseToken: bt, tradingMode: tm, buyAmount: ba, slippage: sl, swapWalletAddress: wa, currencyAddress: ca, currencyPrice: cp } = latestParamsRef.current;
    if (!bt || !wa) return null;
    const av = ba.replace('$', '').replace('%', '');
    if (!av || parseFloat(av) <= 0) return null;
    let amount = parseFloat(av);
    // Buy mode: input is USD, convert to currency amount
    if (tm === 'buy' && cp > 0) {
      amount = amount / cp;
    }
    try {
      const resp = await sdk.fetchSwapQuote({
        chainId: bt.blockchain,
        tokenIn: tm === 'buy' ? ca : bt.address,
        tokenOut: tm === 'buy' ? bt.address : ca,
        amount: String(amount) as unknown as number,
        walletAddress: wa,
        slippage: sl as unknown as number,
      }) as SwapQuoteResponse;
      if (resp?.data) {
        cachedQuoteRef.current = { response: resp, receivedAt: Date.now() };
        setQuoteAmountUsd(computeQuoteUsd(resp.data));
      }
      return resp;
    } catch { return null; }
  }, [computeQuoteUsd]);

  // Invalidate cached quote when params change — keep old USD value visible until new quote arrives (no blink)
  useEffect(() => { cachedQuoteRef.current = null; hoverPromiseRef.current = null; },
    [baseToken?.address, baseToken?.blockchain, tradingMode, buyAmount, slippage, swapWalletAddress, currencyAddress]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!isConnected || !baseToken || !swapWalletAddress) return;
    const av = buyAmount.replace('$', '').replace('%', '');
    if (!av || parseFloat(av) <= 0) return;
    fetchQuote();
    pollRef.current = setInterval(() => {
      if (!isFetchingRef.current) { isFetchingRef.current = true; fetchQuote().finally(() => { isFetchingRef.current = false; }); }
    }, BACKGROUND_POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isConnected, baseToken?.address, baseToken?.blockchain, swapWalletAddress, buyAmount, tradingMode, slippage, currencyAddress, fetchQuote]);

  const handleButtonHover = useCallback(() => {
    if (!isConnected || !baseToken || !swapWalletAddress) return;
    const av = buyAmount.replace('$', '').replace('%', '');
    if (!av || parseFloat(av) <= 0) return;
    hoverPromiseRef.current = fetchQuote();
  }, [isConnected, baseToken, swapWalletAddress, buyAmount, fetchQuote]);

  const calculateSellAmount = (value: string): string => {
    if (tradingMode === 'sell' && value.includes('%')) {
      const p = parseFloat(value.replace('%', ''));
      if (!isNaN(p) && p >= 0 && p <= 100) {
        const bal = parseFloat(walletBalance || '0');
        return (p >= 100 ? bal : (bal * p) / 100).toString();
      }
    }
    return value;
  };

  const handleConfirmSize = () => { tradingActions().setBuyAmount(calculateSellAmount(tempSizeValue)); setIsEditingSize(false); };

  const handleStartEditAmounts = () => {
    setIsEditingAmounts(true);
    const vals: { [k: number]: string } = {};
    (tradingMode === 'sell' ? customSellPercentages : customBuyAmounts).forEach((v, i) => { vals[i] = v.toString(); });
    setTempAmountValues(vals);
  };

  const handleConfirmAllAmounts = () => {
    const values = tradingMode === 'sell' ? customSellPercentages : customBuyAmounts;
    const nv = values.map((_, i) => { const s = tempAmountValues[i]; if (s === '' || s === undefined) return values[i]; const n = parseFloat(s); return !isNaN(n) && n >= 0 ? n : values[i]; });
    tradingMode === 'sell' ? tradingActions().setCustomSellPercentages(nv) : tradingActions().setCustomBuyAmounts(nv);
    setIsEditingAmounts(false); setTempAmountValues({});
  };

  const handleBuyOrSell = async () => {
    console.log('[Buy] handleBuyOrSell', { isConnected, address, swapWalletAddress, token: baseToken?.symbol, mode: tradingMode, amount: buyAmount });
    if (!isConnected || !address) { console.log('[Buy] Not connected'); connect(); return; }
    if (!swapWalletAddress) { toast.error('Wallet not available.'); return; }
    if (!baseToken) { setError('Token data not available.'); return; }
    const av = buyAmount.replace('$', '').replace('%', '');
    if (!av || parseFloat(av) <= 0) { setError('Enter a valid amount'); return; }
    const amountNum = parseFloat(av);
    if (tradingMode === 'buy') {
      // Fallback chain: tradingCurrency → ownedTokens (position stream) → portfolio store (REST)
      let balUsd = tradingCurrency?.balanceUSD ?? ownedTokens.find((t) => isNativeAddress(t.address))?.balanceUSD ?? 0;
      if (balUsd <= 0) {
        const portfolioTokens = useUserPortfolioStore.getState().walletTokens;
        const nativeFromPortfolio = portfolioTokens.find((t) => isNativeAddress(t.address));
        if (nativeFromPortfolio) balUsd = nativeFromPortfolio.balanceUSD;
      }
      console.log('[Buy] Balance check:', { amountNum, balUsd, currency: tradingCurrency?.symbol, ownedCount: ownedTokens.length });
      if (amountNum > balUsd * 1.001) {
        toast.error(`Insufficient balance: $${balUsd.toFixed(2)} available`);
        return;
      }
    } else {
      let effectiveBalance = parseFloat(walletBalance || '0');

      // For Solana sells: always verify on-chain balance before executing
      // The position stream balance can be estimated (RPC failed) or stale
      if (isTokenOnSolana && swapWalletAddress && baseToken.address && !isNativeAddress(baseToken.address)) {
        try {
          const onChainBalance = await fetchSolanaTokenBalance(swapWalletAddress, baseToken.address);
          if (onChainBalance !== null && onChainBalance !== effectiveBalance) {
            console.log('[Sell] On-chain balance differs from position stream', {
              positionBalance: effectiveBalance,
              onChainBalance,
              isEstimated: isSellBalanceEstimated,
            });
            effectiveBalance = onChainBalance;
            // Update the store so the UI reflects the real balance
            tradingActions().setSellBalance(onChainBalance.toString(), false);
          }
        } catch {
          // RPC check failed — proceed with position stream balance
        }
      }

      const tolerance = effectiveBalance * 1e-9;
      if (amountNum > effectiveBalance + tolerance) {
        toast.error(`Insufficient balance: ${formatPureNumber(effectiveBalance.toString())} ${tokenSymbol}`);
        return;
      }
      // If user tried to sell more than real balance (e.g. clicked 100% with stale data),
      // auto-adjust the amount down to the real balance
      if (amountNum > effectiveBalance) {
        tradingActions().setBuyAmount(effectiveBalance.toString());
      }
    }
    try {
      setLoading(true); setError(null);
      // Re-fetch quote with potentially corrected amount
      const currentAmount = parseFloat(useTradingPanelStore.getState().buyAmount.replace('$', '').replace('%', ''));
      if (currentAmount !== amountNum) {
        // Amount was adjusted — need fresh quote
        cachedQuoteRef.current = null;
      }
      let qr: SwapQuoteResponse | null = null;
      const c = cachedQuoteRef.current;
      if (c?.response?.data) qr = c.response;
      if (!qr?.data) qr = await fetchQuote();
      if (!qr?.data) throw new Error('No quote');
      console.log('[Buy] Executing swap, chain:', baseToken.blockchain, 'has solana:', !!qr.data.solana, 'has evm:', !!qr.data.evm);
      await signAndSendTransaction(qr as SwapQuoteResponse & { data: NonNullable<SwapQuoteResponse['data']> }, baseToken.blockchain, tradingMode);
    } catch (err) {
      const m = err instanceof Error ? err.message : 'Swap failed';
      console.error('[Buy] Error:', m);
      // Parse simulation errors for better UX
      if (m.includes('insufficient funds') || m.includes('"Custom":1')) {
        toast.error(`Insufficient token balance. Please refresh and try again.`);
        // Refresh balance from chain
        if (isTokenOnSolana && swapWalletAddress && baseToken.address && !isNativeAddress(baseToken.address)) {
          fetchSolanaTokenBalance(swapWalletAddress, baseToken.address).then((b) => {
            if (b !== null) tradingActions().setSellBalance(b.toString(), false);
          });
        }
      }
      setError(m);
    }
    finally { setLoading(false); }
  };

  const isBuy = tradingMode === 'buy';
  const accentHex = isBuy ? '#0ECB81' : '#EA3943';

  return (
    <div className="select-none">
      {/* ── Mode Toggle ── */}
      <div className="px-2.5 pt-2 pb-1.5">
        <div className="flex h-8 bg-bgOverlay rounded border border-borderDefault">
          <button
            onClick={() => tradingActions().setTradingMode('buy')}
            className={`flex-1 text-[11px] font-bold tracking-wide rounded-l transition-all ${
              isBuy
                ? 'bg-success/10 text-success border-b-2 border-success'
                : 'text-textTertiary hover:text-grayGhost'
            }`}
          >
            BUY
          </button>
          <div className="w-px bg-borderDefault" />
          <button
            onClick={() => tradingActions().setTradingMode('sell')}
            className={`flex-1 text-[11px] font-bold tracking-wide rounded-r transition-all ${
              !isBuy
                ? 'bg-error/10 text-error border-b-2 border-error'
                : 'text-textTertiary hover:text-grayGhost'
            }`}
          >
            SELL
          </button>
        </div>
      </div>

      {/* ── Amount Section ── */}
      <div className="px-2.5 pt-1 pb-2">
        <div className="rounded border border-borderDefault overflow-visible">
          {/* Input row */}
          <div className="flex items-center h-9 bg-bgOverlay rounded-t border-b border-borderDefault">
            <span className="px-2.5 text-textTertiary text-[10px] font-mono uppercase w-16 shrink-0 border-r border-borderDefault h-full flex items-center">
              SIZE
            </span>
            {isBuy && (
              <span className="pl-2.5 text-[13px] font-bold text-success shrink-0">$</span>
            )}
            <input
              type="text"
              value={isEditingSize ? tempSizeValue : buyAmount.replace('$', '')}
              onChange={(e) => isEditingSize ? setTempSizeValue(e.target.value) : tradingActions().setBuyAmount(e.target.value)}
              onFocus={() => { if (!isEditingSize) { setIsEditingSize(true); setTempSizeValue(buyAmount.replace('$', '')); } }}
              onBlur={() => { if (isEditingSize) handleConfirmSize(); }}
              className={`flex-1 bg-transparent ${isBuy ? 'pl-1' : 'px-2.5'} pr-2.5 text-[12px] font-mono text-textPrimary placeholder-textTertiary/50 focus:outline-none h-full`}
              placeholder={tradingMode === 'sell' ? '0.0 / 25%' : '0.00'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isEditingSize) handleConfirmSize();
                if (e.key === 'Escape') { setTempSizeValue(buyAmount.replace('$', '')); setIsEditingSize(false); }
              }}
            />
            {quoteAmountUsd && !isBuy && (
              <span className="px-1.5 text-[10px] font-mono text-textTertiary shrink-0">
                ≈{fmtUsd(quoteAmountUsd)}
              </span>
            )}
            <div className="pr-1.5 shrink-0">
              <CurrencySelector
                selectedToken={tradingMode === 'buy' ? tradingCurrency : null}
                nativeSymbol={tradingMode === 'buy' ? nativeSymbol : tokenSymbol}
                ownedTokens={tradingMode === 'buy' ? ownedTokens : []}
                onSelect={tradingMode === 'buy' ? handleCurrencySelect : () => {}}
                disabled={tradingMode === 'sell' || !isConnected}
              />
            </div>
          </div>

          {/* Preset buttons */}
          <div className="flex">
            {(tradingMode === 'sell' ? customSellPercentages : customBuyAmounts).map((value, index) => {
              const displayValue = tradingMode === 'sell' ? `${value}%` : `$${value}`;
              let isSelected = false;
              if (tradingMode === 'sell') {
                const bal = parseFloat(walletBalance || '0');
                const calc = (bal * value) / 100;
                const cur = parseFloat(buyAmount.replace('$', '').replace('%', ''));
                isSelected = !isNaN(cur) && !isNaN(calc) && Math.abs(cur - calc) < 0.01;
              } else {
                isSelected = buyAmount.replace('$', '') === `${value}`;
              }
              return (
                <div key={index} className="flex-1 border-r border-borderDefault last:border-r-0">
                  {isEditingAmounts ? (
                    <input
                      type="number" step="any"
                      value={tempAmountValues[index] ?? ''}
                      onChange={(e) => setTempAmountValues({ ...tempAmountValues, [index]: e.target.value })}
                      className="w-full bg-transparent h-8 text-[11px] font-mono text-textPrimary text-center focus:outline-none"
                      placeholder={value.toString()}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmAllAmounts(); if (e.key === 'Escape') { setIsEditingAmounts(false); setTempAmountValues({}); } }}
                    />
                  ) : (
                    <button
                      onClick={() => {
                        if (tradingMode === 'sell') {
                          const bal = parseFloat(walletBalance || '0');
                          const calc = value >= 100 ? bal : (bal * value) / 100;
                          tradingActions().setBuyAmount(calc.toString()); setTempSizeValue(calc.toString());
                        } else { tradingActions().setBuyAmount(`${value}`); setTempSizeValue(`${value}`); }
                        setIsEditingSize(false);
                      }}
                      className="w-full h-8 text-[11px] font-mono transition-all bg-bgPrimary text-textTertiary hover:bg-bgTertiary hover:text-grayGhost"
                      style={isSelected ? { color: accentHex, backgroundColor: `${accentHex}12`, fontWeight: 700 } : undefined}
                    >
                      {displayValue}
                    </button>
                  )}
                </div>
              );
            })}
            <button
              onClick={() => isEditingAmounts ? handleConfirmAllAmounts() : handleStartEditAmounts()}
              className="w-9 h-8 flex items-center justify-center bg-bgPrimary text-textTertiary hover:bg-bgTertiary hover:text-grayGhost transition-all shrink-0"
            >
              {isEditingAmounts ? <Check size={12} /> : <Edit2 size={12} />}
            </button>
          </div>
        </div>

        {/* Balance row */}
        {isConnected && (
          <div className="flex items-center justify-between mt-2 px-0.5">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${!isBuy && isSellBalanceEstimated ? 'bg-warning' : 'bg-success'} animate-pulse`} />
              <span className="text-textTertiary text-[10px] font-mono">
                {isBuy ? (
                  <>{fmtUsd(tradingCurrency?.balanceUSD ?? ownedTokens.find((t) => isNativeAddress(t.address))?.balanceUSD ?? useUserPortfolioStore.getState().walletTokens.find((t) => isNativeAddress(t.address))?.balanceUSD ?? 0)} <span className="text-textTertiary/60">({formatPureNumber(walletBalance)} {currencySymbol})</span></>
                ) : (
                  <>{formatPureNumber(walletBalance)} {tokenSymbol}{isSellBalanceEstimated ? <span className="text-warning/80 ml-1" title="Balance estimated from trade history — actual on-chain balance will be verified before sell">~</span> : null}</>
                )}
              </span>
            </div>
            {walletBalance && parseFloat(walletBalance) > 0 && (
              <button
                onClick={() => {
                  if (isBuy) {
                    let balUsd = tradingCurrency?.balanceUSD ?? ownedTokens.find((t) => isNativeAddress(t.address))?.balanceUSD ?? 0;
                    if (balUsd <= 0) {
                      balUsd = useUserPortfolioStore.getState().walletTokens.find((t) => isNativeAddress(t.address))?.balanceUSD ?? 0;
                    }
                    tradingActions().setBuyAmount(balUsd.toFixed(2));
                  } else {
                    tradingActions().setBuyAmount(walletBalance);
                  }
                }}
                className="text-[9px] font-mono font-bold tracking-wider text-textTertiary hover:text-success transition-colors"
              >
                MAX
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Execute Button ── */}
      <div className="px-2.5 pb-2">
        {!isConnected ? (
          <button
            onClick={() => connect()}
            className="w-full h-10 rounded border border-success/30 bg-success/5 text-success text-[11px] font-bold tracking-wider hover:bg-success/10 transition-all"
          >
            CONNECT WALLET
          </button>
        ) : (
          <button
            onClick={handleBuyOrSell}
            onMouseEnter={handleButtonHover}
            className="w-full h-11 rounded font-bold text-[12px] tracking-wide transition-all active:scale-[0.98] text-bgPrimary"
            style={{
              backgroundColor: accentHex,
              boxShadow: `0 0 20px ${accentHex}25, 0 2px 8px ${accentHex}15`,
            }}
          >
            <span className="flex items-center justify-center gap-1.5">
              <span>{isBuy ? 'BUY' : 'SELL'} {tokenSymbol.toUpperCase()}</span>
              {quoteAmountUsd && (
                <span className="opacity-70 font-normal text-[11px]">
                  {fmtUsd(quoteAmountUsd)}
                </span>
              )}
            </span>
          </button>
        )}
      </div>

      {/* ── Position Stats ── */}
      {isConnected && positionStats && (positionStats.volumeBuy > 0 || positionStats.volumeSell > 0 || positionStats.balance > 0) && (
        <div className="px-2.5 pb-2.5">
          <div className="rounded border border-borderDefault overflow-hidden">
            <div className="grid grid-cols-4 divide-x divide-borderDefault">
              {[
                { label: 'Bought', value: fmtUsd(positionStats.volumeBuy), color: 'text-success' },
                { label: 'Sold', value: fmtUsd(positionStats.volumeSell), color: 'text-error' },
                { label: 'Holding', value: fmtUsd(positionStats.amountUSD), color: 'text-textPrimary' },
                {
                  label: 'PnL',
                  value: fmtPnl(positionStats.totalPnlUSD),
                  sub: pnlPct(positionStats.totalPnlUSD, positionStats.volumeBuy),
                  color: positionStats.totalPnlUSD >= 0 ? 'text-success' : 'text-error',
                },
              ].map((col) => (
                <div key={col.label} className="bg-bgOverlay px-2 py-2.5 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-textTertiary font-mono tracking-wide">{col.label}</span>
                  <span className={`text-[14px] font-mono font-bold ${col.color}`}>{col.value}</span>
                  {'sub' in col && col.sub && (
                    <span className={`text-[11px] font-mono ${col.color} opacity-70`}>{col.sub}</span>
                  )}
                </div>
              ))}
              {/* Realized / Unrealized PnL breakdown */}
              <div className="col-span-4 flex items-center justify-center gap-4 bg-bgOverlay border-t border-borderDefault px-2 py-1.5">
                <span className="text-[10px] font-mono text-textTertiary">
                  Realized: <span className={positionStats.realizedPnlUSD >= 0 ? 'text-success' : 'text-error'}>{fmtPnl(positionStats.realizedPnlUSD)}</span>
                </span>
                <span className="text-[10px] font-mono text-textTertiary">
                  Unrealized: <span className={positionStats.unrealizedPnlUSD >= 0 ? 'text-success' : 'text-error'}>{fmtPnl(positionStats.unrealizedPnlUSD)}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
