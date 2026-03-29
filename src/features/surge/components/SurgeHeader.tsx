'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useSurgeStore, type SortOption } from '../store/useSurgeStore';
import type { WalletToken } from '@/lib/tokens';
import { fmtBalance, fmtUsd } from '@/lib/format';
import { useSurgeMetadata } from '../hooks/useSurgeMetadata';
import { ChainDropdown } from '@/features/pulse/components/ChainDropDown';
import { FactoryDropdown } from './FactoryDropdown';

export default function SurgeHeader() {
  // Individual selectors — only re-render when these specific fields change
  const isPaused = useSurgeStore((s) => s.isPaused);
  const sortBy = useSurgeStore((s) => s.sortBy);
  const quickBuyAmount = useSurgeStore((s) => s.quickBuyAmount);
  const quickSellPercentage = useSurgeStore((s) => s.quickSellPercentage);
  const buyCurrencyAddress = useSurgeStore((s) => s.buyCurrencyAddress);
  const walletTokens = useSurgeStore((s) => s.walletTokens);
  const selectedChainIds = useSurgeStore((s) => s.selectedChainIds);
  const selectedProtocols = useSurgeStore((s) => s.selectedProtocols);

  const selectedToken = walletTokens.find(
    (t) => buyCurrencyAddress === null ? t.isNative : t.address === buyCurrencyAddress
  ) || walletTokens[0] || null;

  const { chains, availableProtocols, loading: metadataLoading } = useSurgeMetadata();

  const sortLabels: Record<SortOption, string> = {
    trending: 'Trending',
    surge: 'Surge',
    new: 'New',
    bonding: 'Bonding',
    bonded: 'Bonded',
    topGainers: 'Top Gainers',
  };
  const sortOptions = Object.keys(sortLabels) as SortOption[];

  const handleChainSelect = (chainId: string) => {
    const newChains = selectedChainIds.includes(chainId)
      ? selectedChainIds.filter((c) => c !== chainId)
      : [...selectedChainIds, chainId];
    useSurgeStore.getState().setSelectedChainIds(newChains);
  };

  const handleFactorySelect = (name: string) => {
    const updated = selectedProtocols.includes(name)
      ? selectedProtocols.filter((p) => p !== name)
      : [...selectedProtocols, name];
    useSurgeStore.getState().setSelectedProtocols(updated);
  };

  return (
    <div className="px-10 pt-3 pb-2">
      {/* Title Row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-textPrimary">Surge</h1>
            <button
              onClick={() => useSurgeStore.getState().togglePause()}
              className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                isPaused
                  ? 'bg-warning/15 text-warning border border-warning/30'
                  : 'bg-success/15 text-success border border-success/30'
              }`}
            >
              {isPaused ? 'II PAUSED' : '● LIVE'}
            </button>
          </div>
          <p className="text-xs text-textTertiary mt-0.5">
            Track token surge and market activity in real-time.
          </p>
        </div>

        {/* Controls Row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Chain Selector */}
          <div className="w-44">
            <ChainDropdown
              selectedChains={selectedChainIds}
              chains={chains}
              loading={metadataLoading}
              onChainSelect={handleChainSelect}
            />
          </div>

          {/* Factory Selector */}
          <div className="w-44">
            <FactoryDropdown
              selectedFactories={selectedProtocols}
              factories={availableProtocols}
              loading={metadataLoading}
              onFactorySelect={handleFactorySelect}
            />
          </div>

          {/* Sort Dropdown */}
          <SortDropdown sortBy={sortBy} options={sortOptions} labels={sortLabels} onSelect={(v) => useSurgeStore.getState().setSortBy(v)} />

          {/* Quick Buy input */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-semibold text-textTertiary uppercase tracking-wider">Quick Buy</span>
            <div className="flex items-center border border-success/30 rounded-md bg-bgOverlay">
              <span className="px-2.5 py-2 text-[12px] font-bold text-success bg-success/10 rounded-l-md">$</span>
              <input
                type="text"
                value={quickBuyAmount}
                onChange={(e) => useSurgeStore.getState().setQuickBuyAmount(e.target.value)}
                className="w-14 bg-transparent text-center text-[13px] font-mono font-semibold text-textPrimary py-2 focus:outline-none rounded-r-md"
              />
            </div>
          </div>

          {/* Quick Sell input */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-semibold text-textTertiary uppercase tracking-wider">Quick Sell</span>
            <div className="flex items-center border border-error/30 rounded-md overflow-hidden bg-bgOverlay">
              <input
                type="text"
                value={quickSellPercentage}
                onChange={(e) => useSurgeStore.getState().setQuickSellPercentage(e.target.value)}
                className="w-14 bg-transparent text-center text-[13px] font-mono font-semibold text-textPrimary py-2 focus:outline-none"
              />
              <span className="px-2.5 py-2 text-[12px] font-bold text-error bg-error/10">%</span>
            </div>
          </div>

          {/* Currency Selector */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-semibold text-textTertiary uppercase tracking-wider">Currency</span>
            <CurrencyDropdown
              selected={selectedToken}
              tokens={walletTokens}
              onSelect={(t) => useSurgeStore.getState().setBuyCurrencyAddress(t.isNative ? null : t.address)}
            />
          </div>
        </div>
      </div>

    </div>
  );
}

/* ── Currency Dropdown ── */
function CurrencyDropdown({
  selected,
  tokens,
  onSelect,
}: {
  selected: WalletToken | null;
  tokens: WalletToken[];
  onSelect: (token: WalletToken) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const displaySymbol = selected?.symbol || 'SOL';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-2 bg-bgOverlay border border-borderDefault rounded-md text-[11px] font-mono font-bold text-textSecondary hover:bg-bgTertiary transition-colors"
      >
        {selected?.logo && (
          <img src={selected.logo} alt="" width={14} height={14} className="rounded-full" />
        )}
        {displaySymbol}
        <ChevronDown size={10} className={`text-textTertiary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 max-h-72 overflow-y-auto bg-bgPrimary border border-borderDefault shadow-2xl shadow-black/60 z-50 rounded-lg">
          <div className="p-1.5 space-y-0.5">
            {tokens.length === 0 && (
              <div className="px-2 py-4 text-center text-[10px] text-textTertiary font-mono">
                No tokens in wallet
              </div>
            )}
            {tokens.map((t) => {
              const isSelected = selected?.address === t.address;
              return (
                <button
                  key={t.address}
                  onClick={() => { onSelect(t); setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors ${
                    isSelected
                      ? 'bg-success/8 ring-1 ring-success/20'
                      : 'hover:bg-bgTertiary/80'
                  }`}
                >
                  {t.logo ? (
                    <img src={t.logo} alt="" width={20} height={20} className="rounded-full shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-bgTertiary flex items-center justify-center text-[8px] font-bold text-textTertiary shrink-0">
                      {t.symbol.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono font-bold text-textPrimary truncate">{t.symbol}</span>
                      {t.isNative && (
                        <span className="text-[8px] text-textTertiary font-mono px-1 py-0.5 rounded bg-bgTertiary/50">NATIVE</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-textSecondary font-mono">{fmtBalance(t.balance)}</span>
                      <span className="text-[10px] text-textTertiary font-mono">{fmtUsd(t.balanceUSD)}</span>
                    </div>
                  </div>
                  {isSelected && <Check size={14} className="text-success shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sort Dropdown ── */
function SortDropdown({
  sortBy, options, labels, onSelect,
}: {
  sortBy: SortOption;
  options: SortOption[];
  labels: Record<SortOption, string>;
  onSelect: (v: SortOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-bgOverlay border border-borderDefault rounded text-xs text-textPrimary hover:bg-bgTertiary transition-colors"
      >
        Sort <span className="font-semibold">{labels[sortBy]}</span>
        <ChevronDown size={12} className={`text-textTertiary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-bgPrimary border border-borderDefault shadow-lg z-50 rounded overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onSelect(opt); setOpen(false); }}
              className={`w-full px-3 py-2 text-xs text-left transition-colors ${
                sortBy === opt
                  ? 'bg-success/10 text-success font-semibold'
                  : 'text-textSecondary hover:bg-bgTertiary'
              }`}
            >
              {labels[opt]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
