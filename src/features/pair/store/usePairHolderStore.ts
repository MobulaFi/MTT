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
  clearHolders: () => void;
}

export const usePairHoldersStore = create<PairHoldersState>((set, get) => ({
  holders: [],
  holdersCount: 0,
  loading: false,
  blockchain: '',
  tokenPrice: 0,
  totalSupply: 0,
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

    console.log('[holders-store] upsertFromTrades called with', trades.length, 'trades');
    for (const t of trades) {
      const wallet = (t.swapRecipient || t.sender)?.toLowerCase();
      const existing = state.holders.find(h => h.walletAddress.toLowerCase() === wallet);
      console.log('[holders-store] trade detail:', {
        wallet,
        type: t.type,
        tradeTokenAmount: t.tokenAmount,
        tradeTokenAmountUsd: t.tokenAmountUsd,
        tradeTokenPrice: t.tokenPrice,
        existingBalance: existing ? existing.tokenAmount : 'NOT_FOUND',
        existingBalanceUSD: existing ? existing.tokenAmountUSD : 'NOT_FOUND',
      });
    }

    const { positions, countDelta } = applyTradesToPositions(
      state.holders,
      trades,
      { removeZeroBalance: true },
    );

    // Log the result for affected wallets
    for (const t of trades) {
      const wallet = (t.swapRecipient || t.sender)?.toLowerCase();
      const updated = positions.find(h => h.walletAddress.toLowerCase() === wallet);
      if (updated) {
        console.log('[holders-store] after apply:', {
          wallet,
          newBalance: updated.tokenAmount,
          newBalanceUSD: updated.tokenAmountUSD,
        });
      }
    }

    set({
      holders: positions,
      holdersCount: state.holdersCount + countDelta,
    });
  },

  clearHolders: () =>
    set({
      holders: [],
      holdersCount: 0,
      loading: false,
      blockchain: '',
      tokenPrice: 0,
      totalSupply: 0,
      sortField: 'balance',
      sortDirection: 'desc',
      labelFilter: null,
    }),
}));
