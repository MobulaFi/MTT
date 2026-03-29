'use client';

import { SlidersHorizontal, Search, X } from 'lucide-react';
import { useState, useMemo, useCallback, useRef, memo } from 'react';
import { useNavigationStore } from '@/store/useNavigationStore';
import { toBlockchain } from '@/lib/format';
import TokenCard from './TokenCard';
import FilterModal from './FilterModal';
import { usePulseFilterStore } from '@/features/pulse/store/usePulseModalFilterStore';
import { useUnifiedStreamContext } from '@/features/pulse/context/UnifiedStreamContext';
import { usePulseDataStore, ViewName, PulseToken } from '@/features/pulse/store/usePulseDataStore';
import { usePulseDisplayStore } from '@/features/pulse/store/usePulseDisplayStore';

const mono = 'var(--font-mono, monospace)';

function PulseTokenSkeleton() {
  return (
    <div style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ width: 68, height: 68, borderRadius: 1, background: '#111114', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 80, height: 18, borderRadius: 2, background: '#111114' }} />
            <div style={{ width: 100, height: 18, borderRadius: 2, background: '#111114' }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 30, height: 14, borderRadius: 2, background: '#111114' }} />
            <div style={{ width: 40, height: 14, borderRadius: 2, background: '#111114' }} />
            <div style={{ width: 30, height: 14, borderRadius: 2, background: '#111114' }} />
            <div style={{ width: 30, height: 14, borderRadius: 2, background: '#111114' }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 60, height: 14, borderRadius: 2, background: '#111114' }} />
            <div style={{ width: 50, height: 14, borderRadius: 2, background: '#111114' }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ width: 90, height: 18, borderRadius: 2, background: '#111114', marginBottom: 3 }} />
            <div style={{ width: 70, height: 18, borderRadius: 2, background: '#111114' }} />
          </div>
          <div style={{ width: 90, height: 4, borderRadius: 1, background: '#111114' }} />
        </div>
      </div>
    </div>
  );
}

interface TokenSectionProps {
  title: string;
  viewName: ViewName;
  shouldBonded?: boolean;
  showExpand?: boolean;
}

const extractTokenKey = (token: PulseToken): { address: string; chainId: string } | null => {
  const flatToken = token?.token?.address ? token.token : token;
  if (!flatToken?.address) return null;
  return { address: flatToken.address, chainId: flatToken.chainId || '' };
};

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

const PulseTokenLink = memo(({ tokenKey, pulseToken, shouldBonded, viewName, index }: {
  tokenKey: { address: string; chainId: string };
  pulseToken: PulseToken;
  shouldBonded: boolean;
  viewName: ViewName;
  index: number;
}) => {
  const navigateToToken = useNavigationStore((s) => s.navigateToToken);
  return (
    <div
      style={{ cursor: 'pointer' }}
      onClick={() => navigateToToken(tokenKey.address, toBlockchain(tokenKey.chainId), pulseToken as Record<string, unknown>)}
    >
      <TokenCard pulseData={pulseToken} shouldBonded={shouldBonded} viewName={viewName} index={index} />
    </div>
  );
});
PulseTokenLink.displayName = 'PulseTokenLink';

export default function TokenSection({
  title,
  viewName,
  shouldBonded = false,
  showExpand = true,
}: TokenSectionProps) {
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { hideSearchBar } = usePulseDisplayStore();
  const tokens = usePulseDataStore((state) => state.sections[viewName].tokens);
  const searchQuery = usePulseDataStore((state) => state.sections[viewName].searchQuery);
  const loading = usePulseDataStore((state) => state.sections[viewName].loading);
  const error = usePulseDataStore((state) => state.sections[viewName].error);
  const setSearchQuery = usePulseDataStore((state) => state.setSearchQuery);

  const { sections: filterSections } = usePulseFilterStore();
  const { isStreaming } = useUnifiedStreamContext();

  const filteredTokens = useMemo(() => filterTokensBySearch(tokens, searchQuery), [tokens, searchQuery]);

  const handleFilterOpen = useCallback(() => setIsFilterModalOpen(true), []);
  const handleFilterClose = useCallback(() => setIsFilterModalOpen(false), []);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(viewName, e.target.value),
    [viewName, setSearchQuery]
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery(viewName, '');
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
      searchInputRef.current.focus();
    }
  }, [viewName, setSearchQuery]);

  return (
    <div style={{
      background: '#0E0E12',
      maxHeight: 'calc(100vh - 20vh)',
      overflow: 'hidden auto',
      position: 'relative',
      minWidth: 0,
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#0D0D10',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 18px',
        borderBottom: '1px solid #1A1A1E',
        fontFamily: mono,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 16, color: '#E8E8EC' }}>{title}</span>
          <span style={{ fontSize: 14, color: viewName === 'new' ? '#60A5FA' : viewName === 'bonding' ? '#00DC82' : '#F0B90B' }}>
            {searchQuery ? `${filteredTokens.length}/${tokens.length}` : tokens.length}
          </span>
          {/* Live dot */}
          <div style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: isStreaming ? '#00DC82' : '#4A4A52',
            boxShadow: isStreaming ? '0 0 6px #00DC82' : 'none',
          }} />

          {/* Inline search */}
          {hideSearchBar && (
            <div style={{ flex: 1, position: 'relative', maxWidth: 240 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#4A4A52' }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={handleSearchChange}
                style={{
                  width: '100%', background: '#08080A', border: '1px solid #1A1A1E',
                  borderRadius: 3, padding: '5px 10px 5px 30px',
                  fontSize: 14, color: '#E8E8EC', outline: 'none', fontFamily: mono,
                }}
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#4A4A52', lineHeight: 0,
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Filter button */}
        <button
          type="button"
          onClick={handleFilterOpen}
          style={{
            background: 'none', border: 'none', padding: 4, cursor: 'pointer',
            color: '#4A4A52', lineHeight: 0, flexShrink: 0,
          }}
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 18px', fontSize: 14, color: '#FF4757', textAlign: 'center',
          borderBottom: '1px solid rgba(255,71,87,0.15)', background: 'rgba(255,71,87,0.03)',
          fontFamily: mono,
        }}>
          {error}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginLeft: 8, color: '#FF4757', background: 'none', border: 'none',
              textDecoration: 'underline', cursor: 'pointer', fontSize: 14, fontFamily: mono,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Token List */}
      <div>
        {filteredTokens.length === 0 && tokens.length === 0 && !searchQuery && !error ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ borderBottom: '1px solid #1A1A1E' }}>
              <PulseTokenSkeleton />
            </div>
          ))
        ) : filteredTokens.length === 0 ? (
          <div style={{
            padding: '24px 18px', color: '#4A4A52', fontSize: 14,
            textAlign: 'center', fontFamily: mono,
          }}>
            {searchQuery
              ? `No tokens match "${searchQuery}"`
              : 'No tokens match the selected filters'
            }
          </div>
        ) : (
          filteredTokens.map((pulseToken: PulseToken, idx: number) => {
            const tokenKey = extractTokenKey(pulseToken);
            if (!tokenKey) return null;
            return (
              <PulseTokenLink
                key={`${tokenKey.address}-${tokenKey.chainId}`}
                tokenKey={tokenKey}
                pulseToken={pulseToken}
                shouldBonded={shouldBonded}
                viewName={viewName}
                index={idx}
              />
            );
          })
        )}
      </div>

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={handleFilterClose}
        activeSection={title}
      />
    </div>
  );
}
