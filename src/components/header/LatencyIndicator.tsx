'use client';
import React, { memo, useCallback } from 'react';
import { FiChevronDown } from 'react-icons/fi';

interface LatencyIndicatorProps {
  currentUrl: string;
  latency: string;
  isApiSelectorOpen: boolean;
  toggleSelector: () => void;
  buttonRef: React.RefObject<HTMLButtonElement>;
  getLabelForUrl: (url: string) => string;
  displayLabel?: string | null;
  displayLatency?: string | null;
}

export const LatencyIndicator = memo(
  ({
    currentUrl,
    latency,
    isApiSelectorOpen,
    toggleSelector,
    buttonRef,
    getLabelForUrl,
    displayLabel,
    displayLatency,
  }: LatencyIndicatorProps) => {
    const label = displayLabel ?? getLabelForUrl(currentUrl);
    const latencyValue = displayLatency ?? latency;

    const getLatencyColor = useCallback(() => {
      if (latencyValue === '...' || latencyValue === 'offline' || latencyValue === 'error') {
        return { bg: 'bg-grayGhost/50', text: 'text-red-500' };
      }

      const ms = parseInt(latencyValue, 10);
      if (isNaN(ms)) return { bg: 'bg-grayGhost/50', text: 'text-gray-400' };
      if (ms < 50) return { bg: 'bg-success', text: 'text-success' };
      if (ms < 100) return { bg: 'bg-warning', text: 'text-warning' };
      return { bg: 'bg-error', text: 'text-error' };
    }, [latencyValue]);

    const { bg, text } = getLatencyColor();

    return (
      <button
        ref={buttonRef}
        onClick={toggleSelector}
        className="header-btn px-3 sm:px-4 py-1.5 sm:py-2 h-9 sm:h-10 flex items-center gap-2.5 bg-bgContainer border border-borderDefault rounded-lg hover:bg-bgTertiary hover:border-borderMuted cursor-pointer relative"
      >
        <div className={`w-2 h-2 ${bg} rounded-full animate-blink relative flex-shrink-0`} />

        <div className="flex items-center gap-1.5 text-[12px] sm:text-[13px] font-medium tracking-wide">
          <span
            className={`inline-block max-w-[80px] truncate ${text}`}
            title={label}
            suppressHydrationWarning
          >
            {label}
          </span>
          <span className={`${text} opacity-40`}>/</span>
          <span className={`inline-block w-[48px] text-right font-mono ${text}`}>{latencyValue}</span>
        </div>

        <FiChevronDown
          size={14}
          className={`${text} opacity-50 transition-transform duration-200 ${
            isApiSelectorOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
    );
  },
  (prev, next) =>
    prev.latency === next.latency &&
    prev.isApiSelectorOpen === next.isApiSelectorOpen &&
    prev.displayLabel === next.displayLabel &&
    prev.displayLatency === next.displayLatency
);

LatencyIndicator.displayName = 'LatencyIndicator';
