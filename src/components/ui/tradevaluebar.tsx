"use client";
import React from "react";
import { PriceDisplay } from "../PriceDisplay";
import { formatPureNumber } from "@mobula_labs/sdk";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "./tooltip";

type FeeValue = number | string | null | undefined;

interface TradeValueBarProps {
  trade: {
    tokenAmountUsd: string | number;
    type: string;
    totalFeesUSD?: FeeValue;
    gasFeesUSD?: FeeValue;
    platformFeesUSD?: FeeValue;
    mevFeesUSD?: FeeValue;
  };
  maxValue: number;
}

const normalizeFeeValue = (value: FeeValue): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

function FeesBadge({ trade }: { trade: TradeValueBarProps["trade"] }) {
  const totalFees = normalizeFeeValue(trade.totalFeesUSD);
  
  if (totalFees === null || totalFees <= 0) return null;

  const feeBreakdownItems = [
    { key: "gas", label: "Gas", value: normalizeFeeValue(trade.gasFeesUSD) },
    { key: "platform", label: "Platform", value: normalizeFeeValue(trade.platformFeesUSD) },
    { key: "mev", label: "MEV", value: normalizeFeeValue(trade.mevFeesUSD) },
  ].filter((item): item is { key: string; label: string; value: number } => item.value !== null && item.value > 0);

  const hasFeeBreakdown = feeBreakdownItems.length > 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="ml-1 px-1 py-0.5 text-[8px] sm:text-[9px] font-medium bg-orange-500/20 text-orange-400 rounded cursor-help whitespace-nowrap">
          -${formatPureNumber(totalFees, { minFractionDigits: 2, maxFractionDigits: 2 })}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="text-[10px] font-medium text-textPrimary p-2 min-w-[120px]"
      >
        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold text-orange-400 mb-1">Fees Breakdown</div>
          {hasFeeBreakdown ? (
            <>
              {feeBreakdownItems.map((fee) => (
                <div key={fee.key} className="flex justify-between gap-3">
                  <span className="text-grayGhost">{fee.label}:</span>
                  <span className="text-white">
                    ${formatPureNumber(fee.value, { minFractionDigits: 2, maxFractionDigits: 4 })}
                  </span>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-borderDefault pt-1 mt-1">
                <span className="text-grayGhost font-semibold">Total:</span>
                <span className="text-orange-400 font-semibold">${formatPureNumber(totalFees, { minFractionDigits: 2, maxFractionDigits: 4 })}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between gap-3">
              <span className="text-grayGhost">Total Fees:</span>
              <span className="text-orange-400">${formatPureNumber(totalFees, { minFractionDigits: 2, maxFractionDigits: 4 })}</span>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function TradeValueBar({ trade, maxValue }: TradeValueBarProps) {
  const value = Number(trade.tokenAmountUsd);
  const percent = maxValue > 0 ? (value / maxValue) * 70 : 0;
  const isBuy = trade.type.toLowerCase() === "buy" || trade.type.toLowerCase() === "deposit";

  const gradient = isBuy
    ? "linear-gradient(90deg, rgba(24,199,34,0) 0%, rgba(24,199,34,0.15) 100%)"
    : "linear-gradient(90deg, rgba(252, 252, 252, 0) 0%, rgba(252, 252, 252, 0.15) 100%)";

  return (
    <TooltipProvider>
      <div className="relative w-full h-full flex items-center overflow-hidden rounded-sm">
        {/* background bar */}
        <div
          className="absolute left-0 top-0 h-full transition-all duration-500 ease-out"
          style={{ backgroundImage: gradient, width: `${percent}%` }}
        />

        {/* label */}
        <div
          className={`relative z-10 pl-2 text-xs font-medium flex items-center ${isBuy ? "text-success" : "text-error"}`}
        >
          <PriceDisplay usdAmount={value}/>
          <FeesBadge trade={trade} />
        </div>
      </div>
    </TooltipProvider>
  );
}
