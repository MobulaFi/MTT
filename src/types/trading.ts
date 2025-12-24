export type TradingMode = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';

export interface TradingWindowProps {
  className?: string;
  initialPosition?: { x: number; y: number };
}

export interface Market {
  exchange: string;
  chainId: string;
  poolAddress: string;
  exchangeLogo?: string;
  pair: string;
  baseSymbol?: string;
  baseAddress?: string;
  quoteSymbol?: string;
  quoteAddress?: string;
  price: number;
  priceChange24hPercentage?: number;
  volume24hUSD: number;
  basePriceUSD?: number;
  quotePriceUSD?: number;
  reserve0?: number;
  reserve1?: number;
  totalFeesPaidUSD?: number;
}
