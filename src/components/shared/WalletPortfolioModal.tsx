"use client";
import React, { useMemo, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { buildExplorerUrl, formatCryptoPrice, formatUSD } from "@mobula_labs/sdk";
import { ExternalLink, X, Edit2, BarChart3, TrendingUp, Calendar } from "lucide-react";
import { WalletChart, type ChartMode } from "./WalletChart";
import CopyToClipboard from "@/utils/CopyToClipboard";
import { useWalletModalStore } from "@/store/useWalletModalStore";
import Link from "next/link";
import { useWalletPortfolio } from "@/hooks/useWalletPortfolio";
import { WalletActivePosition } from "../shared/WalletActivePosition";
import { WalletActivityPosition } from "../shared/WalletActivityPositions";
import { useWalletAnalysis } from "@/hooks/useWalletAnalysis";
import { useWalletAnalysisStore, type Timeframe } from "@/store/useWalletAnalysisStore";
import DualRatioCharts from "../ui/dualratiocharts";
import { Skeleton } from "../ui/skeleton";
import { useWalletNicknameStore } from "@/store/useWalletNicknameStore";
import { EmojiPickerModal } from "./EmojiPickerModal";
import { PnlCalendar } from "./PnlCalendar";
import { DateRangePicker } from "./DateRangePicker";
import { useWalletPortfolioStore } from "@/store/useWalletPortfolioStore";
import { useSearchParams, usePathname } from "next/navigation";

type StatValue = string | number | { buy: number; sell: number };
interface Stat {
  label: string;
  value?: StatValue;
}

const TIMEFRAME_OPTIONS: Array<{ label: string; value: Timeframe }> = [
  { label: "24H", value: "1d" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
];

const TABS = ["Open Trades", "Closed Trades", "Best Trades", "Activity"] as const;

export function WalletPortfolioModal() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isOpen, closeWalletModal, walletAddress, txHash, blockchain, syncFromUrl } = useWalletModalStore();
  
  // Ref to track intentional close (prevents re-open from stale URL params)
  const justClosedRef = React.useRef(false);
  const { data: walletData, isLoading, walletHistory, fetchWalletHistoryData, refetchActivity, closeWebSocket } = useWalletPortfolio(walletAddress ?? undefined, blockchain ?? undefined);
  const { data, timeframe, loading, setTimeframe, reset: resetAnalysisStore } = useWalletAnalysisStore();
  const { activePositionData, assetFilter, setAssetFilter, dateFilter, setDateFilter, isHistoryLoading, reset: resetPortfolioStore } = useWalletPortfolioStore();
  useWalletAnalysis(walletAddress ?? undefined, blockchain ?? undefined);

  const [activeTab, setActiveTab] = React.useState<typeof TABS[number]>("Open Trades");
  const [chartMode, setChartMode] = React.useState<ChartMode>("pnl");
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = React.useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [customDateRange, setCustomDateRange] = React.useState<{ from: Date; to: Date } | null>(null);
  const [isCustomTimeframe, setIsCustomTimeframe] = React.useState(false);
  const [hideDust, setHideDust] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('wallet-hide-dust') === 'true';
    }
    return false;
  });
  const nameInputRef = React.useRef<HTMLDivElement>(null);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout>();

  // Persist hideDust setting
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wallet-hide-dust', hideDust.toString());
    }
  }, [hideDust]);

  const nicknames = useWalletNicknameStore((state) => state.nicknames);
  const setWalletNickname = useWalletNicknameStore((state) => state.setWalletNickname);
  const setWalletEmoji = useWalletNicknameStore((state) => state.setWalletEmoji);
  
  const walletNickname = useMemo(() => {
    if (!walletAddress) return { name: '', emoji: '👻' };
    const nickname = nicknames[walletAddress.toLowerCase()];
    return nickname || { name: '', emoji: '👻' };
  }, [walletAddress, nicknames]);

  // Get wallet entity metadata from analysis response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walletMetadata = useMemo(() => {
    const analysisData = data?.data as { walletMetadata?: { entityName: string | null; entityLogo: string | null; entityLabels: string[] } } | undefined;
    return analysisData?.walletMetadata ?? null;
  }, [data]);

  // Sync from URL on mount
  useEffect(() => {
    const popupAddress = searchParams?.get('popup');
    // Extract blockchain from pathname (e.g., /token/evm:56/xxx or /token/solana:solana/xxx)
    // The chainPart is the full chain ID like "evm:56" or "solana:solana"
    // Note: pathname may contain URL-encoded characters like %3A for :
    const decodedPathname = pathname ? decodeURIComponent(pathname) : '';
    const pathParts = decodedPathname.split('/');
    const chainPart = pathParts.find(p => p.includes(':'));
    // Use the full chain ID, not just the prefix
    const extractedBlockchain = chainPart ?? 'solana:solana';
    
    // Don't re-open if we just closed the modal intentionally
    if (justClosedRef.current) {
      justClosedRef.current = false;
      return;
    }
    
    if (popupAddress && !isOpen) {
      syncFromUrl({ walletAddress: popupAddress, blockchain: extractedBlockchain });
    }
  }, [searchParams, pathname, isOpen, syncFromUrl]);

  const explorerUrl = useMemo(
    () => (blockchain && txHash ? buildExplorerUrl(blockchain, "tx", txHash) : null),
    [blockchain, txHash]
  );

  // Calculate unrealized PNL from active positions
  const unrealizedPnlFromPositions = useMemo(() => {
    if (!activePositionData?.data) return 0;
    return activePositionData.data
      .filter(pos => pos.balance > 0)
      .reduce((sum, pos) => sum + (pos.unrealizedPnlUSD ?? 0), 0);
  }, [activePositionData?.data]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const portfolioData = walletData as { data?: { total_wallet_balance?: number } } | null;

  const stats: Stat[] = useMemo(() => [
    { label: "Bought", value: formatCryptoPrice(data?.data?.stat?.periodVolumeBuy ?? 0) },
    { label: "Sold", value: formatCryptoPrice(data?.data?.stat?.periodVolumeSell ?? 0) },
    { label: "Win Count", value: data?.data?.stat?.periodWinCount ?? 0 },
    { label: "PNL", value: formatCryptoPrice(data?.data?.stat?.periodTotalPnlUSD ?? 0) },
    { label: "Balance", value: formatUSD(portfolioData?.data?.total_wallet_balance ?? 0) },
    {
      label: "Txn",
      value: {
        buy: data?.data?.stat?.periodBuys ?? 0,
        sell: data?.data?.stat?.periodSells ?? 0,
      },
    },
    { label: "RealizedRate", value: `${((data?.data?.stat?.periodRealizedRate ?? 0) * 100).toFixed(1)}%` },
    { label: "Active Token Counts", value: data?.data?.stat?.periodActiveTokensCount ?? 0 }
  ], [data?.data?.stat, portfolioData?.data?.total_wallet_balance]);

  // Prepare chart data based on mode
  const chartData = useMemo(() => {
    if (chartMode === 'pnl') {
      return data?.data.periodTimeframes;
    } else {
      // Balance mode: use wallet history
      return walletHistory?.map(h => ({ date: h.date, realized: h.value })) ?? [];
    }
  }, [chartMode, data?.data.periodTimeframes, walletHistory]);

  const handleTimeframeChange = useCallback((newTimeframe: Timeframe) => {
    setIsCustomTimeframe(false);
    setCustomDateRange(null);
    setTimeframe(newTimeframe);
    // Convert timeframe to days for wallet history
    const timeframeDays = newTimeframe === '1d' ? 1 : newTimeframe === '7d' ? 7 : newTimeframe === '30d' ? 30 : 90;
    fetchWalletHistoryData(timeframeDays);
  }, [setTimeframe, fetchWalletHistoryData]);

  const handleCustomRangeSelect = useCallback((from: Date, to: Date) => {
    setCustomDateRange({ from, to });
    setIsCustomTimeframe(true);
    // Calculate days difference for history
    const daysDiff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    fetchWalletHistoryData(daysDiff, from.getTime(), to.getTime());
  }, [fetchWalletHistoryData]);

  const handleTabChange = useCallback((tab: typeof TABS[number]) => {
    setActiveTab(tab);
    // Clear filters when switching away from Activity
    if (tab !== "Activity") {
      setAssetFilter(null);
      setDateFilter(null);
    }
  }, [setAssetFilter, setDateFilter]);

  const handleCalendarDayClick = useCallback((date: Date) => {
    // Set date filter for the selected day (start of day to end of day)
    const from = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const to = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    setDateFilter({ from, to });
    setAssetFilter(null); // Clear asset filter
    setActiveTab("Activity");
    setIsCalendarOpen(false);
    // Refetch activity with date range filter
    refetchActivity({ from: from.getTime(), to: to.getTime() });
  }, [setDateFilter, setAssetFilter, refetchActivity]);

  const handleAssetClick = useCallback((asset: { address: string; chainId: string; name: string; symbol?: string; logo?: string; totalSupply?: number }) => {
    console.log('[Modal] handleAssetClick:', asset);
    setDateFilter(null); // Clear date filter when filtering by asset
    setAssetFilter(asset);
    setActiveTab("Activity");
  }, [setAssetFilter]);

  const handleCloseModal = useCallback(() => {
    justClosedRef.current = true; // Prevent re-open from stale URL params
    closeWebSocket(); // Close WebSocket when modal closes
    resetPortfolioStore(); // Reset all portfolio data to avoid stale state
    resetAnalysisStore(); // Reset analysis data
    closeWalletModal();
  }, [closeWalletModal, closeWebSocket, resetPortfolioStore, resetAnalysisStore]);
  
  React.useEffect(() => {
    if (nameInputRef.current && !isEditingName) {
      nameInputRef.current.textContent = walletNickname.name || '';
    }
  }, [walletNickname.name, isEditingName]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    if (walletAddress) {
      setWalletEmoji(walletAddress, emoji);
    }
  }, [walletAddress, setWalletEmoji]);

  const handleNameInput = useCallback(() => {
    if (!nameInputRef.current || !walletAddress) return;
    const newName = nameInputRef.current.textContent?.trim() || '';
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      setWalletNickname(walletAddress, newName);
    }, 500);
  }, [walletAddress, setWalletNickname]);

  const handleNameClick = useCallback(() => {
    setIsEditingName(true);
    setTimeout(() => {
      if (nameInputRef.current) {
        nameInputRef.current.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(nameInputRef.current);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, 0);
  }, []);

  const handleNameBlur = useCallback(() => {
    if (!nameInputRef.current || !walletAddress) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    const newName = nameInputRef.current.textContent?.trim() || '';
    setWalletNickname(walletAddress, newName);
    setIsEditingName(false);
  }, [walletAddress, setWalletNickname]);

  if (!isOpen || !walletAddress) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseModal}>
      <DialogContent
        showCloseButton={false}
        className="bg-bgPrimary border border-bgMuted rounded-md flex flex-col gap-0 p-0 
                   h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]
                   md:h-[calc(100vh-4rem)] md:w-[calc(100vw-4rem)] 
                   lg:h-[calc(100vh-8rem)] lg:w-[calc(100vw-8rem)] lg:max-w-[1400px]"
      >
        <VisuallyHidden>
          <DialogTitle>Wallet Modal</DialogTitle>
        </VisuallyHidden>

        <div className="p-3 md:p-4 lg:p-5 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 relative">
            <button
              onClick={handleCloseModal}
              className="sm:hidden absolute -top-1 right-0 text-textTertiary hover:text-success transition-colors z-10"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-2 flex-wrap pr-8 sm:pr-0">
              {/* Show entity logo if available, otherwise show emoji picker */}
              {walletMetadata?.entityLogo ? (
                <img 
                  src={walletMetadata.entityLogo} 
                  alt={walletMetadata.entityName || ''} 
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex-shrink-0 border border-borderDefault"
                />
              ) : (
                <button
                  onClick={() => setIsEmojiPickerOpen(true)}
                  className="text-xl sm:text-xl hover:scale-110 transition-all flex-shrink-0"
                  title="Change emoji"
                >
                  {walletNickname.emoji}
                </button>
              )}

              <div className="flex items-center gap-1.5 group -ml-1">
                {/* If entity name exists and no custom nickname, show entity name with badge */}
                {walletMetadata?.entityName && !walletNickname.name && !isEditingName ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-textPrimary">
                      {walletMetadata.entityName}
                    </span>
                    {walletMetadata.entityLabels?.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-[9px] font-semibold text-amber-400">
                        {walletMetadata.entityLabels[0]}
                      </span>
                    )}
                    <button onClick={handleNameClick} className="opacity-0 group-hover:opacity-100 transition-opacity" title="Add custom nickname">
                      <Edit2 size={12} className="text-grayGhost hover:text-textPrimary" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      ref={nameInputRef}
                      contentEditable={isEditingName}
                      suppressContentEditableWarning
                      onInput={handleNameInput}
                      onBlur={handleNameBlur}
                      onClick={!isEditingName ? handleNameClick : undefined}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          nameInputRef.current?.blur();
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          if (nameInputRef.current) {
                            nameInputRef.current.textContent = walletNickname.name || '';
                          }
                          setIsEditingName(false);
                        }
                      }}
                      className={`text-xs sm:text-sm font-medium transition-all outline-none whitespace-nowrap
                        ${isEditingName 
                          ? 'text-textPrimary min-w-[100px] border-b border-textPrimary' 
                          : 'cursor-pointer text-textPrimary'
                        }
                        ${!walletNickname.name && !isEditingName ? 'text-grayGhost' : ''}
                      `}
                    >
                      {!isEditingName && !walletNickname.name ? 'Rename to track' : walletNickname.name}
                    </div>
                    
                    {!isEditingName && (
                      <button onClick={handleNameClick} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Edit2 size={12} className="text-grayGhost hover:text-textPrimary" />
                      </button>
                    )}
                  </>
                )}
              </div>

              <span className="text-[10px] sm:text-xs text-grayGhost px-1 py-0.5 rounded truncate max-w-[100px] sm:max-w-[150px] lg:max-w-none">
                {walletAddress}
              </span>
              <div className="w-3 h-3 sm:w-4 sm:h-4 flex items-center justify-center flex-shrink-0">
                <CopyToClipboard text={walletAddress} />
              </div>
              {explorerUrl && (
                <Link href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-textTertiary hover:text-white transition-colors flex-shrink-0">
                  <ExternalLink size={13} />
                </Link>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-textTertiary hidden sm:inline">Timeframe</span>
              {TIMEFRAME_OPTIONS.map((t) => (
                <button
                  key={t.label}
                  onClick={() => handleTimeframeChange(t.value)}
                  className={`h-7 w-8 text-xs font-semibold rounded-md transition-all
                    ${timeframe === t.value && !isCustomTimeframe ? "text-success" : "hover:bg-success/50 text-textTertiary hover:text-white"}`}
                >
                  {t.label}
                </button>
              ))}
              <DateRangePicker 
                onRangeSelect={handleCustomRangeSelect}
                isCustomActive={isCustomTimeframe}
                customRange={customDateRange}
              />
              <button onClick={handleCloseModal} className="hidden sm:block ml-1 text-textTertiary hover:text-success transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex flex-1 flex-col lg:flex-row border-t border-x border-borderDefault overflow-hidden min-h-0">
            {/* Chart */}
            <div className="w-full lg:w-1/2 border-b lg:border-b-0 lg:border-r border-bgMuted flex flex-col p-3 md:p-4 min-h-[200px] lg:min-h-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs text-textTertiary">{chartMode === 'pnl' ? 'PNL' : 'Balance'}</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsCalendarOpen(true)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-textTertiary hover:text-white hover:bg-bgMuted transition-colors"
                    title="PNL Calendar"
                  >
                    <Calendar size={12} />
                  </button>
                  <div className="flex items-center gap-1 bg-bgMuted rounded p-0.5">
                    <button
                      onClick={() => setChartMode('pnl')}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                        chartMode === 'pnl' ? 'bg-bgPrimary text-success' : 'text-textTertiary hover:text-white'
                      }`}
                    >
                      <TrendingUp size={12} />
                      PNL
                    </button>
                    <button
                      onClick={() => {
                        setChartMode('balance');
                        // Lazy load wallet history on first click
                        if (!walletHistory && !isHistoryLoading) {
                          const currentTimeframe = timeframe;
                          const timeframeDays = currentTimeframe === '1d' ? 1 : currentTimeframe === '7d' ? 7 : currentTimeframe === '30d' ? 30 : 90;
                          fetchWalletHistoryData(timeframeDays);
                        }
                      }}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                        chartMode === 'balance' ? 'bg-bgPrimary text-blue-500' : 'text-textTertiary hover:text-white'
                      }`}
                    >
                      <BarChart3 size={12} />
                      Balance
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex-1 w-full min-h-[150px]">
                {/* Only wait for the relevant data based on chart mode */}
                {(chartMode === 'pnl' ? loading : isHistoryLoading) ? (
                  <Skeleton className="w-full h-full rounded" />
                ) : (
                  <WalletChart data={chartData} mode={chartMode} />
                )}
              </div>
            </div>

            <div className="w-full lg:w-1/2 flex flex-col">
              {/* Wallet Balance */}
              <div className="flex justify-between items-center border-b border-borderDefault px-3 md:px-4 min-h-[35px] py-2">
                <span className="text-xs font-medium text-textPrimary">
                  {loading ? <Skeleton className="h-3 w-16 rounded" /> : "Wallet Balance"}
                </span>
                <div className="flex items-end">
                  <span className="text-base md:text-lg font-semibold text-textPrimary">
                    {loading ? (
                      <Skeleton className="h-3 w-16 rounded" />
                    ) : portfolioData?.data?.total_wallet_balance ? (
                      formatUSD(portfolioData.data.total_wallet_balance)
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 px-3 md:px-4 py-2 border-b border-borderDefault">
                <div className="flex items-center space-x-2">
                  {loading ? (
                    <>
                      <Skeleton className="h-3 w-16 rounded" />
                      <Skeleton className="h-3 w-16 rounded" />
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-grayGhost font-medium">Realized PNL:</span>
                      <span className={`text-xs font-medium ${(data?.data?.stat?.periodRealizedPnlUSD ?? 0) > 0 ? "text-success" : (data?.data?.stat?.periodRealizedPnlUSD ?? 0) < 0 ? "text-error" : "text-textPrimary"}`}>
                        {formatUSD(data?.data?.stat?.periodRealizedPnlUSD ?? 0)}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {loading ? (
                    <>
                      <Skeleton className="h-3 w-16 rounded" />
                      <Skeleton className="h-3 w-16 rounded" />
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-grayGhost font-medium">Unrealized PNL:</span>
                      <span className={`text-xs font-medium ${unrealizedPnlFromPositions > 0 ? "text-success" : unrealizedPnlFromPositions < 0 ? "text-error" : "text-textPrimary"}`}>
                        {formatUSD(unrealizedPnlFromPositions)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-between px-3 md:px-4 py-2 border-b border-borderDefault overflow-y-auto min-h-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 md:gap-x-14 gap-y-1 text-xs">
                  {loading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="flex justify-between py-1">
                        <Skeleton className="h-3 w-16 rounded" />
                        <Skeleton className="h-3 w-16 rounded" />
                      </div>
                    ))
                  ) : (
                    <>
                      {stats.map((stat, i) => {
                      const isBuy = stat.label === "Bought";
                      const isSell = stat.label === "Sold";
                      if (stat.label === "Txn" && typeof stat.value === "object") {
                        return (
                          <div key={i} className="flex justify-between py-1">
                            <span className="text-textTertiary text-xs font-medium">{stat.label}</span>
                            <span className="text-xs font-medium whitespace-nowrap">
                              <span className="text-success">{stat.value.buy}</span>
                              <span className="text-grayGhost mx-1">/</span>
                              <span className="text-error">{stat.value.sell}</span>
                            </span>
                          </div>
                        );
                      }
                        const valueToRender = typeof stat.value === "string" || typeof stat.value === "number" ? stat.value : "-";
                      return (
                        <div key={i} className="flex justify-between py-1">
                          <span className="text-textTertiary text-xs font-medium">{stat.label}</span>
                            <span className={`text-xs font-medium whitespace-nowrap ${isBuy ? "text-success" : isSell ? "text-red-500" : "text-textPrimary"}`}>
                              {valueToRender}
                            </span>
                          </div>
                        );
                      })}
                      
                      {/* Funding Info - inline with stats */}
                      {data?.data?.stat?.fundingInfo?.from && (
                        <>
                          <div className="flex justify-between py-1">
                            <span className="text-textTertiary text-xs font-medium">Funded by</span>
                            <span className="text-xs font-medium whitespace-nowrap flex items-center gap-1.5">
                              {data.data.stat.fundingInfo.fromWalletLogo && (
                                <img src={data.data.stat.fundingInfo.fromWalletLogo} alt="" className="w-3.5 h-3.5 rounded-full" />
                              )}
                              {data.data.stat.fundingInfo.fromWalletTag ? (
                                <span className="text-textPrimary">{data.data.stat.fundingInfo.fromWalletTag}</span>
                              ) : (
                                <Link
                                  href={`${window.location.pathname}?popup=${data.data.stat.fundingInfo.from}`}
                                  target="_blank"
                                  className="text-textTertiary hover:text-success transition-colors font-mono"
                                >
                                  {data.data.stat.fundingInfo.from.slice(0, 4)}...{data.data.stat.fundingInfo.from.slice(-4)}
                                </Link>
                              )}
                              {data.data.stat.fundingInfo.txHash && data.data.stat.fundingInfo.chainId && (
                                <a
                                  href={buildExplorerUrl(data.data.stat.fundingInfo.chainId, 'tx', data.data.stat.fundingInfo.txHash) ?? '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-textTertiary hover:text-success transition-colors"
                                >
                                  <ExternalLink size={10} />
                                </a>
                              )}
                            </span>
                          </div>
                          {(data.data.stat.fundingInfo.formattedAmount || data.data.stat.fundingInfo.amount) && (
                            <div className="flex justify-between py-1">
                              <span className="text-textTertiary text-xs font-medium">Funding</span>
                              <span className="text-xs font-medium whitespace-nowrap flex items-center gap-1">
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {(data.data.stat.fundingInfo as any).currency?.logo && (
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  <img src={(data.data.stat.fundingInfo as any).currency.logo} alt="" className="w-3.5 h-3.5 rounded-full" />
                                )}
                                <span className="text-success">
                                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                  {(data.data.stat.fundingInfo as any).formattedAmount 
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    ? formatCryptoPrice((data.data.stat.fundingInfo as any).formattedAmount)
                                    : data.data.stat.fundingInfo.amount}
                                </span>
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {(data.data.stat.fundingInfo as any).currency?.symbol && (
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  <span className="text-textTertiary">{(data.data.stat.fundingInfo as any).currency.symbol}</span>
                                )}
                              </span>
                            </div>
                          )}
                          {data.data.stat.fundingInfo.date && (
                            <div className="flex justify-between py-1">
                              <span className="text-textTertiary text-xs font-medium">Funding Date</span>
                              <span className="text-xs font-medium text-textPrimary">
                                {new Date(data.data.stat.fundingInfo.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                      
                      {/* Platform - inline with stats */}
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(data?.data as any)?.platform && (
                        <div className="flex justify-between py-1">
                          <span className="text-textTertiary text-xs font-medium">Platform</span>
                          <span className="text-xs font-medium whitespace-nowrap flex items-center gap-1.5">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {(data?.data as any).platform.logo && (
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              <img src={(data?.data as any).platform.logo} alt="" className="w-3.5 h-3.5 rounded-full" />
                            )}
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            <span className="text-textPrimary">{(data?.data as any).platform.name}</span>
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="px-3 md:px-4 py-2 md:py-3">
                <DualRatioCharts
                  winRateDistribution={data?.data?.winRateDistribution}
                  marketCapDistribution={data?.data?.marketCapDistribution}
                  loading={loading}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col flex-1 overflow-hidden border border-borderDefault min-h-0">
            {/* Tab Buttons */}
            <div className="flex border-b border-borderDefault overflow-x-auto scrollbar-none">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`relative px-3 md:px-4 py-2.5 text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0
                    ${activeTab === tab ? "text-textPrimary" : "text-grayGhost hover:text-success"}`}
                >
                  {tab}
                  {tab === "Activity" && assetFilter && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-success/20 text-success rounded">
                      {assetFilter.name}
                    </span>
                  )}
                  {tab === "Activity" && dateFilter && !assetFilter && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded">
                      {dateFilter.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  <span className={`absolute bottom-0 left-0 right-0 h-[2px] bg-textPrimary rounded-full transition-all duration-300 ease-in-out origin-center 
                    ${activeTab === tab ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"}`}
                  />
                </button>
              ))}
              
              <div className="ml-auto flex items-center gap-2 px-3">
                {(assetFilter || dateFilter) && activeTab === "Activity" && (
                  <button
                    onClick={() => { setAssetFilter(null); setDateFilter(null); refetchActivity(); }}
                    className="text-[10px] text-textTertiary hover:text-white transition-colors"
                  >
                    Clear filter
                  </button>
                )}
                <button
                  onClick={() => setHideDust(!hideDust)}
                  className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                    hideDust ? 'bg-success/20 text-success' : 'text-textTertiary hover:text-white hover:bg-bgMuted'
                  }`}
                  title="Hide positions and transfers under $1"
                >
                  Hide dust
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto min-h-0">
              {activeTab === "Open Trades" && (
                <WalletActivePosition mode="active" onAssetClick={handleAssetClick} hideDust={hideDust} />
              )}
              {activeTab === "Closed Trades" && (
                <WalletActivePosition mode="history" onAssetClick={handleAssetClick} hideDust={hideDust} />
              )}
              {activeTab === "Best Trades" && (
                <WalletActivePosition mode="top100" onAssetClick={handleAssetClick} hideDust={hideDust} />
              )}
              {activeTab === "Activity" && (
                <WalletActivityPosition hideDust={hideDust} refetchActivity={refetchActivity} />
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      <EmojiPickerModal
        isOpen={isEmojiPickerOpen}
        onClose={() => setIsEmojiPickerOpen(false)}
        onSelect={handleEmojiSelect}
        currentEmoji={walletNickname.emoji}
      />

      <PnlCalendar
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        walletAddress={walletAddress}
        blockchain={blockchain ?? 'solana:solana'}
        onDayClick={handleCalendarDayClick}
      />
    </Dialog>
  );
}
