'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { sdk } from '@/lib/sdkClient';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useUserPortfolioStore } from '@/store/useUserPortfolioStore';

// Re-export types so existing component imports don't break
export type {
  AnalysisData,
  PortfolioAsset,
  PositionEntry,
  ActivityEntry,
} from '../types';

import type { AnalysisData, PositionEntry, ActivityEntry } from '../types';

interface PortfolioResponse {
  data?: {
    total_wallet_balance?: number;
    totalBalanceUSD?: number;
    assetsCount?: number;
    balances_length?: number;
    assets?: Array<Record<string, unknown>>;
  };
}

interface PositionsResponse {
  data?: PositionEntry[];
  pagination?: { page: number; offset: number; limit: number; pageEntries: number };
}

interface ActivityResponse {
  data?: ActivityEntry[];
  pagination?: { page: number; offset: number; limit: number; pageEntries: number };
}

interface HistoryResponse {
  data?: {
    balance_history?: Array<[number, number]>;
  };
}

type Period = '1d' | '7d' | '30d' | 'max';

const PERIOD_MS: Record<Period, number> = { '1d': 86400000, '7d': 604800000, '30d': 2592000000, 'max': 0 };

export type SelectedWalletType = 'all' | 'solana' | 'evm';

export function usePortfolioData() {
  const { solanaAddress, evmAddress } = useWalletConnection();

  const [selectedWalletType, setSelectedWalletType] = useState<SelectedWalletType>('all');
  const [searchWallet, setSearchWallet] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('30d');
  const [positionsTab, setPositionsTab] = useState<'active' | 'history' | 'top100' | 'calendar'>('active');

  // Reset selection when wallets change (connect/disconnect)
  const prevSolRef = useRef(solanaAddress);
  const prevEvmRef = useRef(evmAddress);
  useEffect(() => {
    if (prevSolRef.current !== solanaAddress || prevEvmRef.current !== evmAddress) {
      prevSolRef.current = solanaAddress;
      prevEvmRef.current = evmAddress;
      setSelectedWalletType('all');
    }
  }, [solanaAddress, evmAddress]);

  // Derive active wallet based on selection
  const primaryWallet = solanaAddress || evmAddress || null;
  const connectedWallet = selectedWalletType === 'solana'
    ? solanaAddress ?? null
    : selectedWalletType === 'evm'
      ? evmAddress ?? null
      : primaryWallet;

  const wallet = searchWallet || connectedWallet;
  // Only use preloaded data when viewing the same wallet that was preloaded (primary)
  const isUsingPreloaded = !searchWallet && !!connectedWallet && connectedWallet === primaryWallet;

  // Read preloaded data from global store
  const storePortfolio = useUserPortfolioStore((s) => s.portfolioResponse);
  const storeAnalysis = useUserPortfolioStore((s) => s.analysisData);
  const storePositions = useUserPortfolioStore((s) => s.detailedPositions);
  const storeActivity = useUserPortfolioStore((s) => s.activityEntries);
  const storeHistory = useUserPortfolioStore((s) => s.balanceHistory);
  const storePageReady = useUserPortfolioStore((s) => s.pageDataReady);
  const storeLoading = useUserPortfolioStore((s) => s.isLoading);
  const storeHistoryLoading = useUserPortfolioStore((s) => s.isHistoryLoading);
  const storeTotalBalance = useUserPortfolioStore((s) => s.totalBalanceUsd);

  // Local state for searched wallet data
  const [searchPortfolio, setSearchPortfolio] = useState<PortfolioResponse | null>(null);
  const [searchAnalysis, setSearchAnalysis] = useState<{ data?: AnalysisData } | null>(null);
  const [searchPositions, setSearchPositions] = useState<PositionsResponse | null>(null);
  const [searchActivity, setSearchActivity] = useState<ActivityResponse | null>(null);
  const [searchHistory, setSearchHistory] = useState<Array<{ date: string; value: number }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHistoryLoading, setSearchHistoryLoading] = useState(false);

  // Period-specific overrides for connected wallet (preloaded data is always 30d)
  const [periodAnalysis, setPeriodAnalysis] = useState<{ data?: AnalysisData } | null>(null);
  const [periodHistory, setPeriodHistory] = useState<Array<{ date: string; value: number }> | null>(null);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [periodHistoryLoading, setPeriodHistoryLoading] = useState(false);
  const periodAbortRef = useRef<AbortController | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Fetch for searched wallets only
  const fetchAll = useCallback(async (w: string, p: Period) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setSearchLoading(true);

    const periodParam = p === 'max' ? '90d' : p;
    const now = Date.now();
    const from = p === 'max' ? undefined : (now - PERIOD_MS[p]).toString();
    const to = now.toString();

    try {
      const [portfolioRes, analysisRes, positionsRes, activityRes] = await Promise.all([
        sdk.fetchWalletPortfolio({ wallet: w }) as Promise<PortfolioResponse>,
        sdk.fetchWalletAnalysis({ wallet: w, period: periodParam }) as Promise<{ data?: AnalysisData }>,
        sdk.fetchWalletPositions({ wallet: w, sortBy: 'lastActivity', order: 'desc', limit: 100 }) as Promise<PositionsResponse>,
        sdk.fetchWalletActivity({ wallet: w, limit: 50, order: 'desc' }) as Promise<ActivityResponse>,
      ]);

      if (ctrl.signal.aborted) return;

      setSearchPortfolio(portfolioRes);
      setSearchAnalysis(analysisRes);
      setSearchPositions(positionsRes);
      setSearchActivity(activityRes);
    } catch (err) {
      if (!ctrl.signal.aborted) console.error('[Portfolio] Fetch failed:', err);
    } finally {
      if (!ctrl.signal.aborted) setSearchLoading(false);
    }

    // Fetch history separately
    try {
      setSearchHistoryLoading(true);
      const histRes = await sdk.fetchWalletHistory({
        wallet: w,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      }) as HistoryResponse;

      if (ctrl.signal.aborted) return;

      if (histRes?.data?.balance_history) {
        setSearchHistory(histRes.data.balance_history.map(([ts, val]) => ({
          date: new Date(ts).toISOString(),
          value: val,
        })));
      }
    } catch (err) {
      if (!ctrl.signal.aborted) console.error('[Portfolio] History fetch failed:', err);
    } finally {
      if (!ctrl.signal.aborted) setSearchHistoryLoading(false);
    }
  }, []);

  // Only fetch when searching a different wallet or changing period on search
  useEffect(() => {
    if (isUsingPreloaded || !wallet) {
      setSearchPortfolio(null);
      setSearchAnalysis(null);
      setSearchPositions(null);
      setSearchActivity(null);
      setSearchHistory([]);
      return;
    }
    fetchAll(wallet, period);
    return () => { abortRef.current?.abort(); };
  }, [wallet, period, isUsingPreloaded, fetchAll]);

  // Refetch analysis + history when period changes for connected wallet
  // (preloaded data is hardcoded to 30d — we need fresh data for other periods)
  useEffect(() => {
    if (!isUsingPreloaded || !connectedWallet) return;

    if (period === '30d' && storeAnalysis?.calendarBreakdown) {
      // 30d matches preloaded data AND analysis is available — clear overrides
      setPeriodAnalysis(null);
      setPeriodHistory(null);
      // Reset loading states that may have been set by a previous run of this effect
      // (e.g. preload hadn't finished yet → effect started a fetch → preload finished → effect re-ran)
      setPeriodLoading(false);
      setPeriodHistoryLoading(false);
      return;
    }

    // For non-30d periods, or 30d when preloaded analysis is missing, fetch fresh data
    periodAbortRef.current?.abort();
    const ctrl = new AbortController();
    periodAbortRef.current = ctrl;

    const periodParam = period === 'max' ? '90d' : period;
    const now = Date.now();
    const from = period === 'max' ? undefined : (now - PERIOD_MS[period]).toString();
    const to = now.toString();

    setPeriodLoading(true);
    sdk.fetchWalletAnalysis({ wallet: connectedWallet, period: periodParam })
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setPeriodAnalysis(res as { data?: AnalysisData });
      })
      .catch(() => {})
      .finally(() => { if (!ctrl.signal.aborted) setPeriodLoading(false); });

    setPeriodHistoryLoading(true);
    sdk.fetchWalletHistory({ wallet: connectedWallet, ...(from ? { from } : {}), ...(to ? { to } : {}) })
      .then((res) => {
        if (ctrl.signal.aborted) return;
        const histRes = res as HistoryResponse;
        if (histRes?.data?.balance_history) {
          setPeriodHistory(histRes.data.balance_history.map(([ts, val]) => ({
            date: new Date(ts).toISOString(),
            value: val,
          })));
        }
      })
      .catch(() => {})
      .finally(() => { if (!ctrl.signal.aborted) setPeriodHistoryLoading(false); });

    return () => { ctrl.abort(); };
  }, [period, isUsingPreloaded, connectedWallet, storeAnalysis]);

  // Resolve data source: preloaded store or search results
  const portfolio = isUsingPreloaded
    ? { data: { total_wallet_balance: storeTotalBalance, totalBalanceUSD: storeTotalBalance, assetsCount: storePositions.length, assets: storePortfolio?.assets } }
    : searchPortfolio;

  const analysis = isUsingPreloaded
    ? (periodAnalysis ?? (storeAnalysis ? { data: storeAnalysis } : null))
    : searchAnalysis;

  const positions = isUsingPreloaded
    ? { data: storePositions }
    : searchPositions;

  const activity = isUsingPreloaded
    ? { data: storeActivity }
    : searchActivity;

  const history = isUsingPreloaded ? (periodHistory ?? storeHistory) : searchHistory;
  const isLoading = isUsingPreloaded ? ((storeLoading && !storePageReady) || periodLoading) : searchLoading;
  const isHistoryLoading = isUsingPreloaded ? (storeHistoryLoading || periodHistoryLoading) : searchHistoryLoading;

  const stat = analysis?.data?.stat;
  const nativeBalanceUSD = stat?.nativeBalance?.balanceUSD ?? 0;
  const portfolioBalance = portfolio?.data?.total_wallet_balance ?? portfolio?.data?.totalBalanceUSD ?? 0;
  const totalValue = (portfolioBalance || analysis?.data?.stat?.totalValue || 0) + nativeBalanceUSD;
  const unrealizedPnl = stat?.periodTotalPnlUSD != null ? stat.periodTotalPnlUSD - (stat?.periodRealizedPnlUSD ?? 0) : 0;
  const realizedPnl = stat?.periodRealizedPnlUSD ?? 0;
  const totalPnl = stat?.periodTotalPnlUSD ?? 0;
  const totalTxns = stat?.periodActiveTokensCount ?? 0;
  const winCount = stat?.periodWinCount ?? 0;
  const winRate = stat?.winRealizedPnlRate ?? 0;
  const tradeableBalance = totalValue;

  const activePositions = (positions?.data ?? []).filter(p => p.balance > 0);

  // Default to top100 tab when no active positions exist
  useEffect(() => {
    if (!isLoading && positions?.data && activePositions.length === 0 && positionsTab === 'active') {
      setPositionsTab('top100');
    }
  }, [isLoading, positions?.data, activePositions.length, positionsTab]);

  return {
    wallet,
    connectedWallet,
    solanaAddress,
    evmAddress,
    searchWallet,
    setSearchWallet,
    selectedWalletType,
    setSelectedWalletType,
    period,
    setPeriod,
    positionsTab,
    setPositionsTab,
    portfolio,
    analysis,
    positions,
    activePositions,
    activity,
    history,
    isLoading,
    isHistoryLoading,
    totalValue,
    unrealizedPnl,
    realizedPnl,
    totalPnl,
    totalTxns,
    winCount,
    winRate,
    tradeableBalance,
  };
}
