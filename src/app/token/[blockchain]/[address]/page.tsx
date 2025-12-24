import { getMobulaClient } from '@/lib/mobulaClient';
import { TokenDetailsResponse } from '@mobula_labs/types';
import { formatPriceWithPlaceholder } from '@/utils/tokenMetrics';
import { TokenHeader } from '@/features/token/components/TokenHeader';
import TokenStatsCard from '@/features/token/components/TokenStatsCard';
import TokenResizablePanels from '@/features/token/components/TokenResizablePanel';
import { cookies, headers } from 'next/headers'

interface TokenPageProps {
  params: Promise<{ blockchain: string; address: string }>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function generateMetadata({ params }: TokenPageProps) {
  await headers();
  
  const cookieStore = await cookies();
  const customRestUrl = cookieStore.get('customRestUrl')?.value;
  const client = getMobulaClient(customRestUrl, true);

  const awaitedParams = await params;
  const address = awaitedParams.address;
  const blockchain = decodeURIComponent(awaitedParams.blockchain);

  const response: TokenDetailsResponse = await client.fetchTokenDetails({
    address,
    blockchain
  });

  const initialData = response.data;

  if (!initialData) {
    return {
      title: 'Token not found - Mobula',
      description: 'No Token data available for this address',
    };
  }

  const price = formatPriceWithPlaceholder(initialData.priceUSD);
  const volume = initialData.volume24hUSD || 0;
  const tokenAddress = initialData.address;
  const baseTokenLogo = initialData.logo || "https://framerusercontent.com/images/83wKw3MxTAt4Shj56JmraGNXdM.png?scale-down-to=1024"

  const title = `${initialData?.symbol} ${price} ${initialData?.symbol || 'USD'} price today, ${initialData?.name} live chart, forecast | Mobula`;
  const readablePrice = price === 'N/A' ? 'N/A' : `$${price}`;
  const description = `The ${initialData?.name} live price is ${readablePrice} ${initialData?.symbol || 'USD'} with a 24h volume of $${volume.toLocaleString()} USD. Buy ${initialData?.symbol}. Check ${initialData?.symbol} airdrop and audits. ${tokenAddress} is ${initialData?.symbol} (${initialData?.name}) token contract address on ${initialData.blockchain}.`;

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

export default async function TokenPage({ params }: TokenPageProps) {
  // ✅ Force dynamic rendering for page component
  await headers();
  
  const cookieStore = await cookies();
  const customRestUrl = cookieStore.get('customRestUrl')?.value;

  const awaitedParams = await params;
  const { blockchain, address } = {
    blockchain: decodeURIComponent(awaitedParams.blockchain),
    address: awaitedParams.address,
  };

  const client = getMobulaClient(customRestUrl, true);

  const tokenRes = await client.fetchTokenDetails({ address, blockchain });
  const tokenData = tokenRes.data;

  if (!tokenData) {
    return (
      <div className="flex items-center justify-center min-h-screen text-textPrimary">
        <p>No Token data available for this address.</p>
      </div>
    );
  }

  return (
    <main className="flex flex-col lg:flex-row w-full min-h-screen overflow-y-auto">
      {/* 🔹 Main content area */}
      <div className="w-full lg:w-[75%] xl:w-[80%] flex flex-col border-r border-borderDefault">
        {/* Header */}
        <div className="border-b border-borderDefault px-4 ">
          <TokenHeader token={tokenData} address={address} blockchain={blockchain} />
        </div>
        <div className="flex-1 overflow-y-auto hidden md:flex">
          <TokenResizablePanels
            tokenData={tokenData}
            address={address}
            blockchain={blockchain}
          />
        </div>
      </div>
      <aside className="w-full lg:w-[25%] mr-2 xl:w-[20%] bg-bgPrimary flex flex-col border-l border-borderDefault overflow-y-auto scrollbar-hide">
        <TokenStatsCard />
      </aside>
    </main>
  );
}