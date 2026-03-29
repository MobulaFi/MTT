import { create } from 'zustand';
import type { WalletToken } from '@/lib/tokens';
import { isNativeAddress } from '@/lib/tokens';
import type {
  AnalysisData,
  PositionEntry,
  ActivityEntry,
  PortfolioAsset,
} from '@/features/portfolio/types';

export interface UserPosition {
  address: string;
  chainId: string;
  blockchain: string;
  symbol: string;
  name: string;
  logo: string | null;
  decimals: number;
  balance: number;
  balanceUSD: number;
  priceUSD: number;
  marketCap: number;
  // Real-time WSS fields
  unrealizedPnlUSD: number;
  totalPnlUSD: number;
  realizedPnlUSD: number;
  avgBuyPriceUSD: number;
  avgSellPriceUSD: number;
  volumeBuy: number;
  volumeSell: number;
}

type PositionRealtimeUpdate = Partial<Pick<UserPosition,
  'balanceUSD' | 'balance' | 'unrealizedPnlUSD' | 'totalPnlUSD' | 'realizedPnlUSD' |
  'avgBuyPriceUSD' | 'avgSellPriceUSD' | 'priceUSD' | 'marketCap' | 'volumeBuy' | 'volumeSell'
>>;

interface UserPortfolioState {
  /** All portfolio positions sorted by balanceUSD desc */
  positions: UserPosition[];
  /** Flat wallet tokens (for trading currency pickers etc.) */
  walletTokens: WalletToken[];
  /** Total USD balance */
  totalBalanceUsd: number;
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Last successful fetch timestamp */
  lastFetchedAt: number;
  /** Refresh trigger (incremented after swaps) */
  refreshTrigger: number;

  // ---- Portfolio page preloaded data ----
  /** Portfolio response (totalBalanceUSD, assetsCount, assets) */
  portfolioResponse: { totalBalanceUSD?: number; assetsCount?: number; assets?: PortfolioAsset[] } | null;
  /** Wallet analysis data */
  analysisData: AnalysisData | null;
  /** Detailed positions with PnL */
  detailedPositions: PositionEntry[];
  /** Activity entries */
  activityEntries: ActivityEntry[];
  /** Balance history */
  balanceHistory: Array<{ date: string; value: number }>;
  /** Whether portfolio page data has been preloaded */
  pageDataReady: boolean;
  /** History loading state */
  isHistoryLoading: boolean;

  // Actions
  setPositions: (positions: UserPosition[]) => void;
  /** Batch-set positions + walletTokens + totalBalance in a single state update */
  setPortfolioData: (positions: UserPosition[], walletTokens: WalletToken[], totalBalance: number) => void;
  setWalletTokens: (tokens: WalletToken[]) => void;
  setTotalBalance: (total: number) => void;
  setLoading: (loading: boolean) => void;
  /** Update a single position's real-time fields (from WSS) — no sort, lightweight */
  updatePositionRealtime: (address: string, update: PositionRealtimeUpdate) => void;
  /** Batch-update multiple positions in one pass (from WSS batching) */
  batchUpdatePositions: (updates: Map<string, PositionRealtimeUpdate>) => void;
  /** Trigger a refresh (call after swap) */
  triggerRefresh: () => void;
  /** Apply a full positions snapshot from WSS — merges new positions, updates existing, recalculates total */
  applyPositionsSnapshot: (wssPositions: UserPosition[]) => void;
  /** Optimistic update after swap — instantly adjusts balances before WSS/REST confirm */
  applyOptimisticSwapUpdate: (params: {
    direction: 'buy' | 'sell';
    tokenAddress: string;
    tokenSymbol: string;
    tokenLogo: string | null;
    tokenBlockchain: string;
    tokenChainId: string;
    tokenAmountDelta: number;
    usdAmountDelta: number;
    nativeAddress: string;
    nativePriceUSD: number;
  }) => void;
  reset: () => void;

  // Portfolio page data actions
  setPortfolioPageData: (data: {
    portfolioResponse?: { totalBalanceUSD?: number; assetsCount?: number; assets?: PortfolioAsset[] } | null;
    analysisData?: AnalysisData | null;
    detailedPositions?: PositionEntry[];
    activityEntries?: ActivityEntry[];
  }) => void;
  setBalanceHistory: (history: Array<{ date: string; value: number }>) => void;
  setHistoryLoading: (loading: boolean) => void;
}

