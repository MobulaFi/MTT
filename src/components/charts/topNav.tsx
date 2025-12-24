import { Popover, PopoverContent, PopoverTrigger } from '@radix-ui/react-popover';
import Image from 'next/image';
import { useState } from 'react';
import { IoChevronDown } from 'react-icons/io5';
import { cn } from '@/lib/utils';
import { useChartStore } from '@/store/useChartStore';

import type {
  IChartingLibraryWidget,
  ResolutionString,
} from '../../../public/static/charting_library/charting_library';
import {
  CHART_TYPES,
  chartTypeOptions,
  timeframes,
  type ChartTypeOption,
} from './constants';

interface IChartTopNav {
  tvWidget: IChartingLibraryWidget | null;
}

export const ChartTopNav = ({ tvWidget }: IChartTopNav) => {
  const { timeframe, setTimeframe } = useChartStore();

  const [activeChartType, setActiveChartType] = useState<ChartTypeOption>({
    value: CHART_TYPES.CANDLES,
    label: 'Candles',
    icon: <Image height={20} width={20} alt="candle chart icon" src="/svg/icon-candles.svg" />,
  });

  return (
    <div className="h-[40px] border-b-[1px] border-borderDefault flex gap-2.5 px-3 items-center bg-bgPrimary">
      {/* Timeframe buttons */}
      {Object.entries(timeframes).map(([key, value], i) => (
        <button
          type="button"
          key={key}
          className={cn(
            'text-xs px-2 py-1 rounded transition-all',
            timeframe === value 
              ? 'text-grayGhost bg-bgPrimary' 
              : 'text-graySlate hover:text-white hover:bg-bgSurfaceAlt/50',
            i <= 3 ? '' : 'hidden md:flex items-center justify-center',
          )}
          onClick={() => {
            setTimeframe(value);
            tvWidget?.activeChart().setResolution(value as ResolutionString);
          }}
        >
          {key}
        </button>
      ))}

      {/* More timeframes dropdown */}
      <Popover>
        <PopoverTrigger className="md:flex hidden">
          <div
            className={cn(
              'rounded px-2 py-1 cursor-pointer text-xs flex items-center gap-1 transition-all',
              timeframe !== '1' && timeframe !== '3' && timeframe !== '5'
                ? 'text-grayGhost bg-bgPrimary'
                : 'text-graySlate hover:text-white hover:bg-bgSurfaceAlt/50'
            )}
          >
            {timeframe !== '1' && timeframe !== '3' && timeframe !== '5'
              ? Object.entries(timeframes)?.find((entry) => entry[1] === timeframe)?.[0]
              : 'More'}
            <IoChevronDown className="text-xs min-w-[14px]" />
          </div>
        </PopoverTrigger>
        <PopoverContent
          sideOffset={10}
          className="flex flex-row flex-wrap p-2 z-[102] bg-bgPrimary gap-2 rounded-md w-[220px] border border-bgSectionAlt shadow-xl"
        >
          {Object.entries(timeframes).map(([key, value], i) => (
            <button
              type="button"
              key={key}
              className={cn(
                'text-xs cursor-pointer px-3 py-1.5 rounded transition-all',
                timeframe === value 
                  ? 'text-white bg-bgSectionAlt' 
                  : 'text-graySlate hover:text-white hover:bg-bgSectionAlt/50',
                i > 3 ? 'flex items-center justify-center' : 'hidden',
              )}
              onClick={() => {
                setTimeframe(value);
                tvWidget?.activeChart().setResolution(value as ResolutionString);
              }}
            >
              {key}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Divider */}
      <div className="h-5 w-[1px] bg-bgSectionAlt mx-1" />

      {/* Indicators button */}
      <button
        className="text-graySlate hover:text-white transition-colors p-1 rounded hover:bg-bgSurfaceAlt"
        onClick={() => {
          tvWidget?.activeChart().executeActionById('insertIndicator');
        }}
        type="button"
        title="Indicators"
      >
        <Image height={18} width={18} alt="indicator icon" src="/svg/icon-indicator.svg" />
      </button>

      {/* Settings button */}
      <button
        className="text-graySlate hover:text-white transition-colors p-1 rounded hover:bg-bgSurfaceAlt"
        onClick={() => {
          tvWidget?.activeChart().executeActionById('chartProperties');
        }}
        type="button"
        title="Settings"
      >
        <Image height={18} width={18} alt="settings icon" src="/svg/icon-settings.svg" />
      </button>

      {/* Chart type selector */}
      <Popover>
        <PopoverTrigger>
          <div className="flex items-center gap-1 cursor-pointer rounded px-2 py-1 text-xs text-graySlate hover:text-white hover:bg-bgPrimary transition-all">
            <Image height={18} width={18} alt="chart type icon" src="/svg/icon-candles.svg" />
            <IoChevronDown className="min-w-[14px] text-xs" />
          </div>
        </PopoverTrigger>

        <PopoverContent
          sideOffset={10}
          className="z-[102] w-[200px] rounded-md border border-bgSectionAlt bg-bgPrimary py-1 shadow-xl"
        >
          {chartTypeOptions.map((entry, i) => {
            const isLast = i === chartTypeOptions.length - 1;
            return (
              <button
                key={i}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2.5 px-4 py-2 text-sm cursor-pointer transition-colors',
                  activeChartType?.value === entry.value 
                    ? 'text-white bg-bgSectionAlt' 
                    : 'text-graySlate hover:text-white hover:bg-bgSectionAlt/50',
                  !isLast && 'border-b border-bgSectionAlt',
                )}
                onClick={() => {
                  setActiveChartType(entry);
                  const mainSeries = tvWidget?.activeChart().getSeries();
                  mainSeries?.setChartStyleProperties(entry?.value, {});
                  tvWidget?.applyOverrides({
                    'mainSeriesProperties.style': entry?.value,
                    'mainSeriesProperties.lineStyle.color': '#4A90E2',
                    'mainSeriesProperties.lineStyle.width': 2,
                  });
                }}
                >
                {entry.icon ? <div>{entry.icon}</div> : null}
                <p>{entry.label}</p>
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
    </div>
  );
};