'use client';

import { useMemo, useEffect, useCallback, memo } from 'react';
import { Settings2, Funnel } from 'lucide-react';
import TradingViewChart from '@/components/charts';
import { TradesTable } from '@/components/tables/TradesTable';
import { HoldersTable } from '@/components/tables/HoldersTable';
import { TopTradersTable } from '@/components/tables/TopTradersTable';
import { DevTokensTable } from '@/components/tables/DevTokensTable';
import { MarketsTable } from '@/components/tables/MarketTable';
import { FilterModal } from '@/components/FilterModal';
import ResizablePanelsLayout from '@/components/shared/ResizablePanelLayout';
import { TokenDetailsResponse } from '@mobula_labs/types';
import { useCombinedHolders } from '@/features/pair/hooks/useCombinedHolders';
import { usePairHoldersStore } from '@/features/pair/store/usePairHolderStore';
import { useTradeSubscription } from '@/features/pair/hooks/useTradeSubscription';
import type { Transaction } from '@/features/pair/store/usePairTradeStore';
import { useTradingData } from '@/hooks/useTradingData';
import { useTradesPanelStore } from '@/store/useTradesPanelStore';
import { useFilterModalStore } from '@/store/useFilterModalStore';
import { useRenderCounter } from '@/utils/useRenderCounter';
import { shallow } from 'zustand/shallow';

interface TokenClientPanelsProps {
  tokenData: TokenDetailsResponse['data'];
  address: string;
  blockchain: string;
}

// Memoized action components to prevent re-creation
const HoldersActions = memo(({ onToggleTrades }: { onToggleTrades: () => void }) => (
  <>
    <button
      onClick={onToggleTrades}
      className="flex items-center rounded-md hover:bg-bgContainer gap-1.5 px-2 py-1 text-xs font-medium text-grayGhost hover:text-white transition-colors"
    >
      <span>Trades Panel</span>
    </button>
  </>
));
HoldersActions.displayName = 'HoldersActions';

const TopTradersActions = memo(({ onToggleTrades }: { onToggleTrades: () => void }) => (
  <>
    <button
      onClick={onToggleTrades}
      className="flex items-center rounded-md hover:bg-bgContainer gap-1.5 px-2 py-1 text-xs font-medium text-grayGhost hover:text-white transition-colors"
    >
      <span>Trades Panel</span>
    </button>
  </>
));
TopTradersActions.displayName = 'TopTradersActions';

const TradesActions = memo(({ 
  deployer, 
  isDevFilterActive, 
  onToggleTrades, 
  onToggleDevFilter, 
  onOpenModal 
}: { 
  deployer?: string;
  isDevFilterActive: boolean;
  onToggleTrades: () => void;
  onToggleDevFilter: () => void;
  onOpenModal: () => void;
}) => (
  <>
    <button
      onClick={onToggleTrades}
      className="flex items-center rounded-md hover:bg-bgContainer gap-1.5 px-2 py-1 text-xs font-medium text-grayGhost hover:text-white transition-colors"
    >
      <span>Trades Panel</span>
    </button>
    {deployer && (
      <button
        className={`flex items-center rounded-md gap-1.5 px-2 py-1 text-xs font-medium transition-colors ${isDevFilterActive
          ? 'bg-success text-white hover:bg-success/80'
          : 'hover:bg-bgContainer text-grayGhost hover:text-white'
          }`}
        onClick={onToggleDevFilter}
      >
        <Funnel size={13} className={isDevFilterActive ? 'text-white' : 'text-textPrimary'} />
        <span>DEV</span>
      </button>
    )}
    <button
      onClick={onOpenModal}
      className="flex items-center justify-center p-1.5 text-[#6B7280] hover:text-white transition-colors"
    >
      <Settings2 size={16} className='text-textPrimary hover:text-success' />
    </button>
  </>
));
TradesActions.displayName = 'TradesActions';