// Address → index lookup for O(1) position updates instead of O(n) findIndex
let addressIndexMap = new Map<string, number>();
let detailedAddressIndexMap = new Map<string, number>();

function rebuildAddressIndex(positions: UserPosition[]) {
  addressIndexMap = new Map();
  for (let i = 0; i < positions.length; i++) {
    addressIndexMap.set(positions[i].address.toLowerCase(), i);
  }
}

function rebuildDetailedAddressIndex(positions: PositionEntry[]) {
  detailedAddressIndexMap = new Map();
  for (let i = 0; i < positions.length; i++) {
    detailedAddressIndexMap.set(positions[i].token.address.toLowerCase(), i);
  }
}

/** Map WSS PositionRealtimeUpdate fields → PositionEntry fields (different naming) */
function applyRealtimeToDetailed(entry: PositionEntry, update: PositionRealtimeUpdate): PositionEntry {
  const patched = { ...entry };
  if (update.balance !== undefined) patched.balance = update.balance;
  if (update.balanceUSD !== undefined) patched.amountUSD = update.balanceUSD;
  if (update.priceUSD !== undefined) patched.priceUSD = update.priceUSD;
  if (update.unrealizedPnlUSD !== undefined) patched.unrealizedPnlUSD = update.unrealizedPnlUSD;
  if (update.realizedPnlUSD !== undefined) patched.realizedPnlUSD = update.realizedPnlUSD;
  if (update.totalPnlUSD !== undefined) patched.totalPnlUSD = update.totalPnlUSD;
  if (update.avgBuyPriceUSD !== undefined) patched.avgBuyPriceUSD = update.avgBuyPriceUSD;
  if (update.avgSellPriceUSD !== undefined) patched.avgSellPriceUSD = update.avgSellPriceUSD;
  if (update.volumeBuy !== undefined) patched.volumeBuy = update.volumeBuy;
  if (update.volumeSell !== undefined) patched.volumeSell = update.volumeSell;
  if (update.marketCap !== undefined) patched.marketCapUSD = update.marketCap;
  return patched;
}

