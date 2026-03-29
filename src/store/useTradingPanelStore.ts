import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WalletToken } from '@/lib/tokens';

type TradingMode = 'buy' | 'sell';
type OrderType = 'market' | 'limit' | 'twap';
type PriorityFeePreset = 'auto' | 'low' | 'medium' | 'high' | 'veryHigh' | 'custom';

interface SolanaSwapSettings {
  priorityFeePreset: PriorityFeePreset;
  priorityFeeCustom: number;
  
  jitoEnabled: boolean;
  jitoTipLamports: number;
  
  computeUnitLimitAuto: boolean;
  computeUnitLimit: number;
    
  useInstructionsMode: boolean;
}

interface PositionStats {
  volumeBuy: number;
  volumeSell: number;
  balance: number;
  amountUSD: number;
  realizedPnlUSD: number;
  unrealizedPnlUSD: number;
  totalPnlUSD: number;
  avgBuyPriceUSD: number;
  avgSellPriceUSD: number;
}

/** @deprecated Use WalletToken from '@/lib/tokens' */
type OwnedToken = WalletToken;

interface BuySeries {
  tokenAddress: string;
  totalUSD: number;
  totalTokenAmount: number;
}

interface TradingPanelState {
  tradingMode: TradingMode;
  orderType: OrderType;

  buyAmount: string;
  limitPrice: string;
  buyStrategy: string;
  buyBalance: string;
  sellBalance: string;
  /** Whether the sell balance is estimated from trade volumes (RPC fetch failed) */
  isSellBalanceEstimated: boolean;

  /** Timestamp of last trade — WSS balance updates are ignored for 5s after a trade */
  lastTradeAt: number;
  markTrade: () => void;

  positionStats: PositionStats | null;
  setPositionStats: (stats: PositionStats | null) => void;

  /** Accumulated buy USD/token amounts from fast-trade WS for PnL computation */
  buySeries: BuySeries | null;
  addBuyToSeries: (tokenAddress: string, usdAmount: number, tokenAmount: number) => void;
  resetBuySeries: () => void;

  balanceRefreshTrigger: number;
  triggerBalanceRefresh: () => void;

  tradingCurrency: OwnedToken | null;
  ownedTokens: OwnedToken[];
  setTradingCurrency: (token: OwnedToken | null) => void;
  setOwnedTokens: (tokens: OwnedToken[]) => void;
  
  slippage: number;
  prequote: boolean;
  customBuyAmounts: number[];
  customSellPercentages: number[];
  
  solanaSwapSettings: SolanaSwapSettings;
  
  isSettingsOpen: boolean;
  isMinimized: boolean;
  isCollapsed: boolean;
  isFloating: boolean;
  windowPosition: { x: number; y: number };
  isDragging: boolean;
  
  setTradingMode: (mode: TradingMode) => void;
  setOrderType: (type: OrderType) => void;
  setBuyAmount: (amount: string) => void;
  setLimitPrice: (price: string) => void;
  setBuyStrategy: (strategy: string) => void;
  setBuyBalance: (balance: string) => void;
  setSellBalance: (balance: string, isEstimated?: boolean) => void;
  
  setSlippage: (value: number) => void;
  setPrequote: (value: boolean) => void;
  setCustomBuyAmounts: (amounts: number[]) => void;
  setCustomSellPercentages: (percentages: number[]) => void;
  setSolanaSwapSettings: (settings: Partial<SolanaSwapSettings>) => void;
  
  setSettingsOpen: (isOpen: boolean) => void;
  setMinimized: (minimized: boolean) => void;
  setCollapsed: (collapsed: boolean) => void;
  setFloating: (floating: boolean) => void;
  setWindowPosition: (position: { x: number; y: number }) => void;
  setIsDragging: (isDragging: boolean) => void;
}

export type { SolanaSwapSettings, PriorityFeePreset, PositionStats, OwnedToken, BuySeries };

