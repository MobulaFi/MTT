import { PairHeaderSkeleton, PairStatsCardSkeleton } from '@/components/skeleton';

export default function PairLoading() {
  return (
    <main className="flex flex-col lg:flex-row w-full min-h-screen overflow-y-auto">
      <div className="w-full lg:w-[75%] xl:w-[80%] flex flex-col border-r border-borderDefault">
        <div className="border-b border-borderDefault px-4">
          <PairHeaderSkeleton />
        </div>
        <div className="flex-1" />
      </div>
      <aside className="w-full lg:w-[25%] mr-2 xl:w-[20%] bg-bgPrimary flex flex-col border-l border-borderDefault overflow-y-auto scrollbar-hide">
        <PairStatsCardSkeleton />
      </aside>
    </main>
  );
}
