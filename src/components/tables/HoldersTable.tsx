import { useState } from 'react';
import { truncate, formatUSD, formatPercentage, buildExplorerUrl, formatPureNumber } from '@mobula_labs/sdk';
import { ExternalLink, ArrowUpDown } from 'lucide-react';
import { useWalletModalStore } from '@/store/useWalletModalStore';
import { usePairHoldersStore } from '@/features/pair/store/usePairHolderStore';
import { HOLDER_TAG_ICONS } from '@/assets/icons/HolderTags';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { HoldersTableSkeleton } from '../skeleton';
import { PriceDisplay } from '../PriceDisplay';

type HoldersTableProps = {
  totalSupply: number;
};

export function HoldersTable({ totalSupply }: HoldersTableProps) {
  const { holders, loading, blockchain } = usePairHoldersStore();

  const [showRealized, setShowRealized] = useState(false);


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
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-[#22242D] scrollbar-track-transparent hover:scrollbar-thumb-[#343439]">
          <table className="min-w-[600px] w-full text-xs bg-bgPrimary border-collapse table-fixed">
            <thead className="text-grayGhost bg-bgPrimary h-9 sticky top-0 z-20 border-b border-borderDefault shadow-sm text-xs">
              <tr>
                <th className="w-[10px] whitespace-nowrap text-left pl-5">#</th>
                <th className="w-[1px] text-left whitespace-nowrap px-2">/</th>
                <th className="w-[150px] whitespace-nowrap text-left">Wallet</th>
                <th className="w-[100px] whitespace-nowrap text-left">Wallet Balance</th>
                {/* <th className="w-[100px] whitespace-nowrap text-left">Bought</th>
                <th className="w-[100px] whitespace-nowrap text-left">Sold</th> */}
                <th className="w-[120px] whitespace-nowrap text-left">Remaining</th>
                {/* <th
                  className="w-[120px] text-right pr-5 cursor-pointer select-none"
                  onClick={() => setShowRealized(!showRealized)}
                >
                  <div className="inline-flex items-center text-xs gap-1">
                    <span>{showRealized ? 'Realized PNL' : 'Unrealized PNL'}</span>
                    <ArrowUpDown
                      size={12}
                      className={showRealized ? 'text-success' : 'text-muted-foreground'}
                    />
                  </div>
                </th> */}
              </tr>
            </thead>

            <tbody>
              {holders.map((holder, index) => {
                const remainingPercent = totalSupply
                  ? (holder.balance / totalSupply) * 100
                  : 0;

                // const pnlValue = showRealized
                //   ? holder.realizedPnlUSD
                //   : holder.unrealizedPnlUSD;

                return (
                  <tr
                  key={holder.address}
                  className="cursor-default border-b border-borderDefault/50 transition-colors h-10 bg-bgPrimary even:bg-bgTableAlt hover:bg-bgTableHover"
                >
                
                    <td className="text-center text-grayGhost">{index + 1}</td>
                    <td></td>

                    <td className="text-left whitespace-nowrap">
                      <div className="inline-flex items-start justify-center space-x-2">
                        {holder.address && blockchain && (() => {
                          const explorerUrl = buildExplorerUrl(blockchain, 'address', holder.address);
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
                            useWalletModalStore.getState().openWalletModal({
                              walletAddress: holder.address,
                              txHash: holder.address,
                              blockchain,
                            })
                          }
                          className="text-accentPurple hover:underline-offset-2 hover:underline cursor-pointer truncate max-w-[200px]"
                        >
                          {truncate(holder.address, { length: 4, mode: 'middle' })}
                        </span>

                        {holder.tags?.length > 0 && (
                          <div className="flex items-center space-x-1">
                            {holder.tags.map((tag: string) => {
                              const icon = HOLDER_TAG_ICONS[tag];
                              return icon ? (
                                <Tooltip key={tag}>
                                  <TooltipTrigger asChild>{icon}</TooltipTrigger>
                                  <TooltipContent
                                    side="top"
                                    className="text-[10px] font-medium text-textPrimary"
                                  >
                                    {tag}
                                  </TooltipContent>
                                </Tooltip>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="text-left text-grayGhost font-medium">
                      {formatPureNumber(holder.balance)}
                    </td>
                    {/* <td className="text-left text-success font-normal">
                      <PriceDisplay usdAmount={holder.boughtAmountUSD} align="left" />
                    </td>
                    <td className="text-left font-normal text-white">
                      <PriceDisplay usdAmount={holder.soldAmountUSD} align="left" />
                    </td> */}

                    <td>


                      <div className="flex flex-col items-start justify-start w-full">
                        <div className="flex items-center space-x-1 mb-1">
                          <div className="text-xs text-grayGhost"><PriceDisplay usdAmount={holder.balanceUSD} /></div>
                          <span className="text-textTertiary text-[10px] w-14 text-center rounded-md bg-bgContainer px-[2px]">
                            {formatPercentage(remainingPercent)}
                          </span>
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

                    {/* <td
                      className={`pr-5 text-right font-medium ${Number(pnlValue) >= 0
                        ? 'text-success'
                        : 'text-red-500'
                        }`}
                    >
                      <PriceDisplay usdAmount={pnlValue} align="right" />
                    </td> */}
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
