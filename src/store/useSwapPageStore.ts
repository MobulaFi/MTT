import { create } from 'zustand';
import type { SwapQuotingResponse } from '@mobula_labs/types';

export interface SwapTokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string | null;
  chainId: string;
}

export interface WalletAsset {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo: string | null;
  chainId: string;
  balanceUsd: number;
  tokenBalance: number;
}

type TokenPickerMode = 'tokenIn' | 'tokenOut';

interface SwapPageState {
  tokenIn: SwapTokenInfo | null;
  tokenOut: SwapTokenInfo | null;
  amountIn: string;
  amountOut: string;
  chainId: string;
  slippage: number;

  tokenInPriceUSD: number | null;
  tokenOutPriceUSD: number | null;

  quote: SwapQuotingResponse | null;
  isQuoteLoading: boolean;
  quoteError: string | null;

  isSwapping: boolean;

  walletAssets: WalletAsset[];
  isWalletPortfolioLoading: boolean;

  isTokenPickerOpen: boolean;
  tokenPickerMode: TokenPickerMode | null;
  isSettingsOpen: boolean;

  setWalletAssets: (assets: WalletAsset[]) => void;
  setWalletPortfolioLoading: (loading: boolean) => void;
  setTokenIn: (token: SwapTokenInfo | null) => void;
  setTokenOut: (token: SwapTokenInfo | null) => void;
  setAmountIn: (amount: string) => void;
  setAmountOut: (amount: string) => void;
  setChainId: (chainId: string) => void;
  setSlippage: (slippage: number) => void;

  setTokenInPriceUSD: (price: number | null) => void;
  setTokenOutPriceUSD: (price: number | null) => void;

  setQuote: (quote: SwapQuotingResponse | null) => void;
  setQuoteLoading: (loading: boolean) => void;
  setQuoteError: (error: string | null) => void;
  setSwapping: (swapping: boolean) => void;

  swapTokens: () => void;
  openTokenPicker: (mode: TokenPickerMode) => void;
  closeTokenPicker: () => void;
  setSettingsOpen: (open: boolean) => void;
  reset: () => void;
}

const DEFAULT_SOL: SwapTokenInfo = {
  address: 'So11111111111111111111111111111111111111111',
  symbol: 'SOL',
  name: 'Solana',
  decimals: 9,
  logo: 'https://assets.coingecko.com/coins/images/4128/standard/solana.png',
  chainId: 'solana:solana',
};

const DEFAULT_USDC: SwapTokenInfo = {
  address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  logo: 'https://assets.coingecko.com/coins/images/6319/standard/usdc.png',
  chainId: 'solana:solana',
};

export const useSwapPageStore = create<SwapPageState>((set) => ({
  tokenIn: DEFAULT_SOL,
  tokenOut: DEFAULT_USDC,
  amountIn: '',
  amountOut: '',
  chainId: 'solana:solana',
  slippage: 10,

  tokenInPriceUSD: null,
  tokenOutPriceUSD: null,

  quote: null,
  isQuoteLoading: false,
  quoteError: null,
  isSwapping: false,

  walletAssets: [],
  isWalletPortfolioLoading: false,

  isTokenPickerOpen: false,
  tokenPickerMode: null,
  isSettingsOpen: false,

  setWalletAssets: (assets) => set({ walletAssets: assets }),
  setWalletPortfolioLoading: (loading) => set({ isWalletPortfolioLoading: loading }),
  setTokenIn: (token) => set({ tokenIn: token, tokenInPriceUSD: null }),
  setTokenOut: (token) => set({ tokenOut: token, tokenOutPriceUSD: null }),
  setAmountIn: (amount) => set({ amountIn: amount }),
  setAmountOut: (amount) => set({ amountOut: amount }),
  setChainId: (chainId) => set({ chainId }),
  setSlippage: (slippage) => set({ slippage }),

  setTokenInPriceUSD: (price) => set({ tokenInPriceUSD: price }),
  setTokenOutPriceUSD: (price) => set({ tokenOutPriceUSD: price }),

  setQuote: (quote) => set({ quote, quoteError: null }),
  setQuoteLoading: (loading) => set({ isQuoteLoading: loading }),
  setQuoteError: (error) => set({ quoteError: error, isQuoteLoading: false }),
  setSwapping: (swapping) => set({ isSwapping: swapping }),

  swapTokens: () =>
    set((state) => ({
      tokenIn: state.tokenOut,
      tokenOut: state.tokenIn,
      tokenInPriceUSD: state.tokenOutPriceUSD,
      tokenOutPriceUSD: state.tokenInPriceUSD,
      amountIn: '',
      amountOut: '',
      quote: null,
      quoteError: null,
    })),

  openTokenPicker: (mode) => set({ isTokenPickerOpen: true, tokenPickerMode: mode }),
  closeTokenPicker: () => set({ isTokenPickerOpen: false, tokenPickerMode: null }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),

  reset: () =>
    set({
      tokenIn: DEFAULT_SOL,
      tokenOut: DEFAULT_USDC,
      amountIn: '',
      amountOut: '',
      chainId: 'solana:solana',
      slippage: 10,
      tokenInPriceUSD: null,
      tokenOutPriceUSD: null,
      quote: null,
      isQuoteLoading: false,
      quoteError: null,
      isSwapping: false,
      walletAssets: [],
      isWalletPortfolioLoading: false,
      isTokenPickerOpen: false,
      tokenPickerMode: null,
      isSettingsOpen: false,
    }),
}));
