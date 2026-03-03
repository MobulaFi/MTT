'use client';

import { useState, useMemo, useCallback } from 'react';
import { Search, X, TrendingUp, Sparkles, Clock } from 'lucide-react';
import MarketCard from './MarketCard';
import { usePMStore, type PMViewName } from '../store/usePMStore';
import type { PMMarket } from '../types';

interface MarketSectionProps {
  title: string;
  viewName: PMViewName;
  icon?: 'trending' | 'new' | 'closing';
  showSearch?: boolean;
}

const ICONS = {
  trending: TrendingUp,
  new: Sparkles,
  closing: Clock,
};

export default function MarketSection({ title, viewName, icon = 'trending', showSearch = true }: MarketSectionProps) {
  const [localSearch, setLocalSearch] = useState('');
  const { sections, setSearchQuery, getFilteredMarkets } = usePMStore();
  const section = sections[viewName];
  
  const Icon = ICONS[icon];

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalSearch(value);
      setSearchQuery(viewName, value);
    },
    [viewName, setSearchQuery]
  );

  const clearSearch = useCallback(() => {
    setLocalSearch('');
    setSearchQuery(viewName, '');
  }, [viewName, setSearchQuery]);

  const filteredMarkets = useMemo(() => {
    return getFilteredMarkets(viewName);
  }, [viewName, getFilteredMarkets, section.searchQuery, section.markets]);

  // Badge state
  const getBadgeState = () => {
    if (section.loading) {
      return { text: 'LOADING', color: 'bg-warning/20', textColor: 'text-warning' };
    }
    if (section.error) {
      return { text: 'ERROR', color: 'bg-danger/20', textColor: 'text-danger' };
    }
    return { text: 'LIVE', color: 'bg-success/20', textColor: 'text-success' };
  };

  const badge = getBadgeState();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-borderDefault bg-bgPrimary sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-success" />
          <h2 className="text-sm font-semibold text-textPrimary">{title}</h2>
          <span className="text-xs text-textTertiary">({filteredMarkets.length})</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.color} ${badge.textColor}`}>
            {badge.text}
          </span>
        </div>
      </div>

      {/* Search - only show if showSearch is true */}
      {showSearch && (
        <div className="p-2 border-b border-borderDefault">
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-textTertiary" />
            <input
              type="text"
              value={localSearch}
              onChange={handleSearchChange}
              placeholder="Search markets..."
              className="w-full bg-bgOverlay border border-borderDefault rounded-md pl-7 pr-7 py-1.5 text-xs text-textPrimary placeholder-textTertiary focus:outline-none focus:border-borderSecondary"
            />
            {localSearch && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-textTertiary hover:text-textPrimary"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Markets List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {section.loading && filteredMarkets.length === 0 ? (
          // Loading skeletons
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-bgContainer border border-borderDefault rounded-lg p-3 animate-pulse"
            >
              <div className="h-4 bg-bgOverlay rounded w-3/4 mb-3" />
              <div className="h-2 bg-bgOverlay rounded-full mb-3" />
              <div className="flex justify-between">
                <div className="h-3 bg-bgOverlay rounded w-16" />
                <div className="h-3 bg-bgOverlay rounded w-16" />
                <div className="h-3 bg-bgOverlay rounded w-12" />
              </div>
            </div>
          ))
        ) : filteredMarkets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-textTertiary">
            <Search size={24} className="mb-2 opacity-50" />
            <p className="text-sm">No markets found</p>
            {localSearch && (
              <button
                onClick={clearSearch}
                className="mt-2 text-xs text-success hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          filteredMarkets.map((market) => (
            <MarketCard key={`${market.platform}:${market.marketId}`} market={market} />
          ))
        )}
      </div>
    </div>
  );
}
