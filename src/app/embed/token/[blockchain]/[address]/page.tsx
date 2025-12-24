import { getMobulaClient } from '@/lib/mobulaClient';
import { EmbedLayout } from '@/components/embed/EmbedLayout';
import { EmbedBranding } from '@/components/embed/EmbedBranding';
import TradingViewChart from '@/components/charts';
import { validateEmbedParams, mapResolutionToTradingView, getThemeFromBgColor } from '@/lib/embed/validateEmbedParams';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

interface EmbedTokenPageProps {
  params: Promise<{ blockchain: string; address: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function generateMetadata({ params }: EmbedTokenPageProps) {
  return {
    title: 'Token Chart Embed - Mobula',
    robots: 'noindex, nofollow',
  };
}

export default async function EmbedTokenPage({ params, searchParams }: EmbedTokenPageProps) {
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

  // Fetch token data
  const client = getMobulaClient(undefined, true);
  
  const tokenRes = await client.fetchTokenDetails({ address, blockchain });
  const tokenData = tokenRes.data;

  if (!tokenData) {
    notFound();
  }


  const initialResolution = mapResolutionToTradingView(embedConfig.resolution);

  const theme = getThemeFromBgColor(embedConfig.bgColor);

  const baseAsset = {
    address: tokenData.address,
    blockchain,
    symbol: tokenData.symbol ?? undefined,
    priceUSD: tokenData.priceUSD,
  };

  return (
    <EmbedLayout config={embedConfig}>
      <div style={{ width: '100%', height: '100vh', backgroundColor: embedConfig.bgColor || '#121319', position: 'relative' }}>
        <div style={{ width: '100%', height: 'calc(100% - 36px)' }}>
        <TradingViewChart
          baseAsset={baseAsset}
          isPair={false}
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

