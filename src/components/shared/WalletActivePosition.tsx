"use client";
import React, { useState, useCallback, useMemo, useEffect } from "react";
import Image from "next/image";
import { ArrowLeftRight, ArrowUpDown } from "lucide-react";
import { formatCryptoPrice, formatUSD, formatPureNumber } from "@mobula_labs/sdk";
import { formatPriceWithPlaceholder } from "@/utils/tokenMetrics";
import { useWalletPortfolioStore } from "@/store/useWalletPortfolioStore";
import { useWalletModalStore } from "@/store/useWalletModalStore";
import TimeAgo from "@/utils/TimeAgo";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

// Token logo with first-letter fallback
const TokenLogo = ({ logo, symbol, size = 20 }: { logo?: string | null; symbol?: string | null; size?: number }) => {
    const letter = (symbol ?? '?').charAt(0).toUpperCase();
    
    if (logo) {
        return (
            <Image
                src={logo}
                width={size}
                height={size}
                className="rounded-full flex-shrink-0"
                alt={symbol ?? ''}
            />
        );
    }
    
    return (
        <div 
            className="rounded-full bg-success/30 flex items-center justify-center text-success font-bold flex-shrink-0"
            style={{ width: size, height: size, fontSize: size * 0.5 }}
        >
            {letter}
        </div>
    );
};

interface WalletActivePositionProps {
    mode: "active" | "history" | "top100";
    onAssetClick?: (asset: { address: string; chainId: string; name: string; symbol?: string; logo?: string; totalSupply?: number }) => void;
    hideDust?: boolean;
}

// Calculate ATH/ATL Market Cap from price and current supply
const calculateAthMarketCap = (token: {
    athUSD?: number;
    atlUSD?: number;
    priceUSD?: number;
    marketCapUSD?: number;
    totalSupply?: number;
}, isATL: boolean): number | null => {
    const targetPrice = isATL ? token.atlUSD : token.athUSD;
    if (!targetPrice || targetPrice === 0) return null;

    if (token.totalSupply && token.totalSupply > 0) {
        return targetPrice * token.totalSupply;
    }

    if (token.marketCapUSD && token.priceUSD && token.priceUSD > 0) {
        const supply = token.marketCapUSD / token.priceUSD;
        return targetPrice * supply;
    }

    return null;
};

// Calculate average market cap from average price
const calculateAvgMarketCap = (
    avgPrice: number | undefined,
    token: { priceUSD?: number; marketCapUSD?: number; totalSupply?: number }
): number | null => {
    if (!avgPrice || avgPrice === 0) return null;

    if (token.totalSupply && token.totalSupply > 0) {
        return avgPrice * token.totalSupply;
    }

    if (token.marketCapUSD && token.priceUSD && token.priceUSD > 0) {
        const supply = token.marketCapUSD / token.priceUSD;
        return avgPrice * supply;
    }

    return null;
};

type SortField = "realizedPnl" | "unrealizedPnl" | "athMc" | "marketCap" | "trades" | "volume" | "avgBuyMc" | "avgSellMc" | "balance" | "opening" | "closing";
type SortDirection = "asc" | "desc";

// Skeleton row for loading state
const SkeletonRow = ({ columns }: { columns: number }) => (
    <tr className="border-b border-borderDefault h-12">
        {Array.from({ length: columns }).map((_, i) => (
            <td key={i} className={i === 0 ? "pl-4" : i === columns - 1 ? "pr-4" : ""}>
                <Skeleton className="h-4 w-16 rounded" />
            </td>
        ))}
    </tr>
);

