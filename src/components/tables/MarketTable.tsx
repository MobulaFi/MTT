import { Market } from '@/types/trading';
import Image from 'next/image';
import { HoldersTableSkeleton } from '../skeleton';
import { formatPureNumber, formatUSD } from '@mobula_labs/sdk';
import Link from 'next/link';
import { PriceDisplay } from '../PriceDisplay';
import { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { shouldMaskPrice } from '@/utils/tokenMetrics';

interface MarketsTableProps {
  data: Market[];
  isLoading?: boolean;
}

export function MarketsTable({ data, isLoading }: MarketsTableProps) {
  const [showUSD, setShowUSD] = useState(true);

  if (isLoading) {
    return <HoldersTableSkeleton />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-grayGhost">No market data available</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto overflow-x-auto scrollbar-thin scrollbar-thumb-[#22242D] scrollbar-track-transparent hover:scrollbar-thumb-[#343439]">
      <table className="min-w-[600px] w-full text-xs bg-bgPrimary border-collapse table-fixed">
        <thead className="sticky top-0 z-20 bg-bgPrimary border-b border-borderDefault shadow-sm text-xs h-9">
          <tr>
            <th className="w-[10px] text-left pl-5 font-medium text-xs leading-4 tracking-normal align-middle text-grayGhost">#</th>
            <th className="w-[1px] text-left px-2 font-medium text-xs leading-4 tracking-normal align-middle text-grayGhost">/</th>
            <th className="w-[150px] text-left font-medium text-xs leading-4 tracking-normal align-middle text-grayGhost">Exchange</th>
            <th className="w-[100px] text-left font-medium text-xs leading-4 tracking-normal align-middle text-grayGhost">Pair</th>
            <th className="w-[100px] text-left font-medium text-xs leading-4 tracking-normal align-middle text-grayGhost">Price</th>
            <th 
              className="w-[100px] text-left font-medium text-xs leading-4 tracking-normal align-middle text-grayGhost cursor-pointer select-none hover:text-textPrimary transition-colors"
              onClick={() => setShowUSD(!showUSD)}
            >
              <div className="inline-flex items-center gap-1">
                <span>Base / Quote</span>
                <ArrowUpDown size={14} className={showUSD ? 'text-success' : 'text-grayGhost'} />
              </div>
            </th>
            <th className="w-[120px] text-right pr-5 font-medium text-xs leading-4 tracking-normal align-middle text-grayGhost">24h Volume</th>
          </tr>
        </thead>

        <tbody>
          {data.map((market, index) => (
            <tr
              key={index}
              className={`
               cursor-default border-b border-borderDefault/50 transition-colors h-10 bg-bgPrimary even:bg-bgTableAlt hover:bg-bgTableHover text-xs
              `}
            >
              <td className="text-center text-grayGhost">{index + 1}</td>
              <td></td>

              <td className="text-left">
                <div className="flex items-center gap-2">
                  {market.exchangeLogo ? (
                    <div className="w-4 h-4 relative flex-shrink-0">
                      <Image
                        src={market.exchangeLogo}
                        alt={market.exchange}
                        fill
                        className="object-contain rounded-full"
                      />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-success flex-shrink-0" />
                  )}
                  <span className="text-textPrimary truncate text-xs max-w-[120px]">{market.exchange}</span>
                </div>
              </td>

              <td className="text-left text-textPrimary font-medium truncate max-w-[100px]">
                <Link
                  href={`/pair/${market.chainId}/${market.poolAddress}`}
                  className="text-textPrimary font-medium text-xs truncate hover:underline"
                >
                  {market.pair}
                </Link>
              </td>

              <td className="text-left text-textPrimary">
                {shouldMaskPrice(market.price) ? (
                  <span className="text-textSecondary font-menlo text-xs">N/A</span>
                ) : (
                  <PriceDisplay align='left' usdAmount={market.price} />
                )}
              </td>
              <td className="text-left text-textPrimary">
                {showUSD ? (
                  <>
                     ${((market.reserve0 || 0) * (market.basePriceUSD || 0)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} / ${((market.reserve1 || 0) * (market.quotePriceUSD || 0)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </>
                ) : (
                  <>
                    {(formatPureNumber(market.reserve0))} {market.baseSymbol || ''} / {(formatPureNumber(market.reserve1))} {market.quoteSymbol || ''}
                  </>
                )}
              </td>
              <td className="pr-5 text-right text-success font-medium"><PriceDisplay align='right' usdAmount={market.volume24hUSD} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
