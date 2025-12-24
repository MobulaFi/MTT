'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, AlertCircle, Loader2, ArrowDown, ChevronDown, Info } from 'lucide-react';
import { useSwapQuoteStore } from '@/store/useSwapQuoteStore';
import { useTradingPanelStore } from '@/store/useTradingPanelStore';
import { useTradingDataStore } from '@/store/useTradingDataStore';
import { formatPureNumber, formatCryptoPrice } from '@mobula_labs/sdk';
import SafeImage from '@/components/SafeImage';
import { toast } from 'sonner';
import { useSwapTransaction } from '@/hooks/trading/useSwapTransaction';
import type { SwapQuoteResponse } from '@/types/swap';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TokenDisplayData {
  symbol: string;
  logo?: string;
}

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  valueIcon?: React.ReactNode;
  showInfo?: boolean;
  tooltipText?: string;
  highlight?: 'success' | 'warning' | 'error' | null;
}

export function SwapQuoteModal() {
  const { quote, isLoading, error, isModalOpen, closeModal, setLoading, setError } = useSwapQuoteStore();
  const { buyAmount } = useTradingPanelStore();
  const { baseToken } = useTradingDataStore();
  const [showMore, setShowMore] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
  const { signAndSendTransaction: executeTransaction } = useSwapTransaction({
    onSuccess: () => {
      closeModal();
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  // Memoized computed values for better performance - MUST be before any conditional returns
  const tokenIn = useMemo(() => quote?.data?.tokenIn, [quote]);
  const tokenOut = useMemo(() => quote?.data?.tokenOut, [quote]);

  const computedData = useMemo(() => {
    const amountIn = parseFloat(buyAmount.replace('$', '').replace('%', '') || '0');
    const data = quote?.data;
    
    // @ts-expect-error - Dynamic properties may not exist on all quote types
    const amountOut = data ? (data.amountOutTokens || data.estimatedAmountOut) : null;
    // @ts-expect-error - Dynamic properties may not exist on all quote types
    const slippage = data ? (data.slippagePercentage ?? data.estimatedSlippage) : null;
    // @ts-expect-error - Dynamic properties may not exist on all quote types
    const marketImpact = data ? (data.marketImpactPercentage ?? data.estimatedMarketImpact) : null;
    // @ts-expect-error - Dynamic properties may not exist on all quote types
    const totalFee = data ? (data.details?.route?.totalFeePercentage ?? data.poolFees) : null;
    // @ts-expect-error - Dynamic properties may not exist on all quote types
    const networkCost = data ? (data.networkCost ?? data.estimatedGas) : null;
    // @ts-expect-error - Dynamic properties may not exist on all quote types
    const aggregator = data?.debug?.aggregator;
    
    // Calculate rate
    const rate = amountIn > 0 && amountOut ? (parseFloat(amountOut) / amountIn) : null;
    const rateUSD = rate && data?.amountOutUSD ? (data.amountOutUSD / amountIn) : null;

    return {
      amountIn,
      amountOut,
      slippage,
      marketImpact,
      totalFee,
      networkCost,
      aggregator,
      rate,
      rateUSD,
    };
  }, [quote, buyAmount]);

  const handleSignAndSend = useCallback(async () => {
    if (!quote || !baseToken) {
      toast.error('No quote available');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const chainId = baseToken.blockchain;
      await executeTransaction(quote as SwapQuoteResponse, chainId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute swap';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [quote, baseToken, executeTransaction, setError, setLoading]);

  const toggleShowMore = useCallback(() => setShowMore(prev => !prev), []);

  // Animation management
  useEffect(() => {
    if (isModalOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isModalOpen]);

  // Keyboard handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeModal();
      }
    };
    
    if (isModalOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen, closeModal]);

  // Conditional return MUST come after all hooks
  if (!isModalOpen && !isVisible) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={`fixed inset-0 z-[10000] flex items-center justify-center bg-bgBackdrop backdrop-blur-sm px-2 sm:px-4 transition-all duration-200 ${
          isModalOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="swap-modal-title"
      >
      <div
        className={`flex w-full max-w-[420px] flex-col rounded-xl sm:rounded-2xl bg-bgPrimary shadow-2xl border border-borderDefault overflow-hidden transform transition-all duration-200 ${
          isModalOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-borderDefault bg-bgOverlay">
          <h2 id="swap-modal-title" className="text-xs sm:text-sm font-medium text-textSecondary">
            You&apos;re swapping
          </h2>
          <button
            onClick={closeModal}
            className="rounded-lg p-1 sm:p-1.5 text-textTertiary hover:text-textPrimary hover:bg-bgTertiary transition-all duration-150"
            aria-label="Close modal"
            type="button"
          >
            <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-3 sm:px-4 py-3 sm:py-4">
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error} />
          ) : quote && tokenIn && tokenOut ? (
            <>
              {/* Token In */}
              <TokenDisplayRow
                amount={computedData.amountIn}
                symbol={tokenIn.symbol || ''}
                logo={tokenIn.logo ?? undefined}
                usdValue={quote.data?.amountInUSD}
              />

              {/* Arrow Divider */}
              <div className="flex items-center justify-center py-2">
                <div className="rounded-full bg-bgTertiary p-1.5 border border-borderDefault">
                  <ArrowDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-textTertiary" />
                </div>
              </div>

              {/* Token Out */}
              <TokenDisplayRow
                amount={computedData.amountOut ? parseFloat(computedData.amountOut) : null}
                symbol={tokenOut.symbol || ''}
                logo={tokenOut.logo ?? undefined}
                usdValue={quote.data?.amountOutUSD}
              />

              {/* Divider with Show More/Less */}
              <div className="flex items-center gap-2 sm:gap-3 my-3 sm:my-4">
                <div className="flex-1 h-px bg-borderDefault" />
                <button
                  onClick={toggleShowMore}
                  className="flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md text-[10px] sm:text-xs font-medium text-textTertiary hover:text-textPrimary hover:bg-bgTertiary transition-all duration-150"
                  type="button"
                  aria-expanded={showMore}
                >
                  Show {showMore ? 'less' : 'more'}
                  <ChevronDown className={`w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform duration-200 ${showMore ? 'rotate-180' : ''}`} />
                </button>
                <div className="flex-1 h-px bg-borderDefault" />
              </div>

              {/* Details Section */}
              <div className="space-y-2 sm:space-y-2.5 bg-bgOverlay rounded-lg sm:rounded-xl p-2.5 sm:p-3 border border-borderDefault">
                {/* Fee - Always visible */}
                {computedData.totalFee !== undefined && computedData.totalFee !== null && (
                  <DetailRow
                    label={`Fee (${computedData.totalFee.toFixed(2)}%)`}
                    value={
                      // @ts-expect-error - feeUSD may not exist on all quote types
                      quote.data?.feeUSD ? `${formatCryptoPrice(quote.data.feeUSD)}` : '<$0.01'
                    }
                    showInfo
                    tooltipText="Protocol + LP fees"
                  />
                )}

                {/* Network cost - Always visible */}
                <DetailRow
                  label="Network cost"
                  value={computedData.networkCost !== undefined && computedData.networkCost !== null ? `$${formatCryptoPrice(computedData.networkCost)}` : '$0.01'}
                  showInfo
                  tooltipText="Gas fee to execute transaction"
                />

                {/* Expanded Details with smooth animation */}
                <div 
                  className={`space-y-2 sm:space-y-2.5 overflow-hidden transition-all duration-300 ease-in-out ${
                    showMore ? 'max-h-96 opacity-100 mt-2 sm:mt-2.5' : 'max-h-0 opacity-0 mt-0'
                  }`}
                >
                  {/* Rate */}
                  {computedData.rate && (
                    <DetailRow
                      label="Rate"
                      value={
                        <span className="text-right">
                          <span className="text-textPrimary block text-xs sm:text-sm">
                            1 {tokenIn.symbol} = {formatPureNumber(computedData.rate)} {tokenOut.symbol}
                          </span>
                          {computedData.rateUSD && (
                            <span className="text-textTertiary text-[10px] sm:text-xs">{formatCryptoPrice(computedData.rateUSD)}</span>
                          )}
                        </span>
                      }
                    />
                  )}

                  {/* Max Slippage */}
                  {computedData.slippage !== undefined && computedData.slippage !== null && (
                    <DetailRow
                      label="Max slippage"
                      value={
                        <span className="flex items-center gap-1.5">
                          <span className="text-textTertiary text-[9px] sm:text-xs px-1.5 py-0.5 bg-bgTertiary rounded border border-borderDefault">
                            Auto
                          </span>
                          <span className="text-xs sm:text-sm">{computedData.slippage.toFixed(2)}%</span>
                        </span>
                      }
                      showInfo
                      tooltipText="Max acceptable price change"
                    />
                  )}

                  {/* Order Routing / Aggregator */}
                  {computedData.aggregator && (
                    <DetailRow
                      label="Order routing"
                      value={
                        <span className="capitalize px-1.5 py-0.5 bg-bgTertiary rounded text-[9px] sm:text-xs border border-borderDefault">
                          {computedData.aggregator} API
                        </span>
                      }
                      showInfo
                      tooltipText="Best route finder across DEXs"
                    />
                  )}

                  {/* Price Impact */}
                  {computedData.marketImpact !== undefined && computedData.marketImpact !== null && (
                    <DetailRow
                      label="Price impact"
                      value={`${computedData.marketImpact > 0 ? '-' : ''}${Math.abs(computedData.marketImpact).toFixed(2)}%`}
                      highlight={
                        computedData.marketImpact > 1 
                          ? 'error' 
                          : computedData.marketImpact > 0.5 
                          ? 'warning' 
                          : null
                      }
                      showInfo
                      tooltipText="Your trade's effect on price"
                    />
                  )}
                </div>
              </div>

              {/* Error Message */}
              {quote.error && (
                <div className="bg-error/10 border border-error/30 rounded-lg sm:rounded-xl p-2.5 sm:p-3 mt-3 sm:mt-4 animate-in fade-in duration-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-error flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] sm:text-xs text-error leading-relaxed">{quote.error}</p>
                  </div>
                </div>
              )}

              {/* Swap Button */}
              <button
                onClick={handleSignAndSend}
                disabled={!!quote.error || isLoading}
                className={`w-full mt-3 sm:mt-4 py-3 sm:py-3.5 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${
                  quote.error || isLoading
                    ? 'bg-bgSecondary text-textTertiary cursor-not-allowed opacity-50'
                    : 'bg-success hover:bg-success/90 text-white hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]'
                }`}
                type="button"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                    <span className="text-sm sm:text-base">Signing transaction...</span>
                  </>
                ) : (
                  'Swap'
                )}
              </button>
            </>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}


function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12 gap-3 sm:gap-4">
      <div className="relative">
        <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 animate-spin text-success" />
        <div className="absolute inset-0 h-10 w-10 sm:h-12 sm:w-12 animate-ping rounded-full bg-success/20" />
      </div>
      <p className="text-xs sm:text-sm font-medium text-textTertiary px-4 text-center">Fetching best swap route...</p>
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="bg-error/10 border border-error/30 rounded-lg sm:rounded-xl p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="flex items-start gap-2 sm:gap-3">
        <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-error flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs sm:text-sm font-semibold text-error mb-1 sm:mb-2">Error</p>
          <p className="text-[10px] sm:text-xs text-error/80 leading-relaxed">{error}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8 sm:py-10 px-4">
      <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-bgTertiary flex items-center justify-center mb-3 sm:mb-4">
        <AlertCircle className="h-6 w-6 sm:h-7 sm:w-7 text-textTertiary" />
      </div>
      <p className="text-xs sm:text-sm font-medium text-textSecondary">No quote data available</p>
      <p className="text-[10px] sm:text-xs text-textTertiary mt-1">Please try again</p>
    </div>
  );
}

function TokenDisplayRow({
  amount,
  symbol,
  logo,
  usdValue,
}: {
  amount: number | null;
  symbol: string;
  logo?: string;
  usdValue?: number;
}) {
  return (
    <div className="flex items-center justify-between py-1 sm:py-1.5">
      <div className="flex flex-col gap-0.5 sm:gap-1 flex-1 min-w-0">
        <p className="text-base sm:text-lg font-bold text-textPrimary truncate">
          {amount !== null ? formatPureNumber(amount) : '-'} {symbol}
        </p>
        {usdValue !== undefined && (
          <p className="text-xs sm:text-sm text-textTertiary">
            {formatCryptoPrice(usdValue)}
          </p>
        )}
      </div>
      {logo && (
        <div className="relative w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 rounded-full overflow-hidden ring-1 sm:ring-2 ring-borderDefault ml-2">
          <SafeImage
            src={logo}
            alt={symbol}
            fill
            className="object-cover"
          />
        </div>
      )}
    </div>
  );
}

function DetailRow({ 
  label, 
  value, 
  valueIcon,
  showInfo,
  tooltipText,
  highlight,
}: DetailRowProps) {
  const getHighlightColor = () => {
    switch (highlight) {
      case 'success':
        return 'text-success';
      case 'warning':
        return 'text-warning';
      case 'error':
        return 'text-error';
      default:
        return 'text-textPrimary';
    }
  };

  return (
    <div className="flex items-center justify-between text-xs sm:text-sm group gap-2">
      <div className="flex items-center gap-1 sm:gap-1.5 text-textTertiary min-w-0">
        <span className="font-medium text-[10px] sm:text-xs truncate">{label}</span>
        {showInfo && tooltipText && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                type="button" 
                className="outline-none flex-shrink-0"
                aria-label={`Information about ${label}`}
              >
                <Info className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-textTertiary/40 hover:text-textSecondary transition-colors cursor-help" />
              </button>
            </TooltipTrigger>
            <TooltipContent 
              side="top" 
              sideOffset={6}
              className="max-w-[140px] sm:max-w-[160px] px-2 py-1 text-center bg-bgOverlay border border-borderDefault shadow-xl"
            >
              <span className="text-[9px] sm:text-[10px] text-textSecondary font-medium leading-tight">
                {tooltipText}
              </span>
            </TooltipContent>
          </Tooltip>
        )}
        {showInfo && !tooltipText && (
          <Info className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-textTertiary/50 group-hover:text-textTertiary/80 transition-colors flex-shrink-0" />
        )}
      </div>
      <div className={`flex items-center font-medium text-xs sm:text-sm ${getHighlightColor()} flex-shrink-0`}>
        {valueIcon}
        {typeof value === 'string' ? <span className="text-right">{value}</span> : value}
      </div>
    </div>
  );
}