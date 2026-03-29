'use client';

import { WalletTrackerPanel } from '@/features/wallet-tracker/components/WalletTrackerPanel';
import { XTrackerInlinePanel } from '@/features/wallet-tracker/components/XTrackerInlinePanel';

export default function TrackerPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] flex-1 min-h-0 overflow-hidden">
      {/* Left: Wallet Tracker — scrolls independently */}
      <div className="border-r border-borderDefault flex flex-col overflow-hidden">
        <WalletTrackerPanel />
      </div>

      {/* Right: X Tracker — scrolls independently */}
      <div className="flex flex-col overflow-hidden">
        <XTrackerInlinePanel />
      </div>
    </div>
  );
}
