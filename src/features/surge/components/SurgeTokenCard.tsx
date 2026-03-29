'use client';

import { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { Zap } from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import { formatCryptoPrice, formatPureNumber } from '@mobula_labs/sdk';
import { toast } from 'sonner';
import type { SwapQuotingResponse } from '@mobula_labs/types';
import type { SurgeToken } from '../store/useSurgeStore';
import { useNavigationStore } from '@/store/useNavigationStore';
import { useSurgeStore } from '../store/useSurgeStore';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useSwapTransaction, makeSwapToast } from '@/hooks/trading/useSwapTransaction';
import { useUserPortfolioStore } from '@/store/useUserPortfolioStore';
import { NATIVE_TOKEN_ADDRESS, type WalletToken } from '@/lib/tokens';
import { fmtUsdCrypto, timeAgo, toBlockchain, getMcColor } from '@/lib/format';
import MiniCandlestickChart from './MiniCandlestickChart';
import { getQuote, fetchQuote as fetchQuoteNow } from '../hooks/surgeQuotes';

/* ── Palette ── */
const C = {
  bg:     '#0A0A0D',
  card:   '#0C0C10',
  border: '#141418',
  hover:  '#111116',
  green:  '#00DC82',
  red:    '#FF4757',
  yellow: '#F0B90B',
  gold:   '#D4A843',
  silver: '#A8B0BC',
  bronze: '#C47A3A',
  label:  '#3E3E46',
  muted:  '#2A2A30',
  dim:    '#6A6A74',
  white:  '#EAEAEE',
  link:   '#5A5A64',
} as const;

const mono = 'var(--font-mono, monospace)';

/* ── Helpers ── */
function pct(v: number): string {
  return `${Math.abs(v) >= 1000 ? Math.round(Math.abs(v)) : Math.abs(v).toFixed(0)}%`;
}

function holdingColor(value: number, threshold: number): string {
  if (value === 0) return C.label;
  return value > threshold ? C.red : C.green;
}

