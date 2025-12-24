"use client";

import { ArrowUpDown, ExternalLink, Funnel, RefreshCcwDot } from "lucide-react";
import { FormattedTokenTradesResponse } from "@mobula_labs/types";
import { usePairTradeStore, type Transaction as StoreTransaction } from "@/features/pair/store/usePairTradeStore";
import { useEffect, useState, useCallback, useMemo, useRef, memo } from "react";
import { getMobulaClient } from "@/lib/mobulaClient";
import { formatPureNumber, truncate, buildExplorerUrl } from "@mobula_labs/sdk";
import { TradeTimeCell } from "../ui/tradetimecell";
import { TradeTimeHeader } from "../ui/tradetimeheader";
import { TradeValueBar } from "../ui/tradevaluebar";
import { useWalletModalStore } from "@/store/useWalletModalStore";
import { TradeCompactSkeleton, TradeWithoutCompactSkeleton } from "../skeleton";
import { useFilterModalStore } from "@/store/useFilterModalStore";
import { FilterModal } from "../FilterModal";
import { usePriceDisplayStore } from "@/store/useDisplayPriceStore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { HOLDER_TAG_ICONS } from "@/assets/icons/HolderTags";
import SafeImage from "@/components/SafeImage";
import { useWalletDisplayName } from "@/hooks/useWalletDisplayName";
import { useRenderCounter } from "@/utils/useRenderCounter";

type Transaction = FormattedTokenTradesResponse["data"][number];


const isDepositOrWithdrawal = (type: string): boolean => {
  const lowerType = type.toLowerCase();
  return lowerType === "deposit" || lowerType === "withdrawal";
};

function FormattedPrice({ price, className = "" }: { price: string | number; className?: string }) {
  const formattedPrice = useMemo(() => formatPureNumber(price), [price]);
  const fullPrice = useMemo(() => formatPureNumber(price, { maxFractionDigits: 18 }), [price]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`truncate block cursor-help ${className}`}>{formattedPrice}</span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="text-[9px] sm:text-[10px] font-medium text-textPrimary"
      >
        {fullPrice}
      </TooltipContent>
    </Tooltip>
  );
}

function FormattedAmount({ 
  trade, 
  displayCurrency, 
  className = "" 
}: { 
  trade: Transaction; 
  displayCurrency: string; 
  className?: string;
}) {
  const amountValue = useMemo(() => 
    displayCurrency === 'QUOTE' 
      ? formatPureNumber(trade.tokenAmount, { minFractionDigits: 2, maxFractionDigits: 2 })
      : `$${formatPureNumber(trade.tokenAmountUsd, { minFractionDigits: 2, maxFractionDigits: 2 })}`,
    [trade.tokenAmount, trade.tokenAmountUsd, displayCurrency]
  );

  const amountValueFull = useMemo(() => 
    displayCurrency === 'QUOTE' 
      ? formatPureNumber(trade.tokenAmount, { maxFractionDigits: 18 })
      : `$${formatPureNumber(trade.tokenAmountUsd, { maxFractionDigits: 18 })}`,
    [trade.tokenAmount, trade.tokenAmountUsd, displayCurrency]
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`truncate cursor-help ${className}`}>{amountValue}</span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="text-[9px] sm:text-[10px] font-medium text-textPrimary"
      >
        {amountValueFull}
      </TooltipContent>
    </Tooltip>
  );
}


