// src/components/wallet/WalletTabs.tsx
"use client";
import React, { useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { ArrowLeftRight, ExternalLink, Twitter, Send, Globe, ArrowUpDown } from "lucide-react";
import { formatCryptoPrice, formatPureNumber, formatUSD } from "@mobula_labs/sdk";
import { formatPriceWithPlaceholder } from "@/utils/tokenMetrics";
import { useWalletPortfolioStore } from "@/store/useWalletPortfolioStore";
import TimeAgo from "@/utils/TimeAgo";
import Link from "next/link";

export function WalletActivePosition() {
    const { activePositionData } = useWalletPortfolioStore();
    const [showATL, setShowATL] = useState(false);
    const [showRealized, setShowRealized] = useState(false);

    const toggleView = useCallback(() => setShowATL((prev) => !prev), []);
    const toggleRealized = useCallback(() => setShowRealized((prev) => !prev), []);

    const positions = useMemo(() => activePositionData?.data ?? [], [activePositionData?.data]);

    return (
        <div className="h-full flex flex-col">
            {/* Horizontal scroll wrapper for mobile */}
            <div className="flex-1 overflow-x-auto overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse min-w-[1000px]">
                    <thead className="sticky top-0 bg-bgPrimary z-10">
                        <tr className="text-textTertiary font-medium border-b border-borderDefault h-10">
                            <th className="min-w-[160px] pl-4 whitespace-nowrap">Token</th>
                            <th className="min-w-[100px] text-left whitespace-nowrap">Price</th>
                            <th className="min-w-[110px] text-left whitespace-nowrap">Amount</th>
                            <th className="min-w-[100px] text-left whitespace-nowrap">USD</th>
                            <th className="min-w-[120px] text-left whitespace-nowrap">Market Cap</th>
                            <th className="min-w-[80px] text-left whitespace-nowrap">Age</th>
                            <th
                                className="min-w-[90px] text-left cursor-pointer select-none whitespace-nowrap"
                                onClick={toggleView}
                            >
                                <div className="inline-flex items-center gap-1">
                                    <span className="text-textTertiary font-medium">
                                        {showATL ? "ATL" : "ATH"}
                                    </span>
                                    <ArrowLeftRight
                                        size={12}
                                        className={`transition-colors rotate-90 ${showATL ? "text-success" : "text-textTertiary"
                                            }`}
                                    />
                                </div>
                            </th>
                            <th
                                className="min-w-[130px] text-left pr-5 cursor-pointer select-none whitespace-nowrap"
                                onClick={toggleRealized}
                            >
                                <div className="inline-flex items-center text-xs gap-1">
                                    <span>{showRealized ? 'Realized PNL' : 'Unrealized PNL'}</span>
                                    <ArrowUpDown
                                        size={12}
                                        className={showRealized ? 'text-success' : 'text-muted-foreground'}
                                    />
                                </div>
                            </th>
                            <th className="min-w-[90px] text-left whitespace-nowrap">Socials</th>
                            <th className="min-w-[80px] text-right pr-4 whitespace-nowrap">Explorer</th>
                        </tr>
                    </thead>
                    <tbody>
                        {positions.map((pos, i) => (
                            <tr
                                key={i}
                                className="border-b border-borderDefault even:bg-borderDefault/20 odd:hover:bg-bgContainer even:hover:bg-bgPrimary transition-colors h-12"
                            >
                                <td className="text-white pl-4">
                                    <div className="flex items-center gap-2 whitespace-nowrap">
                                        {pos.token.logo ? (
                                            <Image
                                                src={pos.token.logo}
                                                width={20}
                                                height={20}
                                                className="rounded-full flex-shrink-0"
                                                alt={pos.token.name ?? "token logo"}
                                            />
                                        ) : (
                                            <div className="size-4 rounded-full bg-green-500 flex-shrink-0" />
                                        )}
                                        <Link
                                            href={`/pair/${pos.token.chainId}/${pos.token.poolAddress}`}
                                            className="hover:underline underline-offset-2 max-w-[160px] truncate block"
                                            title={pos.token.name ?? ""}
                                        >
                                            {pos.token.name}
                                        </Link>

                                    </div>
                                </td>

                                <td className="text-left text-white whitespace-nowrap">
                                    {formatPriceWithPlaceholder(pos.token.priceUSD)}
                                </td>
                                <td className="text-left text-white whitespace-nowrap">
                                    {formatPureNumber(pos.balance)}
                                </td>
                                <td className="text-left text-white whitespace-nowrap">
                                    {formatCryptoPrice(pos.amountUSD)}
                                </td>
                                <td className="text-left text-white whitespace-nowrap">
                                    {formatCryptoPrice(pos.token.marketCapUSD)}
                                </td>
                                <td className="text-left text-textTertiary whitespace-nowrap">
                                    <TimeAgo timestamp={pos.token.createdAt} />
                                </td>
                                <td className="text-left text-textTertiary whitespace-nowrap">
                                    {formatPriceWithPlaceholder(showATL ? pos.token.atlUSD : pos.token.athUSD)}
                                </td>
                                <td className="text-left text-white pr-5 whitespace-nowrap">
                                    {showRealized ? (
                                        <span
                                            className={
                                                pos.realizedPnlUSD >= 0
                                                    ? "text-success"
                                                    : "text-errorBright"
                                            }
                                        >
                                            {formatUSD(pos.realizedPnlUSD)}
                                        </span>
                                    ) : (
                                        <span
                                            className={
                                                pos.unrealizedPnlUSD >= 0
                                                    ? "text-success"
                                                    : "text-errorBright"
                                            }
                                        >
                                            {formatUSD(pos.unrealizedPnlUSD)}
                                        </span>
                                    )}
                                </td>
                                <td className="text-left text-textTertiary">
                                    <div className="flex items-center justify-start gap-2 h-full">
                                        {pos.token.socials?.website ? (
                                            <Link
                                                href={pos.token.socials.website}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center"
                                            >
                                                <Globe
                                                    size={15}
                                                    className="text-grayGhost hover:text-success transition-colors flex-shrink-0"
                                                />
                                            </Link>
                                        ) : (
                                            <Globe
                                                size={15}
                                                className="text-graySlateDark opacity-50 cursor-not-allowed flex-shrink-0"
                                            />
                                        )}
                                        {pos.token.socials?.twitter ? (
                                            <Link
                                                href={pos.token.socials.twitter}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center"
                                            >
                                                <Twitter
                                                    size={15}
                                                    className="text-grayGhost hover:text-success transition-colors flex-shrink-0"
                                                />
                                            </Link>
                                        ) : (
                                            <Twitter
                                                size={15}
                                                className="text-graySlateDark opacity-50 cursor-not-allowed flex-shrink-0"
                                            />
                                        )}
                                        {pos.token.socials?.telegram ? (
                                            <Link
                                                href={pos.token.socials.telegram}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center"
                                            >
                                                <Send
                                                    size={15}
                                                    className="text-grayGhost hover:text-success transition-colors flex-shrink-0"
                                                />
                                            </Link>
                                        ) : (
                                            <Send
                                                size={15}
                                                className="text-graySlateDark opacity-50 cursor-not-allowed flex-shrink-0"
                                            />
                                        )}
                                    </div>
                                </td>
                                <td className="text-right pr-4">
                                    <a
                                        href="#"
                                        className="text-textTertiary hover:text-white inline-flex items-center justify-center"
                                    >
                                        <ExternalLink size={12} className="flex-shrink-0" />
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}