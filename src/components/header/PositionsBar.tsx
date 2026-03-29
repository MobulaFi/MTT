'use client';

import { useRef, useCallback, useMemo, useEffect, memo, useState } from 'react';
import { useUserPortfolioStore, type UserPosition } from '@/store/useUserPortfolioStore';
import { useWalletConnectionStore } from '@/store/useWalletConnectionStore';
import { useNavigationStore } from '@/store/useNavigationStore';
import { useSwapTransaction } from '@/hooks/trading/useSwapTransaction';
import SafeImage from '@/components/SafeImage';
import { fmtUsd, fmtNum } from '@/lib/format';
import { getNativeAddress, isNativeAddress } from '@/lib/tokens';
import { sdk } from '@/lib/sdkClient';
import { useTradingPanelStore } from '@/store/useTradingPanelStore';
import { toast } from 'sonner';
import type { SwapQuoteResponse } from '@/types/swap';

function pnlColor(pnl: number): string {
  if (pnl > 0) return 'text-success';
  if (pnl < 0) return 'text-error';
  return 'text-textTertiary';
}

function pnlPct(pnl: number, cost: number): string {
  if (!cost || cost === 0) return '';
  const pct = (pnl / cost) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

type FlashDir = 'up' | 'down';

// Memoized individual position chip — only re-renders when its own data changes
const PositionChip = memo(function PositionChip({
  pos,
  flash,
  onHoverStart,
  onHoverEnd,
}: {
  pos: UserPosition;
  flash?: FlashDir;
  onHoverStart: (pos: UserPosition, el: HTMLDivElement) => void;
  onHoverEnd: () => void;
}) {
  const navigateToToken = useNavigationStore((s) => s.navigateToToken);
  const chipRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(() => {
    if (pos.blockchain && pos.address) {
      navigateToToken(pos.address, pos.blockchain, pos as unknown as Record<string, unknown>);
    }
  }, [pos, navigateToToken]);

  const handleMouseEnter = useCallback(() => {
    if (chipRef.current) onHoverStart(pos, chipRef.current);
  }, [pos, onHoverStart]);

  const pnlValue = pos.unrealizedPnlUSD;
  const pnlPercent = pnlPct(pnlValue, pos.avgBuyPriceUSD * pos.balance);

  return (
    <div
      ref={chipRef}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onHoverEnd}
      className={`relative flex items-center gap-1.5 px-2.5 py-1 shrink-0 bg-bgTertiary/40 hover:bg-bgTertiary/70 rounded-md transition-colors group border border-borderDefault/20 overflow-hidden cursor-pointer ${
        flash === 'up' ? 'pos-flash-up' : flash === 'down' ? 'pos-flash-down' : ''
      }`}
    >
      <div className="w-4 h-4 sm:w-[18px] sm:h-[18px] rounded-full overflow-hidden flex-shrink-0 bg-bgTertiary">
        {pos.logo ? (
          <SafeImage
            src={pos.logo}
            alt={pos.symbol}
            width={18}
            height={18}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-textTertiary">
            {pos.symbol.charAt(0)}
          </div>
        )}
      </div>

      <span className="text-[10px] sm:text-[11px] font-semibold text-textPrimary whitespace-nowrap">
        {pos.symbol}
      </span>

      <span className="text-[10px] sm:text-[11px] font-medium text-textSecondary whitespace-nowrap">
        {fmtUsd(pos.balanceUSD)}
      </span>

      {pnlValue !== 0 && (
        <span className={`text-[9px] sm:text-[10px] font-medium whitespace-nowrap ${pnlColor(pnlValue)}`}>
          {pnlPercent || `${pnlValue > 0 ? '+' : ''}${fmtUsd(pnlValue)}`}
        </span>
      )}

      {pos.marketCap > 0 && (
        <span className="text-[8px] sm:text-[9px] text-textTertiary/60 whitespace-nowrap hidden group-hover:inline">
          MC {fmtNum(pos.marketCap)}
        </span>
      )}
    </div>
  );
});

/* ─── Quick Sell Popup ─── */
type SellState = 'idle' | 'quoting' | 'signing' | 'error';

