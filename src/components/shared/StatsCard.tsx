// components/shared/StatsCard.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { ExternalLink, Globe, Twitter, Send, LucideIcon } from 'lucide-react';
import { truncate, formatCryptoPrice, formatPureNumber } from '@mobula_labs/sdk';
import { Skeleton } from '../ui/skeleton';
import { TooltipButton } from '../ui/tooltipbutton';
import TokenMetricsCard from '@/features/pair/components/TokenMetricsCard';
import { TimeframeChange } from '@/utils/TimeFrameChange';
import { getTimeAgo } from '@/utils/TimeAgo';
import SafeImage from '@/components/SafeImage';

const labelClass = 'text-grayMedium font-menlo text-[11px] sm:text-[12px] font-normal leading-[19.5px] underline decoration-solid underline-offset-auto truncate';
const valueClass = 'text-white text-[12px] sm:text-[13px] font-normal leading-[19.5px] truncate';
const rowContainerClass = 'flex items-center justify-between px-3 sm:px-4 py-2 gap-2';
const clampPercentage = (value: number) => Math.max(0, Math.min(100, value));

const InfoRow = ({ label, value }: { label: string; value: string | number }) => (
    <div className={rowContainerClass}>
        <div className={labelClass}>{label}</div>
        <div className={valueClass}>{value}</div>
    </div>
);

const AddressRow = ({
    label,
    tooltip,
    address,
    explorerUrl,
}: {
    label: string;
    tooltip: string;
    address?: string | null;
    explorerUrl?: string | null;
}) => {
    if (!address) return null;

    return (
        <div className={rowContainerClass}>
            <div className={labelClass}>{label}</div>
            <div className="flex items-center gap-1 min-w-0">
                <TooltipButton tooltip={tooltip} copyText={address}>
                    <span className="text-[10px] sm:text-xs bg-bgContainer border border-borderDefault px-1.5 sm:px-2 font-normal text-whiteOverlay py-0.5 sm:py-1 truncate">
                        {truncate(address, { length: 6, mode: 'middle' })}
                    </span>
                </TooltipButton>
                {explorerUrl && (
                    <Link href={explorerUrl} target="_blank">
                        <ExternalLink size={12} className="text-grayBorder flex-shrink-0" />
                    </Link>
                )}
            </div>
        </div>
    );
};


// StatItem & Buy/Sell Bar
interface StatItemProps {
    label: string | number;
    value?: string | number | null;
    labelPosition?: 'center' | 'left' | 'right';
    valuePosition?: 'center' | 'left' | 'right';
    isCurrency?: boolean;
}

export function StatItem({
    label,
    value,
    labelPosition = 'left',
    valuePosition = 'left',
    isCurrency = false,
}: StatItemProps) {
    const displayValue =
        value == null ? 'N/A' : value

    return (
        <div className="px-1.5 sm:px-2">
            <div className={`text-grayMedium font-menlo text-[10px] sm:text-[11px] font-bold leading-[14px] uppercase text-${labelPosition} truncate`}>
                {label}
            </div>
            <div className={`text-white font-menlo text-[12px] sm:text-[13px] font-normal leading-[22.5px] text-${valuePosition} truncate`}>
                {displayValue}
            </div>
        </div>
    );
}

export const getBuyPercent = (buys: number | string, sells: number | string): number => {
    const b = Number(buys) || 0;
    const s = Number(sells) || 0;
    return b + s > 0 ? (b / (b + s)) * 100 : 50;
};


