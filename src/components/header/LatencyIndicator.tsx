'use client';
import React, { memo, useCallback } from 'react';
import { FiChevronDown } from 'react-icons/fi';

export const LatencyIndicator = memo(
  ({
    currentUrl,
    latency,
    isApiSelectorOpen,
    toggleSelector,
    buttonRef,
    getLabelForUrl,
  }: {
    currentUrl: string;
    latency: string;
    isApiSelectorOpen: boolean;
    toggleSelector: () => void;
    buttonRef: React.RefObject<HTMLButtonElement>;
    getLabelForUrl: (url: string) => string;
  }) => {
    const getLatencyColor = useCallback(() => {
      if (latency === '...' || latency === 'offline' || latency === 'error') {
        return { bg: 'bg-grayGhost/50', text: 'text-red-500' };
      }

      const ms = parseInt(latency);
      if (isNaN(ms)) return { bg: 'bg-grayGhost/50', text: 'text-gray-400' };
      if (ms < 50) return { bg: 'bg-success', text: 'text-success' };
      if (ms < 100) return { bg: 'bg-warning', text: 'text-warning' };
      return { bg: 'bg-error', text: 'text-error' };
    }, [latency]);

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
            className={`inline-block max-w-[30px] truncate ${text}`}
            title={getLabelForUrl(currentUrl)}
          >
            {getLabelForUrl(currentUrl)}
          </span>
          <span className={`${text}`}>:</span>
          <span className={`inline-block w-[45px] text-right ${text}`}>{latency}</span>
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
    prev.latency === next.latency && prev.isApiSelectorOpen === next.isApiSelectorOpen
);

LatencyIndicator.displayName = 'LatencyIndicator';