export const useUserPortfolioStore = create<UserPortfolioState>((set) => ({
  positions: [],
  walletTokens: [],
  totalBalanceUsd: 0,
  isLoading: false,
  lastFetchedAt: 0,
  refreshTrigger: 0,

  // Portfolio page preloaded data
  portfolioResponse: null,
  analysisData: null,
  detailedPositions: [],
  activityEntries: [],
  balanceHistory: [],
  pageDataReady: false,
  isHistoryLoading: false,

  setPositions: (positions) => {
    rebuildAddressIndex(positions);
    set({ positions, lastFetchedAt: Date.now() });
  },

  setPortfolioData: (positions, walletTokens, totalBalance) => {
    // MERGE: keep existing positions that are NOT in the REST response
    // but still have balance (e.g. WSS-added tokens, native tokens REST missed)
    const currentPositions = useUserPortfolioStore.getState().positions;
    if (currentPositions.length > 0) {
      const restAddrs = new Set(positions.map((p) => p.address.toLowerCase()));
      for (const existing of currentPositions) {
        if (!restAddrs.has(existing.address.toLowerCase()) && (existing.balance > 0 || existing.balanceUSD > 0.01 || isNativeAddress(existing.address))) {
          positions.push(existing);
        }
      }
      // Re-sort after merge
      positions.sort((a, b) => b.balanceUSD - a.balanceUSD);
    }
    rebuildAddressIndex(positions);
    set({ positions, walletTokens, totalBalanceUsd: totalBalance, lastFetchedAt: Date.now() });
  },

  setWalletTokens: (walletTokens) => set({ walletTokens }),

  setTotalBalance: (totalBalanceUsd) => set({ totalBalanceUsd }),

  setLoading: (isLoading) => set({ isLoading }),

  updatePositionRealtime: (address, update) =>
    set((state) => {
      const idx = addressIndexMap.get(address.toLowerCase());
      if (idx === undefined || idx >= state.positions.length) return state;

      // Shallow-copy array, update the single position
      const updated = [...state.positions];
      // Native tokens: never overwrite balance/balanceUSD from WSS trade data
      if (isNativeAddress(address)) {
        const { balanceUSD: _u, balance: _b, ...safeUpdate } = update;
        updated[idx] = { ...updated[idx], ...safeUpdate };
      } else {
        updated[idx] = { ...updated[idx], ...update };
      }

      // Also propagate to detailedPositions
      const result: Partial<UserPortfolioState> = { positions: updated };
      const dIdx = detailedAddressIndexMap.get(address.toLowerCase());
      if (dIdx !== undefined && dIdx < state.detailedPositions.length) {
        const updatedDetailed = [...state.detailedPositions];
        updatedDetailed[dIdx] = applyRealtimeToDetailed(updatedDetailed[dIdx], update);
        result.detailedPositions = updatedDetailed;
      }

      return result;
    }),

  batchUpdatePositions: (updates) =>
    set((state) => {
      if (updates.size === 0) return state;

      let updated = [...state.positions];
      let changed = false;

      for (const [address, update] of updates) {
        const idx = addressIndexMap.get(address.toLowerCase());
        if (idx === undefined || idx >= updated.length) continue;
        // Native tokens: never overwrite balance/balanceUSD from WSS trade data
        // REST portfolio is the source of truth for native wallet balance
        if (isNativeAddress(address)) {
          const { balance: _b, balanceUSD: _u, ...safeUpdate } = update;
          if (Object.keys(safeUpdate).length === 0) continue;
          updated[idx] = { ...updated[idx], ...safeUpdate };
        } else {
          updated[idx] = { ...updated[idx], ...update };
        }
        changed = true;
      }

      // Remove positions that have been fully sold (balance and balanceUSD both zero)
      // NEVER remove native tokens (SOL/ETH) — they should always stay visible
      const beforeLen = updated.length;
      updated = updated.filter((p) => isNativeAddress(p.address) || p.balance > 0 || p.balanceUSD > 0.01);
      if (updated.length !== beforeLen) {
        changed = true;
        rebuildAddressIndex(updated);
      }

      // Recalculate totalBalanceUsd from positions so the header updates instantly
      let newTotal: number | undefined;
      if (changed) {
        newTotal = updated.reduce((sum, p) => sum + p.balanceUSD, 0);
      } else {
        // Even without removals, balance values may have changed via WSS
        const hasBalanceChange = [...updates.values()].some((u) => u.balanceUSD !== undefined);
        if (hasBalanceChange) {
          newTotal = updated.reduce((sum, p) => sum + p.balanceUSD, 0);
        }
      }

      // Also propagate WSS updates to detailedPositions (displayed in portfolio table)
      let detailedChanged = false;
      let updatedDetailed = state.detailedPositions;

      if (state.detailedPositions.length > 0) {
        for (const [address, update] of updates) {
          const dIdx = detailedAddressIndexMap.get(address.toLowerCase());
          if (dIdx === undefined || dIdx >= state.detailedPositions.length) continue;
          if (!detailedChanged) {
            updatedDetailed = [...state.detailedPositions];
            detailedChanged = true;
          }
          updatedDetailed[dIdx] = applyRealtimeToDetailed(updatedDetailed[dIdx], update);
        }
      }

      if (!changed && !detailedChanged && newTotal === undefined) return state;
      return {
        ...(changed ? { positions: updated } : {}),
        ...(detailedChanged ? { detailedPositions: updatedDetailed } : {}),
        ...(newTotal !== undefined ? { totalBalanceUsd: newTotal } : {}),
      };
    }),

  triggerRefresh: () =>
    set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),

  applyPositionsSnapshot: (wssPositions) =>
    set((state) => {
      let updated: UserPosition[] | null = null; // lazy copy — only allocate when needed
      let changed = false;

      for (const wssPos of wssPositions) {
        if (!wssPos.address) continue;
        const key = wssPos.address.toLowerCase();
        const idx = addressIndexMap.get(key);

        if (idx !== undefined && idx < state.positions.length) {
          const existing = state.positions[idx];

          // Native tokens (SOL/ETH): WSS positions track trade data, NOT wallet balance.
          // The REST portfolio is the authoritative source for native balance.
          // Never overwrite native balance/balanceUSD from WSS — only update PnL fields.
          if (isNativeAddress(existing.address)) {
            // Only update PnL fields if they actually changed
            if (
              existing.unrealizedPnlUSD === wssPos.unrealizedPnlUSD &&
              existing.totalPnlUSD === wssPos.totalPnlUSD &&
              existing.realizedPnlUSD === wssPos.realizedPnlUSD &&
              existing.avgBuyPriceUSD === wssPos.avgBuyPriceUSD &&
              existing.volumeBuy === wssPos.volumeBuy &&
              existing.volumeSell === wssPos.volumeSell
            ) continue;

            if (!updated) updated = [...state.positions];
            updated[idx] = {
              ...existing,
              // Preserve REST-provided balance — never overwrite from WSS trade data
              unrealizedPnlUSD: wssPos.unrealizedPnlUSD,
              totalPnlUSD: wssPos.totalPnlUSD,
              realizedPnlUSD: wssPos.realizedPnlUSD,
              avgBuyPriceUSD: wssPos.avgBuyPriceUSD,
              avgSellPriceUSD: wssPos.avgSellPriceUSD,
              volumeBuy: wssPos.volumeBuy,
              volumeSell: wssPos.volumeSell,
            };
            changed = true;
            continue;
          }

          // Skip if nothing actually changed (avoid unnecessary re-renders / flash)
          if (
            existing.balance === wssPos.balance &&
            existing.balanceUSD === wssPos.balanceUSD &&
            existing.unrealizedPnlUSD === wssPos.unrealizedPnlUSD &&
            existing.totalPnlUSD === wssPos.totalPnlUSD &&
            existing.realizedPnlUSD === wssPos.realizedPnlUSD &&
            existing.avgBuyPriceUSD === wssPos.avgBuyPriceUSD &&
            existing.volumeBuy === wssPos.volumeBuy &&
            existing.volumeSell === wssPos.volumeSell
          ) continue;

          if (!updated) updated = [...state.positions];
          updated[idx] = {
            ...existing,
            balance: wssPos.balance,
            balanceUSD: wssPos.balanceUSD,
            priceUSD: wssPos.priceUSD || existing.priceUSD,
            unrealizedPnlUSD: wssPos.unrealizedPnlUSD,
            totalPnlUSD: wssPos.totalPnlUSD,
            realizedPnlUSD: wssPos.realizedPnlUSD,
            avgBuyPriceUSD: wssPos.avgBuyPriceUSD,
            avgSellPriceUSD: wssPos.avgSellPriceUSD,
            volumeBuy: wssPos.volumeBuy,
            volumeSell: wssPos.volumeSell,
          };
          changed = true;
        } else if (wssPos.balance > 0 || wssPos.balanceUSD > 0.01) {
          // New position — add it (e.g. first buy of a token)
          if (!updated) updated = [...state.positions];
          updated.push(wssPos);
          rebuildAddressIndex(updated);
          changed = true;
        }
      }

      if (!changed || !updated) return state;

      // Remove sold positions (balance=0 AND balanceUSD≈0), preserving native tokens.
      // The WSS snapshot only includes positions with balance>0, so sold tokens
      // simply disappear from the snapshot. Without this filter they'd persist forever.
      const beforeLen = updated.length;
      updated = updated.filter((p) => isNativeAddress(p.address) || p.balance > 0 || p.balanceUSD > 0.01);
      if (updated.length !== beforeLen) {
        rebuildAddressIndex(updated);
      }

      // Recalculate total from ALL positions (including ones NOT in the WSS snapshot)
      const newTotal = updated.reduce((sum, p) => sum + p.balanceUSD, 0);
      return { positions: updated, totalBalanceUsd: newTotal };
    }),

  applyOptimisticSwapUpdate: ({ direction, tokenAddress, tokenSymbol, tokenLogo, tokenBlockchain, tokenChainId, tokenAmountDelta, usdAmountDelta, nativeAddress, nativePriceUSD }) =>
    set((state) => {
      let updated = [...state.positions];
      let changed = false;

      // Find the token position
      const tokenIdx = addressIndexMap.get(tokenAddress.toLowerCase());

      if (direction === 'buy') {
        // BUY: SOL decreases, token increases
        // Update native position
        const nativeIdx = addressIndexMap.get(nativeAddress.toLowerCase());
        if (nativeIdx !== undefined && nativeIdx < updated.length) {
          const nativePos = updated[nativeIdx];
          const solSpent = nativePriceUSD > 0 ? usdAmountDelta / nativePriceUSD : 0;
          updated[nativeIdx] = {
            ...nativePos,
            balance: Math.max(0, nativePos.balance - solSpent),
            balanceUSD: Math.max(0, nativePos.balanceUSD - usdAmountDelta),
          };
          changed = true;
        }

        // Update or create token position
        if (tokenIdx !== undefined && tokenIdx < updated.length) {
          const pos = updated[tokenIdx];
          updated[tokenIdx] = {
            ...pos,
            balance: pos.balance + tokenAmountDelta,
            balanceUSD: pos.balanceUSD + usdAmountDelta,
          };
        } else {
          // New position — add it
          updated.push({
            address: tokenAddress,
            chainId: tokenChainId,
            blockchain: tokenBlockchain,
            symbol: tokenSymbol,
            name: tokenSymbol,
            logo: tokenLogo,
            decimals: 0,
            balance: tokenAmountDelta,
            balanceUSD: usdAmountDelta,
            priceUSD: tokenAmountDelta > 0 ? usdAmountDelta / tokenAmountDelta : 0,
            marketCap: 0,
            unrealizedPnlUSD: 0,
            totalPnlUSD: 0,
            realizedPnlUSD: 0,
            avgBuyPriceUSD: 0,
            avgSellPriceUSD: 0,
            volumeBuy: 0,
            volumeSell: 0,
          });
          rebuildAddressIndex(updated);
        }
        changed = true;
      } else {
        // SELL: token decreases, SOL increases
        if (tokenIdx !== undefined && tokenIdx < updated.length) {
          const pos = updated[tokenIdx];
          updated[tokenIdx] = {
            ...pos,
            balance: Math.max(0, pos.balance - tokenAmountDelta),
            balanceUSD: Math.max(0, pos.balanceUSD - usdAmountDelta),
          };
          changed = true;
        }

        // Update native position
        const nativeIdx = addressIndexMap.get(nativeAddress.toLowerCase());
        if (nativeIdx !== undefined && nativeIdx < updated.length) {
          const nativePos = updated[nativeIdx];
          const solGained = nativePriceUSD > 0 ? usdAmountDelta / nativePriceUSD : 0;
          updated[nativeIdx] = {
            ...nativePos,
            balance: nativePos.balance + solGained,
            balanceUSD: nativePos.balanceUSD + usdAmountDelta,
          };
          changed = true;
        }
      }

      if (!changed) return state;

      // Filter out sold positions after optimistic sell (balance=0)
      const lenB = updated.length;
      updated = updated.filter((p) => isNativeAddress(p.address) || p.balance > 0 || p.balanceUSD > 0.01);
      if (updated.length !== lenB) rebuildAddressIndex(updated);

      const newTotal = updated.reduce((sum, p) => sum + p.balanceUSD, 0);
      return { positions: updated, totalBalanceUsd: newTotal };
    }),

  reset: () => {
    addressIndexMap = new Map();
    detailedAddressIndexMap = new Map();
    set({
      positions: [],
      walletTokens: [],
      totalBalanceUsd: 0,
      isLoading: false,
      lastFetchedAt: 0,
      portfolioResponse: null,
      analysisData: null,
      detailedPositions: [],
      activityEntries: [],
      balanceHistory: [],
      pageDataReady: false,
      isHistoryLoading: false,
    });
  },

  setPortfolioPageData: (data) => {
    if (data.detailedPositions !== undefined) {
      rebuildDetailedAddressIndex(data.detailedPositions);
    }
    set({
      ...(data.portfolioResponse !== undefined && { portfolioResponse: data.portfolioResponse }),
      ...(data.analysisData !== undefined && { analysisData: data.analysisData }),
      ...(data.detailedPositions !== undefined && { detailedPositions: data.detailedPositions }),
      ...(data.activityEntries !== undefined && { activityEntries: data.activityEntries }),
      pageDataReady: true,
    });
  },

  setBalanceHistory: (balanceHistory) => set({ balanceHistory }),

  setHistoryLoading: (isHistoryLoading) => set({ isHistoryLoading }),
}));

/**
 * Find a position by token address from the global store.
 * Use outside React: useUserPortfolioStore.getState().positions.find(...)
 * Use in React: usePositionForToken(address)
 */
export function usePositionForToken(address: string | null): UserPosition | undefined {
  return useUserPortfolioStore((s) => {
    if (!address) return undefined;
    const idx = addressIndexMap.get(address.toLowerCase());
    return idx !== undefined ? s.positions[idx] : undefined;
  });
}