// Header
function Header({ base, quote, headerImage, socials }: {
    base: StatsCardData['baseToken'];
    quote?: StatsCardData['quoteToken'];
    headerImage?: string;
    socials?: StatsCardData['socials'];
}) {
    const title = quote
        ? `${truncate(base.symbol, { length: 8 })}/${truncate(quote.symbol, { length: 8 })}`
        : truncate(base.symbol, { length: 16 });

    return (
        <div className="pl-3 sm:pl-4 pr-3 sm:pr-4 py-3 space-y-2 sm:space-y-3 border-b-[1px] border-borderDefault">
            <div className="flex items-center gap-1 min-w-0">
                <span className="text-textTertiary text-[13px] sm:text-[14px] font-medium leading-[21px] tracking-[-0.28px] truncate">
                    {title}
                </span>
            </div>

            <div className="border border-borderDefault rounded-[4px] w-full h-[100px] sm:h-[130px] flex items-center justify-center overflow-hidden bg-bgOverlay">
                {headerImage ? (
                    <div className="relative w-full h-full">
                        <SafeImage
                            src={headerImage}
                            alt={base.symbol ?? "Token"}
                            fill
                            sizes="(max-width: 768px) 100vw, 50vw"
                            className="object-contain object-center rounded-[4px]"
                        />
                    </div>
                ) : (
                    <div className="flex items-center justify-center w-full h-full bg-bgOverlay text-textPrimary text-[48px] font-semibold select-none">
                        {base?.symbol?.[0] ?? "?"}
                    </div>
                )}
            </div>


            {socials && (
                <div className="grid grid-cols-3 bg-bgContainer text-white rounded-[4px] w-full overflow-hidden">
                    {[
                        {
                            name: "Website",
                            icon: <Globe size={14} className="text-grayGhost sm:mr-2" />,
                            href: socials?.website,
                            border: false,
                        },
                        {
                            name: "Twitter",
                            icon: <Twitter size={14} className="text-grayGhost sm:mr-2" />,
                            href: socials?.twitter,
                            border: true,
                        },
                        {
                            name: "Telegram",
                            icon: <Send size={14} className="text-grayGhost sm:mr-2" />,
                            href: socials?.telegram,
                            border: false,
                        },
                    ].map(({ name, icon, href, border }) => {
                        const isDisabled = !href || href.trim() === "";
                        const base =
                            "flex items-center justify-center sm:justify-start gap-0 sm:gap-2 py-2 px-2 sm:px-3 font-menlo text-[11px] sm:text-[12px] font-normal leading-[14.4px] transition-colors duration-200";
                        const borderClass = border ? "border-x border-borderDefault" : "";

                        const stateClass = isDisabled
                            ? "cursor-not-allowed opacity-40"
                            : "hover:bg-bgHighlight";

                        return (
                            <Link
                                key={name}
                                href={isDisabled ? "#" : href}
                                target={isDisabled ? "_self" : "_blank"}
                                rel="noopener noreferrer"
                                className={`${base} ${borderClass} ${stateClass}`}
                                aria-label={name}
                            >
                                <div className="flex-shrink-0">{icon}</div>
                                <span className="hidden sm:inline text-left">{name}</span>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}


// Timeframe Selector
function TimeframeSelector({
    timeframes,
    selected,
    onSelect,
}: {
    timeframes: StatsCardData['timeframes'];
    selected: string;
    onSelect: (k: TimeframeKey) => void;
}) {
    return (
        <div className="border-y border-borderDefault bg-primary-trade-table flex overflow-hidden">
            {timeframes.map((tf, i) => (
                <button
                    key={tf.key}
                    onClick={() => onSelect(tf.key)}
                    className={`relative flex-1 py-1.5 sm:py-2 flex items-center justify-center transition-colors hover:bg-bgCard ${selected === tf.key ? 'bg-bgCard' : ''
                        }`}
                >
                    <TimeframeChange label={tf.label} value={tf.value} />
                    {i < timeframes.length - 1 && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 h-10 sm:h-12 w-px bg-borderPrimary" />
                    )}
                </button>
            ))}
        </div>
    );
}

// Stats Section
function StatsSection({ stats }: { stats: TimeframeStats }) {
    const rows = [
        {
            left: { label: 'TXNS', value: formatPureNumber(stats.trades, { maxFractionDigits: 0, minFractionDigits: 0 }) },
            right: { top: ['BUYS', formatPureNumber(stats.buys, { maxFractionDigits: 0, minFractionDigits: 0 })], bottom: ['SELLS', formatPureNumber(stats.sells, { maxFractionDigits: 0, minFractionDigits: 0 })] },
            bar: { buys: stats.buys, sells: stats.sells },
        },
        {
            left: { label: 'VOLUME', value: formatCryptoPrice(stats.volume) },
            right: { top: ['BUY VOL', formatCryptoPrice(stats.buyVolume)], bottom: ['SELL VOL', formatCryptoPrice(stats.sellVolume)] },
            bar: { buys: stats.buyVolume, sells: stats.sellVolume },
        },
        {
            left: { label: 'MAKERS', value: formatPureNumber(stats.traders, { maxFractionDigits: 0, minFractionDigits: 0 }) },
            right: { top: ['BUYERS', formatPureNumber(stats.buyers, { maxFractionDigits: 0, minFractionDigits: 0 })], bottom: ['SELLERS', formatPureNumber(stats.sellers, { maxFractionDigits: 0, minFractionDigits: 0 })] },
            bar: { buys: stats.buyers, sells: stats.sellers },
        },
    ];

    return (
        <div className="w-full pl-3 pr-3 sm:pl-4 sm:pr-0 border-t border-borderDefault">
            {rows.map((row) => {
                const progress = row.bar ? getBuyPercent(row.bar.buys, row.bar.sells) : 50;

                return (
                    <div key={row.left.label} className="grid grid-cols-[1fr_1.5fr] sm:grid-cols-[1fr_1.8fr] items-start py-3 sm:py-4">
                        <div className="pr-2 sm:pr-3 border-r border-borderDefault">
                            <StatItem label={row.left.label} value={row.left.value} />
                        </div>
                        <div className="pl-2 sm:pl-4">
                            <div className="grid grid-cols-2">
                                <StatItem label={row.right.top[0]} value={row.right.top[1]} isCurrency={true} />
                                <StatItem label={row.right.bottom[0]} value={row.right.bottom[1]} labelPosition="right" valuePosition="right" />
                            </div>
                            <div className="w-full h-1 bg-white rounded-full overflow-hidden relative mt-1.5 sm:mt-2">
                                <div
                                    className="absolute top-0 left-0 h-full bg-success rounded-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                                <div className="absolute top-0 bg-black" style={{ left: `${progress}%`, width: '2px', height: '100%' }} />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function BondingProgress({ info }: { info: NonNullable<StatsCardData['bondingInfo']> }) {
    const normalized = clampPercentage(info.percentage);
    const decimals = normalized >= 10 ? 1 : 2;
    const formatted =
        normalized === 0 || normalized === 100
            ? normalized.toFixed(0)
            : normalized.toFixed(decimals);
    const statusColor = info.isBonded ? 'text-success' : 'text-warning';
    const dotColor = info.isBonded ? 'bg-success' : 'bg-warning';
    const helperText = info.isBonded
        ? 'Bonding curve completed and liquidity migrated.'
        : 'Pool migrates to the DEX automatically when progress reaches 100%.';

    return (
        <div className="px-3 sm:px-4 py-4 border-t border-borderDefault bg-bgPrimary space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-grayMedium text-[11px] font-menlo uppercase tracking-wide">
                        Bonding Progress
                    </p>
                    <p className="text-white text-[22px] font-semibold leading-none mt-1">
                        {formatted}%
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-grayMedium text-[11px] font-menlo uppercase tracking-wide">
                        {info.label ?? 'Bonding curve'}
                    </p>
                    <div className={`flex items-center justify-end gap-2 text-[13px] font-semibold ${statusColor}`}>
                        <span className={`h-2 w-2 rounded-full ${dotColor}`} aria-hidden />
                        {info.isBonded ? 'Bonded' : 'Bonding'}
                    </div>
                </div>
            </div>
            <div className="h-2 rounded-full bg-borderDefault overflow-hidden">
                <div
                    className={`${dotColor} h-full rounded-full transition-all duration-300`}
                    style={{ width: `${normalized}%` }}
                />
            </div>
            <p className="text-grayMedium text-[11px] leading-relaxed">
                {helperText}
            </p>
        </div>
    );
}


export type TimeframeKey = '5min' | '1h' | '6h' | '24h';

export type TimeframeStats = {
    trades: number;
    buys: number;
    sells: number;
    volume: number;
    buyVolume: number;
    sellVolume: number;
    buyers: number;
    sellers: number;
    traders: number;
};

export type StatsCardData = {
    baseToken: {
        symbol: string;
        address: string;
        logo?: string;
        approximateReserveToken?: number;
    };
    quoteToken?: {
        symbol: string;
        address?: string;
        approximateReserveToken?: number;
    };
    headerImage?: string;
    socials?: { website?: string; twitter?: string; telegram?: string };

    timeframes: { label: string; value: number; key: TimeframeKey }[];
    getTimeframeStats: (tf: TimeframeKey) => TimeframeStats;
    bondingInfo?: {
        percentage: number;
        isBonded: boolean;
        label?: string;
    };

    metrics: Array<{
        value: string | number;
        label: string;
        icon?: LucideIcon;
        iconColor?: string;
        textColor?: string;
        count?: string;
    }>;

    poolAddress?: string | null;
    deployer?: string | null

    createdAt?: string;
    contractAddress: string;
    explorerUrl: string;
    additionalAddresses?: Array<{ label: string; address: string; explorerUrl: string }>;
};

interface Props {
    data: StatsCardData;
    isLoading?: boolean;
}

export default function StatsCard({ data, isLoading }: Props) {
    const [selectedTf, setSelectedTf] = React.useState<TimeframeKey>('5min');
    const stats = data.getTimeframeStats(selectedTf);

    if (isLoading) {
        return <Skeleton className="w-full h-[1300px] bg-bgCard rounded-lg" />;
    }

    return (
        <div className="w-full h-auto sm:h-[1300px] space-y-1 sm:space-y-2 pb-[200px]">
            <Header base={data.baseToken} quote={data.quoteToken} headerImage={data.headerImage} socials={data.socials} />
            <TimeframeSelector timeframes={data.timeframes} selected={selectedTf} onSelect={setSelectedTf} />
            {/* <TradingWindow/> */}
            <StatsSection stats={stats} />
            {data.bondingInfo && <BondingProgress info={data.bondingInfo} />}

            <div className="border-t w-full border-borderDefault flex flex-col">
                <h2 className="px-3 sm:px-4 py-2 text-left text-grayGhost font-menlo text-[12px] sm:text-[13px] font-medium leading-[21px] tracking-[-0.28px]">
                    Token Info
                </h2>

                <div className="pb-2 sm:pb-3 border-t border-borderDefault">
                    <div className="text-xs border-b border-borderDefault">
                        <div className="grid grid-cols-3 gap-0">
                            {data.metrics.map((metric, i) => (
                                <div
                                    key={i}
                                    className={`
          ${i % 3 !== 2 ? 'border-r border-borderDefault' : ''} 
          ${i >= 3 ? 'border-t border-borderDefault' : ''} 
          flex items-center justify-center
        `}
                                >
                                    <TokenMetricsCard {...metric} />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className='py-1 sm:py-2 border-b border-borderDefault'></div>
                    <div className="border-b border-borderDefault divide-y divide-borderDefault">
                        <InfoRow
                            label="Pair Created"
                            value={
                                data.createdAt && !isNaN(new Date(data.createdAt).getTime())
                                    ? `${getTimeAgo(data.createdAt)} ago`
                                    : 'Unknown'
                            }
                        />

                        <InfoRow label={`Pooled ${data.baseToken?.symbol}`} value={formatPureNumber(data.baseToken?.approximateReserveToken)} />
                        {
                            data.quoteToken?.symbol && (
                                <InfoRow label={`Pooled ${data.quoteToken?.symbol}`} value={formatPureNumber(data.quoteToken?.approximateReserveToken)} />
                            )
                        }

                        <AddressRow
                            label="Market"
                            tooltip="copy market address"
                            address={data.poolAddress ?? ''}
                            explorerUrl={data.poolAddress ? `https://etherscan.io/address/${data.poolAddress}` : undefined}
                        />
                        <AddressRow
                            label={`Base CA${data.baseToken?.symbol ? ` (${data.baseToken.symbol.toUpperCase()})` : ''}`}
                            tooltip="copy base contract"
                            address={data.baseToken?.address}
                            explorerUrl={data.baseToken?.address ? `https://etherscan.io/address/${data.baseToken.address}` : undefined}
                        />
                        <AddressRow
                            label={`Quote CA${data.quoteToken?.symbol ? ` (${data.quoteToken.symbol.toUpperCase()})` : ''}`}
                            tooltip="copy quote contract"
                            address={data.quoteToken?.address}
                            explorerUrl={data.quoteToken?.address ? `https://etherscan.io/address/${data.quoteToken.address}` : undefined}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}