import { useEffect, useMemo, useRef } from 'react';
import { useTradingStore } from '@/store/tradingStore';

export function useTradingData(
  address: string,
  tokenAddress: string,
  blockchain: string,
  deployer?: string | null
) {
  // Use granular selectors to prevent unnecessary re-renders
  // Only subscribe to what we actually need
  const marketsRaw = useTradingStore((s) => s.markets);
  const isLoadingMarkets = useTradingStore((s) => s.isLoadingMarkets);
  const fetchMarkets = useTradingStore((s) => s.fetchMarkets);
  const fetchDevTokens = useTradingStore((s) => s.fetchDevTokens);
  const cleanup = useTradingStore((s) => s.cleanup);
  
  // Don't subscribe to trades/devTokens here - not used in TokenResizablePanels
  const trades = useTradingStore((s) => s.trades);
  const devTokens = useTradingStore((s) => s.devTokens);
  const isLoadingTrades = useTradingStore((s) => s.isLoadingTrades);
  const isLoadingDevTokens = useTradingStore((s) => s.isLoadingDevTokens);

  // Stabilize markets reference - only update when content actually changes
  const marketsRef = useRef<typeof marketsRaw>(marketsRaw);
  const prevMarketsHashRef = useRef<string>('');
  
  const marketsHash = useMemo(() => {
    if (marketsRaw.length === 0) return '';
    return marketsRaw.map(m => m.poolAddress).join(',') + `:${marketsRaw.length}`;
  }, [marketsRaw]);

  const markets = useMemo(() => {
    if (marketsHash === prevMarketsHashRef.current && marketsRef.current.length > 0) {
      return marketsRef.current; // Return previous reference if content unchanged
    }
    prevMarketsHashRef.current = marketsHash;
    marketsRef.current = marketsRaw;
    return marketsRaw;
  }, [marketsRaw, marketsHash]);

  useEffect(() => {
    if (!address || !tokenAddress || !blockchain) return;

    const promises: Promise<unknown>[] = [
      fetchMarkets(tokenAddress, blockchain),
    ];

    if (deployer) {
      promises.push(fetchDevTokens(deployer, blockchain));
    }

    Promise.all(promises).catch((err) =>
      console.error('[useTradingData] Fetch error:', { address, tokenAddress, blockchain, deployer, err })
    );

    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [address, tokenAddress, blockchain, deployer]);

  const isLoadingAll = isLoadingTrades || isLoadingMarkets || isLoadingDevTokens;

  return {
    trades,
    markets,
    devTokens,
    isLoading: {
      trades: isLoadingTrades,
      markets: isLoadingMarkets,
      devTokens: isLoadingDevTokens,
      all: isLoadingAll,
    },
  };
}
