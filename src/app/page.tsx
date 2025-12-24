'use client';

import { TokenSectionSkeleton } from '@/components/skeleton';
import PulseHeader from '@/features/pulse/components/PulseHeader';
import TokenSection from '@/features/pulse/components/TokenSection';
import { PulseStreamProvider, usePulseStreamContext } from '@/features/pulse/context/PulseStreamContext';
import { usePulseDisplayStore } from '@/features/pulse/store/usePulseDisplayStore';


const PulsePageView = () => {
  const { compactTables } = usePulseDisplayStore();
  const { error, loading } = usePulseStreamContext();

  if (error) {
    console.error('Pulse V2 error:', error);
    return (
      <div className="p-4 text-success">
        Error loading pulse data: {error}
      </div>
    );
  }

  return (
    <div className="bg-bgPrimary">
      <div className="px-4 pt-3 pb-1">
        <PulseHeader />
      </div>
      <div
        className={`px-4 md:grid md:grid-cols-3 p-0 min-h-[calc(100vh-200px)] py-2 ${
          compactTables ? 'gap-2 p-2' : 'gap-0'
        }`}
      >
        {loading ? (
          <>
            {/* NEW PAIRS SECTION SKELETON */}
            <div
              className={`overflow-hidden ${
                compactTables
                  ? 'border-[1px] border-borderDefault rounded-lg'
                  : 'border-x-[1px] border-b border-borderDefault'
              }`}
            >
              <TokenSectionSkeleton title="New Pairs" />
            </div>

            {/* FINAL STRETCH SECTION SKELETON */}
            <div
              className={`overflow-hidden ${
                compactTables
                  ? 'border border-borderDefault rounded-lg'
                  : 'border-r border-b border-borderDefault'
              }`}
            >
              <TokenSectionSkeleton title="Final Stretch" />
            </div>

            {/* MIGRATED SECTION SKELETON */}
            <div
              className={`overflow-hidden ${
                compactTables
                  ? 'border border-borderDefault rounded-lg'
                  : 'border-r border-b border-borderDefault'
              }`}
            >
              <TokenSectionSkeleton title="Migrated" />
            </div>
          </>
        ) : (
          <>
            {/* NEW PAIRS SECTION */}
            <div
              className={`overflow-hidden ${
                compactTables
                  ? 'border-[1px] border-borderDefault rounded-lg'
                  : 'border-x-[1px] border-b border-borderDefault'
              }`}
            >
              <TokenSection
                title="New Pairs"
                viewName="new"
                shouldBonded={true}
                showExpand={false}
              />
            </div>

            {/* FINAL STRETCH SECTION */}
            <div
              className={`overflow-hidden ${
                compactTables
                  ? 'border border-borderDefault rounded-lg'
                  : 'border-r border-b border-borderDefault'
              }`}
            >
              <TokenSection
                title="Final Stretch"
                viewName="bonding"
                shouldBonded={true}
                showExpand={false}
              />
            </div>

            {/* MIGRATED SECTION */}
            <div
              className={`overflow-hidden ${
                compactTables
                  ? 'border border-borderDefault rounded-lg'
                  : 'border-r border-b border-borderDefault'
              }`}
            >
              <TokenSection
                title="Migrated"
                viewName="bonded"
                showExpand={false}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const HomePage = () => (
  <PulseStreamProvider>
    <PulsePageView />
  </PulseStreamProvider>
);

export default HomePage;