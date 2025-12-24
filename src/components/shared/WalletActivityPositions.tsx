"use client";

import React, { useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { ExternalLink, ChevronDown, ChevronRight, ArrowUpDown } from "lucide-react";
import { formatCryptoPrice, formatPureNumber, buildExplorerUrl } from "@mobula_labs/sdk";
import { useWalletPortfolioStore } from "@/store/useWalletPortfolioStore";
import TimeAgo from "@/utils/TimeAgo";
import Link from "next/link";

const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const getTransactionType = (actions: any[]) => {
    if (!actions?.length) return "unknown";
    const models = actions.map(a => a.model?.toLowerCase());
    if (models.includes("swap")) return "swap";
    if (models.includes("transfer")) return "transfer";
    return models[0] || "unknown";
};

const getMainAmount = (actions: any[]) => {
    if (!actions?.length) return 0;
    const action = actions[0];
    return action.swapAmountIn ?? action.transferAmount ?? 0;
};

const getMainValue = (actions: any[]) => {
    if (!actions?.length) return 0;
    const action = actions[0];
    return action.swapAmountUsd ?? action.transferValueUsd ?? action.transferAmountUsd ?? 0;
};

export function WalletActivityPosition() {
    const { walletActivity, isActivityLoading } = useWalletPortfolioStore();
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [priceMode, setPriceMode] = useState<Record<number, "base" | "quote">>({});

    const transactions = useMemo(() => walletActivity?.data ?? [], [walletActivity?.data]);

    const toggleRow = useCallback((index: number) => {
        setExpandedRows((prev) => {
            const newExpanded = new Set(prev);
            if (newExpanded.has(index)) {
                newExpanded.delete(index);
            } else {
                newExpanded.add(index);
            }
            return newExpanded;
        });
    }, []);

    const togglePriceMode = useCallback((txIdx: number) => {
        setPriceMode((prev) => ({
            ...prev,
            [txIdx]: prev[txIdx] === "quote" ? "base" : "quote",
        }));
    }, []);

    const renderMainTokenCell = useCallback((actions: any[]) => {
        if (!actions?.length) return <span className="text-textTertiary">-</span>;

        const action = actions[0];
        const type = action.model?.toLowerCase();

        if (type === "swap" && action.swapAssetIn) {
            return (
                <div className="flex items-center gap-2">
                    {action.swapAssetIn.logo ? (
                        <Image
                            src={action.swapAssetIn.logo}
                            width={20}
                            height={20}
                            className="rounded-full flex-shrink-0"
                            alt={action.swapAssetIn.name}
                        />
                    ) : (
                        <div className="size-5 rounded-full bg-bgMuted" />
                    )}
                    <span className="max-w-[120px] truncate block" title={action.swapAssetIn.name}>
                        {action.swapAssetIn.symbol ?? action.swapAssetIn.name}
                    </span>
                </div>
            );
        }

        if (type === "transfer" && action.transferAsset) {
            return (
                <div className="flex items-center gap-2">
                    {action.transferAsset.logo ? (
                        <Image
                            src={action.transferAsset.logo}
                            width={20}
                            height={20}
                            className="rounded-full flex-shrink-0"
                            alt={action.transferAsset.name}
                        />
                    ) : (
                        <div className="size-5 rounded-full bg-bgMuted" />
                    )}
                    <span className="max-w-[120px] truncate block" title={action.transferAsset.name}>
                        {action.transferAsset.symbol ?? action.transferAsset.name}
                    </span>
                </div>
            );
        }

        return <span className="text-textTertiary">-</span>;
    }, []);

    if (isActivityLoading) {
        return <div className="p-4 text-sm text-textTertiary">Loading...</div>;
    }

    if (!transactions.length) {
        return <div className="p-4 text-center flex items-center justify-center text-sm text-textTertiary">No wallet activity found.</div>;
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-x-auto overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse min-w-[1000px] table-fixed">
                    <colgroup>
                        <col style={{ width: "40px" }} />
                        <col style={{ width: "100px" }} />
                        <col style={{ width: "180px" }} />
                        <col style={{ width: "120px" }} />
                        <col style={{ width: "120px" }} />
                        <col style={{ width: "100px" }} />
                        <col style={{ width: "80px" }} />
                    </colgroup>

                    <thead className="sticky top-0 bg-bgPrimary z-10">
                        <tr className="text-textTertiary font-medium border-b border-borderDefault h-10">
                            <th className="pl-4"></th>
                            <th>Type</th>
                            <th>Token</th>
                            <th>Amount</th>
                            <th>Value (USD)</th>
                            <th>Age</th>
                            <th className="text-right pr-4">Explorer</th>
                        </tr>
                    </thead>

                    <tbody>
                        {transactions.map((tx: any, i: number) => {
                            const txType = getTransactionType(tx.actions);
                            const chainId = tx.chainId;
                            const explorerUrl = buildExplorerUrl(tx.chainId, "tx", tx.txHash);
                            const isExpanded = expandedRows.has(i);
                            const actionCount = tx.actions?.length || 0;

                            return (
                                <React.Fragment key={i}>
                                    {/* Main Row */}
                                    <tr className="border-b border-borderDefault even:bg-borderDefault/20 odd:hover:bg-bgContainer even:hover:bg-bgPrimary transition-colors h-12">
                                        <td className="pl-4 relative">
                                            {isExpanded && (
                                                <div className="absolute inset-0 pointer-events-none">
                                                    <div
                                                        className="absolute bg-textTertiary"
                                                        style={{
                                                            left: '20px',
                                                            top: '50%',
                                                            width: '1px',
                                                            height: `calc(${actionCount * 44}px + 30px)`,
                                                        }}
                                                    />
                                                </div>
                                            )}
                                            <button
                                                onClick={() => toggleRow(i)}
                                                className="text-textTertiary hover:text-white transition-colors relative z-10"
                                            >
                                                {isExpanded ? (
                                                    <ChevronDown size={16} className="flex-shrink-0" />
                                                ) : (
                                                    <ChevronRight size={16} className="flex-shrink-0" />
                                                )}
                                            </button>
                                        </td>

                                        <td className="text-white capitalize">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${txType === "swap"
                                                ? "bg-bgDarkest/20 text-success"
                                                : txType === "transfer"
                                                    ? "bg-textTertiary/20 text-textTertiary"
                                                    : "bg-bgMuted text-white"
                                                }`}>
                                                {txType}
                                            </span>
                                        </td>

                                        <td className="text-white">{renderMainTokenCell(tx.actions)}</td>

                                        <td className="text-white">
                                            {formatPureNumber(getMainAmount(tx.actions))}
                                        </td>

                                        <td className="text-white">
                                            {formatCryptoPrice(getMainValue(tx.actions))}
                                        </td>

                                        <td className="text-textTertiary">
                                            <TimeAgo timestamp={tx.txDateIso} />
                                        </td>

                                        <td className="text-right pr-4">
                                            <a
                                                href={explorerUrl ?? "#"}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-textTertiary hover:text-white inline-flex items-center justify-center"
                                            >
                                                <ExternalLink size={12} className="flex-shrink-0" />
                                            </a>
                                        </td>
                                    </tr>

                                    {/* Expanded Section */}
                                    {isExpanded && (() => {
                                        const firstAction = tx.actions?.[0];
                                        const type = firstAction?.model?.toLowerCase();

                                        const headers =
                                            type === "swap"
                                                ? ["Action", "Pair", "Amount In", "Amount Out", "Base Price", "Value (USD)"]
                                                : ["Action", "Token", "From", "To", "Amount", "Value (USD)"];

                                        return (
                                            <>
                                                {/* Mini Header */}
                                                <tr className="bg-bgTertiary border-b border-borderDefault h-8">
                                                    <td></td>
                                                    {headers.map((header, idx) => {
                                                        const isBasePriceHeader = type === "swap" && header === "Base Price";

                                                        return (
                                                            <td
                                                                key={idx}
                                                                className={`py-2 text-[10px] font-semibold text-textTertiary uppercase tracking-wider ${header === "Value (USD)" ? "text-right pr-4" : ""
                                                                    }`}
                                                            >
                                                                {isBasePriceHeader ? (
                                                                    <button
                                                                        onClick={() => togglePriceMode(i)}
                                                                        className="flex items-center gap-1 hover:text-white transition-colors"
                                                                        title="Click to toggle Base to Quote price"
                                                                    >
                                                                        <span>
                                                                            {priceMode[i] === "quote" ? "Quote Price" : "Base Price"}
                                                                        </span>
                                                                        <ArrowUpDown
                                                                            size={12}
                                                                            className="flex-shrink-0 transition-colors"
                                                                            color={priceMode[i] === "quote" ? "#18C722" : "#777A8C"}

                                                                        />
                                                                    </button>
                                                                ) : (
                                                                    header
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>

                                                {/* Expanded Actions */}
                                                {tx.actions.map((action: any, actionIdx: number) => {
                                                    const actionType = action.model?.toLowerCase();
                                                    const isSwap = actionType === "swap";
                                                    const isTransfer = actionType === "transfer";
                                                    const isLast = actionIdx === tx.actions.length - 1;

                                                    return (
                                                        <tr
                                                            key={`${i}-${actionIdx}`}
                                                            className={`bg-bgContainer/60 h-10 ${isLast ? "border-b border-borderDefault" : "border-b border-textTertiary/10"
                                                                }`}
                                                        >
                                                            <td className="relative">
                                                                <div className="absolute inset-0 pointer-events-none">
                                                                    <div
                                                                        className="absolute bg-textTertiary"
                                                                        style={{
                                                                            left: "20px",
                                                                            top: "50%",
                                                                            width: "16px",
                                                                            height: "1px",
                                                                        }}
                                                                    />
                                                                    <div
                                                                        className="absolute w-1.5 h-1.5 rounded-full bg-textTertiary"
                                                                        style={{
                                                                            left: "35px",
                                                                            top: "50%",
                                                                            transform: "translate(-50%, -50%)",
                                                                        }}
                                                                    />
                                                                </div>
                                                            </td>

                                                            <td className="capitalize">
                                                                {isSwap ? (
                                                                    <span className="text-success font-medium">
                                                                        {action.swapType?.toLowerCase() || "swap"}
                                                                    </span>
                                                                ) : (
                                                                    <span
                                                                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${action.transferType === "TOKEN_IN" || action.transferType === "NATIVE_IN"
                                                                            ? "bg-green-500/20 text-green-400"
                                                                            : "bg-red-500/20 text-red-400"
                                                                            }`}
                                                                    >
                                                                        {action.transferType?.replace(/_/g, " ").toLowerCase() || "transfer"}
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {isSwap ? (
                                                                <>
                                                                    <td className="text-white">
                                                                        <div className="flex items-center gap-2">
                                                                            {action.swapAssetIn?.logo ? (
                                                                                <Image
                                                                                    src={action.swapAssetIn.logo}
                                                                                    width={16}
                                                                                    height={16}
                                                                                    className="rounded-full"
                                                                                    alt=""
                                                                                />
                                                                            ) : (
                                                                                <div className="size-4 rounded-full bg-bgMuted" />
                                                                            )}
                                                                            <span>{action.swapAssetIn?.symbol}</span>
                                                                            <span className="text-textTertiary">to</span>
                                                                            {action.swapAssetOut?.logo ? (
                                                                                <Image
                                                                                    src={action.swapAssetOut.logo}
                                                                                    width={16}
                                                                                    height={16}
                                                                                    className="rounded-full"
                                                                                    alt=""
                                                                                />
                                                                            ) : (
                                                                                <div className="size-4 rounded-full bg-bgMuted" />
                                                                            )}
                                                                            <span>{action.swapAssetOut?.symbol}</span>
                                                                        </div>
                                                                    </td>

                                                                    <td className="text-textTertiary">
                                                                        {formatPureNumber(action.swapAmountIn)} {action.swapAssetIn?.symbol}
                                                                    </td>
                                                                    <td className="text-textTertiary">
                                                                        {formatPureNumber(action.swapAmountOut)} {action.swapAssetOut?.symbol}
                                                                    </td>

                                                                    <td className="text-textTertiary">
                                                                        {(() => {
                                                                            const mode = priceMode[i] ?? "base";
                                                                            const price =
                                                                                mode === "base"
                                                                                    ? action.swapAssetIn?.price
                                                                                    : action.swapAssetOut?.price;
                                                                            const symbol =
                                                                                mode === "base"
                                                                                    ? action.swapAssetIn?.symbol
                                                                                    : action.swapAssetOut?.symbol;
                                                                            return `${formatCryptoPrice(price)} ${symbol ?? ""}`;
                                                                        })()}
                                                                    </td>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <td className="text-white">
                                                                        <div className="flex items-center gap-2">
                                                                            {action.transferAsset?.logo ? (
                                                                                <Image
                                                                                    src={action.transferAsset.logo}
                                                                                    width={16}
                                                                                    height={16}
                                                                                    className="rounded-full"
                                                                                    alt=""
                                                                                />
                                                                            ) : (
                                                                                <div className="size-4 rounded-full bg-bgMuted" />
                                                                            )}
                                                                            <span className="truncate">
                                                                                {action.transferAsset?.symbol ?? action.transferAsset?.name}
                                                                            </span>
                                                                        </div>
                                                                    </td>

                                                                    <td className="text-textTertiary text-[10px]">
                                                                        {buildExplorerUrl(chainId, "address", action.transferFromAddress) ? (
                                                                            <Link
                                                                                href={buildExplorerUrl(chainId, "address", action.transferFromAddress)!}
                                                                                className="hover:underline underline-offset-2"
                                                                            >
                                                                                {truncateAddress(action.transferFromAddress)}
                                                                            </Link>
                                                                        ) : (
                                                                            truncateAddress(action.transferFromAddress)
                                                                        )}
                                                                    </td>
                                                                    <td className="text-textTertiary text-[10px]">
                                                                        {buildExplorerUrl(chainId, "address", action.transferFromAddress) ? (
                                                                            <Link
                                                                                href={buildExplorerUrl(chainId, "address", action.transferToAddress)!}
                                                                                className="hover:underline underline-offset-2"
                                                                            >
                                                                                {truncateAddress(action.transferToAddress)}
                                                                            </Link>
                                                                        ) : (
                                                                            truncateAddress(action.transferToAddress)
                                                                        )}
                                                                    </td>


                                                                    <td className="text-textTertiary">
                                                                        {formatPureNumber(action.transferAmount ?? 0)}
                                                                    </td>
                                                                </>
                                                            )}

                                                            <td className="text-white font-medium text-right pr-4">
                                                                {formatCryptoPrice(
                                                                    action.swapAmountUsd ??
                                                                    action.transferValueUsd ??
                                                                    action.transferAmountUsd ??
                                                                    0
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </>
                                        );
                                    })()}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}