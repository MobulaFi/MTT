"use client";
import React from "react";
import { PriceDisplay } from "../PriceDisplay";

interface TradeValueBarProps {
  trade: {
    tokenAmountUsd: string | number;
    type: string;
  };
  maxValue: number;
}

export function TradeValueBar({ trade, maxValue }: TradeValueBarProps) {
  const value = Number(trade.tokenAmountUsd);
  const percent = maxValue > 0 ? (value / maxValue) * 70 : 0;
  const isBuy = trade.type.toLowerCase() === "buy" || trade.type.toLowerCase() === "deposit";

  const gradient = isBuy
    ? "linear-gradient(90deg, rgba(24,199,34,0) 0%, rgba(24,199,34,0.15) 100%)"
    : "linear-gradient(90deg, rgba(252, 252, 252, 0) 0%, rgba(252, 252, 252, 0.15) 100%)";

  return (
    <div className="relative w-full h-full flex items-center overflow-hidden rounded-sm">
      {/* background bar */}
      <div
        className="absolute left-0 top-0 h-full transition-all duration-500 ease-out"
        style={{ backgroundImage: gradient, width: `${percent}%` }}
      />

      {/* label */}
      <div
        className={`relative z-10 pl-2 text-xs font-medium ${isBuy ? "text-success" : "text-error"
          }`}
      >
        <PriceDisplay usdAmount={value}/>
      </div>
    </div>
  );
}
