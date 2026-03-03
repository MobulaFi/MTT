'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, DollarSign, Clock } from 'lucide-react';
import type { PMMarket } from '../types';

interface MarketCardProps {
  market: PMMarket;
}

/**
 * Format large numbers with K, M, B suffixes
 */
function formatVolume(value: number | undefined): string {
  if (value === undefined || value === null) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

/**
 * Format trader/holder count with K, M suffixes
 */
function formatCount(value: number | string | undefined): string {
  if (value === undefined || value === null) return '0';
  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return `${Math.round(num)}`;
}

/**
 * Format end date as "Feb 18, 9:00 PM"
 */
function formatEndDate(endDate: string | undefined): string {
  if (!endDate || endDate === '1970-01-01 00:00:00.000') return 'No end date';

  const end = new Date(endDate.replace(' ', 'T') + 'Z');
  const now = new Date();
  if (end.getTime() - now.getTime() < 0) return 'Ended';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[end.getMonth()];
  const day = end.getDate();
  const hours = end.getHours();
  const minutes = end.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  const m = minutes.toString().padStart(2, '0');

  return `${month} ${day}, ${h}:${m} ${ampm}`;
}

/**
 * Get outcome display with labels and percentages.
 * Always returns a result — defaults to 50/50 if no data.
 */
function getOutcomeDisplay(market: PMMarket): { leftLabel: string; rightLabel: string; leftPercent: number; rightPercent: number } {
  if (!market.outcomes || market.outcomes.length < 2) {
    return { leftLabel: 'Yes', rightLabel: 'No', leftPercent: 50, rightPercent: 50 };
  }

  const yesOutcome = market.outcomes.find((o) => o.label.toLowerCase() === 'yes');
  const noOutcome = market.outcomes.find((o) => o.label.toLowerCase() === 'no');

  if (yesOutcome && noOutcome) {
    const yp = Math.round(yesOutcome.price * 100);
    return { leftLabel: 'Yes', rightLabel: 'No', leftPercent: yp, rightPercent: 100 - yp };
  }

  // Non-binary: use first two outcomes with their actual labels
  const first = market.outcomes[0];
  const second = market.outcomes[1];
  const fp = Math.round(first.price * 100);
  return { leftLabel: first.label, rightLabel: second.label, leftPercent: fp, rightPercent: 100 - fp };
}

const MarketCard = memo(({ market }: MarketCardProps) => {
  const router = useRouter();
  const outcomes = getOutcomeDisplay(market);

  const handleClick = () => {
    router.push(`/predictions/${market.platform}/${encodeURIComponent(market.marketId)}`);
  };

  const tradesCount = market.tradesCount ?? market.stats?.tradesCount;

  return (
    <div
      onClick={handleClick}
      className="bg-bgPrimary border-b border-borderDefault px-5 py-4 min-h-[95px] cursor-pointer w-full"
    >
      {/* ROW 1 — Title Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 max-w-[75%]">
          {/* Avatar — square with rounded corners like TokenCard */}
          <div className="w-12 h-12 shrink-0 rounded overflow-hidden bg-bgPrimary flex items-center justify-center">
            {(market.metadata?.image || market.image) ? (
              <img
                src={market.metadata?.image || market.image || ''}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-xl font-semibold text-blue-400 select-none">${market.question.charAt(0).toUpperCase()}</span>`;
                }}
              />
            ) : (
              <span className="text-xl font-semibold text-blue-400 select-none">
                {market.question.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          {/* Title */}
          <span className="text-textPrimary text-[15px] font-semibold leading-snug">
            {market.question}
          </span>
        </div>
        {/* Category tag */}
        <span className="text-textTertiary text-[13px] font-normal shrink-0 capitalize">
          {market.category}
        </span>
      </div>

      {/* ROW 2 — Voting Bar (ALWAYS rendered) */}
      <div className="mt-3">
        {/* Labels */}
        <div className="flex justify-between mb-1">
          <span className="text-success text-[13px] font-semibold">
            {outcomes.leftLabel} {outcomes.leftPercent}%
          </span>
          <span className="text-textPrimary text-[13px] font-medium">
            {outcomes.rightLabel} {outcomes.rightPercent}%
          </span>
        </div>
        {/* Bar */}
        <div className="w-full h-1.5 bg-bgContainer rounded-sm">
          <div
            className="h-1.5 bg-success rounded-sm"
            style={{ width: `${outcomes.leftPercent}%` }}
          />
        </div>
      </div>

      {/* ROW 3 — Metadata Row */}
      <div className="flex justify-between items-center mt-3">
        {/* Traders */}
        <div className="flex items-center gap-1.5 text-textTertiary text-xs font-normal tracking-wide uppercase">
          <BarChart3 size={14} strokeWidth={1.5} />
          <span>Trades: {formatCount(tradesCount)}</span>
        </div>

        {/* Total Volume */}
        <div className="flex items-center gap-1.5 text-textTertiary text-xs font-normal tracking-wide uppercase">
          <DollarSign size={14} strokeWidth={1.5} />
          <span>Total Vol: {formatVolume(market.volumeTotal)}</span>
        </div>

        {/* End date */}
        <div className="flex items-center gap-1.5 text-textTertiary text-xs font-normal tracking-wide uppercase">
          <Clock size={14} strokeWidth={1.5} />
          <span>Ends: {formatEndDate(market.endDate)}</span>
        </div>
      </div>
    </div>
  );
});

MarketCard.displayName = 'MarketCard';

export default MarketCard;
