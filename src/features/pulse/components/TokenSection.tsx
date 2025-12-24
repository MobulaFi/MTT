'use client';

import { ArrowUpDownIcon as ArrowsUpDown, SlidersHorizontal, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import TokenCard from './TokenCard';
import FilterModal from './FilterModal';
import { usePulseFilterStore } from '@/features/pulse/store/usePulseModalFilterStore';
import { usePulseStreamContext } from '@/features/pulse/context/PulseStreamContext';
import { usePulseDataStore, ViewName, PulseToken } from '@/features/pulse/store/usePulseDataStore';
import { usePulseDisplayStore } from '@/features/pulse/store/usePulseDisplayStore';
import { shallow } from 'zustand/shallow';

interface TokenSectionProps {
  title: string;
  viewName: ViewName;
  shouldBonded?: boolean;
  showExpand?: boolean;
}

interface BadgeState {
  text: string;
  textColor: string;
  color: string;
}

/**
 * Extract token address and flatten nested token structure
 */
const extractTokenKey = (token: PulseToken): { address: string; chainId: string } | null => {
  const flatToken = token?.token?.address ? token.token : token;

  if (!flatToken?.address) return null;

  return {
    address: flatToken.address,
    chainId: flatToken.chainId || '',
  };
};

/**
 * Filter tokens based on search query
 */
function filterTokensBySearch(tokens: PulseToken[], query: string): PulseToken[] {
  if (!query.trim()) return tokens;

  const lowerQuery = query.toLowerCase();

  return tokens.filter((token) => {
    const flatToken = token?.token?.address ? token.token : token;
    const name = (flatToken && 'name' in flatToken && typeof flatToken.name === 'string' ? flatToken.name : '').toLowerCase();
    const symbol = (flatToken && 'symbol' in flatToken && typeof flatToken.symbol === 'string' ? flatToken.symbol : '').toLowerCase();
    const address = (flatToken?.address || '').toLowerCase();

    return name.includes(lowerQuery) || symbol.includes(lowerQuery) || address.includes(lowerQuery);
  });
}

/**
 * Get badge state based on stream status
 * 
 * Logic:
 * - REST data loaded and WebSocket streaming → LIVE
 * - REST data loaded but WebSocket not connected/streaming yet → PAUSED (waiting for real-time)
 * - REST data loaded and WebSocket paused → PAUSED
 * - REST data loaded and WebSocket reconnecting → RECONNECTING
 * - No REST data yet → OFFLINE
 */
const getBadgeState = (
  hasInitialData: boolean,
  isPaused: boolean,
  isReconnecting: boolean,
  isStreaming: boolean,
  isConnected: boolean
): BadgeState => {
  // No REST data yet → OFFLINE
  if (!hasInitialData) {
    return {
      text: 'OFFLINE',
      textColor: 'text-textPrimary',
      color: 'bg-grayGhost/50',
    };
  }
  
  // If we have REST data but WebSocket is reconnecting
  if (isReconnecting) {
    return {
      text: 'RECONNECTING',
      textColor: 'text-warning',
      color: 'bg-warning/20 border-warning/40',
    };
  }
  
  // If we have REST data and WebSocket is streaming → LIVE
  if (isStreaming) {
    return {
      text: 'LIVE',
      textColor: 'text-success',
      color: 'bg-success/20 border-success/40',
    };
  }
  
  // If we have REST data but WebSocket is paused or not connected → PAUSED
  // This covers: REST loaded but WebSocket not connected yet, or WebSocket paused
  if (isPaused || !isConnected) {
    return {
      text: 'PAUSED',
      textColor: 'text-warning',
      color: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400',
    };
  }
  
  // Fallback: Should not reach here, but if we have REST data → LIVE
  return {
    text: 'LIVE',
    textColor: 'text-success',
    color: 'bg-success/20 border-success/40',
  };
};

/**
 * TokenSection - Enhanced with Search
 *
 * Changes from original:
 * 1. Takes viewName prop instead of deriving from title
 * 2. Uses usePulseDataStore for its specific view's data
 * 3. Independent loading state per section
 * 4. NEW: Search functionality
 * 5. NEW: Shows filtered token count
 *
 * Features:
 * - Search by token name, symbol, or address
 * - Live filtering as you type
 * - Clear search button
 * - Shows both total and filtered counts
 * - Each section loads independently
 */
export default function TokenSection({
  title,
  viewName,
  shouldBonded = false,
  showExpand = true,
}: TokenSectionProps) {
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { hideSearchBar } = usePulseDisplayStore();
  // Use granular selectors with shallow equality to avoid unnecessary re-renders
  const tokens = usePulseDataStore((state) => state.sections[viewName].tokens);
  const searchQuery = usePulseDataStore((state) => state.sections[viewName].searchQuery);
  const loading = usePulseDataStore((state) => state.sections[viewName].loading);
  const error = usePulseDataStore((state) => state.sections[viewName].error);
  const setSearchQuery = usePulseDataStore((state) => state.setSearchQuery);

  const { sections: filterSections } = usePulseFilterStore();
  const { isPaused, isReconnecting, isStreaming, isConnected, hasInitialData } = usePulseStreamContext();

  const badgeState = useMemo(() => {
    return getBadgeState(hasInitialData, isPaused, isReconnecting, isStreaming, isConnected);
  }, [hasInitialData, isPaused, isReconnecting, isStreaming, isConnected]);

  const isLoading = isPaused || isReconnecting;

  // Get filtered tokens based on search query (memoized)
  const filteredTokens = useMemo(() => {
    return filterTokensBySearch(tokens, searchQuery);
  }, [tokens, searchQuery]);

  const handleFilterOpen = useCallback(() => {
    setIsFilterModalOpen(true);
  }, []);

  const handleFilterClose = useCallback(() => {
    setIsFilterModalOpen(false);
  }, []);

  // Handle search input change
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(viewName, e.target.value);
    },
    [viewName, setSearchQuery]
  );

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery(viewName, '');
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
      searchInputRef.current.focus();
    }
  }, [viewName, setSearchQuery]);

  return (
    <div className="bg-bgPrimary max-h-[calc(100vh-20vh)] custom-scrollbar overflow-hidden overflow-y-auto relative">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bgOverlay flex justify-between items-center px-3 py-1.5 border-y border-borderDefault">
        <div className="flex items-center gap-2 min-w-0 flex-1 py-2">
          <h2 className="text-sm font-medium text-white truncate">{title}</h2>

          {/* Token Count */}
          <span className="text-xs text-textTertiary font-medium">
            ({searchQuery ? `${filteredTokens.length}/${tokens.length}` : tokens.length})
          </span>

          {/* Status Badge */}
          <div className="relative w-4 h-4 flex-shrink-0">
            <div
              className={`absolute inset-0 rounded-full ${badgeState.color} bg-opacity-30 animate-blink`}
            />
            <div
              className={`absolute top-1/2 left-1/2 w-2 h-2 rounded-full ${badgeState.color} -translate-x-1/2 -translate-y-1/2 animate-blink`}
            />
          </div>

          <span className={`text-xs font-medium truncate ${badgeState.textColor}`}>
            {badgeState.text}
          </span>

          {
            hideSearchBar && (
              <>
                      {/* Search Bar - NEW FEATURE */}
      <div className="px-3 ">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-textTertiary" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search tokens by name, symbol, or address..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full bg-bgOverlay border border-borderDefault rounded-md pl-9 pr-9 py-1.5 text-xs text-textPrimary placeholder:text-textTertiary focus:outline-none focus:ring-1 focus:ring-success/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-textTertiary hover:text-textPrimary transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
              </>
            )
          }
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="p-1 cursor-pointer hover:bg-gray-700 rounded transition-colors"
                  aria-label="Open filters"
                  onClick={handleFilterOpen}
                >
                  <SlidersHorizontal
                    className={`h-4 w-4 ${
                      isLoading ? 'text-gray-600 opacity-50' : 'text-gray-400'
                    }`}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span className="text-xs">
                  {isLoading ? 'Applying filters...' : 'Filters'}
                </span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {showExpand && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                    aria-label="Expand"
                  >
                    <ArrowsUpDown className="h-3 w-3 text-gray-400" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <span className="text-xs">Expand</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>



      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-20 pointer-events-none">
          <div className="text-center">
            <div className="mb-2 flex justify-center">
              <div className="animate-spin">
                <span className="text-2xl">⏳</span>
              </div>
            </div>
            <p className="text-sm text-white font-medium">
              {isPaused ? 'Pausing...' : 'Applying filters...'}
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 text-red-500 text-xs text-center border-b border-red-500/20 bg-red-500/5">
          Error: {error}
          <button
            onClick={() => window.location.reload()}
            className="ml-2 text-red-400 hover:text-red-300 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Token List */}
      <div className="space-y-0">
        {filteredTokens.length === 0 ? (
          <div className="p-4 text-gray-500 text-xs text-center">
            {loading ? (
              'Loading tokens...'
            ) : searchQuery ? (
              <>
                No tokens match <span className="text-textPrimary font-medium">&quot;{searchQuery}&quot;</span>
              </>
            ) : (
              "No tokens match the selected filters"
            )}
          </div>
        ) : (
          filteredTokens.map((pulseToken: PulseToken) => {
            const tokenKey = extractTokenKey(pulseToken);
            if (!tokenKey) return null;

            return (
              <div
                key={`${tokenKey.address}-${tokenKey.chainId}`}
                className={`border-b-[1px] border-borderDefault transition-all duration-300 ${
                  isLoading ? 'opacity-70 pointer-events-none' : 'opacity-100'
                } animate-in slide-in-from-top-2 duration-300`}
              >
                <Link href={`/token/${tokenKey.chainId}/${tokenKey.address}`}>
                  <TokenCard pulseData={pulseToken} shouldBonded={shouldBonded} viewName={viewName} />
                </Link>
              </div>
            );
          })
        )}
      </div>

      {/* Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={handleFilterClose}
        activeSection={title}
      />
    </div>
  );
}