'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FiSearch } from 'react-icons/fi';
import { X, Clock, BarChart2, Layers, LayoutGrid, ChevronDown, Coins, PiggyBank } from 'lucide-react';
import { useSearchStore, type SortByType } from '@/store/searchStore';
import { useRouter } from 'next/navigation';
import { formatCryptoPrice, truncate } from '@mobula_labs/sdk';
import { formatPriceWithPlaceholder } from '@/utils/tokenMetrics';
import TimeAgo from '@/utils/TimeAgo';
import CopyToClipboard from '@/utils/CopyToClipboard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { PoolType } from '@mobula_labs/sdk';
import SafeImage, { validateImageUrl } from './SafeImage';

const sortOptions = [
  { icon: Clock, key: 'created_at', label: 'Sort results by Time' },
  { icon: LayoutGrid, key: 'market_cap', label: 'Sort results by Market Cap' },
  { icon: BarChart2, key: 'volume_24h', label: 'Sort results by 24h volume' },
  { icon: Coins, key: 'fees_paid_24h', label: 'Sort results by fees paid in 24h' },
  { icon: PiggyBank, key: 'total_fees_paid_usd', label: 'Sort results by total fees paid' },
  { icon: Layers, key: 'holders_count', label: 'Sort results by holders count' },
] as const;

const numberFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

const formatCompactNumber = (value?: number | string | null) => {
  if (value === undefined || value === null) return '-';
  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(numericValue)) return '-';
  if (Math.abs(numericValue) < 1) {
    return numericValue.toFixed(2);
  }
  return numberFormatter.format(numericValue);
};

const getChangeDisplay = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return { label: '0.00%', className: 'text-textSecondary' };
  }
  const rounded = value.toFixed(2);
  const prefix = value > 0 ? '+' : '';
  const className =
    value > 0 ? 'text-success' : value < 0 ? 'text-error' : 'text-textSecondary';
  return { label: `${prefix}${rounded}%`, className };
};

type CombinedResultEntry = {
  section: 'tokens' | 'pools';
  item: any;
  globalIndex: number;
};

const blockchainMap: Record<string, string> = {
  'All chains': '',
  'Ethereum': 'evm:1',
  'BSC': 'evm:56',
  'Polygon': 'evm:137',
  'Avalanche': 'evm:43114',
  'Solana': 'solana:solana',
  'Arbitrum': 'evm:42161',
  'Optimism': 'evm:10',
  'Base': 'evm:8453',
};

const mainPoolTypes = [
  PoolType.Pumpfun,
  PoolType.Heaven,
  PoolType.Boop,
  PoolType.Fourmeme,
  PoolType.UniswapV4,
];

const additionalPoolTypes = [
  PoolType.GteBondingV1,
  PoolType.Curve,
  PoolType.Balancer,
  PoolType.RaydiumCLMM,
  PoolType.WenRich,
  PoolType.Orca,
  PoolType.Meteora,
  PoolType.RaydiumLaunchlab,
  PoolType.MeteoraDYN,
  PoolType.LiquidityBookV2_1,
];

const getPlaceholderInitial = (symbol?: string | null, name?: string | null) => {
  const source = symbol?.trim() || name?.trim() || '?';
  return source.charAt(0).toUpperCase() || '?';
};

type TokenLogoBadgeProps = {
  logo?: string | null;
  symbol?: string | null;
  name?: string | null;
  priority?: boolean;
};

