import { getMobulaClient } from '@/lib/mobulaClient';
import { EmbedLayout } from '@/components/embed/EmbedLayout';
import { EmbedBranding } from '@/components/embed/EmbedBranding';
import TradingViewChart from '@/components/charts';
import { validateEmbedParams, mapResolutionToTradingView, getThemeFromBgColor } from '@/lib/embed/validateEmbedParams';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

interface EmbedPoolPageProps {
  params: Promise<{ blockchain: string; address: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// Security headers for embed routes
export async function generateMetadata({ params }: EmbedPoolPageProps) {
  return {
    title: 'Pool Chart Embed - Mobula',
    robots: 'noindex, nofollow',
  };
}

export default async function EmbedPoolPage({ params, searchParams }: EmbedPoolPageProps) {
  await headers();
  
  const awaitedParams = await params;
  const awaitedSearchParams = await searchParams;
  
  const { blockchain, address } = {
    blockchain: decodeURIComponent(awaitedParams.blockchain),
    address: awaitedParams.address,
  };

  // Validate embed parameters
  const searchParamsObj = new URLSearchParams();
  Object.entries(awaitedSearchParams).forEach(([key, value]) => {
    if (typeof value === 'string') {
      searchParamsObj.set(key, value);
    } else if (Array.isArray(value) && value.length > 0) {
      searchParamsObj.set(key, value[0]);
    }
  });

  const embedConfig = validateEmbedParams(searchParamsObj);
  if (!embedConfig) {
    notFound();
  }

  // Fetch pool/pair data
  const client = getMobulaClient(undefined, true);
  
  const marketRes = await client.fetchMarketDetails({ address, blockchain, stats: true });
  const marketData = marketRes.data;

  if (!marketData) {
    notFound();
  }

  const initialResolution = mapResolutionToTradingView(embedConfig.resolution);
  
  const theme = getThemeFromBgColor(embedConfig.bgColor);

  const baseAsset = {
    address: marketData.address,
    blockchain,
    symbol: marketData.base.symbol ?? undefined,
    priceUSD: marketData.base.priceUSD,
    base: { symbol: marketData.base.symbol ?? undefined },
    quote: { symbol: marketData.quote.symbol ?? undefined },
  };

  return (
    <EmbedLayout config={embedConfig}>
      <div style={{ width: '100%', height: '100vh', backgroundColor: embedConfig.bgColor || '#121319', position: 'relative' }}>
        <div style={{ width: '100%', height: 'calc(100% - 36px)' }}>
        <TradingViewChart
          baseAsset={baseAsset}
          isPair={true}
          initialResolution={initialResolution}
          theme={theme}
          backgroundColor={embedConfig.bgColor}
          candleUpColor={embedConfig.candleUpColor}
          candleDownColor={embedConfig.candleDownColor}
        />
        </div>
        <EmbedBranding bgColor={embedConfig.bgColor} />
      </div>
    </EmbedLayout>
  );
}

