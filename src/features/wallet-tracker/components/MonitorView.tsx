'use client';

import { useMemo } from 'react';
import { useWalletTrackerStore } from '../store/useWalletTrackerStore';
import SafeImage from '@/components/SafeImage';
import { fmtUsd } from '@/lib/format';
import { useNavigationStore } from '@/store/useNavigationStore';
import { toBlockchain } from '@/lib/format';

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatTimeAgo(date: string | Date | null): string {
  if (!date) return '-';
  const ms = Date.now() - new Date(date).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

interface TokenGroup {
  tokenAddress: string;
  chainId: string;
  symbol: string;
  name: string;
  logo: string | null;
  price: number;
  marketCap: number | null;
  totalBought: number;
  totalSold: number;
  totalPnl: number;
  txCount: number;
  lastTx: string | null;
  wallets: {
    label: string;
    address: string;
    enteredAgo: string;
    bought: number;
    sold: number;
    pnl: number;
    remaining: number;
  }[];
}

export default function MonitorView() {
  const trackedWallets = useWalletTrackerStore((s) => s.trackedWallets);
  const walletPositions = useWalletTrackerStore((s) => s.walletPositions);
  const navigateToToken = useNavigationStore((s) => s.navigateToToken);

  const tokenGroups = useMemo(() => {
    const groups = new Map<string, TokenGroup>();

    for (const wallet of trackedWallets) {
      const positions = walletPositions[wallet.address.toLowerCase()] || [];

      for (const pos of positions) {
        if (pos.volumeBuy <= 0) continue;

        const key = `${pos.token}_${pos.chainId}`.toLowerCase();
        const details = (pos as Record<string, unknown>).tokenDetails as Record<string, unknown> | undefined;

        if (!groups.has(key)) {
          groups.set(key, {
            tokenAddress: pos.token,
            chainId: pos.chainId,
            symbol: (details?.symbol as string) || pos.token.slice(0, 6),
            name: (details?.name as string) || '',
            logo: (details?.logo as string) || null,
            price: (details?.price as number) || 0,
            marketCap: (details?.marketCap as number) || null,
            totalBought: 0,
            totalSold: 0,
            totalPnl: 0,
            txCount: 0,
            lastTx: null,
            wallets: [],
          });
        }

        const group = groups.get(key)!;
        group.totalBought += pos.volumeBuy;
        group.totalSold += pos.volumeSell;
        group.totalPnl += pos.realizedPnlUSD;
        group.txCount += (pos.buys || 0) + (pos.sells || 0);

        if (pos.lastDate) {
          const lastMs = new Date(pos.lastDate).getTime();
          if (!group.lastTx || lastMs > new Date(group.lastTx).getTime()) {
            group.lastTx = typeof pos.lastDate === 'string' ? pos.lastDate : new Date(pos.lastDate).toISOString();
          }
        }

        group.wallets.push({
          label: wallet.label,
          address: wallet.address,
          enteredAgo: pos.firstDate ? formatTimeAgo(pos.firstDate) : '-',
          bought: pos.volumeBuy,
          sold: pos.volumeSell,
          pnl: pos.realizedPnlUSD,
          remaining: pos.amountUSD,
        });
      }
    }

    return Array.from(groups.values()).sort((a, b) => {
      const aTime = a.lastTx ? new Date(a.lastTx).getTime() : 0;
      const bTime = b.lastTx ? new Date(b.lastTx).getTime() : 0;
      return bTime - aTime;
    });
  }, [trackedWallets, walletPositions]);

  if (trackedWallets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 px-5 text-center">
        <p className="text-base text-textTertiary">No wallets added yet.</p>
        <p className="text-sm text-textTertiary mt-1.5">Add wallets to monitor their positions</p>
      </div>
    );
  }

  if (tokenGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 px-5 text-center">
        <div className="w-4 h-4 border-2 border-textTertiary border-t-success rounded-full animate-spin mb-4" />
        <p className="text-base text-textTertiary">Loading positions...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide p-3.5">
      <div className="grid grid-cols-2 gap-3.5">
        {tokenGroups.map((group) => {
          const isPnlPositive = group.totalPnl >= 0;
          const pnlPct = group.totalBought > 0 ? (group.totalPnl / group.totalBought) * 100 : 0;

          return (
            <div
              key={`${group.tokenAddress}_${group.chainId}`}
              className="rounded-lg border border-borderDefault/60 bg-[#0a0a0a] overflow-hidden"
            >
              {/* Card Header */}
              <div
                className="px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => navigateToToken(group.tokenAddress, toBlockchain(group.chainId), {})}
              >
                <div className="flex items-center gap-3">
                  {/* Token logo */}
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-bgTertiary ring-1 ring-white/5">
                    {group.logo ? (
                      <SafeImage src={group.logo} alt={group.symbol} width={40} height={40} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm font-bold text-textTertiary">
                        {group.symbol.charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Token info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white truncate">{group.symbol}</span>
                      <span className="text-sm text-textTertiary truncate max-w-[120px]">{group.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm text-textTertiary">
                        {group.totalBought > 0 ? `${group.wallets.reduce((s, w) => s + (w.bought > 0 ? 1 : 0), 0)} wallets` : ''}
                      </span>
                    </div>
                  </div>

                  {/* PNL */}
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className={`text-base font-bold tabular-nums ${isPnlPositive ? 'text-success' : 'text-error'}`}>
                      {isPnlPositive ? '+' : ''}{fmtUsd(group.totalPnl)}
                    </span>
                    <span className={`text-sm tabular-nums ${isPnlPositive ? 'text-success/60' : 'text-error/60'}`}>
                      {isPnlPositive ? '+' : ''}{pnlPct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="flex items-center gap-3 px-4 py-2 text-sm border-y border-borderDefault/30 bg-white/[0.015]">
                {group.marketCap != null && group.marketCap > 0 && (
                  <>
                    <span className="text-textTertiary">
                      MC <span className="text-white/80 font-medium">{formatCompact(group.marketCap)}</span>
                    </span>
                    <span className="w-px h-3.5 bg-borderDefault/40" />
                  </>
                )}

                {group.price > 0 && (
                  <>
                    <span className="text-white/80 font-medium">{fmtUsd(group.price)}</span>
                    <span className="w-px h-3.5 bg-borderDefault/40" />
                  </>
                )}

                <span className="text-textTertiary">
                  <span className="text-white/80 font-medium">{group.txCount}</span> tx
                </span>

                <span className="w-px h-3.5 bg-borderDefault/40" />

                <span className="text-textTertiary">
                  {group.lastTx ? formatTimeAgo(group.lastTx) : '-'} ago
                </span>
              </div>

              {/* Per-wallet Table */}
              <div className="text-sm">
                <div className="grid grid-cols-[1fr_50px_60px_60px_60px_50px] gap-1.5 px-4 py-2 text-textTertiary/70 border-b border-borderDefault/20">
                  <span>Wallet</span>
                  <span className="text-right">Time</span>
                  <span className="text-right">Bought</span>
                  <span className="text-right">Sold</span>
                  <span className="text-right">PNL</span>
                  <span className="text-right">Left</span>
                </div>

                {group.wallets.map((w) => {
                  const wPositive = w.pnl >= 0;
                  return (
                    <div
                      key={w.address}
                      className={`grid grid-cols-[1fr_50px_60px_60px_60px_50px] gap-1.5 px-4 py-2 border-b border-borderDefault/10 transition-colors ${
                        wPositive
                          ? 'hover:bg-success/[0.04]'
                          : 'hover:bg-error/[0.04]'
                      }`}
                    >
                      <span className="text-textPrimary font-medium truncate">{w.label}</span>
                      <span className="text-right text-textTertiary tabular-nums">{w.enteredAgo}</span>
                      <span className="text-right text-success/80 font-medium tabular-nums">{fmtUsd(w.bought)}</span>
                      <span className="text-right text-error/80 font-medium tabular-nums">{w.sold > 0 ? fmtUsd(w.sold) : '-'}</span>
                      <span className={`text-right font-bold tabular-nums ${wPositive ? 'text-success' : 'text-error'}`}>
                        {wPositive ? '+' : ''}{fmtUsd(w.pnl)}
                      </span>
                      <span className="text-right text-white/60 tabular-nums">{w.remaining > 0.01 ? fmtUsd(w.remaining) : '$0'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
