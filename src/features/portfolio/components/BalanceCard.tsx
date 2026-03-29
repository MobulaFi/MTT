'use client';

import { fmtUsd } from '@/lib/format';
import { FiCopy } from 'react-icons/fi';
import { HiOutlineSwitchVertical } from 'react-icons/hi';

interface BalanceCardProps {
  totalValue: number;
  realizedPnl: number;
  tradeableBalance: number;
  isLoading: boolean;
}

export function BalanceCard({ totalValue, realizedPnl, tradeableBalance, isLoading }: BalanceCardProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse h-full">
        <div className="h-4 w-16 bg-bgTertiary rounded" />
        <div className="h-6 w-24 bg-bgTertiary rounded" />
        <div className="h-4 w-20 bg-bgTertiary rounded" />
        <div className="h-5 w-18 bg-bgTertiary rounded" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-base text-textTertiary font-medium">Balance</span>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 text-textTertiary hover:text-white transition-colors">
            <HiOutlineSwitchVertical size={16} />
            <span className="text-sm font-medium">USD</span>
          </button>
          <button className="text-textTertiary hover:text-white transition-colors" title="Copy">
            <FiCopy size={16} />
          </button>
        </div>
      </div>

      {/* Total Value */}
      <div className="mb-5">
        <p className="text-sm text-textTertiary mb-2">Total Value</p>
        <p className="text-3xl font-bold text-white leading-tight">{fmtUsd(totalValue)}</p>
      </div>

      {/* Realized PNL */}
      <div className="mb-5">
        <p className="text-sm text-textTertiary mb-2">Realized PNL</p>
        <p className={`text-lg font-semibold leading-tight ${realizedPnl >= 0 ? 'text-success' : 'text-error'}`}>
          {realizedPnl >= 0 ? '+' : ''}{fmtUsd(realizedPnl)}
        </p>
      </div>

      {/* Tradeable Balance */}
      <div className="pt-5 border-t border-borderDefault/30 mt-auto">
        <p className="text-sm text-textTertiary mb-2">Tradeable Balance</p>
        <p className="text-lg font-bold text-white leading-tight">{fmtUsd(tradeableBalance)}</p>
      </div>
    </div>
  );
}
