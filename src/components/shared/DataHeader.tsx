'use client';

import Image from 'next/image';
import { useState, memo } from 'react';
import { Separator } from '@/components/ui/separator';
import CopyToClipboard from '@/utils/CopyToClipboard';
import TooltipFrame from '@/utils/TooltipFramer';
import { formatCryptoPrice, formatUSD, truncate } from '@mobula_labs/sdk';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { HoverCard, HoverCardTrigger, HoverCardContent, HoverCardArrow } from '@/components/ui/hover-card';
import { AlertTriangle, Globe, Lock, Search, Send, UserRound } from 'lucide-react';
import { useTradingStore } from '@/store/tradingStore';
import Link from 'next/link';
import DexLink from '@/utils/DexLink';
import TimeAgo from '@/utils/TimeAgo';
import {
  formatLiquidityWithPlaceholder,
  formatPriceWithPlaceholder,
  shouldShowLowLiquidityWarning,
} from '@/utils/tokenMetrics';

interface TokenInfo {
  address?: string;
  symbol?: string | null;
  name?: string | null;
  logo?: string | null;
  priceUSD?: number;
  blockchain?: string;
  marketCapUSD?: number;
  marketCapDilutedUSD?: number;
  deployer?: string | null;
}

export interface BaseHeaderData {
  primaryToken: TokenInfo;
  secondaryToken?: TokenInfo;
  address?: string;
  logo?: string;
  exchangeLogo?: string | null;
  exchangeName?: string | null;
  createdAt?: string | Date;
  socials: {
    twitter: string | null;
    website: string | null;
    telegram: string | null;
    others: Record<string, unknown> | null;
    uri?: string | undefined;
  };
  liquidityUSD?: number;
  marketCapDilutedUSD?: number;
  totalFeesPaidUSD?: number;
}

interface DataHeaderProps {
  data: BaseHeaderData;
  isLoading?: boolean;
  onTitleUpdate?: (title: string) => void;
  SkeletonComponent?: React.ComponentType;
}

