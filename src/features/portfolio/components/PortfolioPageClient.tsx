'use client';

import { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { usePortfolioData } from '../hooks/usePortfolioData';
import { BalanceCard } from './BalanceCard';
import { PnlChart } from './PnlChart';
import { PerformanceCard } from './PerformanceCard';
import { PositionsTable } from './PositionsTable';
import { ActivityFeed } from './ActivityFeed';
import { WalletSelector } from './WalletSelector';
import { FiSearch } from 'react-icons/fi';
import { HiOutlineMenu } from 'react-icons/hi';

/** Returns true if the string looks like a wallet address (Solana base58 or EVM 0x) */
function looksLikeWallet(input: string): boolean {
  const trimmed = input.trim();
  // EVM: 0x + 40 hex chars
  if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return true;
  // Solana: base58, typically 32-44 chars
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) return true;
  return false;
}

type Period = '1d' | '7d' | '30d' | 'max';

export default function PortfolioPageClient() {
  const {
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
    activePositions,
    positions,
    activity,
    history,
    isLoading,
    isHistoryLoading,
    totalValue,
    realizedPnl,
    totalPnl,
    totalTxns,
    winCount,
    tradeableBalance,
  } = usePortfolioData();

  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-detect wallet address and fetch / clear automatically
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (looksLikeWallet(trimmed)) {
        // Detected a wallet — fetch it
        if (trimmed !== searchWallet) setSearchWallet(trimmed);
      } else if (searchWallet) {
        // Input no longer looks like a wallet — reset to connected wallet
        setSearchWallet(null);
      }
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput, searchWallet, setSearchWallet]);

  const periods: Period[] = ['1d', '7d', '30d', 'max'];

  const shortWallet = wallet
    ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
    : '';

  const tokenCount = useMemo(() => {
    return portfolio?.data?.assetsCount ?? activePositions.length;
  }, [portfolio, activePositions]);

  const nativeBalance = useMemo(() => {
    const stat = analysis?.data?.stat;
    if (stat?.nativeBalance?.formattedBalance) {
      return Number(stat.nativeBalance.formattedBalance).toFixed(3);
    }
    return '0.000';
  }, [analysis]);

  // Build market cap map from positions + portfolio assets
  const marketCapMap = useMemo(() => {
    const map = new Map<string, number>();
    // From positions
    for (const pos of positions?.data ?? []) {
      if (pos.marketCapUSD && pos.marketCapUSD > 0) {
        map.set(`${pos.token.address}_${pos.token.chainId}`, pos.marketCapUSD);
      }
    }
    // From portfolio assets
    for (const asset of portfolio?.data?.assets ?? []) {
      if (asset.marketCapUSD && asset.marketCapUSD > 0) {
        for (const h of asset.holdings ?? []) {
          map.set(`${h.address}_${h.chainId}`, asset.marketCapUSD);
        }
      }
    }
    return map;
  }, [positions, portfolio]);

  return (
    <div className="bg-bgPrimary h-[calc(100vh-64px)] text-textPrimary flex flex-col overflow-hidden">
      {/* Top bar: Tabs + Search + Period */}
      <div className="flex items-center justify-between px-6 h-14 flex-shrink-0 border-b border-borderDefault">
        <div className="flex items-center gap-8">
          <span className="text-base font-semibold text-white cursor-pointer">Spot</span>
        </div>

        <div className="flex items-center gap-5">
          {/* Search wallet */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textTertiary" size={16} />
              <input
                type="text"
                placeholder="Search for other wallets..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className={`bg-bgOverlay border rounded-lg pl-10 pr-4 py-2 text-sm text-textPrimary placeholder-textTertiary w-72 focus:outline-none transition-colors ${
                  searchWallet ? 'border-success/50' : 'border-borderDefault focus:border-borderSecondary'
                }`}
              />
              {searchWallet && (
                <button
                  onClick={() => { setSearchInput(''); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-textTertiary hover:text-error transition-colors"
                  title="Clear"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Period buttons */}
          <div className="flex items-center gap-1.5">
            {periods.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  period === p
                    ? 'bg-bgTertiary text-white'
                    : 'text-textTertiary hover:text-white hover:bg-bgOverlay'
                }`}
              >
                {p === 'max' ? 'Max' : p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Wallet label bar */}
      {wallet && (
        <div className="flex items-center gap-5 px-6 h-12 flex-shrink-0 border-b border-borderDefault">
          <WalletSelector
            solanaAddress={solanaAddress ?? null}
            evmAddress={evmAddress ?? null}
            selectedWalletType={selectedWalletType}
            onSelect={setSelectedWalletType}
          />

          {Number(nativeBalance) > 0 && (
            <div className="flex items-center gap-2.5 text-sm text-textTertiary">
              <HiOutlineMenu size={16} />
              <span className="font-mono">{nativeBalance}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-textTertiary">
            <div className="w-4 h-4 rounded-[3px] bg-bgTertiary flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-[2px] bg-textTertiary" />
            </div>
            <span className="font-mono">{tokenCount}</span>
          </div>
        </div>
      )}

      {!wallet && (
        <div className="flex items-center justify-center flex-1 text-textTertiary text-sm">
          Connect a wallet or search for an address to view portfolio
        </div>
      )}

      {wallet && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Top section: Balance + Chart + Performance */}
          <div className="grid grid-cols-12 gap-0 border-b border-borderDefault h-[260px] flex-shrink-0">
            {/* Balance card */}
            <div className="col-span-3 border-r border-borderDefault p-4 overflow-y-auto scrollbar-hide">
              <BalanceCard
                totalValue={totalValue}
                realizedPnl={realizedPnl}
                tradeableBalance={tradeableBalance}
                isLoading={isLoading}
              />
            </div>

            {/* Realized PNL chart */}
            <div className="col-span-5 border-r border-borderDefault p-4 overflow-hidden">
              <PnlChart
                history={history}
                calendarBreakdown={analysis?.data?.calendarBreakdown}
                isLoading={isLoading || isHistoryLoading}
              />
            </div>

            {/* Performance */}
            <div className="col-span-4 p-4 overflow-y-auto scrollbar-hide">
              <PerformanceCard
                totalPnl={totalPnl}
                realizedPnl={realizedPnl}
                totalTxns={totalTxns}
                winCount={winCount}
                winRateDistribution={analysis?.data?.winRateDistribution}
                isLoading={isLoading}
              />
            </div>
          </div>

          {/* Bottom section: Positions + Activity */}
          <div className="grid grid-cols-12 gap-0 flex-1 min-h-0">
            {/* Positions table */}
            <div className="col-span-7 border-r border-borderDefault flex flex-col min-h-0">
              <PositionsTable
                activePositions={activePositions}
                allPositions={positions?.data ?? []}
                tab={positionsTab}
                onTabChange={setPositionsTab}
                isLoading={isLoading}
                walletAddress={wallet ?? undefined}
              />
            </div>

            {/* Activity feed */}
            <div className="col-span-5 flex flex-col min-h-0">
              <Suspense fallback={null}>
                <ActivityFeed
                  activities={activity?.data ?? []}
                  isLoading={isLoading}
                  marketCapMap={marketCapMap}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
