'use client';

import PairHeader from '@/features/pair/components/PairHeader';
import PairStatsCards from '@/features/pair/components/PairCard';
import PairResizablePanels from '@/features/pair/components/PairResizablePanels';
import { usePairStore } from '@/features/pair/store/pairStore';
import { prefetchMarketDetails, prefetchHolders, prefetchTopTraders, prefetchMarkets } from '@/lib/prefetch';

export default function PairPageClient({
  address,
  blockchain,
}: {
  address: string;
  blockchain: string;
}) {
  // Fire REST fetch at t=0ms (during render, before useEffect)
  // Chain: as soon as market details resolve, prefetch holders/traders/markets
  prefetchMarketDetails(address, blockchain).then((res) => {
    const tokenAddress = (res as { data?: { baseToken?: { address?: string } } })?.data?.baseToken?.address;
    if (tokenAddress) {
      prefetchHolders(tokenAddress, blockchain);
      prefetchTopTraders(tokenAddress, blockchain);
      prefetchMarkets(tokenAddress, blockchain);
    }
  });

  const pairData = usePairStore((state) => state.data);

  return (
    <main className="flex flex-col lg:flex-row w-full min-h-screen overflow-y-auto">
      <div className="w-full lg:w-[75%] xl:w-[80%] flex flex-col border-r border-borderDefault">
        <div className="border-b border-borderDefault px-4">
          <PairHeader pair={null} address={address} blockchain={blockchain} />
        </div>
        <div className="flex-1 overflow-y-auto hidden md:flex">
          <PairResizablePanels
            marketData={pairData}
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
