'use client';

import { TokenHeader } from '@/features/token/components/TokenHeader';
import TokenStatsCard from '@/features/token/components/TokenStatsCard';
import TokenResizablePanels from '@/features/token/components/TokenResizablePanel';
import { useTokenStore } from '@/features/token/store/useTokenStore';
import PairHeader from '@/features/pair/components/PairHeader';
import PairStatsCards from '@/features/pair/components/PairCard';
import PairResizablePanels from '@/features/pair/components/PairResizablePanels';
import { usePairStore } from '@/features/pair/store/pairStore';
import {
  prefetchTokenDetails,
  prefetchMarketDetails,
  prefetchHolders,
  prefetchTopTraders,
  prefetchMarkets,
} from '@/lib/prefetch';

export default function AssetPageClient({
  address,
  blockchain,
  isPair,
}: {
  address: string;
  blockchain: string;
  isPair: boolean;
}) {
  // Fire REST fetches at t=0ms (during render, before useEffect).
  // Always fetch token/pair details even if store is hydrated — list-page data
  // (Pulse/Trending) may have different field names or missing fields.
  // Supplementary data (holders, traders, markets) can be skipped if already started.
  const tokenStoreHydrated = !isPair && Boolean(useTokenStore.getState().token);
  const pairStoreHydrated = isPair && Boolean(usePairStore.getState().data);

  if (isPair) {
    if (!pairStoreHydrated) {
      prefetchMarketDetails(address, blockchain).then((res) => {
        const tokenAddress = (res as { data?: { baseToken?: { address?: string } } })?.data?.baseToken?.address;
        if (tokenAddress) {
          prefetchHolders(tokenAddress, blockchain);
          prefetchTopTraders(tokenAddress, blockchain);
          prefetchMarkets(tokenAddress, blockchain);
        }
      });
    }
  } else {
    // Always prefetch token details — critical for correct field names
    prefetchTokenDetails(address, blockchain);
    if (!tokenStoreHydrated) {
      prefetchHolders(address, blockchain);
      prefetchTopTraders(address, blockchain);
      prefetchMarkets(address, blockchain);
    }
  }

  const tokenData = useTokenStore((state) => state.token);
  const pairData = usePairStore((state) => state.data);

  return (
    <main className="flex flex-col lg:flex-row w-full min-h-screen overflow-y-auto">
      <div className="w-full lg:w-[75%] xl:w-[80%] flex flex-col border-r border-borderDefault">
        <div className="border-b border-borderDefault px-4">
          {isPair ? (
            <PairHeader pair={null} address={address} blockchain={blockchain} />
          ) : (
            <TokenHeader token={null} address={address} blockchain={blockchain} />
          )}
        </div>
        <div className="flex-1 overflow-y-auto hidden md:flex">
          {isPair ? (
            <PairResizablePanels
              marketData={pairData}
              address={address}
              blockchain={blockchain}
            />
          ) : (
            <TokenResizablePanels
              tokenData={tokenData}
              address={address}
              blockchain={blockchain}
            />
          )}
        </div>
      </div>
      <aside className="w-full lg:w-[25%] mr-2 xl:w-[20%] bg-bgPrimary flex flex-col border-l border-borderDefault overflow-y-auto scrollbar-hide">
        {isPair ? <PairStatsCards /> : <TokenStatsCard />}
      </aside>
    </main>
  );
}
