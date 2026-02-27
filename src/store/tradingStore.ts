// store/tradingStore.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { sdk, streams } from '@/lib/sdkClient';
import type {
  Market,
} from '@/types/trading';
import { WalletV2DeployerResponse, WssFastTradesResponseType } from '@mobula_labs/types';

// Stream subscription type
type StreamSubscription = { unsubscribe: () => void };

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
  activeTradeSubscription: StreamSubscription | null;

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

    activeTradeSubscription: null,

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
        const response = await sdk.fetchTokenMarkets({ address, blockchain });

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
        const response = await sdk.fetchWalletDeployer({ wallet: address, blockchain, page: String(page), limit: String(limit) }) as WalletV2DeployerResponse;
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

    // Subscribe to real-time trades (streams wrapper handles server/client mode)
    subscribeToTrades: (address: string, blockchain: string) => {
      // Unsubscribe from existing if any
      const { activeTradeSubscription } = get();
      if (activeTradeSubscription) {
        activeTradeSubscription.unsubscribe();
      }

      try {
        const subscription = streams.subscribeFastTrade(
          {
            assetMode: false,
            items: [{ blockchain, address }],
            subscriptionTracking: true
          },
          (trade: unknown) => {
            get().addTrade(trade as WssFastTradesResponseType);
          }
        );

        set({ activeTradeSubscription: subscription });
      } catch (error) {
        console.error('Error subscribing to trades:', error);
      }
    },

    // Unsubscribe from trades
    unsubscribeFromTrades: () => {
      const { activeTradeSubscription } = get();
      if (activeTradeSubscription) {
        activeTradeSubscription.unsubscribe();
        set({ activeTradeSubscription: null });
      }
    },

    // Cleanup all subscriptions
    cleanup: () => {
      const { activeTradeSubscription } = get();
      if (activeTradeSubscription) {
        activeTradeSubscription.unsubscribe();
      }

      set({
        activeTradeSubscription: null,
        trades: [],
        markets: [],
        devTokens: [],
      });
    },
  }))
);