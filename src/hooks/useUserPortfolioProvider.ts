'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useWalletConnectionStore } from '@/store/useWalletConnectionStore';
import { useUserPortfolioStore, type UserPosition } from '@/store/useUserPortfolioStore';
import { useTradingPanelStore } from '@/store/useTradingPanelStore';
import { sdk, streams } from '@/lib/sdkClient';
import { extractWalletTokens, isNativeAddress, getNativeAddress, getNativeSymbol, getNativeName } from '@/lib/tokens';
import { toBlockchain } from '@/lib/format';
import { UpdateBatcher } from '@/utils/UpdateBatcher';
import type {
  AnalysisData,
  PositionEntry,
  ActivityEntry,
} from '@/features/portfolio/types';

const PORTFOLIO_POLL_MS = 60_000;

type StreamSubscription = { unsubscribe: () => void };

interface PortfolioAsset {
  asset?: {
    name?: string;
    symbol?: string;
    logo?: string;
    price?: number;
    market_cap?: number;
  };
  name?: string;
  symbol?: string;
  logo?: string;
  image?: string;
  price?: number;
  market_cap?: number;
  estimated_balance?: number;
  balanceUSD?: number;
  token_balance?: number;
  balance?: number;
  contracts_balances?: Array<{
    address?: string;
    balance?: number;
    balanceUsd?: number;
    balance_usd?: number;
    blockchain?: string;
    chainId?: string;
    decimals?: number;
  }>;
}

interface PortfolioResponse {
  data?: {
    total_wallet_balance?: number;
    assets?: PortfolioAsset[];
  };
}

/** Data shape from the "positions" (plural) WSS — all wallet positions at once */
interface PositionsWssItem {
  token: string;
  chainId?: string;
  balance?: number;
  amountUSD?: number;
  unrealizedPnlUSD?: number;
  totalPnlUSD?: number;
  realizedPnlUSD?: number;
  avgBuyPriceUSD?: number;
  avgSellPriceUSD?: number;
  volumeBuy?: number;
  volumeSell?: number;
  tokenDetails?: {
    address?: string;
    chainId?: string;
    name?: string;
    symbol?: string;
    decimals?: number;
    logo?: string | null;
    price?: number;
    priceChange24h?: number | null;
    liquidity?: number | null;
    marketCap?: number | null;
  };
}

interface PositionsResponse {
  data?: PositionEntry[];
}

interface ActivityResponse {
  data?: ActivityEntry[];
}

interface HistoryResponse {
  data?: {
    balance_history?: Array<[number, number]>;
  };
}

type PositionBatchEntry = {
  address: string;
  update: Partial<Pick<UserPosition, 'balance' | 'balanceUSD' | 'unrealizedPnlUSD' | 'totalPnlUSD' | 'realizedPnlUSD' | 'avgBuyPriceUSD' | 'avgSellPriceUSD' | 'volumeBuy' | 'volumeSell'>>;
};

// Access store actions outside React render — stable references, no re-renders
const getStore = () => useUserPortfolioStore.getState();

/**
 * Global provider that manages the user's portfolio data.
 * Mount once in the app layout — all other components read from the store.
 *
 * PERF: This hook subscribes to minimal reactive state (refreshTrigger, wallet connection).
 * All store actions are accessed via getState() to avoid re-renders on every position update.
 */
