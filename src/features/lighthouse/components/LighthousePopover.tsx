'use client';

import { useMemo } from 'react';
import { FiX } from 'react-icons/fi';
import { ArrowUpDown } from 'lucide-react';
import { formatPercentage } from '@mobula_labs/sdk';
import SafeImage from '@/components/SafeImage';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCompactNumber } from '@/utils/tokenMetrics';
import { useLighthouseData } from '../hooks/useLighthouseData';
import {
  useLighthouseStore,
  type Timeframe,
  type ActiveTab,
  type SortField,
} from '../store/useLighthouseStore';

interface LighthousePopoverProps {
  isOpen: boolean;
  onClose: () => void;
}

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: '15min', label: '15m' },
  { key: '1h', label: '1H' },
  { key: '6h', label: '6H' },
  { key: '24h', label: '24H' },
];

const TABS: { key: ActiveTab; label: string }[] = [
  { key: 'byChain', label: 'Chains' },
  { key: 'byDex', label: 'DEXes' },
  { key: 'byLaunchpad', label: 'Launchpads' },
  { key: 'byPlatform', label: 'Platforms' },
];

const COLUMNS: { key: SortField; label: string }[] = [
  { key: 'volumeUSD', label: 'Volume' },
  { key: 'trades', label: 'Trades' },
  { key: 'buys', label: 'Buys' },
  { key: 'sells', label: 'Sells' },
  { key: 'feesPaidUSD', label: 'Fees' },
];

function ChangeText({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-grayDark">--</span>;
  const color = value === 0 ? 'text-grayDark' : value > 0 ? 'text-success' : 'text-red-500';
  return <span className={`${color} text-[10px]`}>{formatPercentage(value)}</span>;
}

function MetricCard({
  label,
  value,
  change,
  isUSD,
}: {
  label: string;
  value: number;
  change: number | null;
  isUSD: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-1.5">
      <span className="text-grayNeutral font-menlo text-[10px] font-bold uppercase">{label}</span>
      <span className="text-textPrimary font-menlo text-xs font-bold">
        {isUSD ? formatCompactNumber(value) : value.toLocaleString()}
      </span>
      <ChangeText value={change} />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-1 p-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full rounded" />
      ))}
    </div>
  );
}

export function LighthousePopover({ isOpen, onClose }: LighthousePopoverProps) {
  const { data, loading, error } = useLighthouseData(isOpen);
  const { timeframe, activeTab, sortField, sortDirection, setTimeframe, setActiveTab, setSortField } =
    useLighthouseStore();

  const entries = useMemo(() => {
    if (!data?.data) return [];
    const raw = (data.data[activeTab] ?? []) as Array<Record<string, unknown>>;

    const sorted = [...raw].sort((a, b) => {
      const aMetric = a[sortField] as Record<string, number> | undefined;
      const bMetric = b[sortField] as Record<string, number> | undefined;
      const aVal = aMetric?.[timeframe] ?? 0;
      const bVal = bMetric?.[timeframe] ?? 0;
      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return sorted;
  }, [data, activeTab, sortField, sortDirection, timeframe]);

  const total = data?.data?.total as Record<string, Record<string, number | null>> | undefined;

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-full left-0 mb-1 w-[700px] max-h-[70vh] bg-bgPrimary border border-borderDefault rounded-lg shadow-2xl flex flex-col overflow-hidden z-[9999] animate-in slide-in-from-bottom-2 fade-in duration-150">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-borderDefault">
        <span className="text-sm font-semibold text-textPrimary">Lighthouse</span>
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.key}
              onClick={() => setTimeframe(tf.key)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                timeframe === tf.key
                  ? 'bg-bgContainer text-textPrimary font-semibold'
                  : 'text-textTertiary hover:text-textPrimary'
              }`}
            >
              {tf.label}
            </button>
          ))}
          <button onClick={onClose} className="ml-2 p-1 text-textTertiary hover:text-textPrimary rounded transition-colors">
            <FiX size={14} />
          </button>
        </div>
      </div>

      {/* Total metrics */}
      {total && (
        <div className="flex items-center justify-between border-b border-borderDefault">
          {COLUMNS.map((col) => {
            const metrics = total[col.key] as Record<string, number> | undefined;
            const changeKey = `${col.key}Change`;
            const changes = total[changeKey] as Record<string, number | null> | undefined;
            return (
              <MetricCard
                key={col.key}
                label={col.label}
                value={(metrics?.[timeframe] as number) ?? 0}
                change={(changes?.[timeframe] as number | null) ?? null}
                isUSD={col.key === 'volumeUSD' || col.key === 'feesPaidUSD'}
              />
            );
          })}
        </div>
      )}

      {/* Tab selector */}
      <div className="flex gap-1 px-3 py-1.5 border-b border-borderDefault">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              activeTab === tab.key
                ? 'bg-bgContainer text-textPrimary font-semibold border-borderPrimary'
                : 'text-textTertiary hover:text-textPrimary border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {error ? (
          <div className="p-4 text-center text-xs text-red-500">{error}</div>
        ) : loading && !data ? (
          <TableSkeleton />
        ) : (
          <table className="w-full table-fixed">
            <thead className="sticky top-0 z-10 bg-bgPrimary border-b border-borderDefault">
              <tr>
                <th className="w-8 px-2 py-1.5 text-left text-[10px] text-grayGhost font-medium">#</th>
                <th className="w-[140px] px-2 py-1.5 text-left text-[10px] text-grayGhost font-medium">Name</th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="px-2 py-1.5 text-right text-[10px] text-grayGhost font-medium cursor-pointer hover:text-textPrimary transition-colors"
                    onClick={() => setSortField(col.key)}
                  >
                    <div className="flex items-center justify-end gap-0.5">
                      {col.label}
                      <ArrowUpDown
                        size={10}
                        className={sortField === col.key ? 'text-success' : 'text-grayDark'}
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const name = entry.name as string;
                const logo = entry.logo as string | null;
                return (
                  <tr
                    key={name}
                    className="bg-bgPrimary even:bg-bgTableAlt hover:bg-bgTableHover transition-colors"
                  >
                    <td className="px-2 py-1.5 text-[10px] text-grayMedium">{i + 1}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {logo ? (
                          <SafeImage src={logo} alt={name} width={18} height={18} className="rounded-full flex-shrink-0" />
                        ) : (
                          <div className="w-[18px] h-[18px] rounded-full bg-bgContainer flex-shrink-0" />
                        )}
                        <span className="text-xs text-textPrimary truncate">{name}</span>
                      </div>
                    </td>
                    {COLUMNS.map((col) => {
                      const metrics = entry[col.key] as Record<string, number> | undefined;
                      const changeKey = `${col.key}Change`;
                      const changes = entry[changeKey] as Record<string, number | null> | undefined;
                      const val = metrics?.[timeframe] ?? 0;
                      const change = changes?.[timeframe] ?? null;
                      const isUSD = col.key === 'volumeUSD' || col.key === 'feesPaidUSD';
                      return (
                        <td key={col.key} className="px-2 py-1.5 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-menlo text-textPrimary">
                              {isUSD ? formatCompactNumber(val) : val.toLocaleString()}
                            </span>
                            <ChangeText value={change} />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {entries.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-grayMedium">
                    No data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