function TokenResizablePanelsComponent({
  tokenData,
  address,
  blockchain,
}: TokenClientPanelsProps) {
  // Render counter for diagnostics
  useRenderCounter('TokenResizablePanels');

  // 🔹 Hooks - Use granular selectors to prevent unnecessary re-renders
  // Only subscribe to what we actually need, not the entire store
  // Extract individual filter values to prevent re-renders when object reference changes
  const filterWallet = useFilterModalStore((s) => s.currentFilters.wallet);
  const filterType = useFilterModalStore((s) => s.currentFilters.type);
  const filterMin = useFilterModalStore((s) => s.currentFilters.min);
  const filterMax = useFilterModalStore((s) => s.currentFilters.max);
  
  // Reconstruct currentFilters object only when values actually change
  const currentFilters = useMemo(() => ({
    wallet: filterWallet,
    type: filterType,
    min: filterMin,
    max: filterMax,
  }), [filterWallet, filterType, filterMin, filterMax]);
  
  // Use granular selectors for actions - these are stable function references
  const openModal = useFilterModalStore((s) => s.openModal);
  const setFilters = useFilterModalStore((s) => s.setFilters);
  const resetFilters = useFilterModalStore((s) => s.resetFilters);
  const toggleTrades = useTradesPanelStore((s) => s.toggleTrades);

  useEffect(() => {
    resetFilters();
  }, [address, blockchain, resetFilters]);

  useCombinedHolders(tokenData?.address, blockchain);
  // CRITICAL: Use subscription-only hook that doesn't subscribe to store state
  // This sets up WebSocket subscription but doesn't cause re-renders when trades update
  // TradesTable will subscribe to store directly for its own updates
  useTradeSubscription({ address, blockchain, isPair: false });
  // Use granular selector to prevent unnecessary re-renders
  const holdersCount = usePairHoldersStore((s) => s.holdersCount);

  // Use granular selector - only get markets, not entire hook return
  // This prevents re-renders when other trading data changes
  const tradingData = useTradingData(
    tokenData?.address,
    tokenData?.address,
    blockchain,
    tokenData?.deployer,
  );
  const markets = tradingData.markets;
  const tradeLoading = tradingData.isLoading.markets;

  // Stable callbacks
  const handleToggleTrades = useCallback(() => {
    toggleTrades();
  }, [toggleTrades]);

  // Memoize currentFilters.wallet to prevent unnecessary callback recreation
  const currentWalletFilter = useMemo(() => currentFilters.wallet, [currentFilters.wallet]);
  
  const handleToggleDevFilter = useCallback(() => {
    const isDevFilterActive = currentWalletFilter === tokenData.deployer;
    if (isDevFilterActive) {
      setFilters({ wallet: undefined });
    } else if (tokenData.deployer) {
      setFilters({ wallet: tokenData.deployer });
    }
  }, [currentWalletFilter, tokenData.deployer, setFilters]);

  const handleOpenModal = useCallback(() => {
    openModal();
  }, [openModal]);

  // Use memoized wallet filter for stable comparison
  const isDevFilterActive = currentWalletFilter === tokenData.deployer;

  // Memoize table components to prevent re-creation
  const holdersTable = useMemo(() => (
    <HoldersTable totalSupply={tokenData.totalSupply} />
  ), [tokenData.totalSupply]);

  const topTradersTable = useMemo(() => (
    <TopTradersTable
      blockchain={blockchain}
      tokenAddress={tokenData.address}
      totalSupply={tokenData.totalSupply ?? 0}
    />
  ), [blockchain, tokenData.address, tokenData.totalSupply]);

  // TradesTable subscribes to store internally - don't pass storeTrades prop
  // This prevents TokenResizablePanels from re-rendering when trades update
  const tradesTable = useMemo(() => (
    <TradesTable
      pair={{ address: address, blockchain }}
      storeTrades={[]} // Empty array - TradesTable will use store directly
      isPair={false}
    />
  ), [address, blockchain]); // NO tradesHook.wsTrades dependency!

  const devTokensTable = useMemo(() => (
    tokenData?.deployer ? (
      <DevTokensTable wallet={tokenData.deployer} blockchain={blockchain} />
    ) : null
  ), [tokenData?.deployer, blockchain]);

  // Memoize markets with shallow comparison - only update if markets array actually changed
  const marketsLength = Array.isArray(markets) ? markets.length : 0;
  const marketsTable = useMemo(() => (
    marketsLength > 0 && Array.isArray(markets) ? (
      <MarketsTable data={markets} />
    ) : null
  ), [markets, marketsLength]);

  // 🔹 Build Tabs Dynamically - memoized with stable references
  const tabs = useMemo(() => {
    const baseTabs = [
      {
        value: 'holders',
        label: `Holders (${holdersCount})`,
        content: holdersTable,
        actions: <HoldersActions onToggleTrades={handleToggleTrades} />,
      },
      {
        value: 'top-traders',
        label: 'Top Traders',
        content: topTradersTable,
        actions: <TopTradersActions onToggleTrades={handleToggleTrades} />,
      },
      {
        value: 'trades',
        label: 'Trades',
        content: tradesTable,
        actions: (
          <TradesActions
            deployer={tokenData.deployer ?? undefined}
            isDevFilterActive={isDevFilterActive}
            onToggleTrades={handleToggleTrades}
            onToggleDevFilter={handleToggleDevFilter}
            onOpenModal={handleOpenModal}
          />
        ),
      },
      tokenData?.deployer && devTokensTable && {
        value: 'dev-tokens',
        label: 'Dev Tokens',
        content: devTokensTable,
      },
      marketsLength > 0 && marketsTable && {
        value: 'markets',
        label: `${tokenData.symbol} Markets`,
        content: marketsTable,
      },
    ].filter(Boolean) as {
      value: string;
      label: string;
      content: React.ReactNode;
      actions?: React.ReactNode;
    }[];

    return baseTabs;
  }, [
    holdersCount,
    holdersTable,
    topTradersTable,
    tradesTable,
    devTokensTable,
    marketsTable,
    tokenData.deployer,
    tokenData.symbol,
    marketsLength,
    isDevFilterActive,
    currentWalletFilter,
    handleToggleTrades,
    handleToggleDevFilter,
    handleOpenModal,
    // REMOVED tradesHook.wsTrades - this was causing re-renders!
  ]);

  // 🔹 Safe type for base asset - memoized with stable reference
  const baseAsset = useMemo(
    () => ({
      address: tokenData?.address,
      asset: tokenData?.address,
      blockchain,
      symbol: tokenData?.symbol || '', // ensures type-safety
      priceUSD: tokenData?.priceUSD ?? 0, // avoids undefined
    }),
    [tokenData?.address, tokenData?.symbol, tokenData?.priceUSD, blockchain],
  );

  // Memoize chart component
  const chartComponent = useMemo(() => (
    <TradingViewChart
      isPair={false}
      baseAsset={baseAsset}
    />
  ), [baseAsset]);

  // Memoize trades sidebar - TradesTable subscribes to store internally
  const tradesSidebar = useMemo(() => (
    <TradesTable
      pair={{ address: address, blockchain }}
      isPair={false}
      storeTrades={[]} // Empty - TradesTable uses store directly
      compact
    />
  ), [address, blockchain]); // NO tradesHook.wsTrades dependency!

  // 🔹 Render
  return (
    <>
      <FilterModal />
      <ResizablePanelsLayout
        chart={chartComponent}
        tradesSidebar={tradesSidebar}
        tabs={tabs}
      />
    </>
  );
}

// Memoize to prevent re-renders when parent updates
export default memo(TokenResizablePanelsComponent, (prevProps, nextProps) => {
  return (
    prevProps.address === nextProps.address &&
    prevProps.blockchain === nextProps.blockchain &&
    prevProps.tokenData?.address === nextProps.tokenData?.address
  );
});