export function useUserPortfolioProvider() {
  const evmAddress = useWalletConnectionStore((s) => s.evmAddress);
  const solanaAddress = useWalletConnectionStore((s) => s.solanaAddress);
  const isEvmConnected = useWalletConnectionStore((s) => s.isEvmConnected);
  const isSolanaConnected = useWalletConnectionStore((s) => s.isSolanaConnected);
  const isConnected = isEvmConnected || isSolanaConnected;

  const walletAddress = solanaAddress || evmAddress || null;

  // Only subscribe to reactive triggers — actions accessed via getState()
  const refreshTrigger = useUserPortfolioStore((s) => s.refreshTrigger);
  const balanceRefreshTrigger = useTradingPanelStore((s) => s.balanceRefreshTrigger);

  const positionSubsRef = useRef<StreamSubscription[]>([]);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const prevWalletRef = useRef<string | null>(null);
  const pageDataFetchedRef = useRef<string | null>(null);

  // WSS position update batcher — collects updates per rAF frame, flushes once
  const positionBatcherRef = useRef<UpdateBatcher<PositionBatchEntry> | null>(null);
  if (!positionBatcherRef.current) {
    positionBatcherRef.current = new UpdateBatcher<PositionBatchEntry>((entries) => {
      const updates = new Map<string, PositionBatchEntry['update']>();
      // Last update per address wins (most recent data)
      for (const entry of entries) {
        updates.set(entry.address, entry.update);
      }
      getStore().batchUpdatePositions(updates);
    });
  }

  // Parse portfolio response into UserPosition[]
  const parsePositions = useCallback((assets: PortfolioAsset[]): UserPosition[] => {
    const positions: UserPosition[] = [];

    for (const a of assets) {
      const assetObj = a.asset;
      const symbol = String(assetObj?.symbol || a.symbol || '???');
      const name = String(assetObj?.name || a.name || '');
      const logo = (assetObj?.logo as string) || (a.logo as string) || (a.image as string) || null;
      const price = Number(assetObj?.price || a.price || 0);
      const marketCap = Number(assetObj?.market_cap || a.market_cap || 0);

      const contracts = a.contracts_balances;
      if (contracts && contracts.length > 0) {
        for (const c of contracts) {
          const addr = String(c.address || '');
          const bal = Number(c.balance || 0);
          if (bal <= 0) continue;
          const balUSD = Number(c.balanceUsd || c.balance_usd || 0) || bal * price;
          const blockchain = String(c.blockchain || c.chainId || '');

          // For native tokens, use chain-specific address/symbol/name
          // The API groups all natives under "Ethereum" which is wrong for Solana
          const isNative = isNativeAddress(addr);
          const posAddr = isNative ? getNativeAddress(blockchain) : addr;
          const posSymbol = isNative ? getNativeSymbol(blockchain) : symbol;
          const posName = isNative ? getNativeName(blockchain) : name;

          positions.push({
            address: posAddr,
            chainId: blockchain,
            blockchain: toBlockchain(blockchain),
            symbol: posSymbol,
            name: posName,
            logo,
            decimals: Number(c.decimals || 0),
            balance: bal,
            balanceUSD: balUSD,
            priceUSD: price || (bal > 0 ? balUSD / bal : 0),
            marketCap,
            unrealizedPnlUSD: 0,
            totalPnlUSD: 0,
            realizedPnlUSD: 0,
            avgBuyPriceUSD: 0,
            avgSellPriceUSD: 0,
            volumeBuy: 0,
            volumeSell: 0,
          });
        }
      } else {
        const addr = String((a as Record<string, unknown>).address || assetObj?.name || '');
        const bal = Number(a.token_balance ?? a.balance ?? 0);
        if (bal <= 0) continue;
        const balUSD = Number(a.estimated_balance ?? a.balanceUSD ?? 0) || bal * price;

        positions.push({
          address: addr,
          chainId: '',
          blockchain: '',
          symbol,
          name,
          logo,
          decimals: 0,
          balance: bal,
          balanceUSD: balUSD,
          priceUSD: price || (bal > 0 ? balUSD / bal : 0),
          marketCap,
          unrealizedPnlUSD: 0,
          totalPnlUSD: 0,
          realizedPnlUSD: 0,
          avgBuyPriceUSD: 0,
          avgSellPriceUSD: 0,
          volumeBuy: 0,
          volumeSell: 0,
        });
      }
    }

    // Preserve existing real-time WSS data when re-parsing from REST
    // Use Map for O(1) lookups instead of O(n²) nested find
    const existingPositions = getStore().positions;
    if (existingPositions.length > 0) {
      const existingMap = new Map<string, UserPosition>();
      for (const e of existingPositions) {
        existingMap.set(e.address.toLowerCase(), e);
      }
      for (const pos of positions) {
        const existing = existingMap.get(pos.address.toLowerCase());
        if (existing) {
          pos.unrealizedPnlUSD = existing.unrealizedPnlUSD;
          pos.totalPnlUSD = existing.totalPnlUSD;
          pos.realizedPnlUSD = existing.realizedPnlUSD;
          pos.avgBuyPriceUSD = existing.avgBuyPriceUSD;
          pos.avgSellPriceUSD = existing.avgSellPriceUSD;
          pos.volumeBuy = existing.volumeBuy;
          pos.volumeSell = existing.volumeSell;
        }
      }
    }

    // Sort by balanceUSD desc
    positions.sort((a, b) => b.balanceUSD - a.balanceUSD);
    return positions;
  }, []);

  // Fetch portfolio for a single wallet address
  const fetchSinglePortfolio = useCallback(async (wallet: string): Promise<{ assets: PortfolioAsset[]; totalBalance: number } | null> => {
    try {
      const resp = (await sdk.fetchWalletPortfolio({ wallet })) as PortfolioResponse;
      const assets = resp?.data?.assets;
      if (!assets || !Array.isArray(assets)) {
        console.warn('[UserPortfolio] No assets in response for', wallet.slice(0, 8), { hasData: !!resp?.data, assetsType: typeof assets });
        return null;
      }
      const totalBalance = resp.data?.total_wallet_balance ?? 0;
      console.log('[UserPortfolio] Fetched', wallet.slice(0, 8), '→', assets.length, 'assets, $' + totalBalance.toFixed(2));
      return { assets, totalBalance };
    } catch (err) {
      console.error('[UserPortfolio] Fetch failed for', wallet.slice(0, 8), err);
      return null;
    }
  }, []);

  // Fetch portfolio from API — fetches both wallets when both connected, merges results
  const fetchPortfolio = useCallback(async (_wallet: string) => {
    const walletsToFetch: string[] = [];
    if (solanaAddress) walletsToFetch.push(solanaAddress);
    if (evmAddress) walletsToFetch.push(evmAddress);
    if (walletsToFetch.length === 0) {
      console.warn('[UserPortfolio] No wallets to fetch (sol:', !!solanaAddress, 'evm:', !!evmAddress, ')');
      return;
    }

    console.log('[UserPortfolio] Fetching', walletsToFetch.length, 'wallet(s):', walletsToFetch.map(w => w.slice(0, 8)));

    // Deduplicate (shouldn't happen, but safety)
    const unique = [...new Set(walletsToFetch)];
    const results = await Promise.all(unique.map(fetchSinglePortfolio));

    // Merge all assets from all wallets
    const allAssets: PortfolioAsset[] = [];
    let totalBalance = 0;
    for (const result of results) {
      if (!result) continue;
      allAssets.push(...result.assets);
      totalBalance += result.totalBalance;
    }

    if (allAssets.length === 0) {
      // Still update totalBalance even if no parseable assets
      console.warn('[UserPortfolio] No assets after merge, totalBalance:', totalBalance);
      if (totalBalance > 0) {
        getStore().setTotalBalance(totalBalance);
      }
      return;
    }

    const positions = parsePositions(allAssets);
    const walletTokens = extractWalletTokens(allAssets as Array<Record<string, unknown>>);

    // OBSERVABILITY: Detect when REST poll loses positions compared to current store
    const existingPositions = getStore().positions;
    if (existingPositions.length > 0 && positions.length < existingPositions.length) {
      const existingAddrs = new Set(existingPositions.map((p) => p.address.toLowerCase()));
      const newAddrs = new Set(positions.map((p) => p.address.toLowerCase()));
      const lostAddrs = [...existingAddrs].filter((a) => !newAddrs.has(a));
      if (lostAddrs.length > 0) {
        const lostPositions = existingPositions.filter((p) => lostAddrs.includes(p.address.toLowerCase()));
        console.warn('[PORTFOLIO_POSITIONS_LOST_ON_POLL] REST poll returned fewer positions than current store', {
          previousCount: existingPositions.length,
          newCount: positions.length,
          lostCount: lostAddrs.length,
          lostPositions: lostPositions.map((p) => ({
            symbol: p.symbol,
            address: p.address.slice(0, 10),
            balance: p.balance,
            balanceUSD: p.balanceUSD,
          })),
          restAssetsCount: allAssets.length,
        });
      }
    }

    // Single store update
    console.log('[UserPortfolio] Storing:', positions.length, 'positions,', walletTokens.length, 'tokens, $' + totalBalance.toFixed(2),
      walletTokens.map(t => `${t.symbol}(${t.blockchain}):$${t.balanceUSD.toFixed(2)}`));
    getStore().setPortfolioData(positions, walletTokens, totalBalance);
  }, [parsePositions, fetchSinglePortfolio, solanaAddress, evmAddress]);

  // Preload portfolio page data (analysis, positions, activity, history)
  const fetchPortfolioPageData = useCallback(async (wallet: string) => {
    // Only fetch once per wallet
    if (pageDataFetchedRef.current === wallet) return;

    // Use Promise.allSettled so a failure in positions/activity doesn't lose analysis data
    const [analysisResult, positionsResult, activityResult] = await Promise.allSettled([
      sdk.fetchWalletAnalysis({ wallet, period: '30d' }) as Promise<{ data?: AnalysisData }>,
      sdk.fetchWalletPositions({ wallet, sortBy: 'lastActivity', order: 'desc', limit: 100 }) as Promise<PositionsResponse>,
      sdk.fetchWalletActivity({ wallet, limit: 50, order: 'desc' }) as Promise<ActivityResponse>,
    ]);

    const analysisRes = analysisResult.status === 'fulfilled' ? analysisResult.value : null;
    const positionsRes = positionsResult.status === 'fulfilled' ? positionsResult.value : null;
    const activityRes = activityResult.status === 'fulfilled' ? activityResult.value : null;

    if (analysisResult.status === 'rejected') console.error('[UserPortfolio] Analysis preload failed:', analysisResult.reason);
    if (positionsResult.status === 'rejected') console.error('[UserPortfolio] Positions preload failed:', positionsResult.reason);
    if (activityResult.status === 'rejected') console.error('[UserPortfolio] Activity preload failed:', activityResult.reason);

    // Only mark as fetched if analysis succeeded (most critical for PnL chart)
    if (analysisRes) {
      pageDataFetchedRef.current = wallet;
    }

    const detailedPositions = positionsRes?.data ?? [];
    getStore().setPortfolioPageData({
      analysisData: analysisRes?.data ?? null,
      detailedPositions,
      activityEntries: activityRes?.data ?? [],
    });

    // Cross-reference detailed position PnL data back into the main positions array
    // so PositionsBar and ProTab have avgBuyPriceUSD, avgSellPriceUSD, etc. on page load
    if (detailedPositions.length > 0) {
      const updates = new Map<string, Partial<Pick<UserPosition, 'unrealizedPnlUSD' | 'totalPnlUSD' | 'realizedPnlUSD' | 'avgBuyPriceUSD' | 'avgSellPriceUSD' | 'volumeBuy' | 'volumeSell'>>>();
      for (const dp of detailedPositions) {
        if (!dp.token?.address) continue;
        updates.set(dp.token.address, {
          unrealizedPnlUSD: dp.unrealizedPnlUSD ?? 0,
          totalPnlUSD: dp.totalPnlUSD ?? 0,
          realizedPnlUSD: dp.realizedPnlUSD ?? 0,
          avgBuyPriceUSD: dp.avgBuyPriceUSD ?? 0,
          avgSellPriceUSD: dp.avgSellPriceUSD ?? 0,
          volumeBuy: dp.volumeBuy ?? 0,
          volumeSell: dp.volumeSell ?? 0,
        });
      }
      if (updates.size > 0) {
        getStore().batchUpdatePositions(updates);
      }
    }

    // Fetch history separately (can be slower)
    try {
      getStore().setHistoryLoading(true);
      const now = Date.now();
      const from = (now - 2592000000).toString(); // 30d
      const to = now.toString();
      const histRes = await sdk.fetchWalletHistory({ wallet, from, to }) as HistoryResponse;

      if (histRes?.data?.balance_history) {
        getStore().setBalanceHistory(
          histRes.data.balance_history.map(([ts, val]) => ({
            date: new Date(ts).toISOString(),
            value: val,
          }))
        );
      }
    } catch (err) {
      console.error('[UserPortfolio] History preload failed:', err);
    } finally {
      getStore().setHistoryLoading(false);
    }
  }, []);

  // Build a batch entry from a single position WSS item
  const buildBatchEntry = useCallback((item: PositionsWssItem): PositionBatchEntry | null => {
    const address = item.token || item.tokenDetails?.address;
    if (!address) return null;

    const update: PositionBatchEntry['update'] = {};
    if (item.balance != null) update.balance = item.balance;
    if (item.amountUSD != null) update.balanceUSD = item.amountUSD;
    if (item.unrealizedPnlUSD != null) update.unrealizedPnlUSD = item.unrealizedPnlUSD;
    if (item.totalPnlUSD != null) update.totalPnlUSD = item.totalPnlUSD;
    if (item.realizedPnlUSD != null) update.realizedPnlUSD = item.realizedPnlUSD;
    if (item.avgBuyPriceUSD != null) update.avgBuyPriceUSD = item.avgBuyPriceUSD;
    if (item.avgSellPriceUSD != null) update.avgSellPriceUSD = item.avgSellPriceUSD;
    if (item.volumeBuy != null) update.volumeBuy = item.volumeBuy;
    if (item.volumeSell != null) update.volumeSell = item.volumeSell;

    if (Object.keys(update).length === 0) return null;
    return { address, update };
  }, []);

  // Subscribe WSS "positions" (plural) for real-time updates on ALL wallet positions
  // This gives instant balance/PnL updates within ~100ms of any swap
  const subscribePositions = useCallback(
    (wallet: string, positions: UserPosition[]) => {
      // Unsubscribe previous
      for (const sub of positionSubsRef.current) sub.unsubscribe();
      positionSubsRef.current = [];

      const batcher = positionBatcherRef.current;

      // Determine blockchain(s) to subscribe — use the first position's blockchain
      // or default to 'solana' if Solana wallet is present
      const blockchains = new Set<string>();
      for (const pos of positions) {
        if (pos.blockchain) {
          // Normalize to base chain family for subscription
          const bc = pos.blockchain.toLowerCase();
          if (bc.startsWith('solana') || bc === 'solana') blockchains.add('solana');
          else if (bc.startsWith('evm')) blockchains.add(bc);
        }
      }
      // Fallback
      if (blockchains.size === 0) blockchains.add('solana');

      // Subscribe to "positions" (plural) per blockchain — covers ALL tokens at once
      // NO individual "position" subs — positions (plural) is the single source of truth
      for (const blockchain of blockchains) {
        try {
          console.log('[UserPortfolio] Subscribing positions WSS for', wallet.slice(0, 8), blockchain);
          const sub = streams.subscribePositions(
            {
              wallet,
              blockchain,
              subscriptionTracking: true,
              useSwapRecipient: true,
              includeFees: false,
            },
            (raw: unknown) => {
              const msg = raw as Record<string, unknown>;
              if (!msg) return;

              // The WSS may send data wrapped ({ data: { positions: [...] } })
              // or directly ({ wallet, chainId, positions: [...] })
              const inner = (msg.data as Record<string, unknown>) || msg;
              const items = inner.positions as PositionsWssItem[] | undefined;

              if (Array.isArray(items)) {
                // Full positions snapshot — apply as batch AND create new positions
                getStore().applyPositionsSnapshot(items.map((item) => {
                  const rawAddr = item.token || item.tokenDetails?.address || '';
                  // Normalize native addresses to the correct chain-specific form
                  // (WSS may send 0xEEEE… for Solana SOL — must become So111…)
                  const address = isNativeAddress(rawAddr) ? getNativeAddress(blockchain) : rawAddr;
                  return {
                    address,
                  chainId: item.chainId || blockchain,
                  blockchain,
                  symbol: item.tokenDetails?.symbol || '',
                  name: item.tokenDetails?.name || '',
                  logo: item.tokenDetails?.logo || null,
                  decimals: item.tokenDetails?.decimals || 0,
                  balance: item.balance ?? 0,
                  balanceUSD: item.amountUSD ?? 0,
                  priceUSD: item.tokenDetails?.price || (item.balance && item.amountUSD ? item.amountUSD / item.balance : 0),
                  marketCap: item.tokenDetails?.marketCap ?? 0,
                  unrealizedPnlUSD: item.unrealizedPnlUSD ?? 0,
                  totalPnlUSD: item.totalPnlUSD ?? 0,
                  realizedPnlUSD: item.realizedPnlUSD ?? 0,
                  avgBuyPriceUSD: item.avgBuyPriceUSD ?? 0,
                  avgSellPriceUSD: item.avgSellPriceUSD ?? 0,
                  volumeBuy: item.volumeBuy ?? 0,
                  volumeSell: item.volumeSell ?? 0,
                };}));
                return;
              }

              // Handle single position update
              const token = (inner.token as string) || (inner as PositionsWssItem).tokenDetails?.address;
              if (token) {
                const entry = buildBatchEntry(inner as PositionsWssItem);
                if (entry) {
                  // Normalize native addresses for single updates too
                  if (isNativeAddress(entry.address)) {
                    entry.address = getNativeAddress(blockchain);
                  }
                  batcher?.add(entry);
                }
              }
            }
          );
          positionSubsRef.current.push(sub);
        } catch {
          // Silently ignore sub failures
        }
      }
    },
    [buildBatchEntry]
  );

  // Main effect: fetch + poll + subscribe
  useEffect(() => {
    console.log('[UserPortfolio] Effect:', { isConnected, walletAddress: walletAddress?.slice(0, 8), sol: solanaAddress?.slice(0, 8), evm: evmAddress?.slice(0, 8) });
    if (!isConnected || !walletAddress) {
      getStore().reset();
      prevWalletRef.current = null;
      pageDataFetchedRef.current = null;
      return;
    }

    // If wallet changed, clean up first
    if (prevWalletRef.current !== walletAddress) {
      for (const sub of positionSubsRef.current) sub.unsubscribe();
      positionSubsRef.current = [];
      prevWalletRef.current = walletAddress;
      pageDataFetchedRef.current = null;
    }

    // Only show loading state if we have NO preloaded data.
    // When positions already exist (e.g. navigating back to portfolio),
    // keep showing them instead of flashing skeletons.
    const hasPreloadedData = getStore().positions.length > 0;
    if (!hasPreloadedData) {
      getStore().setLoading(true);
    }

    const doFetch = async () => {
      await fetchPortfolio(walletAddress);
      getStore().setLoading(false);

      // After first fetch, subscribe to WSS for top positions
      const currentPositions = getStore().positions;
      subscribePositions(walletAddress, currentPositions);

      // Preload portfolio page data in background
      fetchPortfolioPageData(walletAddress);
    };

    doFetch();

    // Poll interval
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      fetchPortfolio(walletAddress);
    }, PORTFOLIO_POLL_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      for (const sub of positionSubsRef.current) sub.unsubscribe();
      positionSubsRef.current = [];
      positionBatcherRef.current?.clear();
    };
  }, [isConnected, walletAddress, fetchPortfolio, fetchPortfolioPageData, subscribePositions]);

  // Re-fetch on swap or global refresh trigger (single effect instead of two)
  useEffect(() => {
    if ((balanceRefreshTrigger === 0 && refreshTrigger === 0) || !walletAddress) return;
    fetchPortfolio(walletAddress);
    pageDataFetchedRef.current = null;
    fetchPortfolioPageData(walletAddress);
  }, [balanceRefreshTrigger, refreshTrigger, walletAddress, fetchPortfolio, fetchPortfolioPageData]);
}
