'use client';

import { useState, useMemo } from 'react';
import SafeImage from '@/components/SafeImage';
import { fmtUsd, fmtBalance } from '@/lib/format';
import type { PositionEntry } from '../hooks/usePortfolioData';
import { toBlockchain } from '@/lib/format';
import { useNavigationStore } from '@/store/useNavigationStore';
import { FiSearch, FiExternalLink, FiArrowUp, FiShare2 } from 'react-icons/fi';
import { HiOutlineMenu, HiOutlineSwitchVertical } from 'react-icons/hi';
import { InlinePnlCalendar } from './InlinePnlCalendar';

interface PositionsTableProps {
  activePositions: PositionEntry[];
  allPositions: PositionEntry[];
  tab: 'active' | 'history' | 'top100' | 'calendar';
  onTabChange: (tab: 'active' | 'history' | 'top100' | 'calendar') => void;
  isLoading: boolean;
  walletAddress?: string;
}

export function PositionsTable({
  activePositions,
  allPositions,
  tab,
  onTabChange,
  isLoading,
  walletAddress,
}: PositionsTableProps) {
  const navigateToToken = useNavigationStore((s) => s.navigateToToken);
  const [search, setSearch] = useState('');
  const [showDust, setShowDust] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const displayPositions = useMemo(() => {
    let list = tab === 'active' ? activePositions : allPositions;

    // Only filter dust for active tab — history/top100 need sold (0-balance) positions
    if (tab === 'active' && !showDust) {
      list = list.filter((p) => p.amountUSD >= 0.01);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.token.symbol?.toLowerCase()?.includes(q) ||
          p.token.name?.toLowerCase()?.includes(q) ||
          p.token.address?.toLowerCase()?.includes(q),
      );
    }

    if (tab === 'top100') {
      list = [...list].sort((a, b) => (b.realizedPnlUSD || 0) - (a.realizedPnlUSD || 0)).slice(0, 100);
    }

    return list;
  }, [tab, activePositions, allPositions, search, showDust]);

  const tabs = [
    { id: 'active' as const, label: 'Active Positions' },
    { id: 'history' as const, label: 'History' },
    { id: 'top100' as const, label: 'Top 100' },
    { id: 'calendar' as const, label: 'Calendar' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tabs + Controls */}
      <div className="flex items-center justify-between px-5 h-12 flex-shrink-0 border-b border-borderDefault">
        <div className="flex items-center gap-5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`text-sm font-medium py-1 transition-colors ${
                tab === t.id
                  ? 'text-white border-b-2 border-white'
                  : 'text-textTertiary hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}

          <div className="w-px h-5 bg-borderDefault" />

          <button className="text-textTertiary hover:text-white transition-colors">
            <HiOutlineMenu size={16} />
          </button>

          <div className="relative">
            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-textTertiary" size={15} />
            <input
              type="text"
              placeholder="Search by name or address"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border border-borderDefault/50 rounded-md px-3 py-2 pl-8 text-sm text-textPrimary placeholder-textTertiary w-56 focus:outline-none focus:border-borderSecondary transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDust(!showDust)}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded transition-colors ${
              showDust ? 'bg-bgTertiary text-white' : 'text-textTertiary hover:text-white hover:bg-bgOverlay'
            }`}
          >
            <span className="text-accentPurple">&#9670;</span>
            Optimize Dust
          </button>

          <button
            onClick={() => setShowHidden(!showHidden)}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded transition-colors ${
              showHidden ? 'bg-bgTertiary text-white' : 'text-textTertiary hover:text-white hover:bg-bgOverlay'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Show Hidden
          </button>

          <button className="flex items-center gap-1.5 text-textTertiary hover:text-white transition-colors">
            <HiOutlineSwitchVertical size={15} />
            <span className="text-sm">USD</span>
          </button>
        </div>
      </div>

      {/* Calendar tab content */}
      {tab === 'calendar' && walletAddress && (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
          <InlinePnlCalendar walletAddress={walletAddress} />
        </div>
      )}

      {/* Table header */}
      {tab !== 'calendar' && <><div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1.2fr_0.5fr] gap-3 px-5 py-3 flex-shrink-0 border-b border-borderDefault/40 text-sm text-textTertiary">
        <span>Token</span>
        <span>Bought</span>
        <span>Sold</span>
        <span>Remaining</span>
        <span>PNL</span>
        <span>Action</span>
      </div>

      {/* Rows */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="grid grid-cols-6 gap-3 px-5 py-3.5 animate-pulse">
              <div className="h-5 bg-bgTertiary rounded" />
              <div className="h-5 bg-bgTertiary rounded" />
              <div className="h-5 bg-bgTertiary rounded" />
              <div className="h-5 bg-bgTertiary rounded" />
              <div className="h-5 bg-bgTertiary rounded" />
              <div className="h-5 bg-bgTertiary rounded" />
            </div>
          ))
        ) : displayPositions.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-textTertiary">
            No positions found
          </div>
        ) : (
          displayPositions.map((pos) => {
            const realized = Number.isFinite(pos.realizedPnlUSD) ? pos.realizedPnlUSD : 0;
            const unrealized = Number.isFinite(pos.unrealizedPnlUSD) ? pos.unrealizedPnlUSD : 0;
            const realizedPct = pos.volumeBuy > 0 ? (realized / pos.volumeBuy) * 100 : 0;
            const unrealizedPct = pos.volumeBuy > 0 ? (unrealized / pos.volumeBuy) * 100 : 0;
            const blockchain = toBlockchain(pos.token.chainId);
            const tokensBought = pos.volumeBuy / (pos.avgBuyPriceUSD || 1);
            const tokensSold = pos.volumeSell / (pos.avgSellPriceUSD || 1);

            return (
              <div
                key={`${pos.token.address}_${pos.token.chainId}`}
                onClick={() => {
                  navigateToToken(pos.token.address, blockchain, pos.token as unknown as Record<string, unknown>);
                }}
                className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1.2fr_0.5fr] gap-3 px-5 py-3 hover:bg-bgTableHover transition-colors border-b border-borderDefault/20 items-center cursor-pointer"
              >
                {/* Token */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-bgTertiary">
                    {pos.token.logo ? (
                      <SafeImage
                        src={pos.token.logo}
                        alt={pos.token.symbol}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-textTertiary">
                        {pos.token.symbol.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate leading-tight">{pos.token.symbol}</p>
                    <p className="text-xs text-textTertiary truncate leading-tight">{pos.token.name}</p>
                  </div>
                </div>

                {/* Bought */}
                <div>
                  <p className="text-sm text-success font-medium leading-tight">{fmtUsd(pos.volumeBuy)}</p>
                  <p className="text-xs text-textTertiary leading-tight truncate">
                    {fmtBalance(tokensBought)} {pos.token.symbol}
                  </p>
                </div>

                {/* Sold */}
                <div>
                  <p className="text-sm text-white font-medium leading-tight">{fmtUsd(pos.volumeSell)}</p>
                  <p className="text-xs text-textTertiary leading-tight truncate">
                    {fmtBalance(tokensSold)} {pos.token.symbol}
                  </p>
                </div>

                {/* Remaining */}
                <div>
                  <p className="text-sm text-white font-medium leading-tight">{fmtUsd(pos.amountUSD)}</p>
                  <p className="text-xs text-textTertiary leading-tight truncate">
                    {fmtBalance(pos.balance)} {pos.token.symbol}
                  </p>
                </div>

                {/* PNL */}
                <div>
                  <p className={`text-sm font-semibold leading-tight ${realized >= 0 ? 'text-success' : 'text-error'}`}>
                    {realized >= 0 ? '+' : ''}{fmtUsd(realized)}
                    <span className="text-textTertiary ml-1 text-xs">
                      ({realizedPct >= 0 ? '+' : ''}{realizedPct.toFixed(2)}%)
                    </span>
                  </p>
                  {unrealized !== 0 && (
                    <p className={`text-xs leading-tight ${unrealized >= 0 ? 'text-success/70' : 'text-error/70'}`}>
                      Unreal: {unrealized >= 0 ? '+' : ''}{fmtUsd(unrealized)}
                      <span className="text-textTertiary ml-1">
                        ({unrealizedPct >= 0 ? '+' : ''}{unrealizedPct.toFixed(2)}%)
                      </span>
                    </p>
                  )}
                </div>

                {/* Action icons */}
                <div className="flex items-center gap-2.5">
                  <span
                    className="text-textTertiary hover:text-white transition-colors p-1 cursor-pointer"
                    title="View token"
                    onClick={(e) => { e.stopPropagation(); navigateToToken(pos.token.address, blockchain, pos.token as unknown as Record<string, unknown>); }}
                  >
                    <FiExternalLink size={14} />
                  </span>
                  <button className="text-textTertiary hover:text-white transition-colors p-1" title="Trade">
                    <FiArrowUp size={14} />
                  </button>
                  <button className="text-textTertiary hover:text-white transition-colors p-1" title="Share">
                    <FiShare2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div></>}
    </div>
  );
}
