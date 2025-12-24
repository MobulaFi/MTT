import { formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { formatCryptoPrice, formatPureNumber, formatUSD } from '@mobula_labs/sdk';
import { usePriceDisplayStore } from '@/store/useDisplayPriceStore';


export interface GetTokenAgeOptions {
  /** Fallback value for invalid or unparseable dates (default: 'N/A') */
  fallback?: string;
  /** Locale for formatting (default: 'en-US') */
  locale?: string;
}

export function getTokenAge(
  date: string | Date | null | undefined,
  options: GetTokenAgeOptions = {},
): string {
  const { fallback = 'N/A', locale = 'en-US' } = options;

  // Handle null or undefined
  if (date === null || date === undefined) {
    return fallback;
  }

  // Parse input date
  let parsedDate: Date;
  if (typeof date === 'string') {
    // Handle empty or whitespace-only strings
    if (date.trim() === '') {
      return fallback;
    }
    try {
      parsedDate = parseISO(date);
    } catch {
      return fallback;
    }
  } else {
    parsedDate = date;
  }

  // Validate parsed date
  if (!isValid(parsedDate)) {
    return fallback;
  }

  // Calculate distance with date-fns
  const distance = formatDistanceToNow(parsedDate, {
    addSuffix: true,
  });

  // Shorten the output (e.g., "3 days ago" → "3d ago")
  return distance
    .replace(' minutes', 'min')
    .replace(' minute', 'min')
    .replace(' hours', 'h')
    .replace(' hour', 'h')
    .replace(' days', 'd')
    .replace(' day', 'd')
    .replace(' months', 'mo')
    .replace(' month', 'mo')
    .replace(' years', 'y')
    .replace(' year', 'y')
    .replace('less than a minute ago', '<1min ago')
    .replace('less than a minute from now', '<1min from now');
}


export interface FormattedPrice {
  value: string;
  currency: 'USD' | 'QUOTE';
  logo?: string;
  symbol: string;
}

export const formatPriceByDisplay = (
  usdAmount?: number,
  options?: {
    displayCurrency?: 'USD' | 'QUOTE';
    quoteCurrencySymbol?: string;
    quotePriceUSD?: number;
    quoteLogo?: string;
  }
): FormattedPrice => {
  if (!usdAmount) return { value: '--', currency: 'USD', symbol: 'USD' };

  const {
    displayCurrency = 'QUOTE',
    quoteCurrencySymbol = 'SOL',
    quotePriceUSD = 1,
    quoteLogo = undefined,
  } = options || {};

  if (displayCurrency === 'USD') {
    return {
      value: formatUSD(usdAmount),
      currency: 'USD',
      symbol: 'USD',
      logo: undefined,
    };
  } else {
    // Convert USD to quote currency
    const quoteAmount = usdAmount / quotePriceUSD;
    return {
      value: formatPureNumber(quoteAmount),
      currency: 'QUOTE',
      symbol: quoteCurrencySymbol,
      logo: quoteLogo,
    };
  }
};

export const usePriceFormatter = () => {
  const { displayCurrency, quoteCurrencySymbol, quotePriceUSD, quoteLogo } = usePriceDisplayStore();

  const formatPrice = (usdAmount?: number): FormattedPrice => {
    if (!usdAmount) return { value: '--', currency: 'USD', symbol: 'USD' };

    if (displayCurrency === 'USD') {
      return {
        value: formatUSD(usdAmount),
        currency: 'USD',
        symbol: 'USD',
        logo: undefined,
      };
    } else {
      const quoteAmount = usdAmount / quotePriceUSD;
      return {
        value: formatCryptoPrice(quoteAmount),
        currency: 'QUOTE',
        symbol: quoteCurrencySymbol,
        logo: quoteLogo,
      };
    }
  };

  return {
    formatPrice,
    displayCurrency,
    quoteCurrencySymbol,
    quoteLogo,
  };
};