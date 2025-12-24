
"use client";
import React, { useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { buildExplorerUrl, formatCryptoPrice, formatUSD } from "@mobula_labs/sdk";
import { ExternalLink, X } from "lucide-react";
import { WalletChart } from "./WalletChart";
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
import { Edit2 } from "lucide-react";

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

const TABS = ["Active Positions", "History", "Top 100", "Activity"] as const;

export function WalletPortfolioModal() {
  const { isOpen, closeWalletModal, walletAddress, txHash, blockchain } = useWalletModalStore();
  const { data: walletData, isLoading, error } = useWalletPortfolio(walletAddress ?? undefined, blockchain ?? undefined);
  const { data, timeframe, loading, setTimeframe } = useWalletAnalysisStore();
  useWalletAnalysis(walletAddress ?? undefined, blockchain ?? undefined);

  const [activeTab, setActiveTab] = React.useState<typeof TABS[number]>("Active Positions");
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = React.useState(false);
  const [isEditingName, setIsEditingName] = React.useState(false);
  const nameInputRef = React.useRef<HTMLDivElement>(null);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout>();

  // Subscribe to the store directly to get reactive updates
  const nicknames = useWalletNicknameStore((state) => state.nicknames);
  const setWalletNickname = useWalletNicknameStore((state) => state.setWalletNickname);
  const setWalletEmoji = useWalletNicknameStore((state) => state.setWalletEmoji);
  
  const walletNickname = useMemo(() => {
    if (!walletAddress) return { name: '', emoji: '👻' };
    const nickname = nicknames[walletAddress.toLowerCase()];
    return nickname || { name: '', emoji: '👻' };
  }, [walletAddress, nicknames]);

  const explorerUrl = useMemo(
    () => (blockchain && txHash ? buildExplorerUrl(blockchain, "tx", txHash) : null),
    [blockchain, txHash]
  );

  const stats: Stat[] = useMemo(() => [
    { label: "Bought", value: formatCryptoPrice(data?.data?.stat?.periodVolumeBuy ?? 0) },
    { label: "Sold", value: formatCryptoPrice(data?.data?.stat?.periodVolumeSell ?? 0) },
    { label: "Win Count", value: data?.data?.stat?.periodWinCount ?? 0 },
    { label: "PNL", value: formatCryptoPrice(data?.data?.stat?.periodTotalPnlUSD ?? 0) },
    { label: "Balance", value: formatUSD(walletData?.data?.total_wallet_balance ?? 0) },
    {
      label: "Txn",
      value: {
        buy: data?.data?.stat?.periodBuys ?? 0,
        sell: data?.data?.stat?.periodSells ?? 0,
      },
    },
    { label: "RealizedRate", value: `${((data?.data?.stat?.periodRealizedRate ?? 0) * 100).toFixed(1)}%` },
    { label: "Active Token Counts", value: data?.data?.stat?.periodActiveTokensCount ?? 0 }
  ], [data?.data?.stat, walletData?.data?.total_wallet_balance]);

  const handleTimeframeChange = useCallback((newTimeframe: Timeframe) => {
    setTimeframe(newTimeframe);
  }, [setTimeframe]);

  const handleTabChange = useCallback((tab: typeof TABS[number]) => {
    setActiveTab(tab);
  }, []);

  
  React.useEffect(() => {
    if (nameInputRef.current && !isEditingName) {
      nameInputRef.current.textContent = walletNickname.name || '';
    }
  }, [walletNickname.name]);

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
        // Place cursor at end
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
    <Dialog open={isOpen} onOpenChange={closeWalletModal}>
      <DialogContent
        showCloseButton
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
            {/* Mobile Close Button - Top Right */}
            <button
              onClick={closeWalletModal}
              className="sm:hidden absolute -top-1 right-0 text-textTertiary hover:text-success transition-colors z-10"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-2 flex-wrap pr-8 sm:pr-0">
              {/* Emoji Button - Always clickable, visible when customized */}
              <button
                onClick={() => setIsEmojiPickerOpen(true)}
                className={`text-xl sm:text-xl hover:scale-110 transition-all flex-shrink-0`}
                title="Change emoji"
              >
                {walletNickname.emoji}
              </button>

              {/* Editable Name with Pencil Icon */}
              <div className="flex items-center gap-1.5 group -ml-1">
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
                  style={!isEditingName && !walletNickname.name ? { textDecoration: 'none' } : {}}
                >
                  {!isEditingName && !walletNickname.name ? 'Rename to track' : walletNickname.name}
                </div>
                
                {!isEditingName && (
                  <button
                    onClick={handleNameClick}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit2 size={12} className="text-grayGhost hover:text-textPrimary" />
                  </button>
                )}
              </div>

              <span className="text-[10px] sm:text-xs text-grayGhost px-1 py-0.5 rounded truncate max-w-[100px] sm:max-w-[150px] lg:max-w-none">
                {walletAddress}
              </span>
              <div className="w-3 h-3 sm:w-4 sm:h-4 flex items-center justify-center flex-shrink-0">
                <CopyToClipboard text={walletAddress} />
              </div>
              {explorerUrl && (
                <Link
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-textTertiary hover:text-white transition-colors flex-shrink-0"
                >
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
                  className={`h-7 w-8 text-xs font-semibold rounded-md  transition-all
                    ${timeframe === t.value
                      ? "text-success"
                      : "hover:bg-success/50 text-textTertiary hover:text-white"
                    }`}
                >
                  {t.label}
                </button>
              ))}
              {/* Desktop Close Button - Next to Timeframes */}
              <button
                onClick={closeWalletModal}
                className="hidden sm:block ml-1 text-textTertiary hover:text-success transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>


          <div className="flex flex-1 flex-col lg:flex-row border-t border-x border-borderDefault overflow-hidden min-h-0">
            {/* Chart */}
            <div className="w-full lg:w-1/2 border-b lg:border-b-0 lg:border-r border-bgMuted flex flex-col p-3 md:p-4 min-h-[200px] lg:min-h-0">
              <h3 className="text-xs text-textTertiary mb-2">PNL</h3>
              <div className="flex-1 w-full min-h-[150px]">
                <WalletChart data={data?.data.periodTimeframes} />
              </div>
            </div>

            <div className="w-full lg:w-1/2 flex flex-col">
              {/* Wallet Balance */}
              <div className="flex justify-between items-center border-b border-borderDefault px-3 md:px-4 min-h-[35px] py-2">
                <span className="text-xs font-medium text-textPrimary">
                  {loading ? <Skeleton className="h-3 w-16 rounded" /> : "Wallet Balance"}
                </span>
                <div className="flex items-end">
                  <p className="text-base md:text-lg font-semibold text-textPrimary">
                    {loading ? (
                      <Skeleton className="h-3 w-16 rounded" />
                    ) : walletData?.data?.total_wallet_balance ? (
                      formatUSD(walletData.data.total_wallet_balance)
                    ) : (
                      "—"
                    )}
                  </p>
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
                      <span
                        className={`text-xs font-medium ${(data?.data?.stat?.periodRealizedPnlUSD ?? 0) > 0
                            ? "text-success"
                            : (data?.data?.stat?.periodRealizedPnlUSD ?? 0) < 0
                              ? "text-error"
                              : "text-textPrimary"
                          }`}
                      >
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
                      <span className="text-textPrimary text-xs font-medium">-$14.61</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-between px-3 md:px-4 py-2 border-b border-borderDefault overflow-y-auto min-h-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 md:gap-x-14 gap-y-1 text-xs">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex justify-between py-1">
                        <Skeleton className="h-3 w-16 rounded" />
                        <Skeleton className="h-3 w-16 rounded" />
                      </div>
                    ))
                  ) : (
                    stats.map((stat, i) => {
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

                      const valueToRender =
                        typeof stat.value === "string" || typeof stat.value === "number"
                          ? stat.value
                          : "-";

                      return (
                        <div key={i} className="flex justify-between py-1">
                          <span className="text-textTertiary text-xs font-medium">{stat.label}</span>
                          <span
                            className={`text-xs font-medium whitespace-nowrap ${isBuy
                              ? "text-success"
                              : isSell
                                ? "text-red-500"
                                : "text-textPrimary"
                              }`}
                          >
                            {valueToRender}
                          </span>
                        </div>
                      );
                    })
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
                    ${activeTab === tab
                      ? "text-textPrimary"
                      : "text-grayGhost hover:text-success"
                    }`}
                >
                  {tab}
                  <span
                    className={`absolute bottom-0 left-0 right-0 h-[2px] bg-textPrimary rounded-full transition-all duration-300 ease-in-out origin-center 
                      ${activeTab === tab
                        ? "opacity-100 scale-x-100"
                        : "opacity-0 scale-x-0"
                      }`}
                  />
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto min-h-0">
              {activeTab === "Active Positions" && (
                <WalletActivePosition />
              )}
              {activeTab === "History" && (
                <div className="flex items-center justify-center text-xs text-grayGhost h-full p-4">
                  No historical data available.
                </div>
              )}

              {activeTab === "Top 100" && (
                <div className="flex items-center justify-center text-xs text-grayGhost h-full p-4">
                  Top 100 traders coming soon.
                </div>
              )}

              {activeTab === "Activity" && (
                <WalletActivityPosition />
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Emoji Picker Modal */}
      <EmojiPickerModal
        isOpen={isEmojiPickerOpen}
        onClose={() => setIsEmojiPickerOpen(false)}
        onSelect={handleEmojiSelect}
        currentEmoji={walletNickname.emoji}
      />
    </Dialog>
  );
};
