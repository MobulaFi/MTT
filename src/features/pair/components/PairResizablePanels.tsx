'use client';

import { useMemo, useEffect, useCallback, memo } from 'react';
import { Settings2, Funnel, ArrowUpDown, X } from 'lucide-react';
import TradingViewChart from '@/components/charts';
import ResizablePanelsLayout from '@/components/shared/ResizablePanelLayout';
import { TradesTable } from '@/components/tables/TradesTable';
import { HoldersTable } from '@/components/tables/HoldersTable';
import { TopTradersTable } from '@/components/tables/TopTradersTable';
import { DevTokensTable } from '@/components/tables/DevTokensTable';
import { MarketsTable } from '@/components/tables/MarketTable';
import { FilterModal } from '@/components/FilterModal';
import { useFilterModalStore } from '@/store/useFilterModalStore';
import { useTradesPanelStore } from '@/store/useTradesPanelStore';
import { useCombinedHolders } from '@/features/pair/hooks/useCombinedHolders';
import { useTradeSubscription } from '@/features/pair/hooks/useTradeSubscription';
import { useTradingData } from '@/hooks/useTradingData';
import { usePairStore } from '@/features/pair/store/pairStore';
import { usePairHoldersStore } from '@/features/pair/store/usePairHolderStore';
import { usePriceDisplayStore } from '@/store/useDisplayPriceStore';
import { MarketDetailsResponse } from '@mobula_labs/types';
import { useTopTradersData } from '@/hooks/useTopTraderData';
import { HOLDER_TAG_ICONS } from '@/assets/icons/HolderTags';
import { useRenderCounter } from '@/utils/useRenderCounter';
import type { Transaction } from '@/features/pair/store/usePairTradeStore';

interface PairClientPanelsProps {
  marketData: MarketDetailsResponse['data'];
  address: string;
  blockchain: string;
}

// Memoized action components
const PairHoldersActions = memo(({ 
  onToggleTrades, 
  onToggleCurrency, 
  displayCurrency, 
  quoteCurrencySymbol 
}: { 
  onToggleTrades: () => void;
  onToggleCurrency: () => void;
  displayCurrency: string;
  quoteCurrencySymbol: string;
}) => (
  <>
    <button
      onClick={onToggleTrades}
      className="flex items-center rounded-md hover:bg-bgContainer gap-1.5 px-2 py-1 text-xs font-medium text-grayGhost hover:text-white transition-colors"
    >
      <span>Trades Panel</span>
    </button>
    <button
      type="button"
      onClick={onToggleCurrency}
      className="flex hover:bg-bgContainer rounded-md items-center gap-1 text-xs text-grayGhost hover:text-white px-2 py-1 transition-colors"
    >
      <ArrowUpDown size={14} />
      <span>{displayCurrency === 'QUOTE' ? 'USD' : quoteCurrencySymbol}</span>
    </button>
  </>
));
PairHoldersActions.displayName = 'PairHoldersActions';

