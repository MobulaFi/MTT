'use client';

import dynamic from 'next/dynamic';

const SwapCard = dynamic(() => import('@/components/swap/SwapCard'), { ssr: false });

export default function SwapPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-start pt-8 pb-16 px-4 min-h-0 relative overflow-y-auto overflow-x-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-success/[0.025] blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[400px] rounded-full bg-accentPurple/[0.015] blur-[120px]" />
      </div>

      <div className="relative z-10 w-full flex justify-center">
        <SwapCard />
      </div>
    </div>
  );
}
