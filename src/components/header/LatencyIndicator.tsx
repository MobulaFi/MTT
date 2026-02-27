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
        className="px-2 py-1 h-7 flex items-center gap-2 bg-bgContainer border border-borderDefault rounded hover:bg-bgContainer/50 transition-colors cursor-pointer relative"
      >
        <div className={`w-4 h-4 ${bg} bg-opacity-30 animate-blink rounded-full relative`}>
          <div
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 ${bg} rounded-full animate-blink`}
          />
        </div>

        <div className="flex items-center gap-1 text-[12px] font-medium leading-[18px]">
          <span
            className={`inline-block max-w-[80px] truncate ${text}`}
            title={label}
          >
            {label}
          </span>
          <span className={`${text}`}>:</span>
          <span className={`inline-block w-[45px] text-right ${text}`}>{latencyValue}</span>
        </div>

        <FiChevronDown
          size={14}
          className={`${text} transition-transform duration-200 ${
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
