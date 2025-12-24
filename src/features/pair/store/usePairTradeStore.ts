import { FormattedTokenTradesResponse } from '@mobula_labs/types';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { shallow } from 'zustand/shallow';

export enum MobileSection {
  INFO = 0,
  CHART = 1,
}

export type Timeframe = '1min' | '5min' | '15min' | '1h' | '4h' | '12h' | '24h';

export type Transaction = FormattedTokenTradesResponse['data'][number];


interface TypeFilter {
  title: string;
  value: (trade: Transaction) => boolean;
  selected?: boolean;
}

interface Filter {
  min_max: [number, number];
  filter: (trade: Transaction) => boolean;
}

interface Filters {
  type: TypeFilter[];
  usd: Filter;
  base: Filter;
  quote: Filter;
}

type FilterModalType = {
  genericType: 'min_max' | 'type' | 'maker' | null;
  exactType: 'type' | 'usd' | 'base' | 'quote' | 'price' | 'maker' | null;
};


interface IPairStore {
  timeframe: Timeframe;
  trades: Transaction[];
  filters: Filters;
  filterModalState: FilterModalType;
  mobileSection: MobileSection;
  orderBy: 'desc' | 'asc';
  updateOrderBy: (value: 'desc' | 'asc') => void;
  setMobileSection: (value: MobileSection) => void;
  updateFilterModal: (modal: Partial<FilterModalType> | null) => void;
  clearTrades: () => void;
  setTimeframe: (value: Timeframe) => void;
  updateTrades: (value: Transaction[] | ((prev: Transaction[]) => Transaction[])) => void;
  updateFilters: (filterType: 'type' | 'usd' | 'base' | 'quote', value: number[] | number) => void;
  getFilteredTrades: (trades: Transaction[]) => Transaction[];
}

const MAX_TRADES = 100; // Limit trades to prevent memory bloat

export const usePairTradeStore = create<IPairStore>()(
  devtools(
    immer((set, get) => ({
      timeframe: '1h',
      trades: [],
      orderBy: 'desc',
      mobileSection: MobileSection.INFO,
      filterModalState: {
        genericType: null,
        exactType: null,
      },
      filters: {
        type: [
          { title: 'Buy / Sell', value: () => true, selected: true },
          { title: 'Buy', value: (trade) => trade.type === 'buy' },
          { title: 'Sell', value: (trade) => trade.type === 'sell' },
        ],
        usd: {
          min_max: [0, Number.POSITIVE_INFINITY],
          filter(trade) {
            return trade.tokenAmountUsd >= this.min_max[0] && trade.tokenAmountUsd <= this.min_max[1];
          },
        },
        base: {
          min_max: [0, Number.POSITIVE_INFINITY],
          filter(trade) {
            return trade.tokenAmount >= this.min_max[0] && trade.tokenAmount <= this.min_max[1];
          },
        },
        quote: {
          min_max: [0, Number.POSITIVE_INFINITY],
          filter(trade) {
            return trade.tokenAmountVs >= this.min_max[0] && trade.tokenAmountVs <= this.min_max[1];
          },
        },
      },
      updateOrderBy: (value) => {
        set((state) => {
          state.orderBy = value;
        });
      },
      getFilteredTrades: (trades) => {
        const { filters } = get();
        if (!trades) return [];
      
        return trades.filter((trade) => {
          // Type filter — e.g. Buy / Sell
          const typePass = filters.type.find((f) => f.selected)?.value(trade) ?? true;
      
          // Numeric filters — base, quote, usd
          const usdPass = typeof filters.usd.filter === 'function'
            ? filters.usd.filter(trade)
            : true;
      
          const basePass = typeof filters.base.filter === 'function'
            ? filters.base.filter(trade)
            : true;
      
          const quotePass = typeof filters.quote.filter === 'function'
            ? filters.quote.filter(trade)
            : true;
      
          return typePass && usdPass && basePass && quotePass;
        });
      },
      
      clearTrades: () => {
        set((state) => {
          state.trades = [];
        });
      },
      updateFilters: (filterType, value) => {
        set((state) => {
          if (filterType === 'type') {
            state.filters.type.forEach((filter, index) => {
              filter.selected = index === value;
            });
          } else {
            state.filters[filterType].min_max = value as [number, number];
          }
        });
      },
      updateFilterModal: (modal) => {
        set((state) => {
          if (modal === null) {
            state.filterModalState = { genericType: null, exactType: null };
          } else {
            Object.assign(state.filterModalState, modal);
          }
        });
      },
      closeFilterModal: () => {
        set((state) => {
          state.filterModalState = { genericType: null, exactType: null };
        });
      },
      setMobileSection: (value) => {
        set((state) => {
          state.mobileSection = value;
        });
      },
      setTimeframe: (value) => {
        set((state) => {
          state.timeframe = value;
        });
      },
      updateTrades: (value) => {
        set((state) => {
          let newTrades: Transaction[];
          if (typeof value === 'function') {
            newTrades = value(state.trades);
          } else {
            newTrades = value;
          }
          
          // Limit trades to prevent memory bloat
          const limitedTrades = newTrades.slice(0, MAX_TRADES);
          
          // Only update if trades actually changed (shallow comparison of array length and first/last hashes)
          const currentHashes = state.trades.map(t => t.hash).join(',');
          const newHashes = limitedTrades.map(t => t.hash).join(',');
          
          if (currentHashes !== newHashes || state.trades.length !== limitedTrades.length) {
            state.trades = limitedTrades;
          }
        });
      },
    })),
    { name: 'PairTradeStore' }
  )
);

