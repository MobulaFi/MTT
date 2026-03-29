'use client';

import { useTrendingStore } from '../store/useTrendingStore';
import { useTrendingMetadata } from '../hooks/useTrendingMetadata';
import { ChainDropdown } from '@/features/pulse/components/ChainDropDown';
import { FactoryDropdown } from '@/features/surge/components/FactoryDropdown';
import { Settings } from 'lucide-react';

export default function TrendingHeader() {
  // Individual selectors — only re-render when these specific fields change
  const isPaused = useTrendingStore((s) => s.isPaused);
  const selectedChainIds = useTrendingStore((s) => s.selectedChainIds);
  const selectedProtocols = useTrendingStore((s) => s.selectedProtocols);

  const { chains, availableProtocols, loading: metadataLoading } = useTrendingMetadata();

  const handleChainSelect = (chainId: string) => {
    if (selectedChainIds.includes(chainId)) {
      useTrendingStore.getState().setSelectedChainIds(selectedChainIds.filter((c) => c !== chainId));
    } else {
      useTrendingStore.getState().setSelectedChainIds([...selectedChainIds, chainId]);
    }
  };

  const handleFactorySelect = (name: string) => {
    const updated = selectedProtocols.includes(name)
      ? selectedProtocols.filter((p) => p !== name)
      : [...selectedProtocols, name];
    useTrendingStore.getState().setSelectedProtocols(updated);
  };

  return (
    <div className="px-3 pt-4 pb-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-textSecondary tracking-wide">Trending</h1>
          <button
            onClick={() => useTrendingStore.getState().togglePause()}
            className={`px-2 py-0.5 rounded text-[9px] font-semibold tracking-wider transition-colors ${
              isPaused
                ? 'bg-warning/10 text-warning border border-warning/20'
                : 'bg-success/10 text-success border border-success/20'
            }`}
          >
            {isPaused ? 'PAUSED' : 'LIVE'}
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-40">
            <ChainDropdown
              selectedChains={selectedChainIds}
              chains={chains}
              loading={metadataLoading}
              onChainSelect={handleChainSelect}
            />
          </div>

          <div className="w-40">
            <FactoryDropdown
              selectedFactories={selectedProtocols}
              factories={availableProtocols}
              loading={metadataLoading}
              onFactorySelect={handleFactorySelect}
            />
          </div>

          <button
            onClick={() => useTrendingStore.getState().setConfigOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-borderDefault rounded text-[10px] text-textTertiary hover:text-textSecondary hover:border-borderTertiary transition-colors"
          >
            <Settings size={11} />
            Config
          </button>
        </div>
      </div>
    </div>
  );
}
