'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { FiSearch } from 'react-icons/fi';
import { X, ClipboardPaste } from 'lucide-react';
import { useSwapPageStore, type SwapTokenInfo, type WalletAsset } from '@/store/useSwapPageStore';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { sdk } from '@/lib/sdkClient';
import { formatCryptoPrice } from '@mobula_labs/sdk';
import SafeImage from '@/components/SafeImage';

const SOL_NATIVE = 'So11111111111111111111111111111111111111111';
const WSOL_ADDRESS = 'So11111111111111111111111111111111111111112';
const MAX_WALLET_TOKENS = 5;

interface MarketData {
  price: number | null;
  market_cap: number;
  price_change_24h: number;
  logo: string | null;
}

const POPULAR_TOKENS: SwapTokenInfo[] = [
  {
    address: SOL_NATIVE,
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    logo: 'https://assets.coingecko.com/coins/images/4128/standard/solana.png',
    chainId: 'solana:solana',
  },
  {
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logo: 'https://assets.coingecko.com/coins/images/6319/standard/usdc.png',
    chainId: 'solana:solana',
  },
  {
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    logo: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png',
    chainId: 'solana:solana',
  },
  {
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    symbol: 'BONK',
    name: 'Bonk',
    decimals: 5,
    logo: 'https://assets.coingecko.com/coins/images/28600/standard/bonk.jpg',
    chainId: 'solana:solana',
  },
  {
    address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    symbol: 'JUP',
    name: 'Jupiter',
    decimals: 6,
    logo: 'https://assets.coingecko.com/coins/images/34188/standard/jup.png',
    chainId: 'solana:solana',
  },
  {
    address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    symbol: 'WIF',
    name: 'dogwifhat',
    decimals: 6,
    logo: 'https://assets.coingecko.com/coins/images/33566/standard/dogwifhat.jpg',
    chainId: 'solana:solana',
  },
];

const CHAIN_FILTERS = [
  { id: '', label: 'All' },
  { id: 'solana:solana', label: 'Solana' },
  { id: 'evm:1', label: 'Ethereum' },
  { id: 'evm:8453', label: 'Base' },
  { id: 'evm:42161', label: 'Arbitrum' },
  { id: 'evm:56', label: 'BSC' },
];

function findWalletAsset(walletAssets: WalletAsset[], address: string, chainId: string): WalletAsset | undefined {
  return walletAssets.find(
    (a) => a.address.toLowerCase() === address.toLowerCase() && a.chainId === chainId
  );
}

