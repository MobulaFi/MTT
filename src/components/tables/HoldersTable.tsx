import { useState, useMemo, useCallback } from 'react';
import { truncate, formatPercentage, buildExplorerUrl, formatPureNumber } from '@mobula_labs/sdk';
import { getTokenAge } from '@/utils/Formatter';
import { ExternalLink, ArrowUpDown, ChevronUp, ChevronDown, Funnel, X, Building2 } from 'lucide-react';
import { useWalletModalStore } from '@/store/useWalletModalStore';
import { usePairHoldersStore, type HolderSortField } from '@/features/pair/store/usePairHolderStore';
import { HOLDER_TAG_ICONS, PROMINENT_LABELS } from '@/assets/icons/HolderTags';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { HoldersTableSkeleton } from '../skeleton';
import { PriceDisplay } from '../PriceDisplay';
import type { TokenPositionsOutputResponse } from '@mobula_labs/types';

// Wallet metadata type from API
interface WalletMetadata {
  entityName: string | null;
  entityLogo: string | null;
  entityLabels: string[];
}

// Component to display wallet entity info (CEX, market maker, etc.)
function WalletEntityBadge({ metadata, compact = false }: { metadata?: WalletMetadata | null; compact?: boolean }) {
  if (!metadata?.entityName && (!metadata?.entityLabels || metadata.entityLabels.length === 0)) return null;

  const displayName = metadata.entityName || metadata.entityLabels?.[0] || null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 ${
          compact ? 'text-[8px]' : 'text-[9px]'
        } font-semibold text-amber-400`}>
          {metadata.entityLogo ? (
            <img
              src={metadata.entityLogo}
              width={compact ? 10 : 12}
              height={compact ? 10 : 12}
              alt=""
              className="rounded-full"
            />
          ) : (
            <Building2 size={compact ? 10 : 12} />
          )}
          {!compact && displayName}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[10px]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            {metadata.entityLogo && (
              <img src={metadata.entityLogo} width={14} height={14} alt="" className="rounded-full" />
            )}
            <span className="font-semibold text-white">{displayName}</span>
          </div>
          {metadata.entityLabels && metadata.entityLabels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {metadata.entityLabels.map((label) => (
                <span key={label} className="px-1 py-0.5 bg-bgTertiary rounded text-[9px] text-grayGhost">
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

type HoldersTableProps = {
  totalSupply: number;
};

// Column header component with sort functionality
function SortableHeader({ 
  label, 
  field, 
  sortField, 
  sortDirection, 
  onSort,
  align = 'left',
  subLabel,
}: { 
  label: string; 
  field: HolderSortField;
  sortField: HolderSortField;
  sortDirection: 'asc' | 'desc';
  onSort: (field: HolderSortField) => void;
  align?: 'left' | 'right' | 'center';
  subLabel?: string;
}) {
  const isActive = sortField === field;
  const alignClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  
  return (
    <button 
      onClick={() => onSort(field)}
      className={`flex items-center gap-1 ${alignClass} hover:text-textPrimary transition-colors group w-full`}
    >
      <span className="flex flex-col items-start leading-tight">
        <span>{label}</span>
        {subLabel && <span className="text-[9px] text-grayGhost">({subLabel})</span>}
      </span>
      <span className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
        {isActive && sortDirection === 'asc' ? (
          <ChevronUp size={12} />
        ) : (
          <ChevronDown size={12} />
        )}
      </span>
    </button>
  );
}

// Format funding info display
function FundingDisplay({ fundingInfo, blockchain }: { 
  fundingInfo: TokenPositionsOutputResponse['fundingInfo']; 
  blockchain: string;
}) {
  if (!fundingInfo?.from) {
    return <span className="text-grayGhost">—</span>;
  }

  const explorerUrl = fundingInfo.chainId 
    ? buildExplorerUrl(fundingInfo.chainId, 'address', fundingInfo.from)
    : buildExplorerUrl(blockchain, 'address', fundingInfo.from);

  return (
    <div className="flex items-center gap-1.5">
      {fundingInfo.fromWalletLogo && (
        <img 
          src={fundingInfo.fromWalletLogo} 
          alt="" 
          className="w-4 h-4 rounded-full"
        />
      )}
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          {explorerUrl ? (
            <a 
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accentPurple hover:underline text-[10px]"
            >
              {truncate(fundingInfo.from, { length: 4, mode: 'middle' })}
            </a>
          ) : (
            <span className="text-grayGhost text-[10px]">
              {truncate(fundingInfo.from, { length: 4, mode: 'middle' })}
            </span>
          )}
          {fundingInfo.fromWalletTag && (
            <span className="text-[9px] px-1 py-0.5 bg-bgContainer rounded text-textSecondary">
              {fundingInfo.fromWalletTag}
            </span>
          )}
        </div>
        {fundingInfo.date && (
          <span className="text-[9px] text-grayGhost">
            {getTokenAge(fundingInfo.date)}
          </span>
        )}
      </div>
    </div>
  );
}

export function HoldersTable({ totalSupply }: HoldersTableProps) {
  const { 
    holders, 
    loading, 
    blockchain, 
    tokenPrice,
    sortField,
    sortDirection,
    toggleSort,
    labelFilter,
    setLabelFilter,
  } = usePairHoldersStore();

  // Sort holders based on current sort field and direction
  const sortedHolders = useMemo(() => {
    if (!holders || holders.length === 0) return [];

    const sorted = [...holders].sort((a, b) => {
      let aVal: number, bVal: number;
      
      switch (sortField) {
        case 'balance':
          aVal = Number(a.tokenAmount) || 0;
          bVal = Number(b.tokenAmount) || 0;
          break;
        case 'balanceUSD':
          aVal = (Number(a.tokenAmount) || 0) * tokenPrice;
          bVal = (Number(b.tokenAmount) || 0) * tokenPrice;
          break;
        case 'bought':
          aVal = Number(a.volumeBuyUSD) || 0;
          bVal = Number(b.volumeBuyUSD) || 0;
          break;
        case 'sold':
          aVal = Number(a.volumeSellUSD) || 0;
          bVal = Number(b.volumeSellUSD) || 0;
          break;
        case 'pnl':
          aVal = Number(a.totalPnlUSD) || Number(a.pnlUSD) || 0;
          bVal = Number(b.totalPnlUSD) || Number(b.pnlUSD) || 0;
          break;
        case 'remaining':
          aVal = totalSupply > 0 ? (Number(a.tokenAmount) / totalSupply) * 100 : 0;
          bVal = totalSupply > 0 ? (Number(b.tokenAmount) / totalSupply) * 100 : 0;
          break;
        case 'lastActive':
          aVal = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
          bVal = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
          break;
        case 'avgBuy':
          aVal = Number(a.avgBuyPriceUSD) || 0;
          bVal = Number(b.avgBuyPriceUSD) || 0;
          break;
        case 'avgSell':
          aVal = Number(a.avgSellPriceUSD) || 0;
          bVal = Number(b.avgSellPriceUSD) || 0;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return sorted;
  }, [holders, sortField, sortDirection, tokenPrice, totalSupply]);

  // Filter by label if needed
  const filteredHolders = useMemo(() => {
    if (!labelFilter) return sortedHolders;
    return sortedHolders.filter(h => h.labels?.includes(labelFilter));
  }, [sortedHolders, labelFilter]);

  const handleLabelClick = useCallback((label: string) => {
    if (labelFilter === label) {
      setLabelFilter(null);
    } else {
      setLabelFilter(label);
    }
  }, [labelFilter, setLabelFilter]);

  if (loading || !holders) {
    return <HoldersTableSkeleton />;
  }

  if (Array.isArray(holders) && holders.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-grayGhost">No holder data available</div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
        {/* Active filter indicator */}
        {labelFilter && (
          <div className="flex items-center gap-2 px-4 py-2 bg-bgContainer border-b border-borderDefault">
            <span className="text-xs text-grayGhost">Filtering by:</span>
            <button
              onClick={() => setLabelFilter(null)}
              className="flex items-center gap-1 px-2 py-0.5 bg-accentPurple/20 text-accentPurple rounded text-xs hover:bg-accentPurple/30 transition-colors"
            >
              {labelFilter}
              <X size={12} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-auto scrollbar-thin scrollbar-thumb-[#22242D] scrollbar-track-transparent hover:scrollbar-thumb-[#343439]">
          <table className="min-w-[900px] w-full text-xs bg-bgPrimary border-collapse">
            <thead className="text-grayGhost bg-bgPrimary h-9 sticky top-0 z-20 border-b border-borderDefault shadow-sm text-xs">
              <tr>
                <th className="w-[40px] whitespace-nowrap text-left pl-4">#</th>
                <th className="w-[30px] text-left whitespace-nowrap px-1">/</th>
                <th className="w-[160px] whitespace-nowrap text-left px-2">Wallet</th>
                <th className="w-[130px] whitespace-nowrap text-left px-2">
                  <SortableHeader 
                    label="Token Balance" 
                    subLabel="Last Active"
                    field="balance" 
                    sortField={sortField} 
                    sortDirection={sortDirection} 
                    onSort={toggleSort} 
                  />
                </th>
                <th className="w-[120px] whitespace-nowrap text-left px-2">
                  <SortableHeader 
                    label="Bought" 
                    subLabel="Avg Buy"
                    field="bought" 
                    sortField={sortField} 
                    sortDirection={sortDirection} 
                    onSort={toggleSort} 
                  />
                </th>
                <th className="w-[120px] whitespace-nowrap text-left px-2">
                  <SortableHeader 
                    label="Sold" 
                    subLabel="Avg Sell"
                    field="sold" 
                    sortField={sortField} 
                    sortDirection={sortDirection} 
                    onSort={toggleSort} 
                  />
                </th>
                <th className="w-[120px] whitespace-nowrap text-left px-2">
                  <SortableHeader 
                    label="Total PnL" 
                    field="pnl" 
                    sortField={sortField} 
                    sortDirection={sortDirection} 
                    onSort={toggleSort} 
                  />
                </th>
                <th className="w-[90px] whitespace-nowrap text-left px-2">Platform</th>
                <th className="w-[130px] whitespace-nowrap text-left px-2">
                  <SortableHeader 
                    label="Remaining" 
                    field="remaining" 
                    sortField={sortField} 
                    sortDirection={sortDirection} 
                    onSort={toggleSort} 
                  />
                </th>
                <th className="w-[140px] whitespace-nowrap text-left px-2 pr-4">Funding</th>
              </tr>
            </thead>

            <tbody>
              {filteredHolders.map((holder, index) => {
                const tokenAmount = Number(holder.tokenAmount) || 0;
                const remainingPercent = totalSupply > 0
                  ? (tokenAmount / totalSupply) * 100
                  : 0;
                const balanceUSD = tokenAmount * tokenPrice;
                const totalPnlValue = Number(holder.totalPnlUSD) || Number(holder.pnlUSD) || 0;
                const realizedPnlValue = Number(holder.realizedPnlUSD) || 0;
                const unrealizedPnlValue = Number(holder.unrealizedPnlUSD) || 0;
                const avgBuyPrice = Number(holder.avgBuyPriceUSD) || 0;
                const avgSellPrice = Number(holder.avgSellPriceUSD) || 0;

                return (
                  <tr
                    key={holder.walletAddress}
                    className="cursor-default border-b border-borderDefault/50 transition-colors h-11 bg-bgPrimary even:bg-bgTableAlt hover:bg-bgTableHover"
                  >
                    {/* Index */}
                    <td className="text-center text-grayGhost pl-4">{index + 1}</td>
                    
                    {/* Filter icon */}
                    <td className="px-1">
                      <Funnel
                        color="#777A8C"
                        size={12}
                        className="cursor-pointer hover:opacity-70 transition-opacity"
                      />
                    </td>

                    {/* Wallet with explorer link and labels */}
                    <td className="text-left whitespace-nowrap px-2">
                      <div className="flex items-center gap-1.5">
                        {holder.walletAddress && blockchain && (() => {
                          const explorerUrl = buildExplorerUrl(blockchain, 'address', holder.walletAddress);
                          return explorerUrl ? (
                            <a
                              href={explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-grayGhost hover:text-textPrimary transition-colors"
                              title="View on explorer"
                            >
                              <ExternalLink size={12} />
                            </a>
                          ) : null;
                        })()}

                        {/* Don't make liquidity pool addresses clickable for wallet analysis */}
                        {holder.labels?.includes('liquidityPool') ? (
                          <span className="text-grayGhost truncate max-w-[100px]">
                            {truncate(holder.walletAddress, { length: 4, mode: 'middle' })}
                          </span>
                        ) : (
                          <span
                            onClick={() =>
                              useWalletModalStore.getState().openWalletModal({
                                walletAddress: holder.walletAddress,
                                txHash: holder.walletAddress,
                                blockchain,
                              })
                            }
                            className="text-accentPurple hover:underline-offset-2 hover:underline cursor-pointer truncate max-w-[100px]"
                          >
                            {truncate(holder.walletAddress, { length: 4, mode: 'middle' })}
                          </span>
                        )}

                        {/* Wallet Entity (CEX, Market Maker, etc.) */}
                        <WalletEntityBadge 
                          metadata={(holder as typeof holder & { walletMetadata?: WalletMetadata }).walletMetadata} 
                        />

                        {/* Labels/Tags */}
                        {holder.labels && holder.labels.length > 0 && (
                          <div className="flex items-center gap-1">
                            {holder.labels.map((tag: string) => {
                              const prominentLabel = PROMINENT_LABELS[tag];
                              const icon = HOLDER_TAG_ICONS[tag];
                              const isActiveFilter = labelFilter === tag;
                              
                              // Prominent labels get a full badge display
                              if (prominentLabel) {
                                return (
                                  <Tooltip key={tag}>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleLabelClick(tag);
                                        }}
                                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide transition-all cursor-pointer ${prominentLabel.className} ${
                                          isActiveFilter ? 'ring-1 ring-white/30' : 'hover:brightness-110'
                                        }`}
                                      >
                                        {icon}
                                        {prominentLabel.text}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-[10px]">
                                      <span className="text-grayGhost">
                                        {isActiveFilter ? 'Click to clear filter' : 'Click to filter'}
                                      </span>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              }
                              
                              // Regular labels get icon only
                              return icon ? (
                                <Tooltip key={tag}>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleLabelClick(tag);
                                      }}
                                      className={`transition-all cursor-pointer ${
                                        isActiveFilter 
                                          ? 'opacity-100 ring-1 ring-accentPurple/50 rounded' 
                                          : 'opacity-70 hover:opacity-100'
                                      }`}
                                    >
                                      {icon}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-[10px]">
                                    <span className="font-medium">{tag}</span>
                                    <span className="text-grayGhost ml-1">
                                      {isActiveFilter ? '(click to clear)' : '(click to filter)'}
                                    </span>
                                  </TooltipContent>
                                </Tooltip>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Balance + Last Active */}
                    <td className="text-left px-2">
                      <div className="flex flex-col">
                        <span className="text-white font-medium">
                          {formatPureNumber(tokenAmount)}
                        </span>
                        <span className="text-[10px] text-grayGhost">
                          {holder.lastActivityAt ? (
                            getTokenAge(holder.lastActivityAt)
                          ) : (
                            '—'
                          )}
                        </span>
                      </div>
                    </td>

                    {/* Bought + Avg Buy */}
                    <td className="text-left px-2">
                      <div className="flex flex-col">
                        <span className="text-success">
                          <PriceDisplay usdAmount={holder.volumeBuyUSD} align="left" />
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-grayGhost">
                          <span>{holder.buys} / {holder.sells}</span>
                        </div>
                      </div>
                    </td>

                    {/* Sold + Avg Sell */}
                    <td className="text-left px-2">
                      <div className="flex flex-col">
                        <span className="text-white">
                          <PriceDisplay usdAmount={holder.volumeSellUSD} align="left" />
                        </span>
                        <span className="text-[10px] text-grayGhost">
                          {avgSellPrice > 0 ? (
                            <PriceDisplay usdAmount={avgSellPrice} align="left" />
                          ) : (
                            '—'
                          )}
                        </span>
                      </div>
                    </td>

                    {/* PnL - Total with breakdown */}
                    <td className="text-left px-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col cursor-help">
                            <span className={`font-medium ${totalPnlValue >= 0 ? 'text-success' : 'text-red-500'}`}>
                              <PriceDisplay usdAmount={totalPnlValue} align="left" />
                            </span>
                            <div className="flex items-center gap-2 text-[9px]">
                              <span className={realizedPnlValue >= 0 ? 'text-success/70' : 'text-red-500/70'}>
                                R: <PriceDisplay usdAmount={realizedPnlValue} align="left" />
                              </span>
                              <span className={unrealizedPnlValue >= 0 ? 'text-success/70' : 'text-red-500/70'}>
                                U: <PriceDisplay usdAmount={unrealizedPnlValue} align="left" />
                              </span>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px]">
                          <div className="flex flex-col gap-1 min-w-[100px]">
                            <div className="font-semibold text-white mb-0.5">PnL Breakdown</div>
                            <div className="flex justify-between gap-4">
                              <span className="text-grayGhost">Realized:</span>
                              <span className={realizedPnlValue >= 0 ? 'text-success' : 'text-red-500'}>
                                <PriceDisplay usdAmount={realizedPnlValue} align="right" />
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-grayGhost">Unrealized:</span>
                              <span className={unrealizedPnlValue >= 0 ? 'text-success' : 'text-red-500'}>
                                <PriceDisplay usdAmount={unrealizedPnlValue} align="right" />
                              </span>
                            </div>
                            <div className="flex justify-between gap-4 border-t border-borderDefault pt-1 mt-0.5">
                              <span className="text-grayGhost font-medium">Total:</span>
                              <span className={`font-medium ${totalPnlValue >= 0 ? 'text-success' : 'text-red-500'}`}>
                                <PriceDisplay usdAmount={totalPnlValue} align="right" />
                              </span>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </td>

                    {/* Platform */}
                    <td className="text-left px-2">
                      {(() => {
                        const platform = (holder as typeof holder & { platform?: { id?: string; name?: string; logo?: string } }).platform;
                        return platform?.name ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-bgTertiary text-[10px] font-medium text-white">
                            {platform.logo && (
                              <img 
                                src={platform.logo} 
                                width={12} 
                                height={12} 
                                alt={platform.name || ''} 
                                className="rounded-full"
                              />
                            )}
                            {platform.name}
                          </span>
                        ) : (
                          <span className="text-grayGhost">—</span>
                        );
                      })()}
                    </td>

                    {/* Remaining */}
                    <td className="px-2">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-grayGhost text-[10px] w-10">
                            {formatPercentage(remainingPercent)}
                          </span>
                          <PriceDisplay usdAmount={balanceUSD} align="left" />
                        </div>
                        <div className="w-full bg-borderDefault rounded-full h-1 overflow-hidden">
                          <div
                            className="bg-success h-1 rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(remainingPercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Funding */}
                    <td className="text-left px-2 pr-4">
                      <FundingDisplay fundingInfo={holder.fundingInfo} blockchain={blockchain} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
}
