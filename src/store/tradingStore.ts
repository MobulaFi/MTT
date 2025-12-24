// store/tradingStore.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { getMobulaClient } from '@/lib/mobulaClient';
import type {
  Market,
} from '@/types/trading';
import type { SubscriptionPayload } from '@mobula_labs/sdk';
import { WalletV2DeployerResponse, WssFastTradesResponseType } from '@mobula_labs/types';

export interface DevTokenSimplified {
  name: string;
  address: string;
  chainId: string;
  symbol: string;
  logo: string;
  marketCap: number;
  liquidityUSD: number;
  volume1hUSD: number;
  createdAt: string;
  migrated: boolean;
  poolAddress: string;
}

interface TradingState {
  // Data
  trades: WssFastTradesResponseType[];
  markets: Market[];

  devTokens: DevTokenSimplified[];
  devTokensPage: number;
  devTokensLimit: number;

  // Loading states
  isLoadingTrades: boolean;
  isLoadingMarkets: boolean;
  isLoadingDevTokens: boolean;

  // Active subscriptions
  activeSubscriptions: Map<keyof SubscriptionPayload, string>;

  // Actions
  addTrade: (trade: WssFastTradesResponseType) => void;
  setTrades: (trades: WssFastTradesResponseType[]) => void;
  setMarkets: (markets: Market[]) => void;
  setDevTokens: (tokens: DevTokenSimplified[]) => void;


  // Data fetching
  fetchMarkets: (address: string, blockchain: string) => Promise<void>;
  fetchDevTokens: (address: string, blockchain: string, page?: number, limit?: number) => Promise<void>;
  loadMoreDevTokens: (address: string, blockchain: string) => void;
  // Real-time subscriptions
  subscribeToTrades: (address: string, blockchain: string) => void;
  unsubscribeFromTrades: () => void;

  // Cleanup
  cleanup: () => void;
}

export const useTradingStore = create<TradingState>()(
  subscribeWithSelector((set, get) => ({

    trades: [],
    markets: [],
    devTokens: [],

    devTokensPage: 1,
    devTokensLimit: 20,
    isLoadingTrades: false,
    isLoadingMarkets: false,
    isLoadingDevTokens: false,

    activeSubscriptions: new Map<keyof SubscriptionPayload, string>(),

    addTrade: (trade) =>
      set((state) => ({
        trades: [trade, ...state.trades].slice(0, 100), // Keep last 100 trades
      })),

    setTrades: (trades) => set({ trades }),
    setMarkets: (markets) => set({ markets }),
    setDevTokens: (devTokens) => set({ devTokens }),


    // Fetch markets
    fetchMarkets: async (address: string, blockchain: string) => {
      set({ isLoadingMarkets: true });
      try {
        const client = getMobulaClient();
        const response = await client.fetchTokenMarkets({
          address: address,
          blockchain,
        });

        if (response.data) {
          const markets = response.data.map((market: any) => ({
            exchange: market.exchange?.name || 'Unknown',
            chainId: market.base.chainId ,
            poolAddress: market.address,
            exchangeLogo: market.exchange?.logo || '',
            pair: `${market.base?.symbol || 'UNKNOWN'}/${market.quote?.symbol || 'UNKNOWN'}`,
            baseSymbol: market.base?.symbol || 'UNKNOWN',
            baseAddress: market.base?.address,
            quoteSymbol: market.quote?.symbol || 'UNKNOWN',
            quoteAddress: market.quote?.address,
            price: market.priceUSD ?? 0, // fallback to 0
            priceChange24hPercentage: market.priceChange24hPercentage ?? 0,
            volume24hUSD: market.volume24hUSD ?? 0,
            basePriceUSD: market.base?.priceUSD,
            quotePriceUSD: market.quote?.priceUSD,
            reserve0: market.base?.approximateReserveToken ,
            totalFeesPaidUSD: market?.totalFeesPaidUSD,
            reserve1: market.quote?.approximateReserveToken
          }));
          set({ markets, isLoadingMarkets: false });
        }
      } catch (error) {
        console.error('Error fetching markets:', error);
        set({ isLoadingMarkets: false });
      }
    },

    // Fetch dev tokens
    fetchDevTokens: async (address, blockchain, page = 1, limit = 20) => {
      set({ isLoadingDevTokens: true });
      try {
        const client = getMobulaClient();
        const response: WalletV2DeployerResponse = await client.fetchWalletDeployer({ wallet: address, blockchain, page: String(page), limit: String(limit) });
        if (response.data) {
          const newTokens: DevTokenSimplified[] = response.data.map((token: any) => ({
            name: token.token.name,
            address: token.token.address,
            chainId: token.token.chainId,
            symbol: token.token.symbol,
            logo: token.token.logo,
            marketCap: token.token.marketCapUSD,
            liquidityUSD: token.token.liquidityUSD,
            volume1hUSD: token.token.volume1hUSD,
            createdAt: token.token.createdAt,
            migrated: token.token.bonded,
            poolAddress: token.token.poolAddress,
          }));

          set((state) => ({
            devTokens: page === 1 ? newTokens : [...state.devTokens, ...newTokens],
            devTokensPage: page,
            devTokensLimit: limit,
          }));
        }
      } catch (err) {
        console.error('Error fetching dev tokens:', err);
      } finally {
        set({ isLoadingDevTokens: false });
      }
    },

    // Load more dev tokens
    loadMoreDevTokens: (address, blockchain) => {
      const { devTokensPage, devTokensLimit, fetchDevTokens } = get();
      fetchDevTokens(address, blockchain, devTokensPage + 1, devTokensLimit);
    },

    // Subscribe to real-time trades
    subscribeToTrades: (address: string, blockchain: string) => {
      const client = getMobulaClient();
      const { activeSubscriptions } = get();

      // Unsubscribe from existing if any
      if (activeSubscriptions.has('fast-trade')) {
        get().unsubscribeFromTrades();
      }

      try {
        const subscriptionId = client.streams.subscribe(
          'fast-trade',
          {
            assetMode: false,
            items: [
              {
                blockchain: blockchain,
                address: address
              },
            ],
            subscriptionTracking: true
          },
          (trade: unknown) => {
            get().addTrade(trade as WssFastTradesResponseType);
          }
        );

        activeSubscriptions.set('fast-trade', subscriptionId);
        set({ activeSubscriptions: new Map(activeSubscriptions) });
      } catch (error) {
        console.error('Error subscribing to trades:', error);
      }
    },

    // Unsubscribe from trades
    unsubscribeFromTrades: async () => {
      const { activeSubscriptions } = get();
      const subscriptionId = activeSubscriptions.get('fast-trade');

      if (subscriptionId) {
        try {
          const client = getMobulaClient();
          await client.streams.unsubscribe('fast-trade', subscriptionId);
          activeSubscriptions.delete('fast-trade');
          set({ activeSubscriptions: new Map(activeSubscriptions) });
        } catch (error) {
          console.error('Error unsubscribing from trades:', error);
        }
      }
    },

    // Cleanup all subscriptions
    cleanup: async () => {
      const { activeSubscriptions } = get();
      const client = getMobulaClient();

      for (const [streamType, subId] of activeSubscriptions.entries()) {
        try {
          await client.streams.unsubscribe(streamType, subId);
        } catch (error) {
          console.error(`Error cleaning up subscription ${streamType}:`, error);
        }
      }

      set({
        activeSubscriptions: new Map(),

        trades: [],
        markets: [],
        devTokens: [],
      });
    },
  }))
);