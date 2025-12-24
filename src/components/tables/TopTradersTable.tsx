import {
  formatPureNumber,
  truncate,
  formatPercentage,
  buildExplorerUrl,
} from '@mobula_labs/sdk';
import { ExternalLink, Funnel, X } from 'lucide-react';
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


interface TopTradersTableProps {
  tokenAddress: string;
  blockchain: string;
  totalSupply: number;
}

const headers = [
  { label: '#', align: 'text-left', width: 'w-[10px] pl-5' },
  { label: '/', align: 'text-left', width: 'w-[1px] px-2' },
  { label: 'Wallet', align: 'text-left', width: 'w-[150px]' },
  { label: 'Wallet Balance', align: 'text-left', width: 'w-[100px]' },
  { label: 'Bought', align: 'text-left', width: 'w-[100px]' },
  { label: 'Sold', align: 'text-left', width: 'w-[100px]' },
  { label: 'Remaining', align: 'text-left', width: 'w-[120px]' },
  { label: 'Unrealized PNL', align: 'text-right', width: 'w-[120px] pr-5' },
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

  const hasData = data?.data && data.data.length > 0;

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
                {data.data.map((trader, index) => {
                  const tokenAmountNum = Number(trader.tokenAmount);
                  const totalSupplyNum = Number(totalSupply);
                  const remainingPercent =
                    totalSupplyNum > 0 ? (tokenAmountNum / totalSupplyNum) * 100 : 0;

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
                          <Funnel
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

                      <td className="text-left text-grayGhost font-medium text-xs leading-[16px] tracking-normal align-middle">
                        {formatPureNumber(trader.tokenAmount)}
                      </td>

                      <td className="text-left text-success font-normal text-xs leading-[16px] tracking-normal align-middle">
                        <PriceDisplay usdAmount={trader.volumeBuyUSD} />
                      </td>

                      <td className="text-left font-normal text-xs leading-[16px] tracking-normal align-middle text-white">
                        <PriceDisplay usdAmount={trader.volumeSellUSD} />
                      </td>

                      <td>
                        <div className="flex items-center gap-3">
                          <span className="text-grayGhost font-normal text-xs leading-[16px] tracking-normal text-center w-14">
                            {formatPercentage(remainingPercent)}
                          </span>
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

                      <td
                        className={`pr-5 text-right font-medium ${Number(trader.pnlUSD) >= 0
                            ? 'text-success'
                            : 'text-red-500'
                          }`}
                      >
                        <PriceDisplay usdAmount={trader.pnlUSD} align='right' />
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