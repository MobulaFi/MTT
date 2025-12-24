import Image from "next/image";
import { formatPriceByDisplay, FormattedPrice } from "@/utils/Formatter";
import { usePriceDisplayStore } from "@/store/useDisplayPriceStore";

interface PriceDisplayProps {
  usdAmount?: number | string;
  align?: 'left' | 'right' | 'center';
  showSymbol?: boolean;
  compact?: boolean;
}

/**
 * Centralized component to render prices with currency conversion
 * Handles logo, amount, and symbol alignment consistently
 */
export function PriceDisplay({
  usdAmount,
  align = 'left',
  showSymbol = false,
  compact = false,
}: PriceDisplayProps) {
  const { displayCurrency, quoteCurrencySymbol, quotePriceUSD, quoteLogo } = usePriceDisplayStore();

  const parsedAmount = typeof usdAmount === 'string' ? parseFloat(usdAmount) : usdAmount;

  const formatted = formatPriceByDisplay(parsedAmount, {
    displayCurrency,
    quoteCurrencySymbol,
    quotePriceUSD,
    quoteLogo,
  });

  const alignClass =
    align === 'right' ? 'justify-end' :
    align === 'center' ? 'justify-center' :
    'justify-start';

  return (
    <div className={`flex items-center gap-1 ${alignClass}`}>
      {/* Logo - only show in QUOTE mode */}
      {formatted.logo && formatted.currency === 'QUOTE' && (
        <div className={`relative flex-shrink-0 ${compact ? 'w-3 h-3' : 'w-4 h-4'}`}>
          <Image
            src={formatted.logo}
            alt={formatted.symbol}
            fill
            sizes={compact ? '12px' : '16px'}
            className="rounded-full object-contain"
          />
        </div>
      )}

      {/* Amount - always show */}
      <span className={compact ? 'text-[10px]' : 'text-xs'}>
        {formatted.value}
      </span>

      {/* Symbol - only show in QUOTE mode */}
      {formatted.currency === 'QUOTE' && showSymbol && (
        <span className={`flex-shrink-0 ${compact ? 'text-[8px]' : 'text-[10px]'} text-grayGhost`}>
          {formatted.symbol}
        </span>
      )}
    </div>
  );
}