'use client';

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { WalletToken } from '@/lib/tokens';

export interface OhlcvCandle {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  t: number;
}

const MAX_CANDLES = 400;
const MAX_TOKENS = 20;

// Fields that should never be overwritten with empty/falsy values
const PROTECTED_FIELDS = new Set(['name', 'symbol', 'logo', 'tokenName', 'tokenSymbol']);

function getTokenSortValue(token: SurgeToken, sortBy: SortOption): number {
  switch (sortBy) {
    case 'surge':
      return Number((token as Record<string, unknown>).fees_paid_1min ?? token.feesPaid1mUSD ?? 0);
    case 'trending':
      return Number((token as Record<string, unknown>).feesPaid5minUSD ?? (token as Record<string, unknown>).fees_paid_5min ?? 0);
    case 'new':
      return new Date(token.created_at || token.createdAt || 0).getTime();
    case 'bonded':
      return new Date(token.bonded_at || 0).getTime();
    case 'bonding':
      return Number(token.bondingPercentage ?? (token as Record<string, unknown>).bonding_percentage ?? 0);
    case 'topGainers':
      return Number(token.priceChange1hPercentage ?? (token as Record<string, unknown>).price_change_1h ?? 0);
    default:
      return 0;
  }
}

function sortTokens(tokens: SurgeToken[], sortBy: SortOption): SurgeToken[] {
  return [...tokens].sort((a, b) => getTokenSortValue(b, sortBy) - getTokenSortValue(a, sortBy));
}

export interface SurgeToken {
  address: string;
  chainId: string;
  name?: string;
  symbol?: string;
  logo?: string;
  banner?: string;
  dexscreenerHeader?: string;
  priceUSD?: number;
  marketCapUSD?: number;
  liquidityUSD?: number;
  volumeUSD24h?: number;
  volume1mUSD?: number;
  trades24h?: number;
  trades1m?: number;
  buys24h?: number;
  sells24h?: number;
  buys1m?: number;
  sells1m?: number;
  organicBuys24h?: number;
  organicSells24h?: number;
  organicBuys1m?: number;
  organicSells1m?: number;
  organicVolumeBuy24hUSD?: number;
  organicVolumeSell24hUSD?: number;
  organicVolumeBuy1mUSD?: number;
  organicVolumeSell1mUSD?: number;
  feesPaid24hUSD?: number;
  feesPaid1mUSD?: number;
  priceChange24hPercentage?: number;
  priceChange1mPercentage?: number;
  holdersCount?: number;
  holders_count?: number;
  top10HoldingsPercentage?: number;
  devHoldingsPercentage?: number;
  snipersHoldingsPercentage?: number;
  insidersHoldingsPercentage?: number;
  bundlersHoldingsPercentage?: number;
  bondingPercentage?: number;
  bonded?: boolean;
  createdAt?: string;
  created_at?: string;
  bonded_at?: string;
  source?: string;
  poolAddress?: string;
  socials?: {
    twitter?: string;
    website?: string;
    telegram?: string;
  };
  exchange?: {
    logo?: string;
    name?: string;
  };
  deployerMigrations?: number;
  proTradersCount?: number;
  ath?: number;
  athDate?: string | number;
  atl?: number;
  atlDate?: string | number;
  spottedPrice?: number;
  spottedAt?: string;
  groups?: Array<{ name: string; emoji?: string; color?: string }>;
  ohlcv?: OhlcvCandle[];
  [key: string]: unknown;
}

export type SortOption = 'trending' | 'surge' | 'new' | 'bonding' | 'bonded' | 'topGainers';

/** @deprecated Use WalletToken from '@/lib/tokens' */
export type SurgeWalletToken = WalletToken;

interface SurgeStoreState {
  tokens: SurgeToken[];
  selectedTokenIndex: number;
  loading: boolean;
  error: string | null;
  isPaused: boolean;
  lastUpdated: string;
  sortBy: SortOption;

  // Filters
  selectedChainIds: string[];
  selectedProtocols: string[];

  // Quick trade
  quickBuyAmount: string;
  quickSellPercentage: string;
  buyCurrencyAddress: string | null; // null = native SOL
  isBuyMode: boolean;
  slippage: number;

  // Positions: address -> WSS position data (unrealized PNL, balance, etc.)
  positions: Record<string, { balance: number; amountUSD: number; unrealizedPnlUSD: number; totalPnlUSD: number; avgBuyPriceUSD: number }>;
  // Wallet tokens for currency selector (not persisted)
  walletTokens: WalletToken[];