/* ── Card ── */
function SurgeTokenCard({ token, rank = 0 }: { token: SurgeToken; rank?: number }) {
  const navigateToToken = useNavigationStore((s) => s.navigateToToken);
  const quickBuyAmount = useSurgeStore((s) => s.quickBuyAmount);
  const quickSellPercentage = useSurgeStore((s) => s.quickSellPercentage);
  const buyCurrencyAddress = useSurgeStore((s) => s.buyCurrencyAddress);
  const walletTokens = useSurgeStore((s) => s.walletTokens);
  const slippage = useSurgeStore((s) => s.slippage);
  const { isConnected, solanaAddress, evmAddress, connect } = useWalletConnection();
  const { signAndSendTransaction } = useSwapTransaction();

  const [swapping, setSwapping] = useState(false);
  const [hovered, setHovered] = useState(false);
  const walletAddress = solanaAddress || evmAddress || null;

  const position = useSurgeStore((s) => token.address ? s.positions[token.address.toLowerCase()] : undefined);
  const holdingBalance = position?.balance ?? 0;
  const holdingUSD = position?.amountUSD ?? 0;
  const unrealizedPnl = position?.unrealizedPnlUSD ?? 0;

  const tokenInfo = useMemo(() => {
    const selected: WalletToken | undefined = buyCurrencyAddress === null
      ? walletTokens.find((t) => t.isNative)
      : walletTokens.find((t) => t.address === buyCurrencyAddress);
    const t = selected || walletTokens[0];
    if (!t) return { quoteToken: NATIVE_TOKEN_ADDRESS, balance: 0, balanceUSD: 0, price: 0 };
    return {
      quoteToken: t.address,
      balance: t.balance,
      balanceUSD: t.balanceUSD,
      price: t.priceUSD,
    };
  }, [walletTokens, buyCurrencyAddress]);

  /* ── Quote helper (reads from shared batch cache) ── */
  const doFetchQuote = useCallback(async (direction: 'buy' | 'sell'): Promise<SwapQuotingResponse | null> => {
    if (!walletAddress) return null;
    return fetchQuoteNow(token.address, token.chainId, direction, {
      walletAddress,
      quoteToken: tokenInfo.quoteToken,
      quotePrice: tokenInfo.price,
      buyAmountUSD: Number(quickBuyAmount) || 0,
      sellPct: Number(quickSellPercentage) || 100,
      holdingBalance,
      slippage,
    });
  }, [walletAddress, token.address, token.chainId, tokenInfo, quickBuyAmount, quickSellPercentage, holdingBalance, slippage]);

  const handleHoverBuy = useCallback(() => {
    if (!isConnected || !walletAddress) return;
    doFetchQuote('buy');
  }, [isConnected, walletAddress, doFetchQuote]);

  const handleHoverSell = useCallback(() => {
    if (!isConnected || !walletAddress || holdingBalance <= 0) return;
    doFetchQuote('sell');
  }, [isConnected, walletAddress, holdingBalance, doFetchQuote]);

  useEffect(() => {
    if (!isConnected || !walletAddress) return;
    doFetchQuote('buy');
    if (holdingBalance > 0) doFetchQuote('sell');
    const interval = setInterval(() => {
      doFetchQuote('buy');
      if (holdingBalance > 0) doFetchQuote('sell');
    }, 3_000);
    return () => clearInterval(interval);
  }, [isConnected, walletAddress, doFetchQuote, holdingBalance]);

  const tokenPrice = Number(token.priceUSD ?? 0);

  const handleQuickBuy = useCallback(async () => {
    if (!isConnected) { connect(); return; }
    if (!walletAddress) { toast.error('No wallet address found'); return; }
    if (!tokenInfo || tokenInfo.price <= 0) { toast.error('No balance available'); return; }
    const usdAmount = Number(quickBuyAmount) || 0;
    if (usdAmount > tokenInfo.balanceUSD) {
      toast.error(`Insufficient balance: $${tokenInfo.balanceUSD.toFixed(2)} available`);
      return;
    }
    setSwapping(true);
    try {
      const cached = getQuote(token.address, token.chainId, 'buy');
      let quote: SwapQuotingResponse | null = cached?.response ?? null;
      if (!quote?.data) quote = await doFetchQuote('buy');
      if (!quote?.data) { toast.error('Failed to get quote'); return; }
      await signAndSendTransaction(quote, token.chainId, 'buy');
      // Immediately show sell button — real balance syncs from portfolio later
      useSurgeStore.getState().updatePosition(token.address, {
        balance: 0.0001,
        amountUSD: usdAmount,
        unrealizedPnlUSD: 0,
        totalPnlUSD: 0,
        avgBuyPriceUSD: tokenPrice,
      });
    } catch (err) {
      console.error('[SurgeCard] Buy error:', err);
    } finally {
      setSwapping(false);
    }
  }, [isConnected, connect, walletAddress, token.chainId, token.address, doFetchQuote, signAndSendTransaction, tokenInfo, quickBuyAmount, tokenPrice]);

  const handleQuickSell = useCallback(async () => {
    if (!isConnected) { connect(); return; }
    if (!walletAddress) { toast.error('No wallet address found'); return; }
    setSwapping(true);
    const sellToastId = toast.loading('Selling...', { duration: Infinity });
    const startTime = Date.now();
    try {
      const cached = getQuote(token.address, token.chainId, 'sell');
      let quote: SwapQuotingResponse | null = cached?.response ?? null;
      if (!quote?.data) quote = await doFetchQuote('sell');
      if (!quote?.data) { toast.dismiss(sellToastId); toast.error('Failed to get quote'); setSwapping(false); return; }

      // Record pre-sell balance to detect WSS position update
      const preSellBalance = holdingBalance;

      const txHash = await signAndSendTransaction(quote, token.chainId, 'sell', { skipToast: true });

      if (!txHash) {
        toast.dismiss(sellToastId);
        setSwapping(false);
        return;
      }

      // Wait for WSS position update (balance changes = position updated with accurate PnL)
      let resolved = false;
      const unsub = useUserPortfolioStore.subscribe((state) => {
        if (resolved) return;
        const updatedPos = state.positions.find(
          (p) => p.address.toLowerCase() === token.address.toLowerCase()
        );
        // Position removed or balance changed = WSS delivered the update
        if (!updatedPos || Math.abs(updatedPos.balance - preSellBalance) > 0.0001) {
          resolved = true;
          unsub();
          toast.dismiss(sellToastId);
          const elapsedMs = Date.now() - startTime;
          const elapsed = elapsedMs >= 1000 ? `${(elapsedMs / 1000).toFixed(1)}s` : `${elapsedMs}ms`;
          const realizedPnl = updatedPos?.realizedPnlUSD ?? 0;
          toast.custom(
            makeSwapToast('Sold', token.symbol ?? '', elapsed, realizedPnl, '#EA3943', '/portfolio'),
            { duration: 4000, unstyled: true, style: { background: 'transparent', border: 'none', padding: 0, boxShadow: 'none' } },
          );
          // Update surge position
          if (!updatedPos || updatedPos.balance <= 0) {
            useSurgeStore.getState().updatePosition(token.address, {
              balance: 0, amountUSD: 0, unrealizedPnlUSD: 0, totalPnlUSD: 0, avgBuyPriceUSD: 0,
            });
          } else {
            useSurgeStore.getState().updatePosition(token.address, {
              balance: updatedPos.balance,
              amountUSD: updatedPos.balanceUSD,
              unrealizedPnlUSD: updatedPos.unrealizedPnlUSD,
              totalPnlUSD: updatedPos.totalPnlUSD,
              avgBuyPriceUSD: updatedPos.avgBuyPriceUSD,
            });
          }
          setSwapping(false);
        }
      });

      // Timeout fallback: 15s — if no WSS update, show generic toast
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        unsub();
        toast.dismiss(sellToastId);
        const elapsedMs = Date.now() - startTime;
        const elapsed = elapsedMs >= 1000 ? `${(elapsedMs / 1000).toFixed(1)}s` : `${elapsedMs}ms`;
        toast.custom(
          makeSwapToast('Sold', token.symbol ?? '', elapsed, null, '#EA3943', '/portfolio'),
          { duration: 4000, unstyled: true, style: { background: 'transparent', border: 'none', padding: 0, boxShadow: 'none' } },
        );
        if (Number(quickSellPercentage) >= 100) {
          useSurgeStore.getState().updatePosition(token.address, {
            balance: 0, amountUSD: 0, unrealizedPnlUSD: 0, totalPnlUSD: 0, avgBuyPriceUSD: 0,
          });
        }
        setSwapping(false);
      }, 15_000);
    } catch (err) {
      toast.dismiss(sellToastId);
      toast.error('Sell failed');
      console.error('[SurgeCard] Sell error:', err);
      setSwapping(false);
    }
  }, [isConnected, connect, walletAddress, token.chainId, token.address, token.symbol, doFetchQuote, signAndSendTransaction, quickSellPercentage, holdingBalance]);

  /* ── Data extraction ── */
  const mc    = Number(token.marketCapUSD ?? 0);
  const price = tokenPrice;

  const ext = token as Record<string, unknown>;
  const totalBuys  = Number(ext.buys1min ?? token.buys24h ?? 0);
  const totalSells = Number(ext.sells1min ?? token.sells24h ?? 0);
  const tot        = totalBuys + totalSells;

  const rawVol     = Number(ext.volume1minUSD ?? 0);
  const orgBuyVol  = Number(ext.organicVolumeBuy1minUSD ?? 0);
  const orgSellVol = Number(ext.organicVolumeSell1minUSD ?? 0);
  const vol        = rawVol > 0 ? rawVol : (orgBuyVol + orgSellVol > 0 ? orgBuyVol + orgSellVol : Number(ext.volume24hUSD ?? 0));

  const orgBuys  = Number(token.organicBuys1m ?? ext.organicBuys1min ?? 0);
  const orgSells = Number(token.organicSells1m ?? ext.organicSells1min ?? 0);
  const organicPct = tot > 0 ? Math.round(((orgBuys + orgSells) / tot) * 100) : 0;
  const bond = Number(token.bondingPercentage ?? 0);
  const bonded  = token.bonded === true || bond >= 100;
  const created = token.createdAt ?? token.created_at ?? '';

  const spotted     = Number(token.spottedPrice ?? 0);
  const spottedMc   = useMemo(() => spotted > 0 && price > 0 ? (spotted / price) * mc : 0, [spotted, price, mc]);
  const spottedPct  = useMemo(() => spottedMc > 0 ? ((mc / spottedMc - 1) * 100) : 0, [mc, spottedMc]);

  const pc1m = Number(ext['priceChange1minPercentage'] ?? 0);
  const txps = useMemo(() => tot > 0 ? tot / 60 : 0, [tot]);
  const groups = token.groups;

  const t10 = Number(token.top10HoldingsPercentage ?? 0);
  const dev = Number(token.devHoldingsPercentage ?? 0);
  const snp = Number(token.snipersHoldingsPercentage ?? 0);
  const ins = Number(token.insidersHoldingsPercentage ?? 0);
  const bun = Number(token.bundlersHoldingsPercentage ?? 0);

  const rankColor = rank === 1 ? C.gold : rank === 2 ? C.silver : rank === 3 ? C.bronze : C.label;
  const buyPct = tot > 0 ? Math.round((totalBuys / tot) * 100) : 50;

  const holders = Number(ext.holdersCount ?? ext.holders_count ?? 0);
  const buyers1m = Number(ext.buyers1min ?? ext.buyers1m ?? 0);
  const sellers1m = Number(ext.sellers1min ?? ext.sellers1m ?? 0);
  const paid = Boolean(ext.dexPaid ?? ext.dex_paid);
  const mig = Number(ext.deployerMigrations ?? 0);
  const migTotal = Number(ext.deployerCreations ?? ext.deployer_creations ?? ext.deployerTokensCount ?? 0);

  return (
    <div
      onClick={() => navigateToToken(token.address, toBlockchain(token.chainId), token as unknown as Record<string, unknown>)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? C.hover : C.card,
        border: `1px solid ${hovered ? '#1E1E24' : C.border}`,
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'background 0.12s, border-color 0.12s',
        fontFamily: mono,
        height: 270,
        display: 'flex',
        flexDirection: 'column' as const,
      }}
    >
      {/* ── Header: 3-column layout → [left: name] [center: fees] [right: MC] ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '10px 14px 6px',
      }}>
        {/* LEFT — rank + logo + name (flex:1) */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
          <span style={{
            fontSize: 11, color: rankColor,
            width: 16, textAlign: 'center', flexShrink: 0,
            opacity: rank <= 3 ? 1 : 0.5,
          }}>
            {rank}
          </span>

          {token.logo ? (
            <SafeImage src={token.logo} alt="" width={32} height={32} className="rounded-full" style={{ flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: C.muted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: C.label, flexShrink: 0,
            }}>
              {(token.symbol?.slice(0, 2) ?? '??').toUpperCase()}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: '22px' }}>
              <span style={{ fontSize: 18, color: C.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {token.symbol ?? '???'}
              </span>
              <span style={{ fontSize: 13, color: C.label, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>
                {token.name ?? ''}
              </span>
              {created && (
                <span style={{ fontSize: 12, color: C.dim, flexShrink: 0 }}>{timeAgo(created)}</span>
              )}
              <div style={{ display: 'flex', gap: 4, marginLeft: 2 }} onClick={e => e.stopPropagation()}>
                {token.socials?.twitter && (
                  <button onClick={() => window.open(token.socials!.twitter!, '_blank')} style={{ color: C.link, background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </button>
                )}
                {token.socials?.telegram && (
                  <button onClick={() => window.open(token.socials!.telegram!, '_blank')} style={{ color: C.link, background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                  </button>
                )}
                {token.socials?.website && (
                  <button onClick={() => window.open(token.socials!.website!, '_blank')} style={{ color: C.link, background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 12, flexWrap: 'wrap' }}>
              {token.exchange?.logo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <SafeImage src={token.exchange.logo} alt="" width={13} height={13} className="rounded" style={{ opacity: 0.7 }} />
                  <span style={{ color: C.label }}>{token.exchange.name ?? ''}</span>
                </div>
              )}
              {!bonded && bond > 0 && bond < 100 && (
                <span style={{ color: C.green }}>{Math.round(bond)}%</span>
              )}
              {bonded && (
                <span style={{ color: C.green, letterSpacing: '0.03em' }}>BONDED</span>
              )}
              {holders > 0 && (
                <span style={{ color: C.white, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" opacity="0.5"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                  {formatPureNumber(holders, { maxFractionDigits: 0, minFractionDigits: 0 })}
                </span>
              )}
              {(mig > 0 || migTotal > 0) && (
                <span style={{ color: mig > 0 ? C.green : C.dim }}>
                  {migTotal > 0 ? `${mig}/${migTotal}` : mig} mig
                </span>
              )}
              {paid && (
                <span style={{ color: C.green, background: `${C.green}12`, padding: '0px 5px', borderRadius: 1 }}>Paid</span>
              )}
              {organicPct > 0 && (
                <span style={{ color: organicPct >= 80 ? C.green : organicPct >= 50 ? C.yellow : C.red }}>
                  {organicPct}% org
                </span>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — MC */}
        <div style={{ flexShrink: 0, textAlign: 'right', marginLeft: 12 }}>
          <div style={{ fontSize: 17, color: getMcColor(mc), lineHeight: 1.1 }}>
            {fmtUsdCrypto(mc)}
          </div>
          {spottedPct !== 0 && spottedMc > 0 ? (
            <span style={{ fontSize: 12, color: spottedPct >= 0 ? C.green : C.red }}>
              {spottedPct >= 0 ? '+' : ''}{pct(spottedPct)} <span style={{ color: C.label, fontSize: 10 }}>spotted</span>
            </span>
          ) : pc1m !== 0 ? (
            <span style={{ fontSize: 12, color: pc1m >= 0 ? C.green : C.red }}>
              {pc1m >= 0 ? '+' : ''}{pct(pc1m)} <span style={{ color: C.label, fontSize: 10 }}>1m</span>
            </span>
          ) : null}
        </div>
      </div>

      {/* ── ROW 2: Stats row + Chart ── */}
      <div style={{ display: 'flex', padding: '0 14px', gap: 10, flex: 1, minHeight: 0 }}>
        {/* Stats column */}
        <div style={{ width: 120, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5 }}>
          {/* Trades */}
          <div>
            <div style={{ fontSize: 10, color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>
              Trades 1m
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontSize: 14, color: C.green }}>{totalBuys}</span>
              <span style={{ fontSize: 10, color: C.muted }}>/</span>
              <span style={{ fontSize: 14, color: C.red }}>{totalSells}</span>
              {(buyers1m > 0 || sellers1m > 0) && (
                <span style={{ fontSize: 10, color: C.dim, marginLeft: 2 }}>{buyers1m}B {sellers1m}S</span>
              )}
            </div>
            <div style={{ height: 2, borderRadius: 1, background: C.red, overflow: 'hidden', marginTop: 2, width: '100%' }}>
              <div style={{ height: '100%', background: C.green, width: `${buyPct}%`, borderRadius: 1 }} />
            </div>
          </div>

          {/* Volume */}
          <div>
            <div style={{ fontSize: 10, color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>
              Vol 1m
            </div>
            <div style={{ fontSize: 14, color: C.white }}>
              {fmtUsdCrypto(vol)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1, fontSize: 10 }}>
              <span style={{ color: C.yellow }}>{txps.toFixed(1)} tx/s</span>
            </div>
          </div>

        </div>

        {/* Chart */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 85 }}>
          <MiniCandlestickChart candles={token.ohlcv} avgBuyPrice={position?.avgBuyPriceUSD} />
        </div>
      </div>

      {/* ── ROW 3: Groups (if any) ── */}
      {groups && Array.isArray(groups) && groups.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 14px 0', flexWrap: 'wrap' }}>
          {groups.map((g, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 2,
              padding: '1px 5px', borderRadius: 1,
              fontSize: 10,
              background: `${g.color || C.green}10`, color: g.color || C.green,
              border: `1px solid ${g.color || C.green}20`,
            }}>
              {g.emoji && <span>{g.emoji}</span>}
              {g.name}
            </span>
          ))}
        </div>
      )}

      {/* ── Bottom row: Holdings + Buy/Sell ── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 14px 8px',
          marginTop: 'auto',
        }}
      >
        {/* Holdings badges */}
        {[
          { label: 'DEV', value: dev, threshold: 1 },
          { label: 'T10', value: t10, threshold: 10 },
          { label: 'SNP', value: snp, threshold: 5 },
          { label: 'INS', value: ins, threshold: 5 },
          { label: 'BDL', value: bun, threshold: 5 },
        ].map(({ label, value, threshold }) => {
          const color = holdingColor(value, threshold);
          return (
            <span key={label} style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '4px 6px', borderRadius: 2,
              fontSize: 12,
              color,
              background: `${color}0A`,
              border: `1px solid ${color}15`,
            }}>
              <span style={{ fontSize: 10, color: C.label }}>{label}</span>
              {Math.round(value)}%
            </span>
          );
        })}

        {/* PNL if position */}
        {holdingBalance > 0 && (
          <span style={{
            fontSize: 12,
            color: unrealizedPnl >= 0 ? C.green : C.red,
            marginLeft: 2,
          }}>
            {unrealizedPnl >= 0 ? '+' : ''}{fmtUsdCrypto(unrealizedPnl)}
          </span>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Buy/Sell buttons */}
        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={handleQuickBuy}
            onMouseEnter={handleHoverBuy}
            disabled={swapping}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '5px 42px', borderRadius: 3,
              fontSize: 12,
              color: '#fff',
              background: `${C.green}20`,
              border: `1px solid ${C.green}40`,
              cursor: swapping ? 'wait' : 'pointer',
              opacity: swapping ? 0.5 : 1,
              transition: 'background 0.12s, opacity 0.12s',
            }}
          >
            <Zap size={11} style={{ color: C.green }} />
            <span style={{ color: C.green }}>${quickBuyAmount}</span>
          </button>
          {holdingBalance > 0 && (
            <button
              onClick={handleQuickSell}
              onMouseEnter={handleHoverSell}
              disabled={swapping}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '5px 28px', borderRadius: 3,
                fontSize: 12,
                color: C.red,
                background: `${C.red}15`,
                border: `1px solid ${C.red}35`,
                cursor: swapping ? 'wait' : 'pointer',
                opacity: swapping ? 0.5 : 1,
                transition: 'background 0.12s, opacity 0.12s',
              }}
            >
              SELL {quickSellPercentage}%
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(SurgeTokenCard);