export function DataHeader({
  data,
  isLoading = false,
  SkeletonComponent,
}: DataHeaderProps) {
  const [imageError, setImageError] = useState(false);

  const markets = useTradingStore((state) => state.markets);


  const { primaryToken, secondaryToken, address, exchangeLogo, liquidityUSD, totalFeesPaidUSD, createdAt, socials, exchangeName } =
    data;

  const priceUSD = primaryToken?.priceUSD;
  const priceDisplayValue = formatPriceWithPlaceholder(priceUSD);
  const title =
    primaryToken?.symbol && priceUSD !== undefined
      ? `${primaryToken.symbol} ${priceDisplayValue} ${secondaryToken?.symbol ?? 'USD'} price today | Mobula`
      : 'Mobula';

  const liquidityDisplayValue =
    liquidityUSD === undefined ? undefined : formatLiquidityWithPlaceholder(liquidityUSD);
  const showLowLiquidityWarning = shouldShowLowLiquidityWarning(liquidityUSD);

  useDocumentTitle(title);

  if (isLoading && SkeletonComponent) {
    return <SkeletonComponent />;
  }

  return (
    <div className="flex w-full items-center justify-between py-3">
      {/* Left Side: Token + Metrics */}
      <div className="flex items-center flex-1 justify-start gap-6">
        <div className="flex items-center space-x-3 max-w-[250px]">
          <div className="relative w-12 h-12">
            <div className="w-full h-full rounded-full shadow-lg overflow-hidden bg-gray-800 flex items-center justify-center">
              {primaryToken?.logo && !imageError ? (
                <Image
                  src={primaryToken.logo}
                  alt={`${primaryToken.symbol} token`}
                  width={48}
                  height={48}
                  className="object-contain rounded-full"
                  loading="lazy"
                  onError={() => setImageError(true)}
                  unoptimized
                />
              ) : (
                <span className="text-lg font-bold text-textPrimary">
                  {primaryToken?.symbol?.[0]?.toUpperCase() ?? '?'}
                </span>
              )}
            </div>

            {exchangeLogo && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-borderDefault shadow-md overflow-hidden bg-bgBase flex items-center justify-center">
                <Image
                  src={exchangeLogo}
                  alt="DEX"
                  width={20}
                  height={20}
                  className="object-cover w-full h-full p-[2px] rounded-full"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1 overflow-hidden min-w-[130px] max-w-[170px]">
            <div className="flex items-center overflow-hidden">
              <TooltipFrame tooltipContent={primaryToken?.name || ''}>
                <span className="text-textPrimary text-[16px] font-normal truncate">
                  {truncate(primaryToken?.name, { length: 10 })}
                </span>
              </TooltipFrame>
              <CopyToClipboard text={address ?? ''} />
              <span className="text-textTertiary text-[14px] font-medium truncate">
                {secondaryToken
                  ? `${truncate(primaryToken?.symbol ?? '', { length: 8 })}/${truncate(secondaryToken?.symbol ?? '', { length: 8 })}`
                  : truncate(primaryToken?.symbol ?? '', { length: 16 })}
              </span>
            </div>
            <div className="flex items-center gap-2 overflow-hidden text-textPrimary">
              {exchangeLogo && exchangeName && (
                <DexLink
                  token={exchangeName}
                  logo={exchangeLogo}
                  tokenAddress={address ?? ''}
                />
              )}
              {
                socials.twitter && (
                  <Link
                    href={socials.twitter}
                    target="_blank"
                    className="flex items-center justify-center"
                  >
                    <Globe size={15} className='text-textPrimary hover:text-success' />
                  </Link>
                )
              }
              {
                socials.website && (
                  <Link
                    href={socials.website}
                    target="_blank"
                    className="flex items-center justify-center"
                  >
                    <UserRound size={16} className="text-textPrimary hover:text-success" />
                  </Link>
                )
              }
              {
                socials.twitter && (
                  <Link
                    href={`https://x.com/search?q=$${primaryToken?.symbol}`}
                    target="_blank"
                    className="flex items-center justify-center"
                  >
                    <Search size={16} className="text-textPrimary hover:text-success" />
                  </Link>
                )
              }
              {
                socials.telegram && (
                  <Link
                    href="https://t.me/"
                    target="_blank"
                    className="flex items-center  justify-center"
                  >
                    <Send size={15} className='text-textPrimary hover:text-success' />
                  </Link>
                )
              }
              <span className="text-xs text-textSecondary flex items-center">
                <TimeAgo timestamp={createdAt} />
              </span>
            </div>

          </div>
        </div>

        <div className="flex items-center ml-2 gap-3 border-[1px] border-borderDefault">
          <MetricDisplay label="PRICE USD" value={priceDisplayValue} />
          <VerticalDivider />
          <MetricDisplay label="FDV" value={formatCryptoPrice(primaryToken?.marketCapDilutedUSD)} />

          <VerticalDivider />
          <MetricDisplay label="MCAP" value={formatCryptoPrice(primaryToken?.marketCapUSD)} />

          {liquidityUSD !== undefined && (
            <>
              <VerticalDivider />
              <MetricDisplay label="LIQUIDITY" value={liquidityDisplayValue} />
            </>
          )}

          {showLowLiquidityWarning && (
            <>
              <VerticalDivider />
              <LowLiquidityBadge />
            </>
          )}

          {totalFeesPaidUSD !== undefined && (
            <>
              <VerticalDivider />

              <HoverCard>
                <HoverCardTrigger asChild>
                  <div className="flex flex-col space-y-1 w-[100px] cursor-pointer">
                    <span className="text-grayNeutral text-center font-menlo text-[11px] font-bold leading-[14px] uppercase">
                      FEES PAID
                    </span>
                    <span className="text-white text-center font-menlo text-[15px] font-bold leading-[18px] truncate">
                      {formatCryptoPrice(totalFeesPaidUSD)}
                    </span>
                  </div>
                </HoverCardTrigger>

                {markets && markets.length > 0 && (
                  <HoverCardContent
                    side="bottom"
                    align="center"
                    className="relative w-[380px] p-0 bg-bgPrimary border border-borderDefault rounded-lg shadow-md"

                  >
                    <HoverCardArrow className="fill-borderDefault" />


                    <div className="flex justify-between items-center px-4 py-3 border-b border-borderDefault">
                      <p className="text-[13px] font-medium text-white">Total Fees Paid</p>
                      <button className="text-xs text-textTertiary hover:text-white underline underline-offset-2">
                        Get data &lt;/&gt;
                      </button>
                    </div>


                    <div className="max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#2A2A2E] scrollbar-track-transparent">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-bgPrimary border-b border-borderDefault z-10">
                          <tr className="text-textTertiary text-xs">
                            <th className="text-left text-xs px-4 py-2 font-normal w-[140px]">Platform</th>
                            <th className="text-right text-xs px-4 py-2 font-normal w-[100px]">Amount</th>
                            <th className="text-right text-xs px-4 py-2 font-normal w-[100px]">Total Vol.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-borderDefault">
                          {markets.map((m) => (
                            <tr
                              key={m.poolAddress}
                              className="cursor-default border-b border-borderDefault/50 text-xs transition-colors  bg-bgPrimary even:bg-bgTableAlt hover:bg-bgTableHover h-10"
                            >
                              <td className="px-4 py-2 w-[140px]">
                                <div className="flex items-center gap-2">
                                  <Image
                                    src={m.exchangeLogo || '/mobula.svg'}
                                    alt={m.exchange}
                                    width={16}
                                    height={16}
                                    className="rounded-full flex-shrink-0"
                                  />
                                  <span className="truncate text-grayGhost text-xs font-normal">{m.exchange}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2 text-xs text-right text-grayGhost w-[100px]">
                                {formatCryptoPrice(m.totalFeesPaidUSD)}
                              </td>
                              <td className="px-4 py-2 text-xs text-grayGhost text-right w-[100px]">
                                {formatUSD(m.volume24hUSD)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </HoverCardContent>
                )}
              </HoverCard>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

const VerticalDivider = () => (
  <div className="flex flex-col h-12 justify-center">
    <Separator orientation="vertical" className="h-full w-px bg-borderPrimary" />
  </div>
);

const MetricDisplay = memo(function MetricDisplay({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col space-y-1 w-[100px] min-w-[100px] text-center">
      <span className="text-grayNeutral font-menlo text-[11px] font-bold leading-[14px] uppercase">
        {label}
      </span>
      <span className="flex items-center justify-center gap-1 text-white font-menlo text-[15px] font-bold leading-[18px] truncate">

        {value ?? '--'}  {label === 'LIQUIDITY' && <div className='rounded-full border-[2px] border-success p-[2px]'><Lock size={10} className="text-grayExtraLight flex-shrink-0" /></div>}
      </span>
    </div>
  );
});

const LowLiquidityBadge = () => (
  <div className="flex flex-col items-center justify-center px-3 py-1">
    <span className="text-amber-300 flex items-center gap-1 text-[11px] font-menlo font-bold uppercase">
      <AlertTriangle size={12} className="text-amber-300 flex-shrink-0" />
      Low liquidity token
    </span>
    <span className="text-[10px] text-amber-200 font-menlo">Trade cautiously</span>
  </div>
);