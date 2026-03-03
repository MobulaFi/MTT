'use client';

import { useState, useCallback, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import PMHeader from '@/features/predictions/components/PMHeader';
import MarketSection from '@/features/predictions/components/MarketSection';
import MarketCard from '@/features/predictions/components/MarketCard';
import { usePMData } from '@/features/predictions/hooks/usePMData';
import { usePMStore } from '@/features/predictions/store/usePMStore';
import { searchMarkets } from '@/features/predictions/api/pmApi';
import type { PMMarket } from '@/features/predictions/types';

export default function PredictionsPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState<PMMarket[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const { refreshAll, loading, error } = usePMData({ enabled: true, refreshInterval: 10000 });
  const { setSearchQuery } = usePMStore();

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshAll();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [refreshAll]);

  // Debounced search effect
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (!globalSearch.trim()) {
        setSearchResults([]);
        setSearchError(null);
        return;
      }

      try {
        setIsSearching(true);
        setSearchError(null);
        const response = await searchMarkets({
          query: globalSearch,
          limit: 100,
        });
        setSearchResults(response.data);
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : 'Search failed');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(searchTimeout);
  }, [globalSearch]);

  const handleGlobalSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setGlobalSearch(e.target.value);
  }, []);

  const clearGlobalSearch = useCallback(() => {
    setGlobalSearch('');
    setSearchResults([]);
    setSearchError(null);
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-danger">
        <p>Error loading prediction markets: {error}</p>
      </div>
    );
  }

  return (
    <div className="bg-bgPrimary min-h-screen">
      {/* Header */}
      <div className="pt-3 pb-1">
        <PMHeader onRefresh={handleRefresh} isRefreshing={isRefreshing || loading} />
      </div>

      {/* Global Search Bar */}
      <div className="px-4 pb-3">
        <div className="relative max-w-2xl mx-auto">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-textTertiary" />
          <input
            type="text"
            value={globalSearch}
            onChange={handleGlobalSearch}
            placeholder="Search all prediction markets..."
            className="w-full bg-bgOverlay border border-borderDefault rounded-lg pl-10 pr-10 py-2.5 text-sm text-textPrimary placeholder-textTertiary focus:outline-none focus:border-borderSecondary focus:ring-1 focus:ring-borderSecondary"
          />
          {globalSearch && (
            <button
              onClick={clearGlobalSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-textTertiary hover:text-textPrimary transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Three Column Grid or Search Results */}
      <div className="px-4 pb-4">
        {globalSearch.trim() ? (
          // Search Results View
          <div className="border border-borderDefault rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-borderDefault bg-bgPrimary">
              <div className="flex items-center gap-2">
                <Search size={16} className="text-success" />
                <h2 className="text-sm font-semibold text-textPrimary">Search Results</h2>
                <span className="text-xs text-textTertiary">({searchResults.length})</span>
                {isSearching && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning">SEARCHING</span>
                )}
                {searchError && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-danger/20 text-danger">ERROR</span>
                )}
              </div>
            </div>
            <div className="overflow-y-auto p-2 space-y-2" style={{ maxHeight: 'calc(100vh - 250px)' }}>
              {isSearching ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-bgContainer border border-borderDefault rounded-lg p-3 animate-pulse">
                    <div className="h-4 bg-bgOverlay rounded w-3/4 mb-3" />
                    <div className="h-2 bg-bgOverlay rounded-full mb-3" />
                    <div className="flex justify-between">
                      <div className="h-3 bg-bgOverlay rounded w-16" />
                      <div className="h-3 bg-bgOverlay rounded w-16" />
                      <div className="h-3 bg-bgOverlay rounded w-12" />
                    </div>
                  </div>
                ))
              ) : searchError ? (
                <div className="flex flex-col items-center justify-center py-8 text-danger">
                  <p className="text-sm">{searchError}</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-textTertiary">
                  <Search size={24} className="mb-2 opacity-50" />
                  <p className="text-sm">No markets found for "{globalSearch}"</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {searchResults.map((market) => (
                    <MarketCard key={`${market.platform}:${market.marketId}`} market={market} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          // Normal Three Column View
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-0 min-h-[calc(100vh-200px)]">
            {/* New Markets */}
            <div className="border border-borderDefault md:border-r-0 md:rounded-l-lg overflow-hidden">
              <MarketSection title="New Markets" viewName="new" icon="new" showSearch />
            </div>

            {/* Trending Markets */}
            <div className="border border-borderDefault border-t-0 md:border-t overflow-hidden">
              <MarketSection title="Trending" viewName="trending" icon="trending" showSearch />
            </div>

            {/* Closing Soon */}
            <div className="border border-borderDefault border-t-0 md:border-t md:border-l-0 md:rounded-r-lg overflow-hidden">
              <MarketSection title="Closing Soon" viewName="closing" icon="closing" showSearch />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
