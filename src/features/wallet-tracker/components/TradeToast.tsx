'use client';

import { toast } from 'sonner';
import SafeImage from '@/components/SafeImage';
import { fmtUsd } from '@/lib/format';
import type { LiveTrade } from '../store/useWalletTrackerStore';

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function TradeToastContent({ trade }: { trade: LiveTrade }) {
  const isBuy = trade.type === 'buy';
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-bgTertiary">
        {trade.tokenLogo ? (
          <SafeImage src={trade.tokenLogo} alt={trade.tokenSymbol} width={32} height={32} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-textTertiary">
            {trade.tokenSymbol.charAt(0)}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[10px] font-bold uppercase px-1 py-0.5 rounded ${
              isBuy ? 'bg-success/15 text-success' : 'bg-error/15 text-error'
            }`}
          >
            {trade.type}
          </span>
          <span className="text-sm font-semibold text-white">{trade.tokenSymbol}</span>
          {trade.tokenDetails?.marketCap != null && trade.tokenDetails.marketCap > 0 && (
            <span className="text-[10px] text-textTertiary">MC {formatCompact(trade.tokenDetails.marketCap)}</span>
          )}
        </div>
        <p className="text-xs text-textTertiary truncate">
          {trade.walletLabel} &middot; {fmtUsd(trade.amountUSD)}
        </p>
      </div>
    </div>
  );
}

export function showTradeToast(trade: LiveTrade) {
  toast.custom(() => <TradeToastContent trade={trade} />, { duration: 4000 });
}