  // Actions
  setTokens: (tokens: SurgeToken[]) => void;
  mergeToken: (token: SurgeToken) => void;
  removeToken: (address: string, chainId: string) => void;
  updateTokenOhlcv: (address: string, chainId: string, candle: OhlcvCandle) => void;
  updatePosition: (address: string, data: { balance: number; amountUSD: number; unrealizedPnlUSD: number; totalPnlUSD: number; avgBuyPriceUSD: number }) => void;
  clearPositions: () => void;
  setSelectedTokenIndex: (index: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  togglePause: () => void;
  setLastUpdated: (time: string) => void;
  setSortBy: (sort: SortOption) => void;
  setSelectedChainIds: (chainIds: string[]) => void;
  setSelectedProtocols: (protocols: string[]) => void;
  setQuickBuyAmount: (amount: string) => void;
  setQuickSellPercentage: (pct: string) => void;
  setBuyCurrencyAddress: (address: string | null) => void;
  setWalletTokens: (tokens: WalletToken[]) => void;
  setIsBuyMode: (isBuy: boolean) => void;
  setSlippage: (value: number) => void;
}

export const useSurgeStore = create<SurgeStoreState>()(
  devtools(
    persist(
      (set) => ({
        tokens: [],
        selectedTokenIndex: 0,
        loading: true,
        error: null,
        isPaused: false,
        lastUpdated: '',
        sortBy: 'trending',

        selectedChainIds: ['solana:solana'],
        selectedProtocols: ['pumpswap', 'pumpfun', 'raydium', 'raydium-cpmm', 'raydium-launchlab', 'bonk'],

        quickBuyAmount: '10',
        quickSellPercentage: '100',
        buyCurrencyAddress: null,
        isBuyMode: true,
        slippage: 10,
        positions: {},
        walletTokens: [],

        setTokens: (tokens) =>
          set((state) => ({
            tokens: sortTokens(tokens.slice(0, MAX_TOKENS), state.sortBy),
            loading: false,
            lastUpdated: new Date().toLocaleTimeString('en-US', { hour12: false }),
          })),

        mergeToken: (token) =>
          set((state) => {
            const key = `${token.address}_${token.chainId}`;
            const idx = state.tokens.findIndex(
              (t) => `${t.address}_${t.chainId}` === key
            );
            const now = new Date().toLocaleTimeString('en-US', { hour12: false });

            if (idx !== -1) {
              const updated = [...state.tokens];
              const existing = updated[idx];
              const merged: Record<string, unknown> = { ...existing };
              const partial = token as Record<string, unknown>;
              for (const k in partial) {
                if (k === 'ohlcv') continue;
                const v = partial[k];
                if (v == null) continue;
                // Don't overwrite protected fields with empty strings
                if (PROTECTED_FIELDS.has(k) && v === '') continue;
                merged[k] = v;
              }
              updated[idx] = merged as SurgeToken;
              return {
                tokens: sortTokens(updated, state.sortBy),
                lastUpdated: now,
              };
            }
            // New token: add, sort, and cap at MAX_TOKENS
            const newTokens = sortTokens([...state.tokens, token], state.sortBy).slice(0, MAX_TOKENS);
            return {
              tokens: newTokens,
              lastUpdated: now,
            };
          }),

        removeToken: (address, chainId) =>
          set((state) => ({
            tokens: state.tokens.filter(
              (t) => !(t.address === address && t.chainId === chainId)
            ),
          })),

        updateTokenOhlcv: (address, chainId, candle) =>
          set((state) => {
            const key = `${address}_${chainId}`;
            const idx = state.tokens.findIndex(
              (t) => `${t.address}_${t.chainId}` === key
            );
            if (idx === -1) return state;
            const updated = [...state.tokens];
            const token = { ...updated[idx] };
            const candles = [...(token.ohlcv || [])];

            // If same time bucket as last candle, update it; otherwise append
            if (candles.length > 0 && candles[candles.length - 1].t === candle.t) {
              candles[candles.length - 1] = candle;
            } else {
              candles.push(candle);
            }

            // Cap at MAX_CANDLES to avoid unbounded growth
            if (candles.length > MAX_CANDLES) {
              candles.splice(0, candles.length - MAX_CANDLES);
            }

            token.ohlcv = candles;
            updated[idx] = token;
            return { tokens: updated };
          }),

        setSelectedTokenIndex: (index) => set({ selectedTokenIndex: index }),
        setLoading: (loading) => set({ loading }),
        setError: (error) => set({ error, loading: false }),
        togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
        setLastUpdated: (time) => set({ lastUpdated: time }),
        setSortBy: (sortBy) => set({ sortBy }),
        setSelectedChainIds: (selectedChainIds) => set({ selectedChainIds }),
        setSelectedProtocols: (selectedProtocols) => set({ selectedProtocols }),
        updatePosition: (address, data) => set((state) => ({
          positions: { ...state.positions, [address.toLowerCase()]: data },
        })),
        clearPositions: () => set({ positions: {} }),
        setQuickBuyAmount: (quickBuyAmount) => set({ quickBuyAmount }),
        setQuickSellPercentage: (quickSellPercentage) => set({ quickSellPercentage }),
        setBuyCurrencyAddress: (buyCurrencyAddress) => set({ buyCurrencyAddress }),
        setWalletTokens: (walletTokens) => set({ walletTokens }),
        setIsBuyMode: (isBuyMode) => set({ isBuyMode }),
        setSlippage: (slippage) => set({ slippage }),
      }),
      {
        name: 'surge-store-cache',
        partialize: (state) => ({
          tokens: state.tokens,
          sortBy: state.sortBy,
          selectedChainIds: state.selectedChainIds,
          selectedProtocols: state.selectedProtocols,
          quickBuyAmount: state.quickBuyAmount,
          quickSellPercentage: state.quickSellPercentage,
          buyCurrencyAddress: state.buyCurrencyAddress,
          slippage: state.slippage,
          lastUpdated: state.lastUpdated,
        }),
      }
    ),
    { name: 'SurgeStore' }
  )
);
