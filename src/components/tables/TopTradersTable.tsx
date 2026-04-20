import {
  formatPureNumber,
  truncate,
  formatPercentage,
  buildExplorerUrl,
} from '@mobula_labs/sdk';
import { ExternalLink, Filter, Building2 } from 'lucide-react';
import { useWalletModalStore } from '@/store/useWalletModalStore';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { HOLDER_TAG_ICONS } from '@/assets/icons/HolderTags';
import { HoldersTableSkeleton } from '../skeleton';
import { PriceDisplay } from '../PriceDisplay';
import { useTopTradersData } from '@/hooks/useTopTraderData';
import { getTokenAge } from '@/utils/Formatter';

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


interface TopTradersTableProps {
  tokenAddress: string;
  blockchain: string;
  totalSupply: number;
}

const headers = [
  { label: '#', align: 'text-left', width: 'w-[10px] pl-5' },
  { label: '/', align: 'text-left', width: 'w-[1px] px-2' },
  { label: 'Wallet', align: 'text-left', width: 'w-[150px]' },
  { label: 'Bought', align: 'text-left', width: 'w-[100px]' },
  { label: 'Sold', align: 'text-left', width: 'w-[100px]' },
  { label: 'Total PnL', align: 'text-left', width: 'w-[120px]' },
  { label: 'Platform', align: 'text-left', width: 'w-[90px]' },
  { label: 'Remaining', align: 'text-left', width: 'w-[120px]' },
  { label: 'Last Active', align: 'text-right', width: 'w-[90px] pr-5' },
];

