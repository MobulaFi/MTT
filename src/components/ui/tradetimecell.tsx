"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { buildExplorerUrl } from "@mobula_labs/sdk";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface TradeTimeCellProps {
  timestamp?: number | string | null;
  showAbsolute: boolean;
  hash: string;
  blockchain?: string;
  showSeconds?: boolean;
}

export function TradeTimeCell({
  timestamp,
  showAbsolute,
  hash,
  blockchain,
  showSeconds = true,
}: TradeTimeCellProps) {
  const [, setTick] = useState(0);

  // ⏱️ Force re-render every second when in relative mode
  useEffect(() => {
    if (!showAbsolute) {
      const interval = setInterval(() => {
        setTick((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [showAbsolute]);

  // Validate timestamp and create date each render (so relative time changes)
  const date = (() => {
    if (timestamp === undefined || timestamp === null) return null;
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? null : d;
  })();

  const getRelativeTime = () => {
    if (!date) return "N/A";
  
    const now = Date.now();
    const diffMsRaw = now - date.getTime();

    const diffMs = Math.max(diffMsRaw, 0);
  
    const diffSec = diffMs / 1000;
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
  
    if (diffSec < 1) return `${Math.floor(diffMs)}ms`;
    if (diffSec < 60) return `${Math.floor(diffSec)}s`;
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHour < 24) return `${diffHour}h`;
    return `${diffDay}d`;
  };
  
  const dateFormat = showSeconds ? "yyyy-MM-dd HH:mm:ss" : "yyyy-MM-dd";

  const display = date
    ? showAbsolute
      ? format(date, dateFormat)
      : getRelativeTime()
    : "N/A";

  const explorerUrl =
    blockchain && hash ? buildExplorerUrl(blockchain, "tx", hash) : null;

  if (!explorerUrl) {
    return (
      <span
        title={date ? format(date, dateFormat) : "N/A"}
        className="text-textTertiary font-normal text-[12px] leading-[1rem]"
      >
        {display}
      </span>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-textTertiary font-normal text-[12px] leading-[1rem] underline-offset-2 hover:underline hover:text-textTertiary transition-colors"
          >
            {display}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="left">open Txn</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}