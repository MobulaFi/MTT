import { create } from 'zustand';
import type { TokenPositionsOutputResponse } from '@mobula_labs/types';
import { applyTradesToPositions } from '@/utils/applyTradesToPositions';

// Sort field options for the holders table
export type HolderSortField =
  | 'balance'
  | 'balanceUSD'
  | 'bought'
  | 'sold'
  | 'pnl'
  | 'remaining'
  | 'lastActive'
  | 'avgBuy'
  | 'avgSell';

export type SortDirection = 'asc' | 'desc';

export interface StreamTradeEvent {
  sender: string;
  swapRecipient?: string | null;
  type: 'buy' | 'sell';
  tokenAmount: number;
  tokenAmountUsd: number;
  tokenPrice: number;
  timestamp: number;
  blockchain: string;
  hash: string;
  labels?: string[];
  walletMetadata?: TokenPositionsOutputResponse['walletMetadata'];
  token?: string;
  event?: string;
  // Post-balance fields from the stream (raw bigint strings)
  // postBalanceBaseToken = sender's post-balance
  // postBalanceRecipientBaseToken = swap recipient's post-balance (when recipient != sender)
  postBalanceBaseToken?: string | null;
  preBalanceBaseToken?: string | null;
  postBalanceRecipientBaseToken?: string | null;
  tokenAmountRaw?: string;
}

interface PairHoldersState {
  holders: TokenPositionsOutputResponse[];
  holdersCount: number;
  loading: boolean;
  blockchain: string;
  tokenPrice: number;
  totalSupply: number;

  // Dedup: track seen trade hashes to prevent double-counting
  _seenHashes: Set<string>;

  // Sorting
  sortField: HolderSortField;
  sortDirection: SortDirection;

  // Filtering
  labelFilter: string | null;

  // Actions
  setHolders: (holders: TokenPositionsOutputResponse[]) => void;
  setHoldersCount: (count: number) => void;
  setBlockchain: (blockchain: string) => void;
  setLoading: (loading: boolean) => void;
  setTokenPrice: (price: number) => void;
  setTotalSupply: (supply: number) => void;
  setSortField: (field: HolderSortField) => void;
  setSortDirection: (direction: SortDirection) => void;
  toggleSort: (field: HolderSortField) => void;
  setLabelFilter: (label: string | null) => void;
  upsertFromTrades: (trades: StreamTradeEvent[]) => void;
  upsertHolder: (holder: TokenPositionsOutputResponse) => void;
  removeHolder: (walletAddress: string) => void;
  updateLpFromReserves: (reserveToken: number) => void;
  clearHolders: () => void;
}

export const usePairHoldersStore = create<PairHoldersState>((set, get) => ({
  holders: [],
  holdersCount: 0,
  loading: false,
  blockchain: '',
  tokenPrice: 0,
  totalSupply: 0,
  _seenHashes: new Set<string>(),
  sortField: 'balance',
  sortDirection: 'desc',
  labelFilter: null,

  setHolders: (holders) => set({ holders }),
  setHoldersCount: (count) => set({ holdersCount: count }),
  setBlockchain: (blockchain) => set({ blockchain }),
  setLoading: (loading) => set({ loading }),
  setTokenPrice: (price) => set({ tokenPrice: price }),
  setTotalSupply: (supply) => set({ totalSupply: supply }),
  setSortField: (field) => set({ sortField: field }),
  setSortDirection: (direction) => set({ sortDirection: direction }),

  toggleSort: (field) => {
    const { sortField, sortDirection } = get();
    if (sortField === field) {
      set({ sortDirection: sortDirection === 'asc' ? 'desc' : 'asc' });
    } else {
      set({ sortField: field, sortDirection: 'desc' });
    }
  },

  setLabelFilter: (label) => set({ labelFilter: label }),

  upsertFromTrades: (trades) => {
    const state = get();
    if (state.holders.length === 0) return;

    // Deduplicate by hash to avoid double-counting
    const unique = trades.filter((t) => {
      if (!t.hash) return true;
      if (state._seenHashes.has(t.hash)) return false;
      state._seenHashes.add(t.hash);
      // Cap set size to prevent memory leak
      if (state._seenHashes.size > 2000) {
        const iter = state._seenHashes.values();
        for (let i = 0; i < 500; i++) iter.next();
        // Recreate without oldest entries
        const keep = new Set<string>();
        for (const v of state._seenHashes) keep.add(v);
        // Just delete first 500
        let del = 0;
        for (const v of state._seenHashes) {
          if (del++ < 500) state._seenHashes.delete(v);
          else break;
        }
      }
      return true;
    });

    if (unique.length === 0) return;

    const { positions, countDelta } = applyTradesToPositions(
      state.holders,
      unique,
      { removeZeroBalance: true },
    );

    set({
      holders: positions,
      holdersCount: state.holdersCount + countDelta,
    });
  },

  upsertHolder: (holder) => {
    const state = get();
    const idx = state.holders.findIndex(
      (h) => h.walletAddress.toLowerCase() === holder.walletAddress.toLowerCase(),
    );
    const updated = [...state.holders];
    if (idx >= 0) {
      updated[idx] = holder;
    } else {
      updated.push(holder);
    }
    set({ holders: updated });
  },

  removeHolder: (walletAddress) => {
    const state = get();
    const filtered = state.holders.filter(
      (h) => h.walletAddress.toLowerCase() !== walletAddress.toLowerCase(),
    );
    if (filtered.length !== state.holders.length) {
      set({ holders: filtered, holdersCount: Math.max(0, filtered.length) });
    }
  },

  updateLpFromReserves: (reserveToken: number) => {
    const state = get();
    const idx = state.holders.findIndex((h) => h.labels?.includes('liquidityPool'));
    if (idx < 0 || reserveToken <= 0) return;
    const lp = state.holders[idx];
    // Skip if unchanged (avoid unnecessary re-renders)
    if (Math.abs(Number(lp.tokenAmount) - reserveToken) < 1) return;
    const updated = [...state.holders];
    updated[idx] = { ...lp, tokenAmount: String(reserveToken) };
    set({ holders: updated });
  },

  clearHolders: () =>
    set({
      holders: [],
      holdersCount: 0,
      loading: false,
      blockchain: '',
      tokenPrice: 0,
      totalSupply: 0,
      _seenHashes: new Set<string>(),
      sortField: 'balance',
      sortDirection: 'desc',
      labelFilter: null,
    }),
}));