function TradeLabels({ labels, compact = false }: { labels: string[]; compact?: boolean }) {
  if (!labels || labels.length === 0) return null;

  return (
    <div className={`flex items-center ${compact ? 'gap-0.5' : 'space-x-0.5 sm:space-x-1'}`}>
      {labels.slice(0, compact ? 1 : labels.length).map((tag: string) => {
        const icon = HOLDER_TAG_ICONS[tag];
        return icon ? (
          <Tooltip key={tag}>
            <TooltipTrigger asChild>
              <div className={`${compact ? 'text-[7px] sm:text-[8px]' : ''} flex-shrink-0 leading-none cursor-help`}>
                {icon}
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className={`${compact ? 'text-[9px] sm:text-[10px]' : 'text-[10px]'} font-medium text-textPrimary`}
            >
              {tag}
            </TooltipContent>
          </Tooltip>
        ) : null;
      })}
      {compact && labels.length > 1 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-[7px] sm:text-[8px] text-grayGhost font-bold flex-shrink-0 leading-none px-0.5 bg-bgContainer rounded cursor-help">
              +{labels.length - 1}
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="text-[9px] sm:text-[10px] font-medium text-textPrimary max-w-[180px]"
          >
            <div className="flex flex-col gap-1">
              {labels.slice(1).map((tag: string) => (
                <div key={tag} className="flex items-center gap-1.5">
                  <span className="text-xs">{HOLDER_TAG_ICONS[tag]}</span>
                  <span>{tag}</span>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

interface TradesTableProps {
  pair: {
    address: string;
    blockchain: string;
  } | null;
  storeTrades: any[];
  isPair?: boolean;
  isLoading?: boolean;
  compact?: boolean;
  showCurrencyToggle?: boolean;
}

// Trader cell component to display emoji + nickname or first 3 chars
function TraderCell({ address, compact = false }: { address: string; compact?: boolean }) {
  const display = useWalletDisplayName(address);
  
  // Determine display text based on mode
  const displayText = compact
    ? (display.hasCustomName ? display.name.slice(-3) : address.slice(-3))
    : (display.hasCustomName ? display.name.slice(-10) : address.slice(-10));
  
  // Only show emoji if it's been customized (not the default ghost)
  const hasCustomEmoji = display.emoji !== '👻';
  
  return (
    <span className="inline-flex items-center gap-0.5 sm:gap-1 truncate">
      {hasCustomEmoji && (
        <span className={compact ? "text-[10px] sm:text-xs" : "text-xs sm:text-sm"}>
          {display.emoji}
        </span>
      )}
      <span className="truncate">{displayText}</span>
    </span>
  );
}

// Memoized trade row component for compact mode to prevent unnecessary re-renders
const CompactTradeRow = memo(({ 
  trade, 
  maxAmount, 
  displayCurrency, 
  quoteCurrencySymbol,
  onWalletClick 
}: { 
  trade: Transaction;
  maxAmount: number;
  displayCurrency: string;
  quoteCurrencySymbol: string;
  onWalletClick: (wallet: string, txHash: string, blockchain: string) => void;
}) => {
  const isBuy = trade.type.toLowerCase() === "buy" || trade.type.toLowerCase() === "deposit";
  const value = +trade.tokenAmountUsd;
  const percent = (value / maxAmount) * 80;

  return (
    <tr
      key={trade.hash}
      className="h-6 sm:h-7 text-grayGhost hover:bg-bgTableHover"
      style={{
        backgroundImage: isBuy
          ? "linear-gradient(90deg, rgba(24,199,34,0) 0%, rgba(24,199,34,0.15) 100%)"
          : "linear-gradient(90deg, rgba(252, 252, 252, 0) 0%, rgba(252, 252, 252, 0.15) 100%)",
        backgroundSize: `${percent}% 100%`,
        backgroundRepeat: "no-repeat",
      }}
    >
      <td className={`pl-1 font-medium text-[10px] sm:text-xs ${isBuy ? "text-success" : "text-white"}`}>
        <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
          {displayCurrency === 'QUOTE' && (trade as unknown as { logo?: string; symbol?: string }).logo && (
            <SafeImage
              src={(trade as unknown as { logo: string }).logo}
              alt={(trade as unknown as { symbol?: string }).symbol || 'Token'}
              width={10}
              height={10}
              className="rounded-full flex-shrink-0 sm:w-3 sm:h-3"
            />
          )}
          <FormattedAmount trade={trade} displayCurrency={displayCurrency} />
        </div>
      </td>
      <td className="text-left font-medium text-[10px] sm:text-xs text-grayGhost pl-2 sm:pl-3">
        {isDepositOrWithdrawal(trade.type) ? (
          <span className="truncate block">{trade.type}</span>
        ) : (
          <FormattedPrice price={trade.tokenPrice} />
        )}
      </td>
      <td 
        className="text-left font-medium text-[10px] sm:text-xs text-grayGhost cursor-pointer hover:text-textPrimary pl-2 sm:pl-3"
        onClick={() => onWalletClick(trade.sender, trade.hash, trade.blockchain)}
      >
        <TraderCell address={trade.sender} compact={true} />
      </td>
      <td className="pr-2 sm:pr-3">
        <div className="flex items-center justify-end gap-0.5 sm:gap-1">
          {trade.labels && <TradeLabels labels={trade.labels} compact={true} />}
          <div className="text-[9px] sm:text-[10px] text-grayGhost whitespace-nowrap flex-shrink-0">
            <TradeTimeCell
              timestamp={trade.date}
              showAbsolute={false}
              hash={trade.hash}
              blockchain={trade.blockchain}
            />
          </div>
        </div>
      </td>
    </tr>
  );
}, (prev, next) => {
  if (prev.trade.hash !== next.trade.hash) return false;
  
  if (prev.trade.tokenAmountUsd !== next.trade.tokenAmountUsd) return false;
  if (prev.trade.tokenPrice !== next.trade.tokenPrice) return false;
  if (prev.trade.date !== next.trade.date) return false;
  if (prev.maxAmount !== next.maxAmount) return false;
  if (prev.displayCurrency !== next.displayCurrency) return false;
  if (prev.quoteCurrencySymbol !== next.quoteCurrencySymbol) return false;
  
  // All props are the same - skip re-render
  return true;
});

CompactTradeRow.displayName = 'CompactTradeRow';

const TradeRow = memo(({
  trade,
  maxAmount,
  displayCurrency,
  showAbsoluteTime,
  onWalletClick,
  currentWalletFilter,
  onToggleWalletFilter
}: {
  trade: Transaction;
  maxAmount: number;
  displayCurrency: string;
  showAbsoluteTime: boolean;
  onWalletClick: (wallet: string, txHash: string, blockchain: string) => void;
  currentWalletFilter?: string;
  onToggleWalletFilter: (wallet: string) => void;
}) => {
  return (
    <tr
      key={trade.hash}
      className="cursor-default border-b border-borderDefault/50 bg-bgPrimary even:bg-bgTableAlt hover:bg-bgTableHover text-[10px] sm:text-xs h-8 sm:h-10"
    >
      <td className="px-1.5 sm:px-2 md:px-4">
        <TradeTimeCell
          timestamp={trade.date}
          showAbsolute={showAbsoluteTime}
          hash={trade.hash}
          blockchain={trade.blockchain}
        />
      </td>
      <td className={`text-left font-medium text-[10px] sm:text-xs ${trade.type === "buy" || trade.type === "deposit" ? "text-success" : "text-white"}`}>
        {trade.type}
      </td>
      <td className="text-left text-grayGhost font-medium text-[10px] sm:text-xs">
        {isDepositOrWithdrawal(trade.type) ? (
          <span>{trade.type}</span>
        ) : (
          <FormattedPrice price={trade.tokenPrice} />
        )}
      </td>
      <td className="text-left text-grayGhost font-medium text-[10px] sm:text-xs">
        <span className="truncate block">{formatPureNumber(trade.tokenAmount)}</span>
      </td>
      <td className="text-left h-6 sm:h-8 p-0 align-middle">
        <TradeValueBar trade={trade} maxValue={maxAmount} />
      </td>
      <td className="pr-2 sm:pr-4 text-right">
        <div className="inline-flex items-center space-x-0.5 sm:space-x-1">
          {trade.labels && <TradeLabels labels={trade.labels} compact={false} />}
          <span
            onClick={() => onWalletClick(trade.sender, trade.hash, trade.blockchain)}
            className="cursor-pointer px-0.5 sm:px-1 md:px-2 font-medium text-[10px] sm:text-xs text-grayGhost hover:text-textPrimary hover:underline underline-offset-2"
          >
            <TraderCell address={trade.sender} compact={false} />
          </span>
          {buildExplorerUrl(trade.blockchain, "tx", trade.hash) && (
            <a
              href={buildExplorerUrl(trade.blockchain, "tx", trade.hash)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink color="#777A8C" size={11} className="sm:w-[13px] sm:h-[13px]" />
            </a>
          )}
          <Funnel
            color={currentWalletFilter === trade.sender ? "#B84FFF" : "#777A8C"}
            onClick={() => onToggleWalletFilter(trade.sender)}
            size={11}
            className="cursor-pointer hover:opacity-70 sm:w-[13px] sm:h-[13px]"
          />
        </div>
      </td>
    </tr>
  );
}, (prev, next) => {
  // Custom comparison: only re-render if trade data actually changed
  if (prev.trade.hash !== next.trade.hash) return false;
  if (prev.trade.tokenAmountUsd !== next.trade.tokenAmountUsd) return false;
  if (prev.trade.tokenPrice !== next.trade.tokenPrice) return false;
  if (prev.trade.date !== next.trade.date) return false;
  if (prev.trade.tokenAmount !== next.trade.tokenAmount) return false;
  if (prev.trade.labels?.join(',') !== next.trade.labels?.join(',')) return false;
  if (prev.maxAmount !== next.maxAmount) return false;
  if (prev.displayCurrency !== next.displayCurrency) return false;
  if (prev.showAbsoluteTime !== next.showAbsoluteTime) return false;
  if (prev.currentWalletFilter !== next.currentWalletFilter) return false;
  return true;
});

TradeRow.displayName = 'TradeRow';

// Memoize TradesTable to prevent parent re-renders from causing full re-renders
const TradesTableComponent = ({
  pair,
  storeTrades = [],
  isPair = true,
  isLoading,
  compact = false,
  showCurrencyToggle = false,
}: TradesTableProps) => {
  // Render counter for diagnostics
  useRenderCounter('TradesTable');

  // Use granular selectors with shallow comparison to prevent unnecessary re-renders
  const orderBy = usePairTradeStore((s) => s.orderBy);
  const updateOrderBy = usePairTradeStore((s) => s.updateOrderBy);
  
  // CRITICAL: Subscribe to trades directly from store, not from props
  // This allows TradesTable to update independently without triggering parent re-renders
  // Use ref to track previous trades and prevent re-renders when content hasn't changed
  const storeTradesRef = useRef<StoreTransaction[]>([]);
  const prevTradesHashRef = useRef<string>('');
  
  // Get trades from store
  const allStoreTradesRaw = usePairTradeStore((s) => s.trades) as StoreTransaction[];
  
  // Create hash to detect actual changes (check first 5 hashes + length)
  const currentTradesHash = useMemo(() => {
    if (allStoreTradesRaw.length === 0) return '';
    return allStoreTradesRaw.slice(0, 5).map((t: StoreTransaction) => t.hash).join(',') + `:${allStoreTradesRaw.length}`;
  }, [allStoreTradesRaw]);
  
  // Only update effectiveStoreTrades if content actually changed
  const effectiveStoreTrades = useMemo(() => {
    // If hash hasn't changed, return previous reference to prevent re-render
    if (currentTradesHash === prevTradesHashRef.current && storeTradesRef.current.length > 0) {
      return storeTradesRef.current as Transaction[];
    }
    
    // Content changed - update refs and return new array
    prevTradesHashRef.current = currentTradesHash;
    storeTradesRef.current = allStoreTradesRaw;
    return allStoreTradesRaw.length > 0 
      ? (allStoreTradesRaw as Transaction[]) 
      : (storeTrades as Transaction[]);
  }, [allStoreTradesRaw, currentTradesHash, storeTrades]);
  
  const [historicalTrades, setHistoricalTrades] = useState<
    FormattedTokenTradesResponse["data"]
  >([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);
  const [showAbsoluteTime, setShowAbsoluteTime] = useState(false);
  const [offset, setOffset] = useState(0);

  const { openModal, currentFilters, setFilters } = useFilterModalStore();
  const { displayCurrency, quoteCurrencySymbol, toggleCurrency } = usePriceDisplayStore();

  const currencyLabel = displayCurrency === 'QUOTE' ? quoteCurrencySymbol : 'USD';

  const loaderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOffset(0);
    setHistoricalTrades([]);
    setIsLoadingTrades(false);
  }, [pair?.address, pair?.blockchain]);

  // Fetch trades - reset when filters change
  const fetchTrades = useCallback(async () => {
    if (!pair?.address || !pair?.blockchain) return;
    setIsLoadingTrades(true);
    try {
      const client = getMobulaClient();
      const response = (await client.fetchTokenTrades({
        address: pair.address,
        blockchain: pair.blockchain,
        limit: 100,
        offset,
        sortOrder: orderBy,
        mode: isPair ? "pair" : "asset",
        formatted: true,
        ...(currentFilters.wallet && {
          transactionSenderAddresses: currentFilters.wallet,
        }),
      })) as FormattedTokenTradesResponse;

      if (response?.data) {
        setHistoricalTrades((prev) => {
          if (offset === 0) return response.data;
          const existingHashes = new Set(prev.map((t) => t.hash));
          const newTrades = response.data.filter((t) => !existingHashes.has(t.hash));
          return [...prev, ...newTrades];
        });
      }
    } catch (err) {
      console.error("Failed to fetch trades:", err);
    } finally {
      setIsLoadingTrades(false);
    }
  }, [pair?.address, pair?.blockchain, orderBy, offset, currentFilters.wallet, isPair]);

  // Reset offset when orderBy or filters change
  useEffect(() => {
    setOffset(0);
    setHistoricalTrades([]);
  }, [orderBy, currentFilters.wallet]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  // Combine WS + historical trades
  // Use effectiveStoreTrades (from store subscription) instead of prop
  const allTrades = useMemo(() => {
    const map = new Map(historicalTrades.map((t) => [t.hash, t]));
    const newWs = effectiveStoreTrades.filter((t) => !map.has(t.hash));
    return [...newWs, ...historicalTrades];
  }, [effectiveStoreTrades, historicalTrades]);

  // Split expensive computations into smaller, focused useMemos for better performance
  const uniqueTrades = useMemo(() => {
    const seen = new Set<string>();
    return allTrades.filter((t) => {
      if (seen.has(t.hash)) return false;
      seen.add(t.hash);
      return true;
    });
  }, [allTrades]);

  const filteredTrades = useMemo(() => {
    let filtered = uniqueTrades;

    if (currentFilters.wallet) {
      filtered = filtered.filter(
        (t) => t.sender.toLowerCase() === currentFilters.wallet!.toLowerCase()
      );
    }

    if (currentFilters.type !== "all") {
      filtered = filtered.filter((t) => t.type.toLowerCase() === currentFilters.type);
    }

    if (currentFilters.min !== undefined) {
      filtered = filtered.filter((t) => Number(t.tokenAmountUsd) >= currentFilters.min!);
    }

    if (currentFilters.max !== undefined) {
      filtered = filtered.filter((t) => Number(t.tokenAmountUsd) <= currentFilters.max!);
    }

    return filtered;
  }, [uniqueTrades, currentFilters.wallet, currentFilters.type, currentFilters.min, currentFilters.max]);

  const sortedTrades = useMemo(() => {
    return [...filteredTrades].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [filteredTrades]);

  const maxAmount = useMemo(
    () => (sortedTrades.length ? Math.max(...sortedTrades.map((t) => +t.tokenAmountUsd)) : 1),
    [sortedTrades]
  );

  // Stable callback for wallet click
  const handleWalletClick = useCallback((wallet: string, txHash: string, blockchain: string) => {
    useWalletModalStore.getState().openWalletModal({
      walletAddress: wallet,
      txHash,
      blockchain,
    });
  }, []);

  // Stable callback for wallet filter toggle
  const handleToggleWalletFilter = useCallback((wallet: string) => {
    if (currentFilters.wallet === wallet) {
      setFilters({ wallet: undefined });
    } else {
      setFilters({ wallet });
    }
  }, [currentFilters.wallet, setFilters]);




  // Infinite scroll
  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingTrades) setOffset((p) => p + 100);
      },
      { rootMargin: "200px" }
    );
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [isLoadingTrades]);

  // Loading skeletons
  if (isLoading || (isLoadingTrades && historicalTrades.length === 0))
    return compact ? <TradeCompactSkeleton /> : <TradeWithoutCompactSkeleton />;


  return (
    <TooltipProvider>
      {/* Compact Mode */}
      {compact ? (
        <div className="w-full h-full overflow-y-auto scrollbar-thin scrollbar-thumb-[#22242D] scrollbar-track-transparent hover:scrollbar-thumb-[#343439]">
          <table className="w-full text-[10px] sm:text-xs bg-bgPrimary border-collapse table-fixed">
            <thead className="sticky top-0 z-10 h-6 sm:h-7 bg-bgPrimary hover:bg-bgPrimary border-b border-borderDefault text-grayGhost shadow-sm">
              <tr>
                <th 
                  onClick={toggleCurrency}
                  className="w-[24%] text-left font-medium text-[10px] sm:text-xs pl-1 cursor-pointer"
                >
                  <div className="flex items-center gap-1">
                    <span className="whitespace-nowrap text-xs">Amount</span>
                    <RefreshCcwDot
                      size={12}
                      className={`sm:w-3.5 sm:h-3.5 flex-shrink-0 ${displayCurrency === 'QUOTE' ? 'text-success' : 'text-grayGhost'}`}
                    />
                  </div>
                </th>
                <th className="w-[22%] text-left font-medium text-[10px] sm:text-xs pl-2 sm:pl-3">
                  Price
                </th>
                <th className="w-[22%] text-left font-medium text-[10px] sm:text-xs pl-2 sm:pl-3">Trader</th>
                <th className="w-[32%] text-right font-medium text-[10px] sm:text-xs pr-2 sm:pr-3">Age</th>
              </tr>
            </thead>
            <tbody>
              {sortedTrades.map((t) => (
                <CompactTradeRow
                  key={t.hash}
                  trade={t}
                  maxAmount={maxAmount}
                  displayCurrency={displayCurrency}
                  quoteCurrencySymbol={quoteCurrencySymbol}
                  onWalletClick={handleWalletClick}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // Full table mode
        <div className="w-full h-full overflow-y-auto overflow-x-auto scrollbar-thin scrollbar-thumb-[#22242D] scrollbar-track-transparent hover:scrollbar-thumb-[#343439]">
          <table className="min-w-[400px] w-full text-[10px] sm:text-xs bg-bgPrimary border-collapse table-fixed">
            <thead className="sticky top-0 z-20 h-7 sm:h-8 hover:bg-bgPrimary bg-bgPrimary border-b border-borderDefault text-grayGhost shadow-sm">
              <tr>
                <th className="w-[100px] text-left font-medium text-[10px] sm:text-xs">
                  <TradeTimeHeader
                    showAbsoluteTime={showAbsoluteTime}
                    orderBy={orderBy}
                    onToggleFormat={() => setShowAbsoluteTime((p) => !p)}
                    onToggleOrder={() => updateOrderBy(orderBy === "asc" ? "desc" : "asc")}
                  />
                </th>
                <th className="w-[80px] text-left font-medium text-[10px] sm:text-xs">Type</th>
                <th className="w-[100px] text-left font-medium text-[10px] sm:text-xs">Price</th>
                <th className="w-[100px] text-left font-medium text-[10px] sm:text-xs">Size</th>
                <th
                  onClick={showCurrencyToggle ? toggleCurrency : undefined}
                  className={`w-[130px] text-left font-medium text-[10px] sm:text-xs ${showCurrencyToggle
                    ? 'cursor-pointer hover:bg-bgContainer/50'
                    : ''
                    }`}
                >
                  <div className="flex items-center gap-1 sm:gap-2">
                    <span>Total {currencyLabel}</span>
                    {showCurrencyToggle && (
                      <RefreshCcwDot
                        size={12}
                        className={`sm:w-3.5 sm:h-3.5 ${displayCurrency === 'QUOTE'
                          ? 'text-success'
                          : 'text-grayGhost hover:text-success'
                          }`}
                      />
                    )}
                  </div>
                </th>
                <th className="w-[120px] text-right pr-2 sm:pr-4 font-medium text-[10px] sm:text-xs">Trader</th>
              </tr>
            </thead>
            <tbody>
              {sortedTrades.map((t) => (
                <TradeRow
                  key={t.hash}
                  trade={t}
                  maxAmount={maxAmount}
                  displayCurrency={displayCurrency}
                  showAbsoluteTime={showAbsoluteTime}
                  onWalletClick={handleWalletClick}
                  currentWalletFilter={currentFilters.wallet}
                  onToggleWalletFilter={handleToggleWalletFilter}
                />
              ))}
            </tbody>
          </table>
          <div ref={loaderRef} className="h-8" />
          <FilterModal />
        </div>
      )}
    </TooltipProvider>
  );
};

// Export memoized version - prevents re-renders when parent updates but props haven't changed
export const TradesTable = memo(TradesTableComponent, (prevProps, nextProps) => {
  // Custom comparison: only re-render if critical props changed
  // Compare trades by length and first hash (indicates new trades added)
  const prevTradesLength = prevProps.storeTrades?.length ?? 0;
  const nextTradesLength = nextProps.storeTrades?.length ?? 0;
  const prevFirstHash = prevProps.storeTrades?.[0]?.hash;
  const nextFirstHash = nextProps.storeTrades?.[0]?.hash;
  
  return (
    prevProps.pair?.address === nextProps.pair?.address &&
    prevProps.pair?.blockchain === nextProps.pair?.blockchain &&
    prevProps.isPair === nextProps.isPair &&
    prevProps.compact === nextProps.compact &&
    prevProps.showCurrencyToggle === nextProps.showCurrencyToggle &&
    prevProps.isLoading === nextProps.isLoading &&
    prevTradesLength === nextTradesLength &&
    prevFirstHash === nextFirstHash
  );
});

TradesTable.displayName = 'TradesTable';