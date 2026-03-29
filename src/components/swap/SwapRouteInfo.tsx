'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ArrowRight } from 'lucide-react';
import { useSwapPageStore } from '@/store/useSwapPageStore';
import { formatPureNumber, formatCryptoPrice } from '@mobula_labs/sdk';

export function SwapRouteInfo() {
  const { quote, tokenIn, tokenOut, amountIn, amountOut, slippage } = useSwapPageStore();
  const [expanded, setExpanded] = useState(false);
  const [rateInverted, setRateInverted] = useState(false);

  const hasData = !!quote?.data && !!tokenIn && !!tokenOut && !!amountIn && !!amountOut;

  const amountInNum = hasData ? parseFloat(amountIn) : 0;
  const amountOutNum = hasData ? parseFloat(amountOut) : 0;
  const minReceived = amountOutNum * (1 - slippage / 100);

  const data = hasData ? (quote.data as Record<string, unknown>) : null;
  const priceImpact = data
    ? (data.marketImpactPercentage as number | undefined) ?? (data.estimatedMarketImpact as number | undefined) ?? null
    : null;
  const totalFee = data
    ? ((data.details as Record<string, unknown> | undefined)?.route as Record<string, unknown> | undefined)?.totalFeePercentage as number | undefined
      ?? (data.poolFees as number | undefined) ?? null
    : null;
  const networkCost = data
    ? (data.networkCost as number | undefined) ?? (data.estimatedGas as number | undefined) ?? null
    : null;

  const rateDisplay = useMemo(() => {
    if (!hasData || amountInNum <= 0 || amountOutNum <= 0) return '';
    if (rateInverted) {
      return `1 ${tokenOut!.symbol} = ${formatPureNumber(amountInNum / amountOutNum)} ${tokenIn!.symbol}`;
    }
    return `1 ${tokenIn!.symbol} = ${formatPureNumber(amountOutNum / amountInNum)} ${tokenOut!.symbol}`;
  }, [hasData, amountInNum, amountOutNum, tokenIn, tokenOut, rateInverted]);

  const impactColor = priceImpact !== null
    ? Math.abs(priceImpact) > 5
      ? 'text-error'
      : Math.abs(priceImpact) > 1
      ? 'text-warning'
      : 'text-success'
    : 'text-textPrimary';

  if (!hasData) return null;

  return (
    <div className="px-5 pb-5">
      {/* Rate Bar */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setRateInverted(!rateInverted)}
          className="text-[13px] text-textSecondary hover:text-textPrimary transition-colors font-medium"
        >
          {rateDisplay}
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[12px] text-textTertiary hover:text-textSecondary transition-colors"
        >
          Details
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Expandable Details */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
        expanded ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="bg-bgPrimary rounded-xl border border-borderDefault/60 p-4 space-y-3">
          {/* Route Path */}
          <div className="flex items-center gap-2 text-[12px] text-textSecondary pb-2 border-b border-borderDefault/40">
            <span className="font-medium">{tokenIn!.symbol}</span>
            <ArrowRight size={12} className="text-textTertiary" />
            <span className="font-medium">{tokenOut!.symbol}</span>
            <span className="text-textTertiary ml-auto">via Hawk</span>
          </div>

          {priceImpact !== null && (
            <Row
              label="Price impact"
              value={`${priceImpact > 0 ? '-' : ''}${Math.abs(priceImpact).toFixed(2)}%`}
              valueClass={impactColor}
            />
          )}

          <Row
            label="Minimum received"
            value={`${formatPureNumber(minReceived)} ${tokenOut!.symbol}`}
          />

          {totalFee !== null && totalFee !== undefined && (
            <Row label="Swap fees" value={`${totalFee.toFixed(2)}%`} />
          )}

          {networkCost !== null && networkCost !== undefined && (
            <Row label="Network cost" value={`~${formatCryptoPrice(networkCost)}`} />
          )}

          <Row label="Slippage tolerance" value={`${slippage}%`} />
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass = 'text-textPrimary',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-textTertiary">{label}</span>
      <span className={`text-[12px] font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}
