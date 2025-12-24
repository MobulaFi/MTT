import { create } from 'zustand';

type TradingMode = 'buy' | 'sell';
type OrderType = 'market' | 'limit' | 'twap';
type PnlCalculation = 'Gross' | 'Net';
type PnlPosition = 'Position' | 'All';

interface TradingPanelState {
  // ===== Trade State =====
  tradingMode: TradingMode;
  orderType: OrderType;
  
  // Trading State
  buyAmount: string;
  limitPrice: string;
  buyStrategy: string;
  buyBalance: string;
  sellBalance: string;
  
  // ===== Settings State =====
  slippage: number;
  prequote: boolean;
  customBuyAmounts: number[];
  customSellPercentages: number[];
  
  // ===== UI State =====
  isSettingsOpen: boolean;
  isMinimized: boolean;
  isCollapsed: boolean;
  isFloating: boolean;
  windowPosition: { x: number; y: number };
  isDragging: boolean;
  
  // ===== Trade Actions =====
  setTradingMode: (mode: TradingMode) => void;
  setOrderType: (type: OrderType) => void;
  setBuyAmount: (amount: string) => void;
  setLimitPrice: (price: string) => void;
  setBuyStrategy: (strategy: string) => void;
  setBuyBalance: (balance: string) => void;
  setSellBalance: (balance: string) => void;
  
  // ===== Settings Actions =====
  setSlippage: (value: number) => void;
  setPrequote: (value: boolean) => void;
  setCustomBuyAmounts: (amounts: number[]) => void;
  setCustomSellPercentages: (percentages: number[]) => void;
  
  // ===== UI Actions =====
  setSettingsOpen: (isOpen: boolean) => void;
  setMinimized: (minimized: boolean) => void;
  setCollapsed: (collapsed: boolean) => void;
  setFloating: (floating: boolean) => void;
  setWindowPosition: (position: { x: number; y: number }) => void;
  setIsDragging: (isDragging: boolean) => void;
}

export const useTradingPanelStore = create<TradingPanelState>((set) => ({
  // ===== Trade State =====
  tradingMode: 'buy',
  orderType: 'market',
  
  // Trading State
  buyAmount: '$20',
  limitPrice: '0.001436',
  buyStrategy: 's1',
  buyBalance: '0',
  sellBalance: '0',
  
  // ===== Settings State =====
  slippage: 1,
  prequote: true,
  customBuyAmounts: [0.01, 0.1, 1, 10],
  customSellPercentages: [10, 25, 50, 100],
  
  // ===== UI State =====
  isSettingsOpen: false,
  isMinimized: false,
  isCollapsed: false,
  isFloating: false,
  windowPosition: { x: 50, y: 50 },
  isDragging: false,
  
  // ===== Trade Actions =====
  setTradingMode: (mode) => set({ tradingMode: mode }),
  setOrderType: (type) => set({ orderType: type }),
  setBuyAmount: (amount) => set({ buyAmount: amount }),
  setLimitPrice: (price) => set({ limitPrice: price }),
  setBuyStrategy: (strategy) => set({ buyStrategy: strategy }),
  setBuyBalance: (balance) => set({ buyBalance: balance }),
  setSellBalance: (balance) => set({ sellBalance: balance }),
  
  // ===== Settings Actions =====
  setSlippage: (value) => set({ slippage: value }),
  setPrequote: (value) => set({ prequote: value }),
  setCustomBuyAmounts: (amounts) => set({ customBuyAmounts: amounts }),
  setCustomSellPercentages: (percentages) => set({ customSellPercentages: percentages }),
  
  // ===== UI Actions =====
  setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
  setMinimized: (minimized) => set({ isMinimized: minimized }),
  setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
  setFloating: (floating) => set({ isFloating: floating }),
  setWindowPosition: (position) => set({ windowPosition: position }),
  setIsDragging: (isDragging) => set({ isDragging: isDragging }),
}));
