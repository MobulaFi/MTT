'use client';

import { TokenHeader } from '@/features/token/components/TokenHeader';
import TokenStatsCard from '@/features/token/components/TokenStatsCard';
import TokenResizablePanels from '@/features/token/components/TokenResizablePanel';
import { useTokenStore } from '@/features/token/store/useTokenStore';
import { prefetchTokenDetails, prefetchHolders, prefetchTopTraders, prefetchMarkets } from '@/lib/prefetch';

export default function TokenPageClient({
  address,
  blockchain,
}: {
  address: string;
  blockchain: string;
}) {
  // Fire ALL REST fetches at t=0ms (during render, before useEffect)
  prefetchTokenDetails(address, blockchain);
  prefetchHolders(address, blockchain);
  prefetchTopTraders(address, blockchain);
  prefetchMarkets(address, blockchain);

  const tokenData = useTokenStore((state) => state.token);

  return (
    <main className="flex flex-col lg:flex-row w-full min-h-screen overflow-y-auto">
      <div className="w-full lg:w-[75%] xl:w-[80%] flex flex-col border-r border-borderDefault">
        <div className="border-b border-borderDefault px-4">
          <TokenHeader token={null} address={address} blockchain={blockchain} />
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
