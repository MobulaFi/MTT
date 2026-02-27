"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import { ExternalLink, ChevronDown, ChevronRight, ArrowUpDown, X } from "lucide-react";
import { formatCryptoPrice, formatPureNumber, buildExplorerUrl } from "@mobula_labs/sdk";
import { useWalletPortfolioStore } from "@/store/useWalletPortfolioStore";
import { useWalletModalStore } from "@/store/useWalletModalStore";
import { sdk } from "@/lib/sdkClient";
import TimeAgo from "@/utils/TimeAgo";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePathname } from "next/navigation";

const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

// Token logo with first-letter fallback
const TokenLogo = ({ logo, symbol, size = 16 }: { logo?: string | null; symbol?: string | null; size?: number }) => {
    const letter = (symbol ?? '?').charAt(0).toUpperCase();
    const sizeClass = size === 20 ? 'size-5' : 'size-4';
    const textSize = size === 20 ? 'text-[10px]' : 'text-[8px]';
    
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
        <div className={`${sizeClass} rounded-full bg-success/30 flex items-center justify-center ${textSize} text-success font-bold flex-shrink-0`}>
            {letter}
        </div>
    );
};

// Known quote/stablecoin addresses (SOL, USDC, USDT, etc.)
const QUOTE_ADDRESSES = new Set([
    'so11111111111111111111111111111111111111112', // Wrapped SOL
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // Native ETH/SOL
    'epjfwdd5aufqssqem2qn1xzybapc8g4weggkzwytdt1v', // USDC (Solana)
    'es9vmfrzacermjfrf4h2fyd4kconky11mcce8benwnyb', // USDT (Solana)
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC (Ethereum)
    '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT (Ethereum)
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
    '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
]);


const isQuoteAsset = (address?: string) => {
    if (!address) return false;
    return QUOTE_ADDRESSES.has(address.toLowerCase());
};

interface ActionData {
    model?: string;
    swapAmountIn?: number;
    swapAmountOut?: number;
    transferAmount?: number;
    swapAmountUsd?: number;
    transferValueUsd?: number;
    transferAmountUsd?: number;
    // For filtered trades (token/trades) - direct values from API
    _baseTokenAmount?: number;
    _baseTokenAmountUSD?: number;
    _quoteTokenAmount?: number;
    _quoteTokenAmountUSD?: number;
    swapPriceUsdTokenIn?: number;
    swapPriceUsdTokenOut?: number;
    transferAsset?: { price?: number };
}

// Get the primary action from a list of actions
// Prioritizes swaps over transfers since swaps are the main trading activity
const getPrimaryAction = <T extends { model?: string }>(actions: T[]): T | undefined => {
    if (!actions?.length) return undefined;
    // First, try to find a swap action
    const swapAction = actions.find(a => a.model?.toLowerCase() === 'swap');
    if (swapAction) return swapAction;
    // Fallback to first action (usually a transfer)
    return actions[0];
};

// For wallet/activity, the naming convention is wallet-centric:
// - swapAssetIn / swapAmountIn = asset RECEIVED by wallet
// - swapAssetOut / swapAmountOut = asset SPENT by wallet
// 
// For a BUY (receiving base token, spending quote):
//   - swapAmountIn = base token amount (what we want to show)
// For a SELL (spending base token, receiving quote):
//   - swapAmountOut = base token amount (what we want to show)
//
// For token/trades filtered mode, we store _baseTokenAmount directly from API
const getMainAmount = (actions: ActionData[], isBuy?: boolean) => {
    if (!actions?.length) return 0;
    const action = getPrimaryAction(actions);
    if (!action) return 0;
    
    // For filtered trades (token/trades endpoint), use _baseTokenAmount directly
    // This is the correct amount from the API, no need to calculate
    if (action._baseTokenAmount !== undefined && action._baseTokenAmount > 0) {
        return action._baseTokenAmount;
    }
    
    // For wallet/activity, determine based on buy/sell direction
    if (isBuy !== undefined) {
        return isBuy 
            ? (action.swapAmountIn ?? action.swapAmountOut ?? action.transferAmount ?? 0)  // Buy: show received (base token)
            : (action.swapAmountOut ?? action.swapAmountIn ?? action.transferAmount ?? 0); // Sell: show spent (base token)
    }
    // Fallback for transfers or unknown direction
    return action.swapAmountIn ?? action.transferAmount ?? 0;
};

const getMainValue = (actions: ActionData[]) => {
    if (!actions?.length) return 0;
    const action = getPrimaryAction(actions);
    if (!action) return 0;
    
    // For filtered trades (token/trades endpoint), use _baseTokenAmountUSD directly
    if (action._baseTokenAmountUSD !== undefined && action._baseTokenAmountUSD > 0) {
        return action._baseTokenAmountUSD;
    }
    
    // Direct USD value if available (wallet/activity)
    if (action.swapAmountUsd && action.swapAmountUsd > 0) return action.swapAmountUsd;
    if (action.transferValueUsd && action.transferValueUsd > 0) return action.transferValueUsd;
    if (action.transferAmountUsd && action.transferAmountUsd > 0) return action.transferAmountUsd;
    
    // Calculate from amount * price as fallback
    const inValue = (action.swapAmountIn ?? 0) * (action.swapPriceUsdTokenIn ?? 0);
    const outValue = (action.swapAmountOut ?? 0) * (action.swapPriceUsdTokenOut ?? 0);
    if (inValue > 0 || outValue > 0) {
        return Math.max(inValue, outValue);
    }
    
    // For transfers
    const transferValue = (action.transferAmount ?? 0) * ((action.transferAsset as { price?: number })?.price ?? 0);
    return transferValue;
};

const addressesMatch = (a?: string | null, b?: string | null) => {
    if (!a || !b) return false;
    return a.toUpperCase() === b.toUpperCase();
};

interface Asset {
    logo?: string | null;
    name?: string | null;
    symbol?: string | null;
    contract?: string;
    price?: number;
    marketCapUsd?: number; // from wallet activity schema (ActivityAssetSchema)
    totalSupply?: number;
}

interface SwapAction {
    swapBaseAddress?: string;
    swapQuoteAddress?: string;
    swapAssetIn?: Asset;
    swapAssetOut?: Asset;
    swapType?: string;
    swapPriceUsdTokenIn?: number;
    swapPriceUsdTokenOut?: number;
}