function QuickSellPopup({
  pos,
  rect,
  onSell,
  sellState,
  activePercent,
  onMouseEnter,
  onMouseLeave,
}: {
  pos: UserPosition;
  rect: DOMRect;
  onSell: (pos: UserPosition, pct: number) => void;
  sellState: SellState;
  activePercent: number | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const percentages = [25, 50, 100];
  const isProcessing = sellState === 'quoting' || sellState === 'signing';

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-[99999] animate-in fade-in-0 zoom-in-95 duration-100"
      style={{
        top: rect.bottom + 4,
        left: Math.max(4, Math.min(rect.left, window.innerWidth - 180)),
      }}
    >
      <div className="bg-bgPrimary border border-borderDefault rounded-lg shadow-2xl shadow-black/60 p-1.5 min-w-[160px]">
        <div className="flex items-center gap-1.5 px-1.5 py-1 mb-1">
          <span className="text-[10px] font-mono font-bold text-textPrimary">{pos.symbol}</span>
          <span className="text-[9px] font-mono text-textTertiary">{fmtUsd(pos.balanceUSD)}</span>
        </div>
        <div className="flex gap-1">
          {percentages.map((pct) => {
            const isActive = activePercent === pct && isProcessing;
            return (
              <button
                key={pct}
                disabled={isProcessing}
                onClick={(e) => {
                  e.stopPropagation();
                  onSell(pos, pct);
                }}
                className={`flex-1 h-7 rounded text-[11px] font-bold font-mono transition-all border ${
                  isActive
                    ? 'bg-error/20 border-error/40 text-error'
                    : 'bg-error/5 border-error/15 text-error/80 hover:bg-error/15 hover:border-error/30 hover:text-error'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {isActive && sellState === 'quoting' ? '...' : isActive && sellState === 'signing' ? '✓' : `${pct}%`}
              </button>
            );
          })}
        </div>
        {sellState === 'error' && (
          <div className="text-[9px] text-error/70 font-mono px-1.5 pt-1">Failed — try again</div>
        )}
      </div>
    </div>
  );
}

export function PositionsBar() {
  const isEvmConnected = useWalletConnectionStore((s) => s.isEvmConnected);
  const isSolanaConnected = useWalletConnectionStore((s) => s.isSolanaConnected);
  const evmAddress = useWalletConnectionStore((s) => s.evmAddress);
  const solanaAddress = useWalletConnectionStore((s) => s.solanaAddress);
  const isConnected = isEvmConnected || isSolanaConnected;
  const positions = useUserPortfolioStore((s) => s.positions);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { signAndSendTransaction } = useSwapTransaction();

  // Hover popup state
  const [hoveredPos, setHoveredPos] = useState<UserPosition | null>(null);
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const [sellState, setSellState] = useState<SellState>('idle');
  const [activePercent, setActivePercent] = useState<number | null>(null);
  const isOverPopupRef = useRef(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearHoverTimeout = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const handleHoverStart = useCallback((pos: UserPosition, el: HTMLDivElement) => {
    if (isNativeAddress(pos.address)) return;
    clearHoverTimeout();
    setHoveredPos(pos);
    setHoveredRect(el.getBoundingClientRect());
    setSellState('idle');
    setActivePercent(null);
  }, [clearHoverTimeout]);

  const handleHoverEnd = useCallback(() => {
    clearHoverTimeout();
    hoverTimeoutRef.current = setTimeout(() => {
      if (!isOverPopupRef.current) {
        setHoveredPos(null);
        setHoveredRect(null);
        setSellState('idle');
        setActivePercent(null);
      }
    }, 150);
  }, [clearHoverTimeout]);

  const handlePopupMouseEnter = useCallback(() => {
    isOverPopupRef.current = true;
    clearHoverTimeout();
  }, [clearHoverTimeout]);

  const handlePopupMouseLeave = useCallback(() => {
    isOverPopupRef.current = false;
    handleHoverEnd();
  }, [handleHoverEnd]);

  const handleQuickSell = useCallback(async (pos: UserPosition, pct: number) => {
    const isSolana = pos.blockchain?.toLowerCase().startsWith('solana') || pos.chainId?.toLowerCase().includes('solana');
    const walletAddress = isSolana ? solanaAddress : evmAddress;
    if (!walletAddress) {
      toast.error('Wallet not connected for this chain');
      return;
    }

    const sellAmount = pct >= 100 ? pos.balance : (pos.balance * pct) / 100;
    if (sellAmount <= 0) return;

    const nativeAddress = getNativeAddress(pos.blockchain);

    setSellState('quoting');
    setActivePercent(pct);

    try {
      const resp = await sdk.fetchSwapQuote({
        chainId: pos.chainId,
        tokenIn: pos.address,
        tokenOut: nativeAddress,
        amount: String(sellAmount) as unknown as number,
        walletAddress,
        slippage: 1 as unknown as number,
      }) as SwapQuoteResponse;

      if (!resp?.data) {
        throw new Error('No quote returned');
      }

      setSellState('signing');
      // Set the sell amount in the store so PnL computation uses the correct token amount
      useTradingPanelStore.getState().setBuyAmount(String(sellAmount));
      await signAndSendTransaction(
        resp as SwapQuoteResponse & { data: NonNullable<SwapQuoteResponse['data']> },
        pos.chainId,
        'sell',
      );

      setSellState('idle');
      setHoveredPos(null);
      setHoveredRect(null);
    } catch (err) {
      console.error('[QuickSell] Error:', err);
      setSellState('error');
      setTimeout(() => setSellState('idle'), 2000);
    }
  }, [evmAddress, solanaAddress, signAndSendTransaction]);

  // Track previous balanceUSD and active flashes via refs — no state churn
  const prevValuesRef = useRef<Map<string, number>>(new Map());
  const flashesRef = useRef<Map<string, FlashDir>>(new Map());
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollRef.current) {
      e.preventDefault();
      scrollRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  // Filter out dust positions (< $0.01), but always show native tokens (SOL/ETH)
  const visiblePositions = useMemo(
    () => positions.filter((p) => p.balanceUSD >= 0.01 || isNativeAddress(p.address)),
    [positions],
  );

  // Detect value changes and trigger flash via DOM class manipulation — zero React state
  // Cache DOM refs to avoid querySelector on every update
  const elRefsRef = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    const prev = prevValuesRef.current;
    const flashes = flashesRef.current;
    const elRefs = elRefsRef.current;

    for (const pos of visiblePositions) {
      const key = `${pos.address}_${pos.chainId}`;
      const oldVal = prev.get(key);
      // Only flash on meaningful changes (>1% AND >$0.01) — ignore micro-fluctuations from WSS
      const delta = oldVal !== undefined ? Math.abs(pos.balanceUSD - oldVal) : 0;
      const pctChange = oldVal && oldVal > 0 ? delta / oldVal : 0;
      if (oldVal !== undefined && delta > 0.01 && pctChange > 0.01) {
        const dir: FlashDir = pos.balanceUSD > oldVal ? 'up' : 'down';

        // Use cached ref, fallback to querySelector once
        let el = elRefs.get(key);
        if (!el || !el.isConnected) {
          el = document.querySelector(`[data-pos-key="${key}"]`) as HTMLElement | undefined;
          if (el) elRefs.set(key, el);
        }
        if (el) {
          el.classList.remove('pos-flash-up', 'pos-flash-down');
          void el.offsetWidth; // restart animation
          el.classList.add(dir === 'up' ? 'pos-flash-up' : 'pos-flash-down');
        }

        const existing = timersRef.current.get(key);
        if (existing) clearTimeout(existing);
        timersRef.current.set(
          key,
          setTimeout(() => {
            const cached = elRefs.get(key);
            if (cached?.isConnected) {
              cached.classList.remove('pos-flash-up', 'pos-flash-down');
            }
            flashes.delete(key);
            timersRef.current.delete(key);
          }, 700),
        );

        flashes.set(key, dir);
      }
      prev.set(key, pos.balanceUSD);
    }
  }, [visiblePositions]);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
    };
  }, []);

  if (!isConnected || visiblePositions.length === 0) {
    return (
      <div className="bg-bgOverlay h-6 sm:h-7 border-b border-borderDefault" />
    );
  }

  return (
    <>
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="bg-bgOverlay h-8 sm:h-9 border-b border-borderDefault flex items-center gap-1.5 px-4 sm:px-6 lg:px-8 overflow-x-auto scrollbar-hide"
      >
        {visiblePositions.map((pos) => {
          const key = `${pos.address}_${pos.chainId}`;
          return (
            <div key={key} data-pos-key={key} className="contents">
              <PositionChip
                pos={pos}
                onHoverStart={handleHoverStart}
                onHoverEnd={handleHoverEnd}
              />
            </div>
          );
        })}

        {/* Pulse animations */}
        <style jsx>{`
          @keyframes flashUp {
            0% { box-shadow: inset 0 0 0 0 rgba(34, 197, 94, 0); border-color: rgba(34, 197, 94, 0); }
            20% { box-shadow: inset 0 0 12px 2px rgba(34, 197, 94, 0.25); border-color: rgba(34, 197, 94, 0.5); }
            100% { box-shadow: inset 0 0 0 0 rgba(34, 197, 94, 0); border-color: rgba(255, 255, 255, 0.05); }
          }
          @keyframes flashDown {
            0% { box-shadow: inset 0 0 0 0 rgba(239, 68, 68, 0); border-color: rgba(239, 68, 68, 0); }
            20% { box-shadow: inset 0 0 12px 2px rgba(239, 68, 68, 0.25); border-color: rgba(239, 68, 68, 0.5); }
            100% { box-shadow: inset 0 0 0 0 rgba(239, 68, 68, 0); border-color: rgba(255, 255, 255, 0.05); }
          }
          :global(.pos-flash-up) {
            animation: flashUp 700ms ease-out forwards;
          }
          :global(.pos-flash-down) {
            animation: flashDown 700ms ease-out forwards;
          }
        `}</style>
      </div>

      {/* Quick sell popup on hover */}
      {hoveredPos && hoveredRect && (
        <QuickSellPopup
          pos={hoveredPos}
          rect={hoveredRect}
          onSell={handleQuickSell}
          sellState={sellState}
          activePercent={activePercent}
          onMouseEnter={handlePopupMouseEnter}
          onMouseLeave={handlePopupMouseLeave}
        />
      )}
    </>
  );
}
