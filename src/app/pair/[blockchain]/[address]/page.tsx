import { getMobulaClient } from '@/lib/mobulaClient';
import PairHeader from '@/features/pair/components/PairHeader';
import { MarketDetailsResponse } from '@mobula_labs/types';
import { formatPriceWithPlaceholder } from '@/utils/tokenMetrics';
import PairStatsCards from '@/features/pair/components/PairCard';
import PairResizablePanels from '@/features/pair/components/PairResizablePanels';
import { cookies } from 'next/headers'

interface PairPageProps {
  params: Promise<{ blockchain: string; address: string }>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function generateMetadata({ params }: PairPageProps) {
  const cookieStore = await cookies();
  
  const customRestUrl = cookieStore.get('customRestUrl')?.value;
  const client = getMobulaClient(customRestUrl, true);

  const awaitedParams = await params;
  const address = awaitedParams.address;
  const blockchain = decodeURIComponent(awaitedParams.blockchain);

  const response: MarketDetailsResponse = await client.fetchMarketDetails({
    address,
    blockchain,
    stats: true,
  });

  const initialData = response.data;

  if (!initialData) {
    return {
      title: 'Pair not found - Mobula',
      description: 'No pair data available for this address',
    };
  }

  const baseToken = initialData.base;
  const vsToken = initialData.quote;
  const price = formatPriceWithPlaceholder(baseToken.priceUSD);
  const volume = initialData.volume24hUSD || 0;
  const tokenAddress = initialData.address;
  const baseTokenLogo =
    baseToken.logo ||
    'https://framerusercontent.com/images/83wKw3MxTAt4Shj56JmraGNXdM.png?scale-down-to=1024';

  const title = `${baseToken?.symbol} ${price} ${vsToken?.symbol || 'USD'} price today, ${baseToken?.name} live chart, forecast | Mobula`;
  const readablePrice = price === 'N/A' ? 'N/A' : `$${price}`;
  const description = `The ${baseToken?.name} live price is ${readablePrice} ${vsToken?.symbol || 'USD'} with a 24h volume of $${volume.toLocaleString()} USD. Buy ${baseToken?.symbol}. Check ${baseToken?.symbol} airdrop and audits. ${tokenAddress} is ${baseToken?.symbol} (${baseToken?.name}) token contract address on ${initialData.blockchain}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `https://mobula.fi/pair/${tokenAddress}`,
      siteName: 'Mobula',
      images: [
        {
          url: baseTokenLogo,
          width: 300,
          height: 300,
          alt: 'Mobula',
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [baseTokenLogo],
    },
  };
}

export default async function PairPage({ params }: PairPageProps) {
  const cookieStore = await cookies();
  const customRestUrl = cookieStore.get('customRestUrl')?.value;

  const awaitedParams = await params;
  const blockchain = decodeURIComponent(awaitedParams.blockchain);
  const address = awaitedParams.address;

  const client = getMobulaClient(customRestUrl, true);

  const marketRes = await client.fetchMarketDetails({ address, blockchain, stats: true });
  const marketData = marketRes.data;

  if (!marketData) {
    return (
      <div className="flex items-center justify-center min-h-screen text-textPrimary">
        <p>No pair data available for this address.</p>
      </div>
    );
  }

  return (
    <main className="flex flex-col lg:flex-row w-full min-h-screen overflow-y-auto">
      {/* 🔹 Main content area */}
      <div className="w-full lg:w-[75%] xl:w-[80%] flex flex-col border-r border-borderDefault">
        {/* Header */}
        <div className="border-b border-borderDefault px-4">
          <PairHeader pair={marketData} address={address} blockchain={blockchain} />
        </div>
        <div className="flex-1 overflow-y-auto hidden md:flex">
          <PairResizablePanels
            marketData={marketData}
            address={address}
            blockchain={blockchain}
          />
        </div>
      </div>
      <aside className="w-full lg:w-[25%] mr-2 xl:w-[20%] bg-bgPrimary flex flex-col border-l border-borderDefault overflow-y-auto scrollbar-hide">
        <PairStatsCards />
      </aside>
    </main>
  );
}