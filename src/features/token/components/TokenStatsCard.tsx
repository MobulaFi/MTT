'use client';
import { useMemo } from 'react';
import StatsCard from '@/components/shared/StatsCard';
import { useTokenStore } from '@/features/token/store/useTokenStore';
import { PairStatsCardSkeleton } from '@/components/skeleton';
import { buildToken } from '@/utils/StatsCardAdapter';
import { useTradingStore } from '@/store/tradingStore';

export default function TokenStatsCard() {
  const token = useTokenStore((state) => state.token);
  const tokenLoading = useTokenStore((state) => state.tokenLoading);
  const markets = useTradingStore((state) => state.markets);

  const quoteToken = useMemo(() => {
    if (!token || !markets || markets.length === 0) return undefined;
    const preferredMarket = markets.find((market) => market.poolAddress === token.poolAddress) ?? markets[0];
    if (!preferredMarket?.quoteAddress) return undefined;

    return {
      symbol: preferredMarket.quoteSymbol,
      address: preferredMarket.quoteAddress,
      approximateReserveToken: preferredMarket.reserve1,
    };
  }, [markets, token]);

  if (tokenLoading || !token) return <PairStatsCardSkeleton />;
  return <StatsCard data={buildToken(token, { quoteToken })} />;
}

