'use client';

import { useTrendingData } from '../hooks/useTrendingData';
import { useTrendingStore } from '../store/useTrendingStore';
import TrendingHeader from './TrendingHeader';
import TrendingTable from './TrendingTable';
import ConfigPopup from './ConfigPopup';

export default function TrendingPageClient() {
  useTrendingData();
  // Individual selectors — only re-render when these specific fields change
  const error = useTrendingStore((s) => s.error);
  const tokens = useTrendingStore((s) => s.tokens);
  const lastUpdated = useTrendingStore((s) => s.lastUpdated);

  if (error && tokens.length === 0) {
    return (
      <div className="bg-bgPrimary min-h-[calc(100vh-200px)]">
        <TrendingHeader />
        <div className="p-8 text-center">
          <p className="text-error text-sm">Error loading trending data: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-xs text-textTertiary hover:text-textPrimary underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bgPrimary min-h-[calc(100vh-200px)]" style={{ transform: 'scale(1.25)', transformOrigin: 'top left', width: '80%' }}>
      <TrendingHeader />
      <div className="pb-4">
        <TrendingTable />
      </div>
      {lastUpdated && (
        <div className="pb-4 text-center">
          <span className="text-[9px] text-textTertiary tracking-wide">
            Updated {lastUpdated}
          </span>
        </div>
      )}
      <ConfigPopup />
    </div>
  );
}
