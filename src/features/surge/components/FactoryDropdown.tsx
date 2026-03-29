'use client';

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

export interface Factory {
  id: string;
  name: string;
  icon: string;
  chainId?: string;
}

export const FactoryDropdown: React.FC<{
  selectedFactories: string[];
  onFactorySelect: (name: string) => void;
  factories: Factory[];
  loading?: boolean;
}> = ({ selectedFactories, onFactorySelect, factories, loading = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredFactories = useMemo(() => {
    if (!searchQuery.trim()) return factories;
    const query = searchQuery.toLowerCase();
    return factories.filter((f) => f.name.toLowerCase().includes(query));
  }, [factories, searchQuery]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClose = () => {
      setIsOpen(false);
      setSearchQuery('');
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) searchInputRef.current?.focus();
  }, [isOpen]);

  const toggle = useCallback(
    (name: string) => onFactorySelect(name),
    [onFactorySelect],
  );

  const selectedLabel =
    selectedFactories.length > 0
      ? selectedFactories
          .map((n) => factories.find((f) => f.name === n)?.name ?? n)
          .join(', ')
      : 'Select Factory';

  const displayLabel =
    selectedLabel.length > 20
      ? `${selectedLabel.substring(0, 17)}...`
      : selectedLabel;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading || factories.length === 0}
        title={selectedLabel}
        className="flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-all border rounded bg-bgContainer/5 border-borderDarkSlateGray text-textSecondary hover:text-textPrimary hover:border-borderDefault w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate">
          {loading ? 'Loading...' : displayLabel}
        </span>
        <svg
          className={`w-3.5 h-3.5 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {isOpen && !loading && factories.length > 0 && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-bgPrimary border border-borderDefault shadow-lg z-50 rounded overflow-hidden flex flex-col max-h-80">
          {/* Search */}
          <div className="sticky top-0 bg-bgPrimary border-b border-borderDefault p-2.5 flex-shrink-0">
            <div className="relative flex items-center">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textTertiary flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-bgOverlay border border-borderDefault rounded px-3 py-2 pl-8 text-xs text-textPrimary placeholder:text-textTertiary focus:outline-none focus:ring-1 focus:ring-success/40 focus:border-success/40"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-textTertiary hover:text-textPrimary transition-colors flex-shrink-0"
                  aria-label="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {filteredFactories.length > 0 ? (
              filteredFactories.map((f, idx) => (
                <button
                  key={`${f.name}-${f.chainId}-${idx}`}
                  onClick={() => toggle(f.name)}
                  className={`w-full px-3 py-2.5 text-xs transition-colors flex items-center gap-2.5 hover:bg-bgTertiary ${
                    selectedFactories.includes(f.name)
                      ? 'bg-success/10 text-success'
                      : 'text-textSecondary'
                  }`}
                >
                  <div className="flex-shrink-0">
                    <Checkbox
                      checked={selectedFactories.includes(f.name)}
                      onChange={() => {}}
                      className="border-[#323542] data-[state=checked]:bg-success data-[state=checked]:border-success"
                    />
                  </div>
                  {f.icon && (
                    <img src={f.icon} alt="" className="w-4 h-4 rounded-full flex-shrink-0" />
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-medium truncate">{f.name}</div>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-xs text-textTertiary">
                No factories found
              </div>
            )}
          </div>

          {/* Footer */}
          {selectedFactories.length > 0 && (
            <div className="sticky bottom-0 bg-bgOverlay border-t border-borderDefault px-3 py-2 flex-shrink-0">
              <p className="text-xs text-textTertiary">
                {selectedFactories.length} factor{selectedFactories.length !== 1 ? 'ies' : 'y'} selected
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
