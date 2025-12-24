'use client';
import { usePairStore } from '@/features/pair/store/pairStore';
import { usePriceDisplayStore } from '@/store/useDisplayPriceStore';
import { useTradingDataStore } from '@/store/useTradingDataStore';
import { MarketDetailsResponse } from '@mobula_labs/types';
import { usePairData } from '@/features/pair/hooks/usePairData';
import { useEffect } from 'react';
import { PairHeaderSkeleton } from '@/components/skeleton';
import { BaseHeaderData, DataHeader } from '@/components/shared/DataHeader';

function pairToHeaderData(pairData: MarketDetailsResponse['data']): BaseHeaderData {
  // MarketDetailsResponse has base and quote tokens
  const base = pairData?.base;
  const quote = pairData?.quote;

  return {
    primaryToken: {
      address: base?.address,
      symbol: base?.symbol,
      name: base?.name,
      logo: base?.logo,
      priceUSD: base?.priceUSD,
      blockchain: base?.chainId ?? base?.blockchain,
      marketCapUSD: base?.marketCapUSD,
      marketCapDilutedUSD: base?.marketCapDilutedUSD,
      deployer: base?.deployer,
    },
    secondaryToken: {
      address: quote?.address,
      symbol: quote?.symbol,
      name: quote?.name,
      logo: quote?.logo,
      priceUSD: quote?.priceUSD,
      blockchain: quote?.chainId ?? quote?.blockchain,
      marketCapUSD: quote?.marketCapUSD,
      marketCapDilutedUSD: quote?.marketCapDilutedUSD,
      deployer: quote?.deployer,
    },
    createdAt: pairData?.createdAt ?? undefined,
    socials: pairData?.socials,
    address: pairData?.address,
    exchangeLogo: pairData?.exchange?.logo ?? null,
    exchangeName: pairData?.exchange?.name ?? null,
    liquidityUSD: pairData?.liquidityUSD,
    totalFeesPaidUSD: pairData?.totalFeesPaidUSD ?? 0
  };
}

interface PairHeaderProps {
  pair: MarketDetailsResponse['data'];
  address: string;
  blockchain: string;
}

export default function PairHeader({ pair, address, blockchain }: PairHeaderProps) {
  usePairData(address, blockchain, pair);
  const { data: pairData, isLoading } = usePairStore();
  const { setQuoteInfo } = usePriceDisplayStore();
  const { setBaseToken, setQuoteToken, setPairAddress } = useTradingDataStore();
  const displayData = pairData ?? pair;
  const headerData = pairToHeaderData(displayData);

  // Initialize price display store with quote data
  useEffect(() => {
    if (displayData?.quote) {
      setQuoteInfo(
        displayData.quote.symbol ?? '',
        displayData.quote.priceUSD ?? 1,
        displayData.quote.logo ?? undefined
      );
    }
  }, [displayData?.quote?.symbol, displayData?.quote?.priceUSD, displayData?.quote?.logo, setQuoteInfo]);

  // Initialize trading data store with base and quote tokens
  useEffect(() => {
    if (displayData?.base && displayData?.quote) {
      setBaseToken({
        address: displayData.base.address ?? '',
        symbol: displayData.base.symbol ?? '',
        name: displayData.base.name || undefined,
        logo: displayData.base.logo || undefined,
        blockchain: displayData.base.chainId ?? displayData.base.blockchain ?? blockchain,
        decimals: displayData.base.decimals,
      });
      setQuoteToken({
        address: displayData.quote.address ?? '',
        symbol: displayData.quote.symbol ?? '',
        name: displayData.quote.name || undefined,
        logo: displayData.quote.logo || undefined,
        blockchain: displayData.quote.chainId ?? displayData.quote.blockchain ?? blockchain,
        decimals: displayData.quote.decimals,
      });
      setPairAddress(address);
    }
  }, [
    displayData?.base,
    displayData?.quote,
    address,
    blockchain,
    setBaseToken,
    setQuoteToken,
    setPairAddress,
  ]);

  if (isLoading) return <PairHeaderSkeleton />;

  return (
    <DataHeader
      data={headerData}
      isLoading={isLoading}
      SkeletonComponent={PairHeaderSkeleton}
    />
  );
}

