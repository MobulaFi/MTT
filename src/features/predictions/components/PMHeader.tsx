'use client';

import { ChevronDown, RefreshCw } from 'lucide-react';
import { useState, useCallback } from 'react';
import { usePMStore } from '../store/usePMStore';
import type { PMCategory } from '../types';

const PLATFORMS = [
  { id: null, name: 'All Platforms' },
  { id: 'polymarket', name: 'Polymarket' },
  { id: 'azuro', name: 'Azuro' },
];

interface PMHeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function PMHeader({ onRefresh, isRefreshing }: PMHeaderProps) {
  const [isCategoryOpen, setCategoryOpen] = useState(false);
  const [isPlatformOpen, setPlatformOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const { categories, selectedCategory, setSelectedCategory } = usePMStore();

  const handleCategorySelect = useCallback(
    (category: string | null) => {
      setSelectedCategory(category);
      setCategoryOpen(false);
    },
    [setSelectedCategory]
  );

  const handlePlatformSelect = useCallback((platform: string | null) => {
    setSelectedPlatform(platform);
    setPlatformOpen(false);
  }, []);

  const selectedCategoryName = selectedCategory
    ? categories.find((c) => c.id === selectedCategory)?.name || selectedCategory
    : 'All Categories';

  const selectedPlatformName = selectedPlatform
    ? PLATFORMS.find((p) => p.id === selectedPlatform)?.name || selectedPlatform
    : 'All Platforms';

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <h1 className="text-xl text-textPrimary font-bold">Predictions</h1>

        {/* Category Filter */}
        <div className="relative">
          <button
            onClick={() => setCategoryOpen(!isCategoryOpen)}
            className="flex items-center gap-2 bg-bgContainer border border-borderDefault rounded-lg px-3 py-1.5 text-sm text-textPrimary hover:bg-bgOverlay transition"
          >
            <span className="capitalize">{selectedCategoryName}</span>
            <ChevronDown size={14} className={`transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`} />
          </button>

          {isCategoryOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setCategoryOpen(false)} />
              <div className="absolute top-full left-0 mt-1 w-48 bg-bgContainer border border-borderDefault rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                <button
                  onClick={() => handleCategorySelect(null)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-bgOverlay transition ${
                    !selectedCategory ? 'text-success' : 'text-textPrimary'
                  }`}
                >
                  All Categories
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-bgOverlay transition ${
                      selectedCategory === cat.id ? 'text-success' : 'text-textPrimary'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="capitalize">{cat.name}</span>
                      <span className="text-xs text-textTertiary">{cat.activeMarkets}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Platform Filter */}
        <div className="relative">
          <button
            onClick={() => setPlatformOpen(!isPlatformOpen)}
            className="flex items-center gap-2 bg-bgContainer border border-borderDefault rounded-lg px-3 py-1.5 text-sm text-textPrimary hover:bg-bgOverlay transition"
          >
            <span className="capitalize">{selectedPlatformName}</span>
            <ChevronDown size={14} className={`transition-transform ${isPlatformOpen ? 'rotate-180' : ''}`} />
          </button>

          {isPlatformOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPlatformOpen(false)} />
              <div className="absolute top-full left-0 mt-1 w-48 bg-bgContainer border border-borderDefault rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id || 'all'}
                    onClick={() => handlePlatformSelect(p.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-bgOverlay transition ${
                      selectedPlatform === p.id ? 'text-success' : 'text-textPrimary'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Refresh Button */}
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-2 bg-bgContainer border border-borderDefault rounded-lg px-3 py-1.5 text-sm text-textPrimary hover:bg-bgOverlay transition disabled:opacity-50"
      >
        <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
        <span className="hidden sm:inline">Refresh</span>
      </button>
    </div>
  );
}