const TokenLogoBadge = ({ logo, name, symbol, priority }: TokenLogoBadgeProps) => {
  const validatedLogo = useMemo(() => (logo ? validateImageUrl(logo) : null), [logo]);
  const [showPlaceholder, setShowPlaceholder] = useState(!validatedLogo);

  useEffect(() => {
    setShowPlaceholder(!validatedLogo);
  }, [validatedLogo]);

  return (
    <div className="w-11 h-11 flex items-center justify-center rounded-full bg-bgOverlay border border-borderDefault overflow-hidden flex-shrink-0">
      {!showPlaceholder && validatedLogo ? (
        <SafeImage
          src={validatedLogo}
          alt={name || symbol || 'Token'}
          width={44}
          height={44}
          className="object-contain rounded-full"
          fallbackSrc={validatedLogo}
          priority={priority}
          onError={() => setShowPlaceholder(true)}
        />
      ) : (
        <span className="text-base font-semibold text-textPrimary uppercase">
          {getPlaceholderInitial(symbol, name)}
        </span>
      )}
    </div>
  );
};

export const SearchModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const {
    results,
    isLoading,
    query,
    sortBy,
    setSortBy,
    fetchSearch,
    clearSearch,
    poolTypes: storePoolTypes,
    blockchains: storeBlockchains,
    setPoolTypes,
    setBlockchains,
  } = useSearchStore();

  const [input, setInput] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedPoolTypes, setSelectedPoolTypes] = useState<Set<PoolType>>(new Set());
  const [showAllPoolTypes, setShowAllPoolTypes] = useState(false);
  const [showChainDropdown, setShowChainDropdown] = useState(false);
  const [selectedChain, setSelectedChain] = useState('All chains');

  const router = useRouter();
  const resultsRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleSortChange = (newSortBy: SortByType | null) => {
    setSortBy(newSortBy);
    if (query.trim().length > 1) {
      fetchSearch(query, newSortBy);
    }
  };

  const togglePoolType = (poolType: PoolType) => {
    setSelectedPoolTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(poolType)) {
        newSet.delete(poolType);
      } else {
        newSet.add(poolType);
      }
      setPoolTypes(Array.from(newSet));
      return newSet;
    });
    setSelectedIndex(0);
  };

  const clearPoolTypeFilters = () => {
    setSelectedPoolTypes(new Set());
    setPoolTypes([]);
  };

  const handleChainChange = (chainName: string) => {
    setSelectedChain(chainName);
    setShowChainDropdown(false);
    // Update store with new blockchain
    const chainId = blockchainMap[chainName];
    if (chainId) {
      setBlockchains([chainId]);
    } else {
      setBlockchains([]);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (input.trim()) fetchSearch(input);
      else clearSearch();
    }, 100);
    return () => clearTimeout(timeout);
  }, [input, fetchSearch, clearSearch]);

  useEffect(() => {
    if (query && query.trim().length >= 2) {
      fetchSearch(query);
    }
  }, [storePoolTypes, storeBlockchains]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        setShowChainDropdown(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const tokenEntries = useMemo<CombinedResultEntry[]>(() => {
    return results.map((item: any, idx) => ({
      section: 'tokens' as const,
      item,
      globalIndex: idx,
    }));
  }, [results]);

  const poolEntries = useMemo<CombinedResultEntry[]>(() => {
    let offset = results.length;
    return results.reduce<CombinedResultEntry[]>((acc, item: any) => {
      if (!item?.poolAddress) {
        return acc;
      }
      acc.push({
        section: 'pools',
        item,
        globalIndex: offset++,
      });
      return acc;
    }, []);
  }, [results]);

  const combinedEntries = useMemo(
    () => [...tokenEntries, ...poolEntries],
    [tokenEntries, poolEntries]
  );

  useEffect(() => {
    setSelectedIndex((prev) => {
      if (combinedEntries.length === 0) return 0;
      return Math.min(prev, combinedEntries.length - 1);
    });
  }, [combinedEntries.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || isLoading || combinedEntries.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, combinedEntries.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const entry = combinedEntries[selectedIndex];
        if (!entry) return;
        if (entry.section === 'pools') {
          if (!entry.item?.poolAddress) return;
          router.push(`/pair/${encodeURIComponent(entry.item.chainId)}/${entry.item.poolAddress}`);
        } else {
          router.push(`/token/${encodeURIComponent(entry.item.chainId)}/${entry.item.address}`);
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, combinedEntries, selectedIndex, isLoading, router, onClose]);

  useEffect(() => {
    const activeItem = resultsRef.current?.querySelector<HTMLDivElement>(
      `[data-index="${selectedIndex}"]`
    );
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <TooltipProvider>
      <div
        className={`fixed inset-0 flex justify-center items-start pt-16 sm:pt-20 z-50 px-2 sm:px-5 transition-all duration-200
          ${isOpen ? 'bg-bgBackdrop backdrop-blur-[2px] opacity-100' : 'opacity-0 pointer-events-none'}
        `}
      >
        <div
          ref={modalRef}
          className={`bg-bgPrimary w-full max-w-[700px] rounded-xl shadow-lg border border-borderDefault flex flex-col transform transition-all duration-200
            ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
          `}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 sm:py-4">
            <h2 className="text-textPrimary text-sm font-medium">Search</h2>
            <div className="flex z-999 items-center gap-2">
              <span className="hidden sm:inline font-normal text-[12px] text-textTertiary">Sort by</span>
              <div className="flex items-center gap-2">
                {sortOptions.map(({ icon: Icon, key, label }) => {
                  const isActive = sortBy === key;
                  return (
                    <Tooltip key={key}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleSortChange(isActive ? null : key)}
                          className={`p-1.5 rounded-md border-[1px] transition-all transform hover:scale-110 hover:shadow-md
                            ${isActive
                              ? 'bg-bgSuccessTint border-borderSuccess'
                              : 'bg-transparent border-borderDarkSlateGray hover:border-borderSuccess'}
                          `}
                        >
                          <Icon
                            size={14}
                            className={`transition-colors duration-200 ${
                              isActive ? 'text-success' : 'text-grayLight hover:text-success/50'
                            }`}
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-[10px] font-medium">
                        {label}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
              <button
                onClick={() => {
                  clearSearch();
                  onClose();
                }}
                className="ml-1 sm:ml-2 p-1 rounded-md text-grayLight hover:text-white hover:bg-bgNeutralDark"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="bg-bgOverlay relative border-y border-borderDefault">
            <input
              type="text"
              placeholder="Search by name, ticker, CA or Wallet..."
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setSelectedIndex(0);
              }}
              autoFocus
              className="w-full bg-bgBaseAlt border-borderDefault text-textPrimary text-[13px] pl-9 pr-8 py-3 focus:outline-none placeholder:text-textSecondary"
            />
            {/* Search icon */}
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-grayLight">
              <FiSearch size={14} />
            </span>
            {/* Shortcut key indicator */}
            <span className="absolute right-3 top-1/2 -translate-y-1/2 border border-borderSecondary rounded-sm text-[10px] font-semibold text-grayMedium px-1 flex justify-center items-center h-4">
              <span className="animate-spinSlow inline-block">/</span>
            </span>
          </div>

          {/* Pool Type Filter */}
          <div className="px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              {/* Left side - Pool Types (70% width) */}
              <div className="flex items-center gap-2 flex-1" style={{ maxWidth: '70%' }}>
                {/* Main pool type chips - first row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {mainPoolTypes.map((poolType) => {
                    const isSelected = selectedPoolTypes.has(poolType);
                    return (
                      <button
                        key={poolType}
                        onClick={() => togglePoolType(poolType)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-all border
                          ${isSelected
                            ? 'bg-success/10 border-success/40 text-success'
                            : 'bg-bgContainer/5 border-borderDarkSlateGray text-grayCool hover:border-borderDefault hover:text-textPrimary'
                          }
                        `}
                      >
                        {poolType}
                      </button>
                    );
                  })}

                  {/* Expand/Collapse button */}
                  <button
                    onClick={() => setShowAllPoolTypes(!showAllPoolTypes)}
                    className={`p-1.5 text-xs font-semibold whitespace-nowrap transition-all border border-borderDarkSlateGray ${
                      showAllPoolTypes
                        ? ' hover:border-borderDefault text-grayCool hover:text-textPrimary'
                        : 'bg-bgContainer/5 text-grayCool hover:border-borderDefault hover:text-textPrimary'
                    }`}
                  >
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${showAllPoolTypes ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {/* Right side - Chain selector (30% width) */}
              <div className="relative flex-shrink-0" style={{ width: '30%', maxWidth: '200px' }}>
                <button
                  onClick={() => setShowChainDropdown(!showChainDropdown)}
                  className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold whitespace-nowrap transition-all border bg-bgContainer/5 border-borderDarkSlateGray text-textSecondary hover:text-textPrimary hover:border-borderDefault w-full justify-between"
                >
                  <span className="truncate">{selectedChain}</span>
                  <ChevronDown
                    size={12}
                    className={`transition-transform flex-shrink-0 ${showChainDropdown ? 'rotate-180' : ''}`} // FIXED: Removed backtick
                  />
                </button>

                {/* Chain dropdown */}
                {showChainDropdown && (
                  <div className="absolute right-0 top-full mt-1 w-full bg-bgPrimary border border-borderDarkSlateGray shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
                    {Object.keys(blockchainMap).map((chain) => (
                      <button
                        key={chain}
                        onClick={() => handleChainChange(chain)}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                          selectedChain === chain
                            ? 'bg-success/10 text-success'
                            : 'text-textSecondary hover:bg-bgTertiary hover:text-textPrimary'
                        }`}
                      >
                        {chain}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Expanded pool types - additional rows */}
            {showAllPoolTypes && (
              <div className="mt-2 flex flex-wrap gap-2" style={{ maxWidth: '70%' }}>
                {additionalPoolTypes.map((poolType) => {
                  const isSelected = selectedPoolTypes.has(poolType);
                  return (
                    <button
                      key={poolType}
                      onClick={() => togglePoolType(poolType)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] bg-bgContainer/5 font-semibold whitespace-nowrap transition-all border
                        ${isSelected
                          ? 'bg-success/10 border-success/40 text-success'
                          : 'bg-bgContainer/5 border-borderDarkSlateGray text-grayCool hover:border-borderDefault hover:text-textPrimary'
                        }
                      `}
                    >
                      {poolType}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Results */}
          <div
            ref={resultsRef}
            className="flex-1 overflow-hidden overflow-y-auto custom-scrollbar cursor-pointer max-h-[50vh] sm:max-h-[60vh] scrollbar-thin scrollbar-thumb-[#2A2A2A] scrollbar-track-transparent"
          >
            {isLoading && <p className="text-grayLight text-sm text-center py-3">Searching...</p>}

            {!isLoading && results.length === 0 && input.trim() && (
              <div className="text-center py-6">
                <p className="text-grayLight text-sm">No results found.</p>
                {(selectedPoolTypes.size > 0 || selectedChain !== 'All chains') && (
                  <button
                    onClick={() => {
                      clearPoolTypeFilters();
                      handleChainChange('All chains');
                    }}
                    className="mt-2 text-xs text-success hover:underline"
                  >
                    Clear all filters to see all results
                  </button>
                )}
              </div>
            )}

            {!isLoading && results.length > 0 && (
              <>
                <div className="border-y-[1px] border-borderDefault bg-bgPrimary/60">
                  <h1 className="text-white text-sm font-medium truncate text-left p-3">Tokens</h1>
                </div>
                <div>
                  {tokenEntries.map(({ item, globalIndex }) => {
                    const change = getChangeDisplay(item.priceChange24hPercentage);
                    const rawPrice = Number(item.priceUSD);
                    const normalizedPrice = Number.isNaN(rawPrice) ? undefined : rawPrice;
                    return (
                      <div
                        key={`${item.chainId}-${item.address}-token`}
                        data-index={globalIndex}
                        onClick={() => {
                          router.push(`/token/${encodeURIComponent(item.chainId)}/${item.address}`);
                          onClose();
                        }}
                        className={`flex flex-col gap-3 px-3 py-4 border-b border-borderDefault transition-colors md:flex-row md:items-center md:justify-between ${
                          globalIndex === selectedIndex ? 'bg-bgTertiary' : 'hover:bg-borderDefault/30'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <TokenLogoBadge
                            logo={item.logo}
                            name={item.name}
                            symbol={item.symbol}
                            priority={globalIndex < 10}
                          />
                          <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-white">
                              <p className="font-medium truncate max-w-[160px]">{item.name || 'Unknown token'}</p>
                              {item.symbol && (
                                <span className="text-xs font-semibold text-textSecondary uppercase">
                                  {item.symbol}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1 text-[11px] text-textTertiary">
                              <TimeAgo timestamp={item.createdAt} textColor="text-textTertiary" />
                              <span className="truncate">{truncate(item.address, { length: 4, mode: 'middle' })}</span>
                              <CopyToClipboard text={item.address} />
                            </div>
                          </div>
                        </div>

                        <div className="flex w-full flex-wrap items-center gap-4 text-xs text-grayLight font-menlo md:w-auto md:justify-end">
                          <div className="flex flex-col">
                            <span className="uppercase tracking-wide text-[10px] text-textTertiary">Price</span>
                            <span className="text-white">{formatPriceWithPlaceholder(normalizedPrice)}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="uppercase tracking-wide text-[10px] text-textTertiary">24h</span>
                            <span className={change.className}>{change.label}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="uppercase tracking-wide text-[10px] text-textTertiary">Mcap</span>
                            <span className="text-white">{formatCompactNumber(item.marketCapUSD)}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="uppercase tracking-wide text-[10px] text-textTertiary">Vol 24h</span>
                            <span className="text-white">{formatCompactNumber(item.volume24hUSD)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-y-[1px] border-borderDefault bg-bgPrimary/60">
                  <h1 className="text-white text-sm font-medium truncate text-left p-3">Pools</h1>
                </div>
                <div>
                  {poolEntries.length === 0 && (
                    <p className="px-3 py-4 text-xs text-textTertiary">
                      No pools available for the current search input.
                    </p>
                  )}
                  {poolEntries.map(({ item, globalIndex }) => (
                    <div
                      key={`${item.chainId}-${item.poolAddress}-pool`}
                      data-index={globalIndex}
                      onClick={() => {
                        router.push(`/pair/${encodeURIComponent(item.chainId)}/${item.poolAddress}`);
                        onClose();
                      }}
                      className={`flex items-center justify-between px-3 py-4 border-b border-borderDefault transition-colors ${
                        globalIndex === selectedIndex ? 'bg-bgTertiary' : 'hover:bg-borderDefault/30'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <TokenLogoBadge
                          logo={item.logo}
                          name={item.name}
                          symbol={item.symbol}
                          priority={globalIndex < 10}
                        />
                        <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                          <p className="text-white text-sm font-medium truncate max-w-[200px]">
                            {item.name}
                          </p>
                          <div className="flex items-center space-x-1 text-grayLight text-xs truncate max-w-[200px]">
                            <TimeAgo timestamp={item.createdAt} textColor="text-textTertiary" />
                            <span className="truncate">
                              {truncate(item.address, { length: 4, mode: 'middle' })}
                            </span>
                            <CopyToClipboard text={item.address} />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 text-right text-xs text-grayLight font-menlo flex-shrink-0">
                        {Number(item.marketCapUSD) > 0 && (
                          <p className="whitespace-nowrap">
                            Mcap:{' '}
                            <span className="text-white">
                              {formatCryptoPrice(item.marketCapUSD)}
                            </span>
                          </p>
                        )}
                        {Number(item.volume24hUSD) > 0 && (
                          <p className="whitespace-nowrap">
                            Vol:{' '}
                            <span className="text-white">
                              {formatCryptoPrice(item.volume24hUSD)}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};