export function TopTradersTable({
  tokenAddress,
  blockchain,
  totalSupply
}: TopTradersTableProps) {
  const { data, filters, isLoading, error, setFilter, clearFilters } = useTopTradersData({
    tokenAddress,
    blockchain,
  });

  const handleLabelClick = (clickedLabel: string) => {
    if (filters.label === clickedLabel) {
      clearFilters();
    } else {
      setFilter('label', clickedLabel);
    }
  };

  if (isLoading) {
    return <HoldersTableSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="text-red-500 text-sm font-medium">Error loading traders</div>
        <div className="text-grayGhost text-xs">{error}</div>
      </div>
    );
  }

  // Client-side label filtering
  const filteredData = data?.data
    ? filters.label
      ? data.data.filter((t) => t.labels?.includes(filters.label!))
      : data.data
    : [];
  const hasData = filteredData.length > 0;

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        <div className="flex-1 w-full overflow-y-auto overflow-x-auto scrollbar-thin scrollbar-thumb-[#22242D] scrollbar-track-transparent hover:scrollbar-thumb-[#343439]">
          {!hasData ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-grayGhost text-sm">
                {filters.label
                  ? `No traders found with label: ${filters.label}`
                  : 'No trader data available'}
              </div>
            </div>
          ) : (
            <table className="min-w-[600px] w-full text-xs bg-bgPrimary border-collapse table-fixed">
              {/* Sticky Header */}
              <thead className="sticky text-xs h-9 top-0 z-20 bg-bgPrimary border-b border-borderDefault shadow-sm">
                <tr>
                  {headers.map((header, i) => (
                    <th
                      key={i}
                      className={`${header.width} ${header.align} font-medium text-xs leading-4 tracking-normal py-2 text-grayGhost`}
                    >
                      {header.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredData.map((trader, index) => {
                  const tokenAmountNum = Number(trader.tokenAmount);
                  const totalSupplyNum = Number(totalSupply);
                  const remainingPercent =
                    totalSupplyNum > 0 ? (tokenAmountNum / totalSupplyNum) * 100 : 0;
                  const balanceUSD = Number(trader.tokenAmountUSD) || 0;
                  const realizedPnlValue = Number(trader.realizedPnlUSD) || 0;
                  const unrealizedPnlValue = Number(trader.unrealizedPnlUSD) || 0;
                  const totalPnlValue = Number(trader.totalPnlUSD) || (realizedPnlValue + unrealizedPnlValue);
                  const avgBuyPrice = Number(trader.avgBuyPriceUSD) || 0;
                  const avgSellPrice = Number(trader.avgSellPriceUSD) || 0;

                  return (
                    <tr
                      key={`${trader.walletAddress}-${index}`}
                      className={`
                                  cursor-default border-b border-borderDefault/50 transition-colors h-10 bg-bgPrimary even:bg-bgTableAlt hover:bg-bgTableHover text-xs
                      `}
                    >
                      <td className="text-center text-grayGhost">{index + 1}</td>
                      <td></td>
                      <td className="text-left whitespace-nowrap">
                        <div className="inline-flex items-start justify-center space-x-2">
                          <Filter
                            color={'#777A8C'}
                            size={13}
                            className="cursor-pointer hover:opacity-70 transition-opacity"
                          />

                          {trader.chainId && trader.walletAddress && (() => {
                            const explorerUrl = buildExplorerUrl(
                              trader.chainId,
                              'address',
                              trader.walletAddress
                            );
                            return explorerUrl ? (
                              <a
                                href={explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center text-grayGhost hover:text-textPrimary transition-colors"
                                title="View on explorer"
                              >
                                <ExternalLink color="#777A8C" size={13} />
                              </a>
                            ) : null;
                          })()}

                          <span
                            onClick={() =>
                              useWalletModalStore
                                .getState()
                                .openWalletModal({
                                  walletAddress: trader.walletAddress,
                                  txHash: trader.walletAddress,
                                  blockchain: trader.chainId,
                                })
                            }
                            className="text-accentPurple hover:underline-offset-2 hover:underline cursor-pointer truncate max-w-[200px] font-normal text-xs leading-4 tracking-normal align-middle"
                          >
                            {truncate(trader.walletAddress, {
                              length: 4,
                              mode: 'middle',
                            })}
                          </span>

                          {/* Wallet Entity (CEX, Market Maker, etc.) */}
                          <WalletEntityBadge
                            metadata={(trader as typeof trader & { walletMetadata?: WalletMetadata }).walletMetadata}
                          />

                          {trader.labels && trader.labels.length > 0 && (
                            <div className="flex items-center space-x-1">
                              {trader.labels.map((tag: string) => {
                                const icon = HOLDER_TAG_ICONS[tag];
                                const isActiveFilter = filters.label === tag;

                                if (!icon) return null;

                                return (
                                  <Tooltip key={tag}>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleLabelClick(tag);
                                        }}
                                        className={`
                                          transition-all cursor-pointer focus:outline-none
                                          ${isActiveFilter
                                            ? 'opacity-100 ring-offset-1 ring-offset-bgPrimary rounded'
                                            : 'opacity-70 hover:opacity-100'
                                          }
                                        `}
                                        aria-label={`Filter by ${tag}`}
                                      >
                                        {icon}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent
                                      side="top"
                                      className="text-[10px] font-medium text-textPrimary"
                                    >
                                      <div>{tag}</div>
                                      {isActiveFilter && (
                                        <div className="text-[9px] text-accentPurple mt-0.5">
                                          (currently filtered)
                                        </div>
                                      )}
                                      <div className="text-[9px] text-grayGhost mt-0.5">
                                        Click to {isActiveFilter ? 'clear' : 'filter'}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Bought + Avg Buy + Buys count */}
                      <td className="text-left font-normal text-xs leading-[16px] tracking-normal align-middle">
                        <div className="flex flex-col">
                          <span className="text-success">
                            <PriceDisplay usdAmount={trader.volumeBuyUSD} />
                          </span>
                          <div className="flex items-center gap-1 text-[10px] text-grayGhost">
                            <span>{trader.buys || 0} buys</span>
                            {avgBuyPrice > 0 && (
                              <>
                                <span>·</span>
                                <span>avg <PriceDisplay usdAmount={avgBuyPrice} /></span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Sold + Avg Sell + Sells count */}
                      <td className="text-left font-normal text-xs leading-[16px] tracking-normal align-middle">
                        <div className="flex flex-col">
                          <span className="text-white">
                            <PriceDisplay usdAmount={trader.volumeSellUSD} />
                          </span>
                          <div className="flex items-center gap-1 text-[10px] text-grayGhost">
                            <span>{trader.sells || 0} sells</span>
                            {avgSellPrice > 0 && (
                              <>
                                <span>·</span>
                                <span>avg <PriceDisplay usdAmount={avgSellPrice} /></span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Total PnL with Realized/Unrealized breakdown */}
                      <td className="text-left">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-col cursor-help">
                              <span className={`font-medium ${totalPnlValue >= 0 ? 'text-success' : 'text-red-500'}`}>
                                <PriceDisplay usdAmount={totalPnlValue} />
                              </span>
                              <div className="flex items-center gap-2 text-[9px]">
                                <span className={realizedPnlValue >= 0 ? 'text-success/70' : 'text-red-500/70'}>
                                  R: <PriceDisplay usdAmount={realizedPnlValue} />
                                </span>
                                <span className={unrealizedPnlValue >= 0 ? 'text-success/70' : 'text-red-500/70'}>
                                  U: <PriceDisplay usdAmount={unrealizedPnlValue} />
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
                          const platform = (trader as typeof trader & { platform?: { id?: string; name?: string; logo?: string } }).platform;
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
                      <td>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-grayGhost font-normal text-xs leading-[16px] tracking-normal text-center w-14">
                              {formatPercentage(remainingPercent)}
                            </span>
                            {balanceUSD > 0 && (
                              <span className="text-[10px] text-grayGhost">
                                <PriceDisplay usdAmount={balanceUSD} />
                              </span>
                            )}
                          </div>
                          <div className="w-full bg-borderDefault rounded-full h-1 overflow-hidden">
                            <div
                              className="bg-success h-1 rounded-full"
                              style={{
                                width: `${remainingPercent}%`,
                                transition: 'width 0.7s ease-out',
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Last Active */}
                      <td className="pr-5 text-right text-grayGhost text-[10px]">
                        {trader.lastTradeAt ? (
                          getTokenAge(trader.lastTradeAt)
                        ) : trader.lastActivityAt ? (
                          getTokenAge(trader.lastActivityAt)
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
