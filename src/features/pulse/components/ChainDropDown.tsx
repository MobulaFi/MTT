import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";

export interface Protocol {
  id: string;
  name: string;
  icon: string;
  chainId?: string;
}

export interface Chain {
  id: string;
  name: string;
  label: string;
}

export const ChainDropdown: React.FC<{
  selectedChains: string[];
  onChainSelect: (chainId: string) => void;
  chains: Chain[];
  loading?: boolean;
}> = ({ selectedChains, onChainSelect, chains, loading = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter chains based on search query
  const filteredChains = useMemo(() => {
    if (!searchQuery.trim()) return chains;
    
    const query = searchQuery.toLowerCase();
    return chains.filter(chain => 
      chain.name.toLowerCase().includes(query) ||
      chain.label.toLowerCase().includes(query) ||
      chain.id.toLowerCase().includes(query)
    );
  }, [chains, searchQuery]);

  // Single effect to handle all keyboard and click outside interactions
  useEffect(() => {
    if (!isOpen) return;

    const handleClose = () => {
      setIsOpen(false);
      setSearchQuery("");
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
    }
  }, [isOpen]);

  const toggleChain = useCallback((chainId: string) => {
    onChainSelect(chainId);
  }, [onChainSelect]);

  const selectedChainLabel = selectedChains.length > 0
    ? selectedChains.map(id => chains.find(c => c.id === id)?.label).join(", ")
    : "Select Chain";

  const displayLabel = selectedChainLabel.length > 20 
    ? `${selectedChainLabel.substring(0, 17)}...`
    : selectedChainLabel;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading || chains.length === 0}
        title={selectedChainLabel}
        className="flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-all border rounded bg-bgContainer/5 border-borderDarkSlateGray text-textSecondary hover:text-textPrimary hover:border-borderDefault w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate">
          {loading ? "Loading..." : displayLabel}
        </span>

        <svg
          className={`w-3.5 h-3.5 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && !loading && chains.length > 0 && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-bgPrimary border border-borderDefault shadow-lg z-50 rounded overflow-hidden flex flex-col max-h-80">
          {/* Search Input */}
          <div className="sticky top-0 bg-bgPrimary border-b border-borderDefault p-2.5 flex-shrink-0">
            <div className="relative flex items-center">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textTertiary flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
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
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-textTertiary hover:text-textPrimary transition-colors flex-shrink-0"
                  aria-label="Clear search"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Chains List */}
          <div className="overflow-y-auto flex-1">
            {filteredChains.length > 0 ? (
              filteredChains.map((chain,idx) => (
                <button
                  key={`${chain.id}-${chain.name}-idx`}
                  onClick={() => toggleChain(chain.id)}
                  className={`w-full px-3 py-2.5 text-xs transition-colors flex items-center gap-2.5 hover:bg-bgTertiary ${
                    selectedChains.includes(chain.id)
                      ? "bg-success/10 text-success"
                      : "text-textSecondary"
                  }`}
                >
                  <div className="flex-shrink-0">
                    <Checkbox
                      checked={selectedChains.includes(chain.id)}
                      onChange={() => {}}
                      className="border-[#323542] data-[state=checked]:bg-success data-[state=checked]:border-success"
                    />
                  </div>
                  
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-medium truncate">{chain.name}</div>
                    <div className={`text-xs ${selectedChains.includes(chain.id) ? "text-success/70" : "text-textTertiary"}`}>
                      {chain.id}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-xs text-textTertiary">
                No chains found
              </div>
            )}
          </div>

          {/* Summary Footer */}
          {selectedChains.length > 0 && (
            <div className="sticky bottom-0 bg-bgOverlay border-t border-borderDefault px-3 py-2 flex-shrink-0">
              <p className="text-xs text-textTertiary">
                {selectedChains.length} chain{selectedChains.length !== 1 ? "s" : ""} selected
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};