const DEFAULT_SOLANA_SWAP_SETTINGS: SolanaSwapSettings = {
  priorityFeePreset: 'auto',
  priorityFeeCustom: 100000,
  jitoEnabled: false,
  jitoTipLamports: 10000,
  computeUnitLimitAuto: true,
  computeUnitLimit: 400000,
  useInstructionsMode: true,
};

export const useTradingPanelStore = create<TradingPanelState>()(
  persist(
    (set) => ({
      tradingMode: 'buy',
      orderType: 'market',
      
      buyAmount: '1',
      limitPrice: '0.001436',
      buyStrategy: 's1',
      buyBalance: '0',
      sellBalance: '0',
      isSellBalanceEstimated: false,
      lastTradeAt: 0,
      positionStats: null,
      buySeries: null,
      balanceRefreshTrigger: 0,
      tradingCurrency: null,
      ownedTokens: [],
      
      slippage: 10,
      prequote: true,
      customBuyAmounts: [1, 10, 50, 100],
      customSellPercentages: [10, 25, 50, 100],
      
      solanaSwapSettings: DEFAULT_SOLANA_SWAP_SETTINGS,
      
      isSettingsOpen: false,
      isMinimized: false,
      isCollapsed: false,
      isFloating: false,
      windowPosition: { x: 50, y: 50 },
      isDragging: false,
      
      setTradingMode: (mode) => set({ tradingMode: mode }),
      setOrderType: (type) => set({ orderType: type }),
      setBuyAmount: (amount) => set({ buyAmount: amount }),
      setLimitPrice: (price) => set({ limitPrice: price }),
      setBuyStrategy: (strategy) => set({ buyStrategy: strategy }),
      setBuyBalance: (balance) => set({ buyBalance: balance }),
      setSellBalance: (balance, isEstimated) => set({ sellBalance: balance, isSellBalanceEstimated: isEstimated ?? false }),
      markTrade: () => set({ lastTradeAt: Date.now() }),
      setPositionStats: (stats) => set({ positionStats: stats }),
      addBuyToSeries: (tokenAddress, usdAmount, tokenAmount) => set((s) => {
        if (s.buySeries && s.buySeries.tokenAddress === tokenAddress) {
          return {
            buySeries: {
              tokenAddress,
              totalUSD: s.buySeries.totalUSD + usdAmount,
              totalTokenAmount: s.buySeries.totalTokenAmount + tokenAmount,
            },
          };
        }
        // New token or first buy — start fresh series
        return {
          buySeries: { tokenAddress, totalUSD: usdAmount, totalTokenAmount: tokenAmount },
        };
      }),
      resetBuySeries: () => set({ buySeries: null }),
      triggerBalanceRefresh: () => set((s) => ({ balanceRefreshTrigger: s.balanceRefreshTrigger + 1 })),
      setTradingCurrency: (token) => set({ tradingCurrency: token }),
      setOwnedTokens: (tokens) => set({ ownedTokens: tokens }),
      
      setSlippage: (value) => set({ slippage: value }),
      setPrequote: (value) => set({ prequote: value }),
      setCustomBuyAmounts: (amounts) => set({ customBuyAmounts: amounts }),
      setCustomSellPercentages: (percentages) => set({ customSellPercentages: percentages }),
      setSolanaSwapSettings: (settings) => set((state) => ({
        solanaSwapSettings: { ...state.solanaSwapSettings, ...settings }
      })),
      
      setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
      setMinimized: (minimized) => set({ isMinimized: minimized }),
      setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
      setFloating: (floating) => set({ isFloating: floating }),
      setWindowPosition: (position) => set({ windowPosition: position }),
      setIsDragging: (isDragging) => set({ isDragging: isDragging }),
    }),
    {
      name: 'mtt-trading-settings',
      partialize: (state) => ({
        slippage: state.slippage,
        prequote: state.prequote,
        customBuyAmounts: state.customBuyAmounts,
        customSellPercentages: state.customSellPercentages,
        solanaSwapSettings: state.solanaSwapSettings,
      }),
    }
  )
);
