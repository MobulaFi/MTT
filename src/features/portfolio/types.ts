export interface AnalysisStat {
  totalValue: number;
  periodTotalPnlUSD: number;
  periodRealizedPnlUSD: number;
  periodRealizedRate: number;
  periodActiveTokensCount: number;
  periodWinCount: number;
  holdingTokensCount: number;
  holdingDuration: number;
  tradingTimeFrames: number;
  winRealizedPnl: number;
  winRealizedPnlRate: number;
  nativeBalance?: {
    rawBalance: string;
    formattedBalance: string;
    chainId: string;
    price: number;
    balanceUSD: number;
  };
  fundingInfo: {
    from: string | null;
    date: string | null;
    amount: string | null;
    currency?: { name: string; symbol: string; logo: string; decimals: number; address: string };
  };
}

export interface AnalysisData {
  winRateDistribution: Record<string, number>;
  marketCapDistribution: Record<string, number>;
  periodTimeframes: Array<{ date: string; realized: number }>;
  calendarBreakdown: Array<{
    date: string;
    volumeBuy: number;
    volumeSell: number;
    totalVolume: number;
    buys: number;
    sells: number;
    realizedPnlUSD: number;
  }>;
  stat: AnalysisStat;
  labels: string[];
  walletMetadata?: Record<string, unknown> | null;
  platform?: { id: string; name: string; logo: string } | null;
}

export interface PortfolioAsset {
  assetId: number | null;
  name: string;
  symbol: string;
  logo: string | null;
  priceUSD: number;
  priceChange24h: number;
  liquidity: number;
  marketCapUSD: number;
  balanceUSD: number;
  balanceToken: number;
  allocationPercentage: number;
  holdings: Array<{
    chainId: string;
    address: string;
    balance: number;
    rawBalance: string;
    decimals: number;
  }>;
}

export interface PositionEntry {
  token: {
    address: string;
    chainId: string;
    name: string;
    symbol: string;
    logo: string | null;
    decimals: number;
  };
  balance: number;
  rawBalance: string;
  priceUSD: number;
  amountUSD: number;
  lastActivity: string;
  entryPrice: number;
  unrealizedPnlUSD: number;
  realizedPnlUSD: number;
  volumeBuy: number;
  volumeSell: number;
  avgBuyPriceUSD: number;
  avgSellPriceUSD: number;
  totalPnlUSD: number;
  marketCapUSD?: number;
  liquidity?: number;
}

export interface ActivityAction {
  model: 'swap' | 'transfer';
  swapType?: string;
  swapAmountIn?: number;
  swapAmountOut?: number;
  swapAmountUsd?: number;
  swapPriceUsdTokenIn?: number;
  swapPriceUsdTokenOut?: number;
  swapAssetIn?: { name: string; symbol: string; logo: string | null; address: string; chainId: string };
  swapAssetOut?: { name: string; symbol: string; logo: string | null; address: string; chainId: string };
  swapPlatform?: { id: string; name: string; logo: string } | null;
  transferAmount?: number;
  transferAmountUsd?: number;
  transferType?: string;
  transferAsset?: { name: string; symbol: string; logo: string | null; address: string; chainId: string };
}

export interface ActivityEntry {
  chainId: string;
  txDateMs: number;
  txDateIso: string;
  txHash: string;
  txFeesNativeUsd: number;
  actions: ActivityAction[];
}
