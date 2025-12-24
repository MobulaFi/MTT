import { ArrowDown, ArrowUp } from "lucide-react";
import React from "react";

interface TradeTimeHeaderProps {
  showAbsoluteTime: boolean;
  orderBy: "asc" | "desc";
  onToggleFormat: () => void;
  onToggleOrder: () => void;
}

export const TradeTimeHeader: React.FC<TradeTimeHeaderProps> = ({
  showAbsoluteTime,
  orderBy,
  onToggleFormat,
  onToggleOrder,
}) => {
  const isAscending = orderBy === "asc";

  return (
    <div
      className="flex items-center gap-2 px-4 select-none transition-colors"
      title="Toggle between Age/Time or change order"
    >
      {/* Toggle Age/Time format */}
      <span
        onClick={onToggleFormat}
        className="inline-flex items-center gap-1 cursor-pointer hover:text-textPrimary transition-colors"
      >
        <span className={showAbsoluteTime ? "text-ghost" : "text-textPrimary"}>
          Age
        </span>
        <span className="text-grayGhost">/</span>
        <span className={showAbsoluteTime ? "text-textPrimary" : "text-grayGhost"}>
          Time
        </span>
      </span>

      {/* Toggle sort order */}
      <button
        onClick={onToggleOrder}
        className="cursor-pointer text-grayGhost hover:text-textPrimary transition-colors"
        title={`Sort ${isAscending ? "descending" : "ascending"}`}
      >
        {isAscending ? (
          <ArrowUp size={13} className="transition-transform" />
        ) : (
          <ArrowDown size={13} className="transition-transform" />
        )}
      </button>
    </div>
  );
};