// Fees breakdown interface
interface FeesBreakdown {
    totalFeesUSD?: number | null;
    gasFeesUSD?: number | null;
    platformFeesUSD?: number | null;
    mevFeesUSD?: number | null;
    txFeesNativeUsd?: number;
}

// Platform/DEX identifiers mapped to display names
const PLATFORM_NAMES: Record<string, string> = {
    'raydium': 'Raydium',
    'orca': 'Orca',
    'jupiter': 'Jupiter',
    'meteora': 'Meteora',
    'pump.fun': 'Pump.fun',
    'pumpfun': 'Pump.fun',
    'moonshot': 'Moonshot',
    'uniswap': 'Uniswap',
    'pancakeswap': 'PancakeSwap',
    'sushiswap': 'SushiSwap',
    'curve': 'Curve',
    'balancer': 'Balancer',
};

// Platform metadata type
type PlatformMetadata = { id?: string; name?: string; logo?: string } | null;

// Extract platform info from various sources
const getPlatformInfo = (
    marketAddress?: string, 
    platform?: string | PlatformMetadata
): { name: string | null; logo: string | null } => {
    // If platform is an object with name/logo
    if (platform && typeof platform === 'object') {
        return { 
            name: platform.name ?? null, 
            logo: platform.logo ?? null 
        };
    }
    
    // If platform is a string
    if (platform && typeof platform === 'string') {
        const lower = platform.toLowerCase();
        return { 
            name: PLATFORM_NAMES[lower] || platform, 
            logo: null 
        };
    }
    
    // Try to identify from market address patterns
    if (marketAddress) {
        const lower = marketAddress.toLowerCase();
        for (const [key, name] of Object.entries(PLATFORM_NAMES)) {
            if (lower.includes(key)) return { name, logo: null };
        }
    }
    
    return { name: null, logo: null };
};

// Get the base asset (the token being traded, not the quote currency)
const getSwapBaseAsset = (action: SwapAction) => {
    if (!action) return undefined;

    // Priority 1: Use explicit swapBaseAddress if available
    if (action.swapBaseAddress) {
        if (addressesMatch(action.swapAssetIn?.contract, action.swapBaseAddress)) {
            return action.swapAssetIn;
        }
        if (addressesMatch(action.swapAssetOut?.contract, action.swapBaseAddress)) {
            return action.swapAssetOut;
        }
    }

    // Priority 2: The non-quote asset is the base asset
    const inIsQuote = isQuoteAsset(action.swapAssetIn?.contract);
    const outIsQuote = isQuoteAsset(action.swapAssetOut?.contract);
    
    if (inIsQuote && !outIsQuote) {
        return action.swapAssetOut;
    }
    if (outIsQuote && !inIsQuote) {
        return action.swapAssetIn;
    }
    
    // Priority 3: Token with lower liquidity/market cap is likely the base (meme token)
    // For now, default to swapAssetOut (token received)
    return action.swapAssetOut ?? action.swapAssetIn;
};

// Determine if it's a BUY or SELL from base token perspective
// IMPORTANT: In wallet/activity, naming is from WALLET's perspective:
//   - swapAssetIn = asset flowing INTO the wallet (what wallet RECEIVES)
//   - swapAssetOut = asset flowing OUT of the wallet (what wallet SPENDS)
// So: receiving base = BUY, spending base = SELL
const getTradeDirection = (action: SwapAction): "buy" | "sell" | "unknown" => {
    if (!action) return "unknown";
    if (!action.swapAssetIn && !action.swapAssetOut) return "unknown";
    
    // Priority 1: Use explicit swapQuoteAddress
    // If receiving quote (swapAssetIn = quote) → SELL (sold base to get quote)
    // If spending quote (swapAssetOut = quote) → BUY (spent quote to get base)
    if (action.swapQuoteAddress) {
        if (addressesMatch(action.swapAssetIn?.contract, action.swapQuoteAddress)) {
            return "sell"; // Receiving quote = sold base = SELL
        }
        if (addressesMatch(action.swapAssetOut?.contract, action.swapQuoteAddress)) {
            return "buy"; // Spending quote = bought base = BUY
        }
    }
    
    // Priority 2: Use explicit swapBaseAddress
    // If receiving base (swapAssetIn = base) → BUY
    // If spending base (swapAssetOut = base) → SELL
    if (action.swapBaseAddress) {
        if (addressesMatch(action.swapAssetIn?.contract, action.swapBaseAddress)) {
            return "buy"; // Receiving base = BUY
        }
        if (addressesMatch(action.swapAssetOut?.contract, action.swapBaseAddress)) {
            return "sell"; // Spending base = SELL
        }
    }
    
    // Priority 3: Use base asset heuristic
    const baseAsset = getSwapBaseAsset(action);
    if (baseAsset) {
        if (addressesMatch(baseAsset.contract, action.swapAssetIn?.contract)) {
            return "buy"; // Receiving base = BUY
        }
        if (addressesMatch(baseAsset.contract, action.swapAssetOut?.contract)) {
            return "sell"; // Spending base = SELL
        }
    }
    
    // Fallback: use quote asset heuristic
    // If spending quote (out is quote) → BUY, if receiving quote (in is quote) → SELL
    const inIsQuote = isQuoteAsset(action.swapAssetIn?.contract);
    const outIsQuote = isQuoteAsset(action.swapAssetOut?.contract);
    
    if (outIsQuote && !inIsQuote) {
        return "buy"; // Spending quote to get non-quote = BUY
    }
    if (inIsQuote && !outIsQuote) {
        return "sell"; // Receiving quote from non-quote = SELL
    }
    
    return "unknown";
};

