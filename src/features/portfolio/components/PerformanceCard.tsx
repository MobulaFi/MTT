'use client';

import { fmtUsd } from '@/lib/format';
import { FiShare2 } from 'react-icons/fi';

interface PerformanceCardProps {
  totalPnl: number;
  realizedPnl: number;
  totalTxns: number;
  winCount: number;
  winRateDistribution?: Record<string, number>;
  isLoading: boolean;
}

const DISTRIBUTION_LABELS = [
  { key: '>500%', label: '>500%', color: '#22c55e' },
  { key: '200%-500%', label: '200% ~ 500%', color: '#4ade80' },
  { key: '50%-200%', label: '0% ~ 300%', color: '#86efac' },
  { key: '0%-50%', label: '0% ~ -50%', color: '#a78bfa' },
  { key: '-50%-0%', label: '0% ~ -50%', color: '#f97316' },
  { key: '<-50%', label: '< -50%', color: '#ef4444' },
];

export function PerformanceCard({
  totalPnl,
  realizedPnl,
  totalTxns,
  winCount,
  winRateDistribution,
  isLoading,
}: PerformanceCardProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse h-full">
        <div className="h-4 w-24 bg-bgTertiary rounded" />
        <div className="h-4 w-32 bg-bgTertiary rounded" />
        <div className="h-4 w-28 bg-bgTertiary rounded" />
      </div>
    );
  }

  const lossCount = totalTxns - winCount;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <span className="text-base text-textTertiary font-medium">Performance</span>
        <button className="text-textTertiary hover:text-white transition-colors" title="Share">
          <FiShare2 size={16} />
        </button>
      </div>

      {/* Stats rows */}
      <div className="space-y-3 mb-5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-sm text-textTertiary">Total Pnl</span>
          <span className={`text-sm font-semibold ${totalPnl >= 0 ? 'text-success' : 'text-error'}`}>
            {totalPnl >= 0 ? '+' : ''}{fmtUsd(totalPnl)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-textTertiary">Realized PNL</span>
          <span className={`text-sm font-semibold ${realizedPnl >= 0 ? 'text-success' : 'text-error'}`}>
            {realizedPnl >= 0 ? '+' : ''}{fmtUsd(realizedPnl)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-textTertiary">Total TXNS</span>
          <span className="text-sm font-semibold text-white">
            {totalTxns}
            <span className="text-success ml-2">{winCount}</span>
            <span className="text-textTertiary">/</span>
            <span className="text-error">{lossCount}</span>
          </span>
        </div>
      </div>

      {/* Win rate distribution - legend style */}
      <div className="space-y-2.5 flex-1 overflow-hidden">
        {DISTRIBUTION_LABELS.map(({ key, label, color }) => {
          const count = winRateDistribution?.[key] ?? 0;
          return (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs text-textTertiary">{label}</span>
              </div>
              <span className={`text-xs font-mono ${count > 0 ? 'text-white' : 'text-textTertiary'}`}>
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
