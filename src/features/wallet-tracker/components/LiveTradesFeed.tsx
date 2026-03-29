'use client';

import { useMemo } from 'react';
import { ExternalLink, Copy } from 'lucide-react';
import { useWalletTrackerStore } from '../store/useWalletTrackerStore';
import SafeImage from '@/components/SafeImage';
import { fmtUsd } from '@/lib/format';
import { useNavigationStore } from '@/store/useNavigationStore';
import { toBlockchain } from '@/lib/format';
import { buildExplorerUrl } from '@mobula_labs/sdk';
import { useWalletModalStore } from '@/store/useWalletModalStore';

function formatTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default function LiveTradesFeed() {
  const liveTrades = useWalletTrackerStore((s) => s.liveTrades);
  const trackedWallets = useWalletTrackerStore((s) => s.trackedWallets);
  const walletPositions = useWalletTrackerStore((s) => s.walletPositions);
  const navigateToToken = useNavigationStore((s) => s.navigateToToken);

  const pnlLookup = useMemo(() => {
    const map = new Map<string, { realizedPnlUSD: number; volumeBuy: number }>();
    for (const [walletAddr, positions] of Object.entries(walletPositions)) {
      for (const pos of positions) {
        const key = `${walletAddr}_${pos.token}`.toLowerCase();
        map.set(key, { realizedPnlUSD: pos.realizedPnlUSD, volumeBuy: pos.volumeBuy });
      }
    }
    return map;
  }, [walletPositions]);

  // Only show PNL on the latest sell per wallet+token pair
  const lastSellIds = useMemo(() => {
    const seen = new Set<string>();
    const ids = new Set<string>();
    for (const trade of liveTrades) {
      if (trade.type !== 'sell') continue;
      const key = `${trade.walletAddress}_${trade.tokenAddress}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        ids.add(trade.id);
      }
    }
    return ids;
  }, [liveTrades]);

  if (trackedWallets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 px-5 text-center">
        <p className="text-base text-textTertiary">No wallets added yet.</p>
        <p className="text-sm text-textTertiary mt-1.5">Add wallets to track their live trades</p>
      </div>
    );
  }

  if (liveTrades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 px-5 text-center">
        <div className="w-4 h-4 border-2 border-textTertiary border-t-success rounded-full animate-spin mb-4" />
        <p className="text-base text-textTertiary">Listening for trades...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Column headers */}
      <div className="grid grid-cols-[40px_1fr_1.3fr_1fr_0.8fr_1fr_auto] gap-3 px-4 py-2.5 text-sm text-textTertiary border-b border-borderDefault/40 shrink-0">
        <span>Time</span>
        <span>Wallet</span>
        <span>Token</span>
        <span className="text-right">Amount</span>
        <span className="text-right">MC</span>
        <span className="text-right">PNL</span>
        <span className="w-14" />
      </div>

      {/* Trade rows */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {liveTrades.map((trade) => {
          const isBuy = trade.type === 'buy';
          const mcap = trade.tokenDetails?.marketCap;
          const blockchain = toBlockchain(trade.chainId);
          const explorerUrl = trade.txHash
            ? buildExplorerUrl(trade.chainId, 'tx', trade.txHash)
            : buildExplorerUrl(trade.chainId, 'address', trade.walletAddress);

          // PNL only on the latest sell per wallet+token
          const showPnl = lastSellIds.has(trade.id);
          let pnlUSD: number | null = null;
          let pnlPct: number | null = null;
          if (showPnl) {
            pnlUSD = trade.pnlUSD;
            if (pnlUSD === null) {
              const lookupKey = `${trade.walletAddress}_${trade.tokenAddress}`.toLowerCase();
              const posData = pnlLookup.get(lookupKey);
              if (posData) {
                pnlUSD = posData.realizedPnlUSD;
                pnlPct = posData.volumeBuy > 0 ? (posData.realizedPnlUSD / posData.volumeBuy) * 100 : null;
              }
            } else {
              pnlPct = trade.pnlPct;
            }
          }

          return (
            <div
              key={trade.id}
              onClick={() => navigateToToken(trade.tokenAddress, blockchain, {})}
              className={`grid grid-cols-[40px_1fr_1.3fr_1fr_0.8fr_1fr_auto] gap-3 px-4 py-2.5 cursor-pointer border-b border-borderDefault/10 transition-colors items-center ${
                isBuy
                  ? 'bg-success/[0.04] hover:bg-success/[0.08]'
                  : 'bg-error/[0.04] hover:bg-error/[0.08]'
              }`}
            >
              {/* Time */}
              <span className="text-sm text-textTertiary tabular-nums">
                {formatTime(trade.timestamp)}
              </span>

              {/* Wallet label — click opens wallet modal */}
              <span
                className="text-sm font-medium text-textPrimary truncate hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  useWalletModalStore.getState().openWalletModal({
                    walletAddress: trade.walletAddress,
                    txHash: trade.txHash || trade.walletAddress,
                    blockchain,
                  });
                }}
              >
                {trade.walletLabel.length > 10 ? trade.walletLabel.slice(0, 10) : trade.walletLabel}
              </span>

              {/* Token: logo + name */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-bgTertiary">
                  {trade.tokenLogo ? (
                    <SafeImage src={trade.tokenLogo} alt={trade.tokenSymbol} width={28} height={28} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-textTertiary">
                      {trade.tokenSymbol.charAt(0)}
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium text-textPrimary truncate">{trade.tokenSymbol}</span>
              </div>

              {/* Amount USD */}
              <span className="text-sm font-medium tabular-nums text-right truncate text-textPrimary">
                {fmtUsd(trade.amountUSD)}
              </span>

              {/* Market Cap */}
              <span className="text-sm text-textTertiary text-right tabular-nums truncate">
                {mcap != null && mcap > 0 ? formatCompact(mcap) : '-'}
              </span>

              {/* PNL */}
              <div className="text-right">
                {pnlUSD !== null ? (
                  <div className="flex flex-col items-end leading-tight">
                    <span className={`text-sm font-semibold tabular-nums ${pnlUSD >= 0 ? 'text-success' : 'text-error'}`}>
                      {pnlUSD >= 0 ? '+' : ''}{fmtUsd(pnlUSD)}
                    </span>
                    {pnlPct !== null && (
                      <span className={`text-xs tabular-nums ${pnlPct >= 0 ? 'text-success/70' : 'text-error/70'}`}>
                        {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(0)}%
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-textTertiary">-</span>
                )}
              </div>

              {/* Actions: explorer + copy */}
              <div className="flex items-center gap-1 w-14 justify-end">
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-textTertiary hover:text-textPrimary transition-colors p-1"
                    title="View on explorer"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(trade.walletAddress);
                  }}
                  className="text-textTertiary hover:text-textPrimary transition-colors p-1"
                  title="Copy wallet address"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
