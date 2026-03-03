// Prediction Markets Types

export interface PMOutcome {
  id: string;
  platformOutcomeId: string;
  label: string;
  price: number;
  priceUSD: number;
  liquidity?: string | number;
  openInterest?: string | number;
  holders?: string | number;
}

export interface PMStats {
  totalVolume: number;
  volume24h: number;
  volume7d: number;
  totalLiquidity: number;
  totalOpenInterest?: string | number;
  totalHolders?: string | number;
  tradesCount: number;
  trades24h: number;
}

export interface PMMetadata {
  createdAt: string;
  resolvedAt?: string;
  resolutionDate: string;
  status: 'active' | 'closed' | 'resolved';
  resolved: boolean;
  resolvedOutcome?: string;
  creator?: string | null;
  resolver?: string | null;
  rewardPool?: number | null;
  platformFee?: number | null;
  image?: string | null;
  url?: string | null;
  chainId?: string;
}

export interface PMMarket {
  id?: string;
  platform: string;
  marketId: string;
  platformMarketId?: string;
  slug: string;
  chainId?: string;
  contractAddress?: string;
  question: string;
  description?: string;
  category: string;
  tags?: string[];
  type?: 'binary' | 'categorical' | 'scalar';
  status: 'active' | 'closed' | 'resolved';
  outcomes?: PMOutcome[];
  stats?: PMStats;
  metadata?: PMMetadata;
  image?: string;
  // For list views
  volume24h?: number;
  volumeTotal?: number;
  liquidity?: number;
  endDate?: string;
  createdAt?: string;
  // Enriched from API
  tradesCount?: number;
  // For trending
  trendingScore?: number;
  volumeChange24h?: number;
  rank?: number;
}

export interface PMCategory {
  id: string;
  name: string;
  marketsCount: number;
  activeMarkets: number;
  volume24h: number;
  volumeTotal: number;
}

export interface PMTrade {
  tradeId: string;
  txHash: string;
  outcomeId: string;
  outcomeLabel: string;
  side: 'buy' | 'sell';
  price: number;
  size: number;
  amountUSD: number;
  maker?: string;
  taker?: string;
  timestamp: string;
}

export interface PMSearchParams {
  query?: string;
  platform?: string;
  category?: string;
  status?: 'active' | 'closed' | 'resolved';
  sortBy?: 'volume' | 'liquidity' | 'created' | 'trending' | 'total_volume';
  limit?: number;
  offset?: number;
}

export interface PMSearchResponse {
  data: PMMarket[];
  totalCount: number;
  hasMore: boolean;
}

export interface PMTrendingResponse {
  data: PMMarket[];
}

export interface PMCategoriesResponse {
  data: PMCategory[];
  hostname?: string;
}