const PairTradesActions = memo(({ 
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
PairTradesActions.displayName = 'PairTradesActions';

const PairTopTradersActions = memo(({ 
  filterLabel, 
  onClearFilter, 
  onToggleTrades, 
  onToggleCurrency, 
  displayCurrency, 
  quoteCurrencySymbol 
}: { 
  filterLabel?: string;
  onClearFilter: () => void;
  onToggleTrades: () => void;
  onToggleCurrency: () => void;
  displayCurrency: string;
  quoteCurrencySymbol: string;
}) => (
  <>
    {filterLabel && (
      <div className="flex items-center gap-1.5 rounded-md bg-bgContainer px-2 py-1 text-xs">
        {HOLDER_TAG_ICONS[filterLabel]}
        <span className="text-textPrimary font-medium">{filterLabel}</span>
        <button
          onClick={onClearFilter}
          className="ml-1 text-grayGhost hover:text-textTertiary transition-colors"
          aria-label="Clear filter"
        >
          <X size={12} strokeWidth={2} />
        </button>
      </div>
    )}
    <button
      onClick={onToggleTrades}
      className="flex items-center rounded-md hover:bg-bgContainer gap-1.5 px-2 py-1 text-xs font-medium text-grayGhost hover:text-white transition-colors"
    >
      <span>Trades Panel</span>
    </button>
    <button
      type="button"
      onClick={onToggleCurrency}
      className="flex hover:bg-bgContainer rounded-md items-center gap-1 text-xs text-grayGhost hover:text-white px-2 py-1 transition-colors"
    >
      <ArrowUpDown size={14} />
      <span>{displayCurrency === 'QUOTE' ? 'USD' : quoteCurrencySymbol}</span>
    </button>
  </>
));
PairTopTradersActions.displayName = 'PairTopTradersActions';

function PairResizablePanelsComponent({
  marketData,
  address,
  blockchain,
}: PairClientPanelsProps) {
  // Render counter for diagnostics
  useRenderCounter('PairResizablePanels');

  // Use granular selectors to prevent unnecessary re-renders
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
  
  const openModal = useFilterModalStore((s) => s.openModal);
  const setFilters = useFilterModalStore((s) => s.setFilters);
  const resetFilters = useFilterModalStore((s) => s.resetFilters);
  const toggleTrades = useTradesPanelStore((s) => s.toggleTrades);
  const displayCurrency = usePriceDisplayStore((s) => s.displayCurrency);
  const quoteCurrencySymbol = usePriceDisplayStore((s) => s.quoteCurrencySymbol);
  const toggleCurrency = usePriceDisplayStore((s) => s.toggleCurrency);

  useEffect(() => {
    resetFilters();
  }, [address, blockchain, resetFilters]);

  // Data Hooks
  useCombinedHolders(marketData.base.address, blockchain);
  // Use granular selector to prevent unnecessary re-renders
  const totalSupply = usePairStore((s) => s.totalSupply);
  const holdersCount = usePairHoldersStore((s) => s.holdersCount);
  // CRITICAL: Use subscription-only hook that doesn't subscribe to store state
  // This sets up WebSocket subscription but doesn't cause re-renders when trades update
  // TradesTable will subscribe to store directly for its own updates
  useTradeSubscription({ address, blockchain, isPair: true });

  // Use granular selector - only get markets, not entire hook return
  const tradingData = useTradingData(
    marketData.address,
    marketData.base.address,
    blockchain,
    marketData.base.deployer,
  );
  const markets = tradingData.markets;
  const tradeLoading = tradingData.isLoading.markets;

  const topTradersHook = useTopTradersData({
    tokenAddress: marketData.base.address,
    blockchain,
  });

  // Stable callbacks
  const handleToggleTrades = useCallback(() => {
    toggleTrades();
  }, [toggleTrades]);

  const handleToggleCurrency = useCallback(() => {
    toggleCurrency();
  }, [toggleCurrency]);

  // Memoize currentFilters.wallet to prevent unnecessary callback recreation
  const currentWalletFilter = useMemo(() => currentFilters.wallet, [currentFilters.wallet]);
  
  const handleToggleDevFilter = useCallback(() => {
    const isDevFilterActive = currentWalletFilter === marketData.base.deployer;
    if (isDevFilterActive) {
      setFilters({ wallet: undefined });
    } else if (marketData.base.deployer) {
      setFilters({ wallet: marketData.base.deployer });
    }
  }, [currentWalletFilter, marketData.base.deployer, setFilters]);

  const handleOpenModal = useCallback(() => {
    openModal();
  }, [openModal]);

  const handleClearTopTradersFilter = useCallback(() => {
    topTradersHook.clearFilters();
  }, [topTradersHook]);

  // Use memoized wallet filter for stable comparison
  const isDevFilterActive = currentWalletFilter === marketData.base.deployer;

  // Memoize table components
  const holdersTable = useMemo(() => (
    <HoldersTable totalSupply={totalSupply ?? 0} />
  ), [totalSupply]);

  const topTradersTable = useMemo(() => (
    <TopTradersTable
      tokenAddress={marketData.base.address}
      blockchain={blockchain}
      totalSupply={totalSupply ?? 0}
    />
  ), [marketData.base.address, blockchain, totalSupply]);

  // TradesTable subscribes to store internally - don't pass storeTrades prop
  const tradesTable = useMemo(() => (
    <TradesTable
      pair={{ address, blockchain }}
      storeTrades={[]} // Empty - TradesTable uses store directly
      isPair={true}
      showCurrencyToggle={true}
    />
  ), [address, blockchain]); // NO tradesHook.wsTrades dependency!

  const devTokensTable = useMemo(() => (
    marketData.base.deployer ? (
      <DevTokensTable
        wallet={marketData.base.deployer}
        blockchain={blockchain}
      />
    ) : null
  ), [marketData.base.deployer, blockchain]);

  // Memoize markets with length check - only update if markets array actually changed
  const marketsLength = Array.isArray(markets) ? markets.length : 0;
  const marketsTable = useMemo(() => (
    marketsLength > 0 && Array.isArray(markets) ? (
      <MarketsTable data={markets} />
    ) : null
  ), [markets, marketsLength]);

  const currencyToggleButton = useMemo(() => (
    <button
      type="button"
      onClick={handleToggleCurrency}
      className="flex hover:bg-bgContainer rounded-md items-center gap-1 text-xs text-grayGhost hover:text-white px-2 py-1 transition-colors"
    >
      <ArrowUpDown size={14} />
      <span>{displayCurrency === 'QUOTE' ? 'USD' : quoteCurrencySymbol}</span>
    </button>
  ), [displayCurrency, quoteCurrencySymbol, handleToggleCurrency]);

  const tabs = useMemo(() => {
    const baseTabs = [
      {
        value: 'holders',
        label: `Holders (${holdersCount})`,
        content: holdersTable,
        actions: (
          <PairHoldersActions
            onToggleTrades={handleToggleTrades}
            onToggleCurrency={handleToggleCurrency}
            displayCurrency={displayCurrency}
            quoteCurrencySymbol={quoteCurrencySymbol}
          />
        ),
      },
      {
        value: 'top-traders',
        label: 'Top Traders',
        content: topTradersTable,
        actions: (
          <PairTopTradersActions
            filterLabel={topTradersHook.filters.label}
            onClearFilter={handleClearTopTradersFilter}
            onToggleTrades={handleToggleTrades}
            onToggleCurrency={handleToggleCurrency}
            displayCurrency={displayCurrency}
            quoteCurrencySymbol={quoteCurrencySymbol}
          />
        ),
      },
      {
        value: 'trades',
        label: 'Trades',
        content: tradesTable,
        actions: (
          <PairTradesActions
            deployer={marketData.base.deployer ?? undefined}
            isDevFilterActive={isDevFilterActive}
            onToggleTrades={handleToggleTrades}
            onToggleDevFilter={handleToggleDevFilter}
            onOpenModal={handleOpenModal}
          />
        ),
      },
    ];

    if (marketData.base.deployer && devTokensTable) {
      baseTabs.push({
        value: 'dev-tokens',
        label: 'Dev Tokens',
        content: devTokensTable,
        actions: currencyToggleButton,
      });
    }

    if (marketsLength > 0 && marketsTable) {
      baseTabs.push({
        value: 'markets',
        label: `${marketData.base.symbol?.slice(0, 10)} Markets`,
        content: marketsTable,
        actions: currencyToggleButton,
      });
    }

    return baseTabs;
  }, [
    holdersCount,
    holdersTable,
    topTradersTable,
    tradesTable,
    devTokensTable,
    marketsTable,
    currencyToggleButton,
    marketData.base.deployer,
    marketData.base.symbol,
    marketsLength,
    isDevFilterActive,
    topTradersHook.filters.label,
    handleToggleTrades,
    handleToggleCurrency,
    handleToggleDevFilter,
    handleOpenModal,
    handleClearTopTradersFilter,
    displayCurrency,
    quoteCurrencySymbol,
    currentWalletFilter,
    // REMOVED tradesHook.wsTrades - this was causing re-renders!
  ]);

  // Memoize base asset
  const baseAsset = useMemo(
    () => ({
      address,
      blockchain,
      symbol: marketData.base.symbol ?? undefined,
      priceUSD: marketData.base.priceUSD,
      base: { symbol: marketData.base.symbol ?? undefined },
      quote: { symbol: marketData.quote.symbol ?? undefined },
    }),
    [address, blockchain, marketData.base.symbol, marketData.base.priceUSD, marketData.quote.symbol],
  );

  // Memoize chart component
  const chartComponent = useMemo(() => (
    <TradingViewChart
      isPair
      baseAsset={baseAsset}
    />
  ), [baseAsset]);

  // Memoize trades sidebar - TradesTable subscribes to store internally
  const tradesSidebar = useMemo(() => (
    <TradesTable
      pair={{ address, blockchain }}
      storeTrades={[]} // Empty - TradesTable uses store directly
      isPair
      compact
    />
  ), [address, blockchain]); // NO tradesHook.wsTrades dependency!

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
export default memo(PairResizablePanelsComponent, (prevProps, nextProps) => {
  return (
    prevProps.address === nextProps.address &&
    prevProps.blockchain === nextProps.blockchain &&
    prevProps.marketData?.address === nextProps.marketData?.address
  );
});