// Calculate market cap from price * totalSupply for the base token
const getBaseTokenMarketCap = (action: SwapAction & { 
    swapPriceUsdTokenIn?: number; 
    swapPriceUsdTokenOut?: number;
    swapAmountIn?: number;
    swapAmountOut?: number;
    swapAmountUsd?: number;
}): number | undefined => {
    if (!action) return undefined;
    
    const baseAsset = getSwapBaseAsset(action);
    if (!baseAsset) return undefined;
    
    // Check marketCapUsd (from wallet activity schema)
    if (baseAsset.marketCapUsd && baseAsset.marketCapUsd > 0) {
        return baseAsset.marketCapUsd;
    }
    
    let price: number | undefined;
    let supply: number | undefined;
    
    const isBaseIn = addressesMatch(baseAsset.contract, action.swapAssetIn?.contract);
    const isBaseOut = addressesMatch(baseAsset.contract, action.swapAssetOut?.contract);
    
    if (isBaseIn) {
        price = action.swapPriceUsdTokenIn;
        supply = action.swapAssetIn?.totalSupply;
        if (!price && action.swapAmountUsd && action.swapAmountIn && action.swapAmountIn > 0) {
            price = action.swapAmountUsd / action.swapAmountIn;
        }
    } else if (isBaseOut) {
        price = action.swapPriceUsdTokenOut;
        supply = action.swapAssetOut?.totalSupply;
        if (!price && action.swapAmountUsd && action.swapAmountOut && action.swapAmountOut > 0) {
            price = action.swapAmountUsd / action.swapAmountOut;
        }
    }
    
    if (price && supply && price > 0 && supply > 0) {
        return price * supply;
    }
    
    return undefined;
};

interface ActionWithModel {
    model?: string;
    swapAssetIn?: Asset;
    swapAssetOut?: Asset;
    transferAsset?: Asset;
    swapBaseAddress?: string;
    swapType?: string;
    swapPriceUsdTokenIn?: number;
    swapPriceUsdTokenOut?: number;
}

// Get transaction type considering buy/sell for swaps
const getTransactionDisplay = (actions: ActionWithModel[]): { type: string; isBuy?: boolean } => {
    if (!actions?.length) return { type: "unknown" };
    // Prioritize swap actions over transfers
    const action = getPrimaryAction(actions);
    if (!action) return { type: "unknown" };
    const model = action.model?.toLowerCase();
    
    if (model === "swap") {
        const direction = getTradeDirection(action as SwapAction);
        return { type: direction, isBuy: direction === "buy" };
    }
    if (model === "transfer") {
        return { type: "transfer" };
    }
    return { type: model || "unknown" };
};

// Skeleton row for loading state
const SkeletonRow = () => (
    <tr className="border-b border-borderDefault h-12">
        <td className="pl-4"><Skeleton className="h-4 w-4 rounded" /></td>
        <td><Skeleton className="h-5 w-12 rounded" /></td>
        <td><Skeleton className="h-4 w-24 rounded" /></td>
        <td><Skeleton className="h-4 w-28 rounded" /></td>
        <td><Skeleton className="h-4 w-16 rounded" /></td>
        <td><Skeleton className="h-4 w-14 rounded" /></td>
        <td><Skeleton className="h-4 w-12 rounded" /></td>
        <td><Skeleton className="h-4 w-10 rounded" /></td>
        <td className="pr-4"><Skeleton className="h-4 w-4 rounded" /></td>
    </tr>
);

// Transform token trades to activity format
// Type-safe token trade interface (using any for baseToken/quoteToken since SDK types are complex)
interface TokenTrade {
    id: string;
    type: string;
    operation: string;
    baseTokenAmount: number;
    baseTokenAmountUSD: number;
    quoteTokenAmount: number;
    quoteTokenAmountUSD: number;
    date: number;
    transactionHash: string;
    blockchain: string;
    marketAddress: string;
    baseTokenPriceUSD: number;
    quoteTokenPriceUSD: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    baseToken?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    quoteToken?: any;
    // Fees breakdown
    totalFeesUSD?: number | null;
    gasFeesUSD?: number | null;
    platformFeesUSD?: number | null;
    mevFeesUSD?: number | null;
    // Platform info
    platform?: string | null;
}


interface WalletActivityPositionProps {
    hideDust?: boolean;
    refetchActivity?: (options?: { from?: number; to?: number; order?: 'asc' | 'desc' }) => Promise<void>;
}