function formatTokenBalance(balance: number): string {
  if (balance < 0.001 && balance > 0) return '<0.001';
  if (balance >= 1_000_000) return `${(balance / 1_000_000).toFixed(2)}M`;
  if (balance >= 1_000) return `${(balance / 1_000).toFixed(2)}K`;
  return balance.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function formatMarketCap(mc: number): string {
  if (mc >= 1_000_000_000) return `$${(mc / 1_000_000_000).toFixed(2)}B`;
  if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(2)}M`;
  if (mc >= 1_000) return `$${(mc / 1_000).toFixed(1)}K`;
  if (mc > 0) return `$${mc.toFixed(0)}`;
  return '';
}

export function TokenPickerModal() {
  const {
    isTokenPickerOpen,
    tokenPickerMode,
    tokenIn,
    tokenOut,
    walletAssets,
    closeTokenPicker,
    setTokenIn,
    setTokenOut,
    setChainId,
  } = useSwapPageStore();

  const { isConnected } = useWalletConnection();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SwapTokenInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedChain, setSelectedChain] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [marketDataMap, setMarketDataMap] = useState<Record<string, MarketData>>({});

  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const marketDataFetched = useRef(false);

  // Wallet tokens sorted by USD balance desc, limited to top 5
  // Merge SOL + WSOL into a single "SOL" entry (keeping higher balance variant)
  const walletTokens = useMemo(() => {
    if (!isConnected || walletAssets.length === 0) return [];
    const solAsset = walletAssets.find((a) => a.address === SOL_NATIVE);
    const wsolAsset = walletAssets.find((a) => a.address === WSOL_ADDRESS);

    let merged = walletAssets;
    if (solAsset && wsolAsset) {
      // Combine both into one entry, display as "SOL" with summed balance
      const combined: WalletAsset = {
        address: SOL_NATIVE,
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        logo: solAsset.logo || wsolAsset.logo,
        chainId: 'solana:solana',
        balanceUsd: solAsset.balanceUsd + wsolAsset.balanceUsd,
        tokenBalance: solAsset.tokenBalance + wsolAsset.tokenBalance,
      };
      merged = [combined, ...walletAssets.filter((a) => a.address !== SOL_NATIVE && a.address !== WSOL_ADDRESS)];
    } else if (wsolAsset && !solAsset) {
      // Only WSOL — show it as "SOL" entry
      merged = [{ ...wsolAsset, address: SOL_NATIVE, symbol: 'SOL', name: 'Solana' }, ...walletAssets.filter((a) => a.address !== WSOL_ADDRESS)];
    }

    return merged.sort((a, b) => b.balanceUsd - a.balanceUsd).slice(0, MAX_WALLET_TOKENS);
  }, [isConnected, walletAssets]);

  // Wallet address set for fast lookup (includes both SOL variants if user holds either)
  const walletAddressSet = useMemo(() => {
    const set = new Set<string>();
    for (const a of walletAssets) {
      set.add(`${a.chainId}:${a.address.toLowerCase()}`);
    }
    // If user holds SOL or WSOL, mark both as "owned" to avoid duplicate in popular
    if (set.has(`solana:solana:${SOL_NATIVE.toLowerCase()}`) || set.has(`solana:solana:${WSOL_ADDRESS.toLowerCase()}`)) {
      set.add(`solana:solana:${SOL_NATIVE.toLowerCase()}`);
      set.add(`solana:solana:${WSOL_ADDRESS.toLowerCase()}`);
    }
    return set;
  }, [walletAssets]);

  // Popular tokens minus wallet tokens (avoid duplicates)
  const filteredPopularTokens = useMemo(() => {
    if (walletTokens.length === 0) return POPULAR_TOKENS;
    return POPULAR_TOKENS.filter(
      (t) => !walletAddressSet.has(`${t.chainId}:${t.address.toLowerCase()}`)
    );
  }, [walletTokens, walletAddressSet]);

  // Search results: owned tokens at top, rest below. Deduplicate SOL/WSOL.
  const sortedSearchResults = useMemo(() => {
    if (!searchQuery.trim() || searchResults.length === 0) return searchResults;

    // Deduplicate SOL/WSOL: keep only SOL native entry
    let deduped = searchResults;
    const hasSol = searchResults.some((t) => t.address === SOL_NATIVE);
    const hasWsol = searchResults.some((t) => t.address === WSOL_ADDRESS);
    if (hasSol && hasWsol) {
      deduped = searchResults.filter((t) => t.address !== WSOL_ADDRESS);
    } else if (hasWsol && !hasSol) {
      // Rename WSOL to SOL in results
      deduped = searchResults.map((t) =>
        t.address === WSOL_ADDRESS
          ? { ...t, address: SOL_NATIVE, symbol: 'SOL', name: 'Solana' }
          : t
      );
    }

    const owned: SwapTokenInfo[] = [];
    const rest: SwapTokenInfo[] = [];
    for (const token of deduped) {
      if (walletAddressSet.has(`${token.chainId}:${token.address.toLowerCase()}`)) {
        owned.push(token);
      } else {
        rest.push(token);
      }
    }
    return [...owned, ...rest];
  }, [searchResults, searchQuery, walletAddressSet]);

  // All displayed tokens as flat list for keyboard nav
  const allDisplayedTokens = useMemo(() => {
    if (searchQuery.trim()) return sortedSearchResults;
    return [...walletTokens.map((a) => ({
      address: a.address,
      symbol: a.symbol,
      name: a.name,
      decimals: a.decimals,
      logo: a.logo,
      chainId: a.chainId,
    } as SwapTokenInfo)), ...filteredPopularTokens];
  }, [searchQuery, sortedSearchResults, walletTokens, filteredPopularTokens]);

  // Fetch batch market data for popular tokens on first open
  useEffect(() => {
    if (!isTokenPickerOpen || marketDataFetched.current) return;
    marketDataFetched.current = true;

    (async () => {
      try {
        const assets = POPULAR_TOKENS
          .map((t) => ({ type: 'address' as const, value: t.address }));

        const res = await sdk.fetchMarketMultiData({
          assets,
          shouldFetchPriceChange: '24h',
        }) as { data?: Record<string, { price: number | null; market_cap: number; price_change_24h: number; logo: string | null; contracts?: Array<{ address: string }> }> };

        if (res?.data) {
          const map: Record<string, MarketData> = {};
          for (const [, value] of Object.entries(res.data)) {
            const addr = value.contracts?.[0]?.address;
            if (addr) {
              map[addr.toLowerCase()] = {
                price: value.price,
                market_cap: value.market_cap,
                price_change_24h: value.price_change_24h,
                logo: value.logo,
              };
            }
          }
          setMarketDataMap(map);
        }
      } catch {
        // Market data fetch failed — popular tokens still show without it
      }
    })();
  }, [isTokenPickerOpen]);

  useEffect(() => {
    if (isTokenPickerOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isTokenPickerOpen]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setSearchQuery(text.trim());
      }
    } catch {
      // Clipboard access denied
    }
  }, []);

  // Search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const response = await sdk.fetchSearchFast({
          input: searchQuery,
          ...(selectedChain ? { blockchain: selectedChain } : {}),
        }) as { data?: Array<{ address: string; symbol: string; name: string; decimals?: number; logo?: string | null; chainId: string }> };

        if (response?.data) {
          const tokens: SwapTokenInfo[] = response.data.map((item) => ({
            address: item.address,
            symbol: item.symbol || 'Unknown',
            name: item.name || 'Unknown Token',
            decimals: item.decimals || 9,
            logo: item.logo || null,
            chainId: item.chainId || 'solana:solana',
          }));
          setSearchResults(tokens);
          setSelectedIndex(0);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedChain]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTokenPicker();
    };
    if (isTokenPickerOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTokenPickerOpen, closeTokenPicker]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        closeTokenPicker();
      }
    };
    if (isTokenPickerOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTokenPickerOpen, closeTokenPicker]);

  const handleSelectToken = (token: SwapTokenInfo) => {
    let finalToken = token;

    // If selecting SOL or WSOL, auto-pick the variant with the highest balance
    const isSolSelection = token.address === SOL_NATIVE || token.address === WSOL_ADDRESS;
    if (isSolSelection && walletAssets.length > 0) {
      const solAsset = findWalletAsset(walletAssets, SOL_NATIVE, 'solana:solana');
      const wsolAsset = findWalletAsset(walletAssets, WSOL_ADDRESS, 'solana:solana');
      const solBal = solAsset?.tokenBalance ?? 0;
      const wsolBal = wsolAsset?.tokenBalance ?? 0;

      if (wsolBal > solBal) {
        finalToken = { ...token, address: WSOL_ADDRESS, symbol: 'WSOL', name: 'Wrapped SOL' };
      } else {
        finalToken = { ...token, address: SOL_NATIVE, symbol: 'SOL', name: 'Solana' };
      }
    }

    if (tokenPickerMode === 'tokenIn') {
      if (tokenOut?.address === finalToken.address && tokenOut?.chainId === finalToken.chainId) {
        setTokenOut(tokenIn);
      }
      setTokenIn(finalToken);
      setChainId(finalToken.chainId);
    } else {
      if (tokenIn?.address === finalToken.address && tokenIn?.chainId === finalToken.chainId) {
        setTokenIn(tokenOut);
      }
      setTokenOut(finalToken);
    }
    closeTokenPicker();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTokenPickerOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, allDisplayedTokens.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const token = allDisplayedTokens[selectedIndex];
        if (token) handleSelectToken(token);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTokenPickerOpen, allDisplayedTokens, selectedIndex]);

  useEffect(() => {
    const item = resultsRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    if (item) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  if (!isTokenPickerOpen) return null;

  const isSolVariant = (addr: string) => addr === SOL_NATIVE || addr === WSOL_ADDRESS;

  const renderTokenRow = (token: SwapTokenInfo, index: number, showMarketData = false) => {
    // SOL and WSOL are considered the same token for "selected" state
    const addressMatch = (a: string, b: string) =>
      a === b || (isSolVariant(a) && isSolVariant(b));

    const isCurrentToken =
      (tokenPickerMode === 'tokenIn' && tokenIn && addressMatch(tokenIn.address, token.address) && tokenIn.chainId === token.chainId) ||
      (tokenPickerMode === 'tokenOut' && tokenOut && addressMatch(tokenOut.address, token.address) && tokenOut.chainId === token.chainId);

    const walletAsset = findWalletAsset(walletAssets, token.address, token.chainId);
    const mktData = showMarketData ? marketDataMap[token.address.toLowerCase()] : undefined;

    return (
      <button
        key={`${token.chainId}-${token.address}`}
        data-index={index}
        onClick={() => handleSelectToken(token)}
        disabled={isCurrentToken}
        className={`w-full flex items-center gap-3 px-6 py-3 transition-colors ${
          isCurrentToken
            ? 'opacity-30 cursor-not-allowed'
            : index === selectedIndex
            ? 'bg-bgTertiary/50'
            : 'hover:bg-bgPrimary/60'
        }`}
      >
        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-bgHighlight">
          {token.logo ? (
            <SafeImage
              src={token.logo}
              alt={token.symbol}
              width={40}
              height={40}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 flex items-center justify-center text-sm font-bold text-textPrimary">
              {token.symbol.charAt(0)}
            </div>
          )}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-[15px] font-bold text-textPrimary truncate">
            {token.symbol}
          </p>
          <p className="text-[12px] text-textTertiary truncate">{token.name}</p>
        </div>
        {walletAsset ? (
          <div className="text-right flex-shrink-0">
            <p className="text-[13px] font-semibold text-textPrimary">
              {formatTokenBalance(walletAsset.tokenBalance)}
            </p>
            <p className="text-[11px] text-textTertiary">
              {formatCryptoPrice(walletAsset.balanceUsd)}
            </p>
          </div>
        ) : mktData ? (
          <div className="text-right flex-shrink-0">
            <p className="text-[12px] font-medium text-textSecondary">
              {mktData.market_cap > 0 ? formatMarketCap(mktData.market_cap) : mktData.price ? formatCryptoPrice(mktData.price) : ''}
            </p>
            {mktData.price_change_24h !== 0 && (
              <p className={`text-[10px] font-semibold ${mktData.price_change_24h > 0 ? 'text-success' : 'text-error'}`}>
                {mktData.price_change_24h > 0 ? '+' : ''}{mktData.price_change_24h.toFixed(2)}%
              </p>
            )}
          </div>
        ) : isCurrentToken ? (
          <span className="text-[11px] text-textTertiary font-medium px-2 py-0.5 rounded bg-bgTertiary">Selected</span>
        ) : null}
      </button>
    );
  };

  // Compute flat index offset for popular tokens section
  const walletTokenCount = searchQuery.trim() ? 0 : walletTokens.length;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-bgBackdrop backdrop-blur-sm px-4">
      <div
        ref={modalRef}
        className="w-full max-w-[480px] bg-bgSecondary border border-borderDefault rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-base font-bold text-textPrimary">Select a token</h2>
          <button
            onClick={closeTokenPicker}
            className="p-1.5 rounded-lg text-textTertiary hover:text-textPrimary hover:bg-bgTertiary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search + Paste Row */}
        <div className="px-5 pb-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textTertiary" size={16} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search name or paste address"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                className="w-full bg-bgPrimary border border-borderDefault rounded-xl pl-10 pr-4 py-3 text-sm text-textPrimary placeholder:text-textTertiary/50 outline-none focus:border-borderPrimary transition-colors"
              />
            </div>
            <button
              onClick={handlePaste}
              className="flex items-center gap-1.5 px-4 py-3 bg-bgPrimary border border-borderDefault rounded-xl text-textTertiary hover:text-textPrimary hover:bg-bgTertiary transition-colors text-sm font-medium flex-shrink-0"
            >
              <ClipboardPaste size={15} />
              Paste
            </button>
          </div>
        </div>

        {/* Chain Filter Chips */}
        <div className="px-5 pb-3">
          <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
            {CHAIN_FILTERS.map((chain) => (
              <button
                key={chain.id}
                onClick={() => {
                  setSelectedChain(chain.id);
                  setSelectedIndex(0);
                }}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg whitespace-nowrap transition-all ${
                  selectedChain === chain.id
                    ? 'bg-success/15 text-success border border-success/30'
                    : 'bg-bgPrimary text-textTertiary hover:text-textSecondary hover:bg-bgTertiary border border-transparent'
                }`}
              >
                {chain.label}
              </button>
            ))}
          </div>
        </div>

        {/* Separator */}
        <div className="h-px bg-borderDefault mx-5" />

        {/* Token List */}
        <div ref={resultsRef} className="flex-1 overflow-y-auto py-2">
          {isSearching && (
            <div className="flex items-center justify-center py-14">
              <div className="w-6 h-6 border-2 border-textTertiary/30 border-t-textTertiary rounded-full animate-spin" />
            </div>
          )}

          {!isSearching && searchQuery.trim() && sortedSearchResults.length === 0 && (
            <p className="text-sm text-textTertiary text-center py-14">No tokens found</p>
          )}

          {/* Search results mode */}
          {!isSearching && searchQuery.trim() && sortedSearchResults.length > 0 && (
            <>
              {sortedSearchResults.map((token, index) => renderTokenRow(token, index))}
            </>
          )}

          {/* Default mode: wallet tokens (top 5) + popular tokens with market data */}
          {!isSearching && !searchQuery.trim() && (
            <>
              {walletTokens.length > 0 && (
                <>
                  <p className="text-[10px] text-textTertiary/50 uppercase tracking-widest px-6 py-2 font-bold">
                    Your tokens
                  </p>
                  {walletTokens.map((asset, index) =>
                    renderTokenRow(
                      {
                        address: asset.address,
                        symbol: asset.symbol,
                        name: asset.name,
                        decimals: asset.decimals,
                        logo: asset.logo,
                        chainId: asset.chainId,
                      },
                      index
                    )
                  )}
                </>
              )}

              <p className="text-[10px] text-textTertiary/50 uppercase tracking-widest px-6 py-2 font-bold">
                Popular tokens
              </p>
              {filteredPopularTokens.map((token, index) =>
                renderTokenRow(token, walletTokenCount + index, true)
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