export function WalletActivePosition({ mode, onAssetClick, hideDust = false }: WalletActivePositionProps) {
    const { activePositionData, isLoading } = useWalletPortfolioStore();
    const { closeWalletModal } = useWalletModalStore();
    const [showATL, setShowATL] = useState(false);
    // Default sort: Closed Trades by closing date (most recent first), others by realized PnL
    const [sortField, setSortField] = useState<SortField>(mode === "history" ? "closing" : "realizedPnl");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

    // Update default sort when mode changes
    useEffect(() => {
        if (mode === "history") {
            setSortField("closing");
        } else {
            setSortField("realizedPnl");
        }
        setSortDirection("desc");
    }, [mode]);

    const toggleView = useCallback(() => setShowATL((prev) => !prev), []);

    const handleSort = useCallback((field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection("desc");
        }
    }, [sortField]);

    const handleRowClick = useCallback((pos: { 
        token: { 
            address: string; 
            chainId: string; 
            name: string | null; 
            symbol?: string | null;
            logo?: string | null;
            totalSupply?: number;
        } 
    }) => {
        console.log('[WalletActivePosition] Row clicked:', {
            address: pos.token.address,
            chainId: pos.token.chainId,
            name: pos.token.name,
            symbol: pos.token.symbol,
            logo: pos.token.logo,
            totalSupply: pos.token.totalSupply,
        });
        if (onAssetClick) {
            onAssetClick({
                address: pos.token.address,
                chainId: pos.token.chainId,
                name: pos.token.name ?? 'Unknown',
                symbol: pos.token.symbol ?? undefined,
                logo: pos.token.logo ?? undefined,
                totalSupply: pos.token.totalSupply,
            });
        }
    }, [onAssetClick]);

    const positions = useMemo(() => {
        const allPositions = activePositionData?.data ?? [];
        
        let filtered: typeof allPositions;
        switch (mode) {
            case "active":
                filtered = allPositions.filter(pos => pos.balance > 0);
                break;
            case "history":
                filtered = allPositions.filter(pos => pos.balance === 0 || pos.balance <= 0);
                break;
            case "top100":
                filtered = [...allPositions];
                break;
            default:
                filtered = allPositions;
        }

        // Filter out dust positions (< $1)
        if (hideDust) {
            filtered = filtered.filter(pos => {
                // For active positions, filter by current balance USD
                if (mode === "active") {
                    return (pos.amountUSD ?? 0) >= 1;
                }
                // For history/closed and best trades, filter by realized PNL or volume
                const significantValue = Math.max(
                    Math.abs(pos.realizedPnlUSD ?? 0),
                    (pos.volumeBuy ?? 0) + (pos.volumeSell ?? 0)
                );
                return significantValue >= 1;
            });
        }

        // Sort all modes
        filtered = [...filtered].sort((a, b) => {
            let valueA: number;
            let valueB: number;

            switch (sortField) {
                case "realizedPnl":
                    valueA = a.realizedPnlUSD ?? 0;
                    valueB = b.realizedPnlUSD ?? 0;
                    break;
                case "unrealizedPnl":
                    valueA = a.unrealizedPnlUSD ?? 0;
                    valueB = b.unrealizedPnlUSD ?? 0;
                    break;
                case "athMc":
                    valueA = calculateAthMarketCap(a.token, showATL) ?? 0;
                    valueB = calculateAthMarketCap(b.token, showATL) ?? 0;
                    break;
                case "marketCap":
                    valueA = a.token.marketCapUSD ?? 0;
                    valueB = b.token.marketCapUSD ?? 0;
                    break;
                case "trades":
                    valueA = (a.buys ?? 0) + (a.sells ?? 0);
                    valueB = (b.buys ?? 0) + (b.sells ?? 0);
                    break;
                case "volume":
                    valueA = (a.volumeBuy ?? 0) + (a.volumeSell ?? 0);
                    valueB = (b.volumeBuy ?? 0) + (b.volumeSell ?? 0);
                    break;
                case "avgBuyMc":
                    valueA = calculateAvgMarketCap(a.avgBuyPriceUSD, a.token) ?? 0;
                    valueB = calculateAvgMarketCap(b.avgBuyPriceUSD, b.token) ?? 0;
                    break;
                case "avgSellMc":
                    valueA = calculateAvgMarketCap(a.avgSellPriceUSD, a.token) ?? 0;
                    valueB = calculateAvgMarketCap(b.avgSellPriceUSD, b.token) ?? 0;
                    break;
                case "balance":
                    valueA = a.amountUSD ?? 0;
                    valueB = b.amountUSD ?? 0;
                    break;
                case "opening":
                    valueA = a.firstDate ? new Date(a.firstDate).getTime() : 0;
                    valueB = b.firstDate ? new Date(b.firstDate).getTime() : 0;
                    break;
                case "closing":
                    valueA = a.lastDate ? new Date(a.lastDate).getTime() : 0;
                    valueB = b.lastDate ? new Date(b.lastDate).getTime() : 0;
                    break;
                default:
                    valueA = a.realizedPnlUSD ?? 0;
                    valueB = b.realizedPnlUSD ?? 0;
            }

            return sortDirection === "desc" ? valueB - valueA : valueA - valueB;
        });

        if (mode === "top100") {
            filtered = filtered.slice(0, 100);
        }

        return filtered;
    }, [activePositionData?.data, mode, sortField, sortDirection, showATL, hideDust]);

    const getEmptyMessage = () => {
        switch (mode) {
            case "active":
                return "No open trades";
            case "history":
                return "No closed trades";
            case "top100":
                return "No trades to rank";
            default:
                return "No data";
        }
    };

    const SortableHeader = ({ field, children, className = "" }: { field: SortField; children: React.ReactNode; className?: string }) => (
        <th 
            className={`text-left cursor-pointer select-none whitespace-nowrap hover:text-white transition-colors ${className}`}
            onClick={() => handleSort(field)}
        >
            <div className="inline-flex items-center gap-1">
                <span>{children}</span>
                <ArrowUpDown size={12} className={sortField === field ? "text-success" : "text-textTertiary"} />
            </div>
        </th>
    );

    // Loading skeleton
    if (isLoading) {
        const columnCount = mode === "active" ? 13 : mode === "history" ? 11 : 13;
        return (
            <div className="h-full flex flex-col">
                <div className="flex-1 overflow-x-auto overflow-y-auto">
                    <table className="w-full text-xs text-left border-collapse min-w-[1200px]">
                        <thead className="sticky top-0 bg-bgPrimary z-10">
                            <tr className="text-textTertiary font-medium border-b border-borderDefault h-10">
                                {Array.from({ length: columnCount }).map((_, i) => (
                                    <th key={i} className={`min-w-[80px] ${i === 0 ? "pl-4" : ""}`}>
                                        <Skeleton className="h-3 w-12 rounded" />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: 8 }).map((_, i) => (
                                <SkeletonRow key={i} columns={columnCount} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    if (positions.length === 0) {
        return (
            <div className="flex items-center justify-center text-xs text-grayGhost h-full p-4">
                {getEmptyMessage()}
            </div>
        );
    }

    // Open Trades table (mode === "active")
    if (mode === "active") {
        return (
            <div className="h-full flex flex-col">
                <div className="flex-1 overflow-x-auto overflow-y-auto">
                    <table className="w-full text-xs text-left border-collapse min-w-[1300px]">
                        <thead className="sticky top-0 bg-bgPrimary z-10">
                            <tr className="text-textTertiary font-medium border-b border-borderDefault h-10">
                                <th className="min-w-[130px] pl-4 whitespace-nowrap">Token</th>
                                <th className="min-w-[80px] text-left whitespace-nowrap">Price</th>
                                <SortableHeader field="marketCap" className="min-w-[85px]">MC</SortableHeader>
                                <SortableHeader field="balance" className="min-w-[110px]">Balance</SortableHeader>
                                <SortableHeader field="trades" className="min-w-[80px]">Trades</SortableHeader>
                                <SortableHeader field="volume" className="min-w-[110px]">Volume</SortableHeader>
                                <SortableHeader field="avgBuyMc" className="min-w-[85px]">Avg Buy MC</SortableHeader>
                                <SortableHeader field="avgSellMc" className="min-w-[85px]">Avg Sell MC</SortableHeader>
                                <SortableHeader field="opening" className="min-w-[75px]">Opening</SortableHeader>
                                <SortableHeader field="closing" className="min-w-[75px]">Last Trade</SortableHeader>
                                <th
                                    className="min-w-[85px] text-left cursor-pointer select-none whitespace-nowrap"
                                    onClick={() => handleSort("athMc")}
                                >
                                    <div className="inline-flex items-center gap-1">
                                        <span onClick={(e) => { e.stopPropagation(); toggleView(); }} className="cursor-pointer hover:text-white">
                                            {showATL ? "ATL MC" : "ATH MC"}
                                        </span>
                                        <ArrowLeftRight size={12} className={`rotate-90 cursor-pointer ${showATL ? "text-success" : "text-textTertiary"}`} onClick={(e) => { e.stopPropagation(); toggleView(); }} />
                                        <ArrowUpDown size={12} className={sortField === "athMc" ? "text-success" : "text-textTertiary"} />
                                    </div>
                                </th>
                                <SortableHeader field="realizedPnl" className="min-w-[85px]">Realized</SortableHeader>
                                <SortableHeader field="unrealizedPnl" className="min-w-[85px] pr-4">Unrealized</SortableHeader>
                            </tr>
                        </thead>
                        <tbody>
                            {positions.map((pos, i) => {
                                const athMc = calculateAthMarketCap(pos.token, showATL);
                                const avgBuyMc = calculateAvgMarketCap(pos.avgBuyPriceUSD, pos.token);
                                const avgSellMc = calculateAvgMarketCap(pos.avgSellPriceUSD, pos.token);
                                return (
                                    <tr 
                                        key={i} 
                                        className="border-b border-borderDefault even:bg-borderDefault/20 odd:hover:bg-bgContainer even:hover:bg-bgPrimary transition-colors h-12 cursor-pointer"
                                        onClick={() => handleRowClick(pos)}
                                    >
                                        <td className="text-white pl-4">
                                            <div className="flex items-center gap-2 whitespace-nowrap">
                                                <TokenLogo logo={pos.token.logo} symbol={pos.token.symbol ?? pos.token.name} size={20} />
                                                <Link 
                                                    href={`/token/${pos.token.chainId}/${pos.token.address}`} 
                                                    className="hover:underline underline-offset-2 max-w-[100px] truncate block" 
                                                    title={pos.token.name ?? pos.token.symbol ?? ""}
                                                    onClick={(e) => { e.stopPropagation(); closeWalletModal(); }}
                                                >
                                                    {pos.token.symbol ?? pos.token.name}
                                                </Link>
                                            </div>
                                        </td>
                                        <td className="text-white">{formatPriceWithPlaceholder(pos.token.priceUSD)}</td>
                                        <td className="text-white">{formatCryptoPrice(pos.token.marketCapUSD)}</td>
                                        <td className="text-white whitespace-nowrap">
                                            <span>{formatPureNumber(pos.balance)}</span>
                                            <span className="text-textTertiary ml-1">({formatCryptoPrice(pos.amountUSD)})</span>
                                        </td>
                                        <td className="whitespace-nowrap">
                                            <span className="text-success">{pos.buys}</span>
                                            <span className="text-textTertiary mx-0.5">/</span>
                                            <span className="text-errorBright">{pos.sells}</span>
                                        </td>
                                        <td className="whitespace-nowrap">
                                            <span className="text-success">{formatCryptoPrice(pos.volumeBuy)}</span>
                                            <span className="text-textTertiary mx-0.5">/</span>
                                            <span className="text-errorBright">{formatCryptoPrice(pos.volumeSell)}</span>
                                        </td>
                                        <td className="text-textTertiary">{avgBuyMc ? formatCryptoPrice(avgBuyMc) : "—"}</td>
                                        <td className="text-textTertiary">{avgSellMc ? formatCryptoPrice(avgSellMc) : "—"}</td>
                                        <td className="text-textTertiary"><TimeAgo timestamp={pos.firstDate} /></td>
                                        <td className="text-textTertiary"><TimeAgo timestamp={pos.lastDate} /></td>
                                        <td className="text-textTertiary">{athMc ? formatCryptoPrice(athMc) : "—"}</td>
                                        <td className={pos.realizedPnlUSD >= 0 ? "text-success" : "text-errorBright"}>{formatUSD(pos.realizedPnlUSD)}</td>
                                        <td className={`pr-4 ${pos.unrealizedPnlUSD >= 0 ? "text-success" : "text-errorBright"}`}>{formatUSD(pos.unrealizedPnlUSD)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    // Closed Trades table (mode === "history")
    if (mode === "history") {
        return (
            <div className="h-full flex flex-col">
                <div className="flex-1 overflow-x-auto overflow-y-auto">
                    <table className="w-full text-xs text-left border-collapse min-w-[1100px]">
                        <thead className="sticky top-0 bg-bgPrimary z-10">
                            <tr className="text-textTertiary font-medium border-b border-borderDefault h-10">
                                <th className="min-w-[130px] pl-4 whitespace-nowrap">Token</th>
                                <th className="min-w-[80px] text-left whitespace-nowrap">Price</th>
                                <SortableHeader field="marketCap" className="min-w-[85px]">MC</SortableHeader>
                                <SortableHeader field="trades" className="min-w-[80px]">Trades</SortableHeader>
                                <SortableHeader field="volume" className="min-w-[110px]">Volume</SortableHeader>
                                <SortableHeader field="avgBuyMc" className="min-w-[85px]">Avg Buy MC</SortableHeader>
                                <SortableHeader field="avgSellMc" className="min-w-[85px]">Avg Sell MC</SortableHeader>
                                <SortableHeader field="opening" className="min-w-[75px]">Opening</SortableHeader>
                                <SortableHeader field="closing" className="min-w-[75px]">Closing</SortableHeader>
                                <th
                                    className="min-w-[85px] text-left cursor-pointer select-none whitespace-nowrap"
                                    onClick={() => handleSort("athMc")}
                                >
                                    <div className="inline-flex items-center gap-1">
                                        <span onClick={(e) => { e.stopPropagation(); toggleView(); }} className="cursor-pointer hover:text-white">
                                            {showATL ? "ATL MC" : "ATH MC"}
                                        </span>
                                        <ArrowLeftRight size={12} className={`rotate-90 cursor-pointer ${showATL ? "text-success" : "text-textTertiary"}`} onClick={(e) => { e.stopPropagation(); toggleView(); }} />
                                        <ArrowUpDown size={12} className={sortField === "athMc" ? "text-success" : "text-textTertiary"} />
                                    </div>
                                </th>
                                <SortableHeader field="realizedPnl" className="min-w-[90px] pr-4">Realized</SortableHeader>
                            </tr>
                        </thead>
                        <tbody>
                            {positions.map((pos, i) => {
                                const athMc = calculateAthMarketCap(pos.token, showATL);
                                const avgBuyMc = calculateAvgMarketCap(pos.avgBuyPriceUSD, pos.token);
                                const avgSellMc = calculateAvgMarketCap(pos.avgSellPriceUSD, pos.token);
                                return (
                                    <tr 
                                        key={i} 
                                        className="border-b border-borderDefault even:bg-borderDefault/20 odd:hover:bg-bgContainer even:hover:bg-bgPrimary transition-colors h-12 cursor-pointer"
                                        onClick={() => handleRowClick(pos)}
                                    >
                                        <td className="text-white pl-4">
                                            <div className="flex items-center gap-2 whitespace-nowrap">
                                                <TokenLogo logo={pos.token.logo} symbol={pos.token.symbol ?? pos.token.name} size={20} />
                                                <Link 
                                                    href={`/token/${pos.token.chainId}/${pos.token.address}`} 
                                                    className="hover:underline underline-offset-2 max-w-[100px] truncate block" 
                                                    title={pos.token.name ?? pos.token.symbol ?? ""}
                                                    onClick={(e) => { e.stopPropagation(); closeWalletModal(); }}
                                                >
                                                    {pos.token.symbol ?? pos.token.name}
                                                </Link>
                                            </div>
                                        </td>
                                        <td className="text-white">{formatPriceWithPlaceholder(pos.token.priceUSD)}</td>
                                        <td className="text-white">{formatCryptoPrice(pos.token.marketCapUSD)}</td>
                                        <td className="whitespace-nowrap">
                                            <span className="text-success">{pos.buys}</span>
                                            <span className="text-textTertiary mx-0.5">/</span>
                                            <span className="text-errorBright">{pos.sells}</span>
                                        </td>
                                        <td className="whitespace-nowrap">
                                            <span className="text-success">{formatCryptoPrice(pos.volumeBuy)}</span>
                                            <span className="text-textTertiary mx-0.5">/</span>
                                            <span className="text-errorBright">{formatCryptoPrice(pos.volumeSell)}</span>
                                        </td>
                                        <td className="text-textTertiary">{avgBuyMc ? formatCryptoPrice(avgBuyMc) : "—"}</td>
                                        <td className="text-textTertiary">{avgSellMc ? formatCryptoPrice(avgSellMc) : "—"}</td>
                                        <td className="text-textTertiary"><TimeAgo timestamp={pos.firstDate} /></td>
                                        <td className="text-textTertiary"><TimeAgo timestamp={pos.lastDate} /></td>
                                        <td className="text-textTertiary">{athMc ? formatCryptoPrice(athMc) : "—"}</td>
                                        <td className={`pr-4 ${pos.realizedPnlUSD >= 0 ? "text-success" : "text-errorBright"}`}>{formatUSD(pos.realizedPnlUSD)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    // Best Trades (top100)
    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-x-auto overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse min-w-[1300px]">
                    <thead className="sticky top-0 bg-bgPrimary z-10">
                        <tr className="text-textTertiary font-medium border-b border-borderDefault h-10">
                            <th className="min-w-[120px] pl-4 whitespace-nowrap">Token</th>
                            <th className="min-w-[75px] text-left whitespace-nowrap">Price</th>
                            <SortableHeader field="marketCap" className="min-w-[80px]">MC</SortableHeader>
                            <th className="min-w-[55px] text-left whitespace-nowrap">Status</th>
                            <SortableHeader field="balance" className="min-w-[100px]">Balance</SortableHeader>
                            <SortableHeader field="trades" className="min-w-[75px]">Trades</SortableHeader>
                            <SortableHeader field="volume" className="min-w-[100px]">Volume</SortableHeader>
                            <SortableHeader field="avgBuyMc" className="min-w-[80px]">Avg Buy MC</SortableHeader>
                            <SortableHeader field="avgSellMc" className="min-w-[80px]">Avg Sell MC</SortableHeader>
                            <SortableHeader field="opening" className="min-w-[70px]">Opening</SortableHeader>
                            <SortableHeader field="closing" className="min-w-[70px]">Last Trade</SortableHeader>
                            <th
                                className="min-w-[80px] text-left cursor-pointer select-none whitespace-nowrap"
                                onClick={() => handleSort("athMc")}
                            >
                                <div className="inline-flex items-center gap-1">
                                    <span onClick={(e) => { e.stopPropagation(); toggleView(); }} className="cursor-pointer hover:text-white">
                                        {showATL ? "ATL MC" : "ATH MC"}
                                    </span>
                                    <ArrowLeftRight size={12} className={`rotate-90 cursor-pointer ${showATL ? "text-success" : "text-textTertiary"}`} onClick={(e) => { e.stopPropagation(); toggleView(); }} />
                                    <ArrowUpDown size={12} className={sortField === "athMc" ? "text-success" : "text-textTertiary"} />
                                </div>
                            </th>
                            <SortableHeader field="realizedPnl" className="min-w-[80px]">Realized</SortableHeader>
                            <SortableHeader field="unrealizedPnl" className="min-w-[80px] pr-4">Unrealized</SortableHeader>
                        </tr>
                    </thead>
                    <tbody>
                        {positions.map((pos, i) => {
                            const athMc = calculateAthMarketCap(pos.token, showATL);
                            const avgBuyMc = calculateAvgMarketCap(pos.avgBuyPriceUSD, pos.token);
                            const avgSellMc = calculateAvgMarketCap(pos.avgSellPriceUSD, pos.token);
                            const isOpen = pos.balance > 0;
                            return (
                            <tr
                                key={i}
                                    className="border-b border-borderDefault even:bg-borderDefault/20 odd:hover:bg-bgContainer even:hover:bg-bgPrimary transition-colors h-12 cursor-pointer"
                                    onClick={() => handleRowClick(pos)}
                            >
                                <td className="text-white pl-4">
                                    <div className="flex items-center gap-2 whitespace-nowrap">
                                        <TokenLogo logo={pos.token.logo} symbol={pos.token.symbol ?? pos.token.name} size={20} />
                                        <Link
                                            href={`/token/${pos.token.chainId}/${pos.token.address}`}
                                                className="hover:underline underline-offset-2 max-w-[90px] truncate block" 
                                            title={pos.token.name ?? pos.token.symbol ?? ""}
                                                onClick={(e) => { e.stopPropagation(); closeWalletModal(); }}
                                            >
                                                {pos.token.symbol ?? pos.token.name}
                                            </Link>
                                        </div>
                                    </td>
                                    <td className="text-white">{formatPriceWithPlaceholder(pos.token.priceUSD)}</td>
                                    <td className="text-white">{formatCryptoPrice(pos.token.marketCapUSD)}</td>
                                    <td>
                                        {isOpen ? (
                                            <span className="text-success text-[10px] px-1.5 py-0.5 bg-success/10 rounded">OPEN</span>
                                        ) : (
                                            <span className="text-textTertiary text-[10px] px-1.5 py-0.5 bg-textTertiary/10 rounded">CLOSED</span>
                                        )}
                                    </td>
                                    <td className="text-white whitespace-nowrap">
                                        {isOpen ? (
                                            <>
                                                <span>{formatPureNumber(pos.balance)}</span>
                                                <span className="text-textTertiary ml-1">({formatCryptoPrice(pos.amountUSD)})</span>
                                            </>
                                        ) : (
                                            <span className="text-textTertiary">—</span>
                                        )}
                                    </td>
                                    <td className="whitespace-nowrap">
                                        <span className="text-success">{pos.buys}</span>
                                        <span className="text-textTertiary mx-0.5">/</span>
                                        <span className="text-errorBright">{pos.sells}</span>
                                    </td>
                                    <td className="whitespace-nowrap">
                                        <span className="text-success">{formatCryptoPrice(pos.volumeBuy)}</span>
                                        <span className="text-textTertiary mx-0.5">/</span>
                                        <span className="text-errorBright">{formatCryptoPrice(pos.volumeSell)}</span>
                                </td>
                                    <td className="text-textTertiary">{avgBuyMc ? formatCryptoPrice(avgBuyMc) : "—"}</td>
                                    <td className="text-textTertiary">{avgSellMc ? formatCryptoPrice(avgSellMc) : "—"}</td>
                                    <td className="text-textTertiary"><TimeAgo timestamp={pos.firstDate} /></td>
                                    <td className="text-textTertiary"><TimeAgo timestamp={pos.lastDate} /></td>
                                    <td className="text-textTertiary">{athMc ? formatCryptoPrice(athMc) : "—"}</td>
                                    <td className={pos.realizedPnlUSD >= 0 ? "text-success" : "text-errorBright"}>{formatUSD(pos.realizedPnlUSD)}</td>
                                    <td className={`pr-4 ${isOpen ? (pos.unrealizedPnlUSD >= 0 ? "text-success" : "text-errorBright") : "text-textTertiary"}`}>
                                        {isOpen ? formatUSD(pos.unrealizedPnlUSD) : "—"}
                                </td>
                            </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