export function WalletActivityPosition({ hideDust = false, refetchActivity }: WalletActivityPositionProps) {
    const { 
        walletActivity, 
        isActivityLoading, 
        assetFilter, 
        setAssetFilter,
        dateFilter,
        filteredTrades,
        isFilteredTradesLoading,
        setFilteredTrades,
        setFilteredTradesLoading,
    } = useWalletPortfolioStore();
    const { walletAddress, blockchain } = useWalletModalStore();
    const pathname = usePathname();
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [priceMode, setPriceMode] = useState<Record<number, "base" | "quote">>({});

    // Build wallet popup URL for a given address
    const buildWalletPopupUrl = useCallback((targetWallet: string) => {
        // Get the base path (e.g., /token/solana:solana/xxx)
        return `${pathname}?popup=${targetWallet}`;
    }, [pathname]);

    // Sorting state - works for both filtered and global modes
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    
    // Request ID ref for race condition prevention
    const tradesRequestIdRef = useRef(0);

    // Fetch token trades when filter is set
    useEffect(() => {
        console.log('[Activity] useEffect triggered - assetFilter:', assetFilter, 'walletAddress:', walletAddress, 'blockchain:', blockchain);
        
        if (!assetFilter || !walletAddress || !blockchain) {
            console.log('[Activity] Missing required params, clearing filtered trades');
            setFilteredTrades(null);
            return;
        }

        // Increment request ID
        tradesRequestIdRef.current++;
        const thisRequestId = tradesRequestIdRef.current;
        const thisAssetAddress = assetFilter.address;
        const thisWallet = walletAddress;

        const fetchFilteredTrades = async () => {
            setFilteredTradesLoading(true);
            try {
                // Use assetFilter.chainId (from position data) which should be the correct format
                const chainToUse = assetFilter.chainId || blockchain;
                console.log('[Activity] Fetching trades:', {
                    name: assetFilter.name,
                    address: assetFilter.address,
                    blockchain: chainToUse,
                    wallet: walletAddress,
                    sortOrder,
                });
                
                const response = await sdk.fetchTokenTrades({
                    blockchain: chainToUse,
                    address: assetFilter.address,
                    mode: 'asset',
                    limit: 100,
                    sortOrder, // Sort by date (desc = newest first, asc = oldest first)
                    transactionSenderAddresses: [walletAddress],
                }) as { data?: TokenTrade[] };
                
                // Check for race condition
                if (thisRequestId !== tradesRequestIdRef.current) {
                    console.log(`[Activity] Ignoring stale response for ${thisAssetAddress} (request ${thisRequestId}, current ${tradesRequestIdRef.current})`);
                    return;
                }
                
                console.log('[Activity] Response:', response);
                console.log('[Activity] Fetched trades:', response?.data?.length ?? 0);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setFilteredTrades(response as any);
            } catch (err) {
                // Only handle error if this is still the current request
                if (thisRequestId === tradesRequestIdRef.current) {
                    console.error('Error fetching filtered trades:', err);
                    setFilteredTrades(null);
                }
            } finally {
                // Only update loading state if this is still the current request
                if (thisRequestId === tradesRequestIdRef.current) {
                    setFilteredTradesLoading(false);
                }
            }
        };

        fetchFilteredTrades();
    }, [assetFilter, walletAddress, blockchain, setFilteredTrades, setFilteredTradesLoading, sortOrder]);

    // Track if this is the initial mount to avoid unnecessary refetch
    const isInitialMount = useRef(true);
    const prevSortOrder = useRef(sortOrder);

    // Refetch wallet activity when sortOrder changes in global mode (no asset filter)
    useEffect(() => {
        // Skip on initial mount
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        // Only refetch if sortOrder actually changed
        if (prevSortOrder.current === sortOrder) {
            return;
        }
        prevSortOrder.current = sortOrder;

        // Only refetch in global mode (when there's no asset filter)
        // When assetFilter is set, the token/trades API handles sorting
        if (!assetFilter && refetchActivity) {
            console.log('[Activity] Sort order changed to', sortOrder, '- refetching wallet activity');
            refetchActivity({ order: sortOrder });
        }
    }, [sortOrder, assetFilter, refetchActivity]);

    // Use filtered trades when filter is active, otherwise use wallet activity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transactions: any[] = useMemo(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let result: any[] = [];
        
        if (assetFilter && filteredTrades?.data) {
            // Transform token trades to a compatible format
            // Using baseToken & quoteToken from the API which contain full details (name, symbol, logo, totalSupply, etc.)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            result = (filteredTrades.data as any[]).map((trade: TokenTrade) => {
                const isBuy = trade.type === 'buy';
                
                // Base token info directly from API response
                const baseToken = trade.baseToken;
                const baseAddress = baseToken?.address ?? assetFilter.address;
                const baseSymbol = baseToken?.symbol ?? assetFilter.symbol ?? 'Unknown';
                const baseName = baseToken?.name ?? assetFilter.name ?? baseSymbol;
                const baseLogo = baseToken?.logo ?? assetFilter.logo ?? null;
                const baseTotalSupply = baseToken?.totalSupply ?? assetFilter.totalSupply;
                
                // Quote token info directly from API response
                const quoteToken = trade.quoteToken;
                const quoteAddress = quoteToken?.address ?? '';
                const quoteSymbol = quoteToken?.symbol ?? 'Unknown';
                const quoteName = quoteToken?.name ?? quoteSymbol;
                const quoteLogo = quoteToken?.logo ?? null;
                
                // Market cap from baseToken.marketCapUSD or calculate from price * totalSupply
                const marketCap = baseToken?.marketCapUSD 
                    || (trade.baseTokenPriceUSD && baseTotalSupply ? trade.baseTokenPriceUSD * baseTotalSupply : 0);
                
                // Use baseTokenAmount and baseTokenAmountUSD directly from API
                const baseAmount = trade.baseTokenAmount;
                const baseAmountUSD = trade.baseTokenAmountUSD;
                const quoteAmount = trade.quoteTokenAmount;
                const quoteAmountUSD = trade.quoteTokenAmountUSD;
                
                return {
                    txHash: trade.transactionHash,
                    chainId: trade.blockchain,
                    txDateIso: new Date(trade.date).toISOString(),
                    // Store trade type and market cap directly
                    _tradeType: trade.type,
                    _marketCap: marketCap,
                    // Store base token info for display (used in Token column)
                    _baseToken: { symbol: baseSymbol, name: baseName, logo: baseLogo },
                    // Store platform and fees
                    _platformInfo: getPlatformInfo(trade.marketAddress, trade.platform),
                    _marketAddress: trade.marketAddress,
                    _fees: {
                        totalFeesUSD: trade.totalFeesUSD,
                        gasFeesUSD: trade.gasFeesUSD,
                        platformFeesUSD: trade.platformFeesUSD,
                        mevFeesUSD: trade.mevFeesUSD,
                    } as FeesBreakdown,
                    actions: [{
                        model: 'swap',
                        // IMPORTANT: Match wallet/activity naming convention:
                        // swapAssetIn = asset flowing INTO wallet (what wallet RECEIVES)
                        // swapAssetOut = asset flowing OUT of wallet (what wallet SPENDS)
                        // For BUY: wallet spends quote (SOL/BNB/ETH), receives base token
                        // For SELL: wallet spends base token, receives quote (SOL/BNB/ETH)
                        swapAssetIn: {
                            // What wallet RECEIVES
                            symbol: isBuy ? baseSymbol : quoteSymbol,
                            name: isBuy ? baseName : quoteName,
                            logo: isBuy ? baseLogo : quoteLogo,
                            contract: isBuy ? baseAddress : quoteAddress,
                            totalSupply: baseTotalSupply,
                            marketCapUsd: marketCap,
                        },
                        swapAssetOut: {
                            // What wallet SPENDS
                            symbol: isBuy ? quoteSymbol : baseSymbol,
                            name: isBuy ? quoteName : baseName,
                            logo: isBuy ? quoteLogo : baseLogo,
                            contract: isBuy ? quoteAddress : baseAddress,
                        },
                        // swapAmountIn = amount RECEIVED, swapAmountOut = amount SPENT
                        swapAmountIn: isBuy ? baseAmount : quoteAmount,
                        swapAmountOut: isBuy ? quoteAmount : baseAmount,
                        // USD value of the base token (the main value to display)
                        swapAmountUsd: baseAmountUSD,
                        // Prices (In = received token price, Out = spent token price)
                        swapPriceUsdTokenIn: isBuy ? trade.baseTokenPriceUSD : trade.quoteTokenPriceUSD,
                        swapPriceUsdTokenOut: isBuy ? trade.quoteTokenPriceUSD : trade.baseTokenPriceUSD,
                        swapBaseAddress: baseAddress,
                        // Store amounts explicitly for correct display
                        _baseTokenAmount: baseAmount,
                        _baseTokenAmountUSD: baseAmountUSD,
                        _quoteTokenAmount: quoteAmount,
                        _quoteTokenAmountUSD: quoteAmountUSD,
                    }],
                };
            });
        } else {
            // Use wallet activity data - sorting is handled server-side by the API
            result = walletActivity?.data ?? [];
        }
        
        // Filter out dust transactions (< $1)
        // Use the same calculation logic as getMainValue for consistency
        if (hideDust) {
            result = result.filter((tx: { actions?: ActionData[] }) => {
                if (!tx.actions || tx.actions.length === 0) return true;
                
                // Check any action has value >= $1 using same logic as getMainValue
                return tx.actions.some((action: ActionData) => {
                    // Direct USD values
                    if ((action.swapAmountUsd ?? 0) >= 1) return true;
                    if ((action.transferAmountUsd ?? 0) >= 1) return true;
                    if ((action._baseTokenAmountUSD ?? 0) >= 1) return true;
                    
                    // Calculate from swap amounts * prices (fallback)
                    const inValue = (action.swapAmountIn ?? 0) * (action.swapPriceUsdTokenIn ?? 0);
                    const outValue = (action.swapAmountOut ?? 0) * (action.swapPriceUsdTokenOut ?? 0);
                    if (Math.max(inValue, outValue) >= 1) return true;
                    
                    // Calculate from transfer amount * price (fallback)
                    const transferAsset = action.transferAsset as { price?: number } | undefined;
                    const transferValue = (action.transferAmount ?? 0) * (transferAsset?.price ?? 0);
                    if (transferValue >= 1) return true;
                    
                    return false;
                });
            });
        }
        
        // Filter by date range if dateFilter is set
        if (dateFilter) {
            const fromTime = dateFilter.from.getTime();
            const toTime = dateFilter.to.getTime();
            result = result.filter((tx: { txDateIso?: string }) => {
                if (!tx.txDateIso) return false;
                const txTime = new Date(tx.txDateIso).getTime();
                return txTime >= fromTime && txTime <= toTime;
            });
        }
        
        return result;
    }, [assetFilter, filteredTrades, walletActivity?.data, hideDust, dateFilter]);

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

    const renderMainTokenCell = useCallback((actions: ActionWithModel[], baseToken?: { symbol?: string; name?: string; logo?: string }) => {
        if (!actions?.length) return <span className="text-textTertiary">-</span>;

        // Prioritize swap actions over transfers for main display
        const action = getPrimaryAction(actions);
        if (!action) return <span className="text-textTertiary">-</span>;
        const type = action.model?.toLowerCase();

        let displayName: string;
        let displayTitle: string;
        let logo: string | undefined;

        if (baseToken) {
            displayName = baseToken.symbol ?? baseToken.name ?? 'Unknown';
            displayTitle = baseToken.name ?? baseToken.symbol ?? 'Unknown';
            logo = baseToken.logo ?? undefined;
        } else {
            const asset = type === "swap"
                ? getSwapBaseAsset(action as SwapAction)
                : action.transferAsset;
            displayName = asset?.symbol ?? asset?.name ?? 'Unknown';
            displayTitle = asset?.name ?? asset?.symbol ?? 'Unknown';
            logo = asset?.logo ?? undefined;
        }

        return (
            <div className="flex items-center gap-2">
                <TokenLogo logo={logo} symbol={displayName} size={20} />
                <span className="max-w-[120px] truncate block" title={displayTitle}>
                    {displayName}
                </span>
            </div>
        );
    }, []);

    const isLoading = assetFilter ? isFilteredTradesLoading : isActivityLoading;

    // Loading skeleton
    if (isLoading) {
        return (
            <div className="h-full flex flex-col">
                <div className="flex-1 overflow-x-auto overflow-y-auto">
                    <table className="w-full text-xs text-left border-collapse min-w-[900px] table-fixed">
                        <colgroup>
                            <col style={{ width: "32px" }} />
                            <col style={{ width: "72px" }} />
                            <col style={{ width: "120px" }} />
                            <col style={{ width: "150px" }} />
                            <col style={{ width: "90px" }} />
                            <col style={{ width: "80px" }} />
                            <col style={{ width: "80px" }} />
                            <col style={{ width: "60px" }} />
                            <col style={{ width: "50px" }} />
                        </colgroup>
                        <thead className="sticky top-0 bg-bgPrimary z-10">
                            <tr className="text-textTertiary font-medium border-b border-borderDefault h-10">
                                <th className="pl-4"></th>
                                <th>Type</th>
                                <th>Token</th>
                                <th>Amount</th>
                                <th>Market Cap</th>
                                <th>Platform</th>
                                <th>Fees</th>
                                <th>Age / Time</th>
                                <th className="text-right pr-4">Explorer</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: 10 }).map((_, i) => (
                                <SkeletonRow key={i} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    if (!transactions.length) {
        return (
            <div className="p-4 text-center flex flex-col items-center justify-center text-sm text-textTertiary gap-2">
                {assetFilter ? (
                    <>
                        <span>No trades found for {assetFilter.name}</span>
                        <button
                            onClick={() => setAssetFilter(null)}
                            className="flex items-center gap-1 text-xs text-success hover:underline"
                        >
                            <X size={12} />
                            Clear filter
                        </button>
                    </>
                ) : (
                    "No wallet activity found."
                )}
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-x-auto overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse min-w-[900px] table-fixed">
                    <colgroup>
                        <col style={{ width: "32px" }} />
                        <col style={{ width: "72px" }} />
                        <col style={{ width: "120px" }} />
                        <col style={{ width: "150px" }} />
                        <col style={{ width: "90px" }} />
                        <col style={{ width: "80px" }} />
                        <col style={{ width: "80px" }} />
                        <col style={{ width: "60px" }} />
                        <col style={{ width: "50px" }} />
                    </colgroup>

                    <thead className="sticky top-0 bg-bgPrimary z-10">
                        <tr className="text-textTertiary font-medium border-b border-borderDefault h-10">
                            <th className="pl-4"></th>
                            <th>Type</th>
                            <th>Token</th>
                            <th>Amount</th>
                            <th>Market Cap</th>
                            <th>Platform</th>
                            <th>Fees</th>
                            <th>
                                <button 
                                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                    className="flex items-center gap-1 hover:text-white transition-colors"
                                >
                                    Age
                                    <ArrowUpDown size={12} className={sortOrder === 'asc' ? 'text-success' : 'text-textTertiary'} />
                                </button>
                            </th>
                            <th className="text-right pr-4">Explorer</th>
                        </tr>
                    </thead>

                    <tbody>
                        {transactions.map((tx: { 
                            actions?: ActionWithModel[]; 
                            chainId?: string; 
                            txHash?: string; 
                            txDateIso?: string; 
                            _tradeType?: string; 
                            _marketCap?: number;
                            _platformInfo?: { name: string | null; logo: string | null };
                            _marketAddress?: string;
                            _fees?: FeesBreakdown;
                            txFeesNativeUsd?: number;
                        }, i: number) => {
                            // Use direct trade type for filtered trades, otherwise calculate
                            const txDisplay = tx._tradeType 
                                ? { type: tx._tradeType, isBuy: tx._tradeType === 'buy' }
                                : getTransactionDisplay(tx.actions ?? []);
                            const chainId = tx.chainId ?? '';
                            const explorerUrl = buildExplorerUrl(chainId, "tx", tx.txHash ?? '');
                            const isExpanded = expandedRows.has(i);
                            const actionCount = tx.actions?.length || 0;
                            
                            // Use direct market cap for filtered trades, otherwise calculate
                            // Prioritize swap action for market cap calculation
                            const primaryAction = getPrimaryAction(tx.actions ?? []);
                            const marketCap = tx._marketCap ?? (primaryAction?.model?.toLowerCase() === "swap" 
                                ? getBaseTokenMarketCap(primaryAction as SwapAction & { swapAmountIn?: number; swapAmountOut?: number; swapAmountUsd?: number })
                                : undefined);
                            
                            // Platform and fees - extract from action level for wallet/activity data
                            // For filtered trades (token/trades), use pre-extracted _platformInfo and _fees
                            // For wallet/activity, extract from primaryAction.swapPlatform and swapXxxFeesUsd
                            type SwapActionWithFees = SwapAction & {
                                swapPlatform?: { id?: string; name?: string; logo?: string } | null;
                                swapTotalFeesUsd?: number | null;
                                swapGasFeesUsd?: number | null;
                                swapPlatformFeesUsd?: number | null;
                                swapMevFeesUsd?: number | null;
                            };
                            const swapAction = primaryAction as SwapActionWithFees | undefined;
                            const txPlatformInfo = (tx as { _platformInfo?: { name: string | null; logo: string | null } })._platformInfo;
                            const platform = txPlatformInfo?.name ?? swapAction?.swapPlatform?.name ?? null;
                            const platformLogo = txPlatformInfo?.logo ?? swapAction?.swapPlatform?.logo;
                            const fees = tx._fees?.totalFeesUSD 
                                ?? swapAction?.swapTotalFeesUsd 
                                ?? tx.txFeesNativeUsd;
                            const feesBreakdown: FeesBreakdown = tx._fees ?? {
                                totalFeesUSD: swapAction?.swapTotalFeesUsd ?? null,
                                gasFeesUSD: swapAction?.swapGasFeesUsd ?? null,
                                platformFeesUSD: swapAction?.swapPlatformFeesUsd ?? null,
                                mevFeesUSD: swapAction?.swapMevFeesUsd ?? null,
                            };

                            return (
                                <React.Fragment key={i}>
                                    {/* Main Row - entire row is clickable */}
                                    <tr 
                                        className="border-b border-borderDefault even:bg-borderDefault/20 odd:hover:bg-bgContainer even:hover:bg-bgPrimary transition-colors h-12 cursor-pointer"
                                        onClick={() => toggleRow(i)}
                                    >
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
                                            <span className="text-textTertiary">
                                                {isExpanded ? (
                                                    <ChevronDown size={16} className="flex-shrink-0" />
                                                ) : (
                                                    <ChevronRight size={16} className="flex-shrink-0" />
                                                )}
                                            </span>
                                        </td>

                                        <td className="text-white capitalize">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                txDisplay.type === "buy"
                                                    ? "bg-success/20 text-success"
                                                    : txDisplay.type === "sell"
                                                        ? "bg-errorBright/20 text-errorBright"
                                                        : txDisplay.type === "transfer"
                                                    ? "bg-textTertiary/20 text-textTertiary"
                                                    : "bg-bgMuted text-white"
                                                }`}>
                                                {txDisplay.type}
                                            </span>
                                        </td>

                                        <td className="text-white">{renderMainTokenCell(tx.actions ?? [], (tx as { _baseToken?: { symbol?: string; name?: string; logo?: string } })._baseToken)}</td>

                                        <td className="text-white whitespace-nowrap">
                                            <span>{formatPureNumber(getMainAmount(tx.actions as ActionData[] ?? [], txDisplay.isBuy))}</span>
                                            <span className="text-textTertiary ml-1">({formatCryptoPrice(getMainValue(tx.actions as ActionData[] ?? []))})</span>
                                        </td>

                                        <td className="text-textTertiary whitespace-nowrap">
                                            {marketCap ? formatCryptoPrice(marketCap) : "—"}
                                        </td>

                                        <td className="text-textTertiary whitespace-nowrap">
                                            {platform ? (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-bgTertiary text-[10px] font-medium text-white">
                                                    {platformLogo ? (
                                                        <Image 
                                                            src={platformLogo} 
                                                            width={12} 
                                                            height={12} 
                                                            alt={platform} 
                                                            className="rounded-full flex-shrink-0"
                                                        />
                                                    ) : (
                                                        <span className="size-3 rounded-full bg-success/30 flex items-center justify-center text-[6px] text-success font-bold flex-shrink-0">
                                                            {platform.charAt(0).toUpperCase()}
                                                        </span>
                                                    )}
                                                    {platform}
                                                </span>
                                            ) : "—"}
                                        </td>

                                        <td className="text-textTertiary whitespace-nowrap">
                                            {fees && fees > 0 ? (
                                                <TooltipProvider delayDuration={0}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="cursor-help underline decoration-dotted underline-offset-2">
                                                                {formatCryptoPrice(fees)}
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent 
                                                            side="top" 
                                                            className="bg-bgContainer border border-borderDefault p-2 text-xs"
                                                        >
                                                            <div className="flex flex-col gap-1 min-w-[120px]">
                                                                <div className="font-semibold text-white mb-1">Fee Breakdown</div>
                                                                {feesBreakdown.gasFeesUSD != null && feesBreakdown.gasFeesUSD > 0 && (
                                                                    <div className="flex justify-between gap-4">
                                                                        <span className="text-textTertiary">Gas:</span>
                                                                        <span className="text-white">{formatCryptoPrice(feesBreakdown.gasFeesUSD)}</span>
                                                                    </div>
                                                                )}
                                                                {feesBreakdown.platformFeesUSD != null && feesBreakdown.platformFeesUSD > 0 && (
                                                                    <div className="flex justify-between gap-4">
                                                                        <span className="text-textTertiary">Platform:</span>
                                                                        <span className="text-white">{formatCryptoPrice(feesBreakdown.platformFeesUSD)}</span>
                                                                    </div>
                                                                )}
                                                                {feesBreakdown.mevFeesUSD != null && feesBreakdown.mevFeesUSD > 0 && (
                                                                    <div className="flex justify-between gap-4">
                                                                        <span className="text-textTertiary">MEV:</span>
                                                                        <span className="text-white">{formatCryptoPrice(feesBreakdown.mevFeesUSD)}</span>
                                                                    </div>
                                                                )}
                                                                {(!feesBreakdown.gasFeesUSD && !feesBreakdown.platformFeesUSD && !feesBreakdown.mevFeesUSD) && (
                                                                    <div className="flex justify-between gap-4">
                                                                        <span className="text-textTertiary">Total:</span>
                                                                        <span className="text-white">{formatCryptoPrice(fees)}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            ) : "—"}
                                        </td>

                                        <td className="text-textTertiary">
                                            <div className="flex flex-col">
                                                <TimeAgo timestamp={tx.txDateIso ?? ''} />
                                                <span className="text-[10px] text-textTertiary/60">
                                                    {tx.txDateIso ? new Date(tx.txDateIso).toLocaleString('en-US', { 
                                                        year: 'numeric', 
                                                        month: '2-digit', 
                                                        day: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        hour12: false 
                                                    }) : '—'}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="text-right pr-4">
                                            <a
                                                href={explorerUrl ?? "#"}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-textTertiary hover:text-white inline-flex items-center justify-center"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <ExternalLink size={12} className="flex-shrink-0" />
                                            </a>
                                        </td>
                                    </tr>

                                    {/* Expanded Section */}
                                    {isExpanded && (() => {
                                        // Use primary action (swap if available) to determine view type
                                        const primaryTxAction = getPrimaryAction(tx.actions ?? []) as { model?: string } | undefined;
                                        const type = primaryTxAction?.model?.toLowerCase();

                                        const headers =
                                            type === "swap"
                                                ? ["Action", "Pair", "Spent", "Received", "Base Price", "Value (USD)"]
                                                : ["Action", "Token", "From", "To", "Amount", "Value (USD)"];

                                        return (
                                            <>
                                                {/* Mini Header */}
                                                <tr className="bg-bgPrimary border-b border-borderDefault h-8">
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
                                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                {(tx.actions ?? []).map((action: any, actionIdx: number) => {
                                                    const actionType = (action.model as string)?.toLowerCase();
                                                    const isSwap = actionType === "swap";
                                                    const isTransfer = actionType === "transfer";
                                                    const isLast = actionIdx === (tx.actions?.length ?? 0) - 1;
                                                    
                                                    // Determine buy/sell for this specific action
                                                    const actionDirection = isSwap ? getTradeDirection(action as unknown as SwapAction) : null;

                                                    return (
                                                        <tr
                                                            key={`${i}-${actionIdx}`}
                                                            className={`bg-bgPrimary h-10 ${isLast ? "border-b border-borderDefault" : "border-b border-borderDefault/50"}`}
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
                                                                    <span className={`font-medium ${actionDirection === "buy" ? "text-success" : "text-errorBright"}`}>
                                                                        {actionDirection || "swap"}
                                                                    </span>
                                                                ) : isTransfer ? (
                                                                    <span
                                                                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${(action.transferType as string) === "TOKEN_IN" || (action.transferType as string) === "NATIVE_IN"
                                                                            ? "bg-green-500/20 text-green-400"
                                                                            : "bg-red-500/20 text-red-400"
                                                                            }`}
                                                                    >
                                                                        {(action.transferType as string)?.replace(/_/g, " ").toLowerCase() || "transfer"}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-textTertiary">action</span>
                                                                )}
                                                            </td>

                                                            {isSwap ? (
                                                                <>
                                                                    <td className="text-white">
                                                                        {/* Display as "spent → received" for clarity */}
                                                                        {/* swapAssetOut = spent, swapAssetIn = received */}
                                                                        <div className="flex items-center gap-2">
                                                                            <TokenLogo logo={(action.swapAssetOut as Asset)?.logo} symbol={(action.swapAssetOut as Asset)?.symbol} size={16} />
                                                                            <span>{(action.swapAssetOut as Asset)?.symbol}</span>
                                                                            <span className="text-textTertiary">→</span>
                                                                            <TokenLogo logo={(action.swapAssetIn as Asset)?.logo} symbol={(action.swapAssetIn as Asset)?.symbol} size={16} />
                                                                            <span>{(action.swapAssetIn as Asset)?.symbol}</span>
                                                                        </div>
                                                                    </td>

                                                                    <td className="text-textTertiary">
                                                                        {/* Amount spent */}
                                                                        {formatPureNumber(action.swapAmountOut as number)} {(action.swapAssetOut as Asset)?.symbol}
                                                                    </td>
                                                                    <td className="text-textTertiary">
                                                                        {/* Amount received */}
                                                                        {formatPureNumber(action.swapAmountIn as number)} {(action.swapAssetIn as Asset)?.symbol}
                                                                    </td>

                                                                    <td className="text-textTertiary">
                                                                        {(() => {
                                                                            const mode = priceMode[i] ?? "base";
                                                                            const price =
                                                                                mode === "base"
                                                                                    ? (action.swapPriceUsdTokenIn as number)
                                                                                    : (action.swapPriceUsdTokenOut as number);
                                                                            const symbol =
                                                                                mode === "base"
                                                                                    ? (action.swapAssetIn as Asset)?.symbol
                                                                                    : (action.swapAssetOut as Asset)?.symbol;
                                                                            return `${formatCryptoPrice(price ?? 0)} ${symbol ?? ""}`;
                                                                        })()}
                                                                    </td>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <td className="text-white">
                                                                        <div className="flex items-center gap-2">
                                                                            <TokenLogo 
                                                                                logo={(action.transferAsset as Asset)?.logo} 
                                                                                symbol={(action.transferAsset as Asset)?.symbol ?? (action.transferAsset as Asset)?.name} 
                                                                                size={16} 
                                                                            />
                                                                            <span className="truncate">
                                                                                {(action.transferAsset as Asset)?.symbol ?? (action.transferAsset as Asset)?.name}
                                                                            </span>
                                                                        </div>
                                                                    </td>

                                                                    <td className="text-textTertiary text-[10px]">
                                                                        {action.transferFromAddress ? (
                                                                            <Link
                                                                                href={buildWalletPopupUrl(action.transferFromAddress as string)}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="hover:underline underline-offset-2 hover:text-success transition-colors"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                                {truncateAddress(action.transferFromAddress as string ?? '')}
                                                                            </Link>
                                                                        ) : (
                                                                            truncateAddress(action.transferFromAddress as string ?? '')
                                                                        )}
                                                                    </td>
                                                                    <td className="text-textTertiary text-[10px]">
                                                                        {action.transferToAddress ? (
                                                                            <Link
                                                                                href={buildWalletPopupUrl(action.transferToAddress as string)}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="hover:underline underline-offset-2 hover:text-success transition-colors"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                                {truncateAddress(action.transferToAddress as string ?? '')}
                                                                            </Link>
                                                                        ) : (
                                                                            truncateAddress(action.transferToAddress as string ?? '')
                                                                        )}
                                                                    </td>

                                                                    <td className="text-textTertiary">
                                                                        {formatPureNumber(action.transferAmount as number ?? 0)}
                                                                    </td>
                                                                </>
                                                            )}

                                                            <td className="text-white font-medium text-right pr-4">
                                                                {formatCryptoPrice((() => {
                                                                    // Direct USD value if available
                                                                    if (action.swapAmountUsd && action.swapAmountUsd > 0) return action.swapAmountUsd;
                                                                    if (action.transferValueUsd && action.transferValueUsd > 0) return action.transferValueUsd;
                                                                    if (action.transferAmountUsd && action.transferAmountUsd > 0) return action.transferAmountUsd;
                                                                    
                                                                    // Calculate from amount * price as fallback
                                                                    const inValue = (action.swapAmountIn ?? 0) * (action.swapPriceUsdTokenIn ?? 0);
                                                                    const outValue = (action.swapAmountOut ?? 0) * (action.swapPriceUsdTokenOut ?? 0);
                                                                    if (inValue > 0 || outValue > 0) return Math.max(inValue, outValue);
                                                                    
                                                                    return 0;
                                                                })())}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                
                                                {/* Fees breakdown row - only show if there's actual fee data */}
                                                {/* Use feesBreakdown and platform computed at row level */}
                                                {(() => {
                                                    const hasGas = feesBreakdown.gasFeesUSD && feesBreakdown.gasFeesUSD > 0;
                                                    const hasPlatformFee = feesBreakdown.platformFeesUSD && feesBreakdown.platformFeesUSD > 0;
                                                    const hasMev = feesBreakdown.mevFeesUSD && feesBreakdown.mevFeesUSD > 0;
                                                    const totalFee = feesBreakdown.totalFeesUSD ?? tx.txFeesNativeUsd ?? 0;
                                                    const hasTotal = totalFee > 0;
                                                    
                                                    if (!hasGas && !hasPlatformFee && !hasMev && !hasTotal && !platform) return null;
                                                    
                                                    return (
                                                        <tr className="bg-bgPrimary h-9 border-b border-borderDefault">
                                                            <td></td>
                                                            <td colSpan={6} className="py-2">
                                                                <div className="flex items-center gap-4 text-[10px]">
                                                                    <span className="text-textTertiary font-semibold uppercase tracking-wider">Fees:</span>
                                                                    {hasGas && (
                                                                        <span className="flex items-center gap-1">
                                                                            <span className="text-textTertiary">Gas:</span>
                                                                            <span className="text-white">{formatCryptoPrice(feesBreakdown.gasFeesUSD!)}</span>
                                                                        </span>
                                                                    )}
                                                                    {hasPlatformFee && (
                                                                        <span className="flex items-center gap-1">
                                                                            <span className="text-textTertiary">Platform:</span>
                                                                            <span className="text-white">{formatCryptoPrice(feesBreakdown.platformFeesUSD!)}</span>
                                                                        </span>
                                                                    )}
                                                                    {hasMev && (
                                                                        <span className="flex items-center gap-1">
                                                                            <span className="text-errorBright">MEV:</span>
                                                                            <span className="text-errorBright">{formatCryptoPrice(feesBreakdown.mevFeesUSD!)}</span>
                                                                        </span>
                                                                    )}
                                                                    {hasTotal && (
                                                                        <span className="flex items-center gap-1 ml-auto">
                                                                            <span className="text-textTertiary">Total:</span>
                                                                            <span className="text-white font-medium">{formatCryptoPrice(totalFee)}</span>
                                                                        </span>
                                                                    )}
                                                                    {platform && (
                                                                        <span className="flex items-center gap-1 ml-4">
                                                                            <span className="text-textTertiary">via</span>
                                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-bgMuted text-white font-medium">
                                                                                {platformLogo && (
                                                                                    <Image src={platformLogo} width={12} height={12} alt={platform} className="rounded-full" />
                                                                                )}
                                                                                {platform}
                                                                            </span>
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })()}
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
