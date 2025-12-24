import { formatCryptoPrice } from '@mobula_labs/sdk';

export const PRICE_PLACEHOLDER_THRESHOLD = 1_000_000_000; // 1B
export const LIQUIDITY_PLACEHOLDER_THRESHOLD = 100_000_000_000; // 100B
export const LOW_LIQUIDITY_WARNING_THRESHOLD = 1_000; // $1k

export const shouldMaskPrice = (value?: number | null): boolean =>
  typeof value === 'number' && value > PRICE_PLACEHOLDER_THRESHOLD;

export const shouldMaskLiquidity = (value?: number | null): boolean =>
  typeof value === 'number' && value > LIQUIDITY_PLACEHOLDER_THRESHOLD;

export const formatPriceWithPlaceholder = (value?: number | null, fallback = '--'): string => {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (shouldMaskPrice(value)) {
    return 'N/A';
  }

  return formatCryptoPrice(value);
};

export const formatLiquidityWithPlaceholder = (value?: number | null, fallback = '--'): string => {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (shouldMaskLiquidity(value)) {
    return 'N/A';
  }

  return formatCryptoPrice(value);
};

export const shouldShowLowLiquidityWarning = (value?: number | null): boolean =>
  typeof value === 'number' && value > 0 && value < LOW_LIQUIDITY_WARNING_THRESHOLD;
