import { Skeleton } from '@/components/ui/skeleton';
import React from 'react';

interface DualRatioChartsProps {
  winRateDistribution?: {
    ">500%": number;
    "200%-500%": number;
    "50%-200%": number;
    "0%-50%": number;
    "-50%-0%": number;
    "<-50%": number;
  };
  marketCapDistribution?: {
    ">1000M": number;
    ">100M": number;
    "10M-100M": number;
    "100k-1M": number;
    "<100k": number;
  };
  loading?: boolean;
}

export default function DualRatioCharts({
  winRateDistribution,
  marketCapDistribution,
  loading = false
}: DualRatioChartsProps) {
  if (loading) {
    return (
      <div className="flex gap-8">
        {[1, 2].map((section) => (
          <div key={section} className="flex-1 space-y-2 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                     <Skeleton className="h-3 w-16 rounded"/>
                     <Skeleton className="h-3 w-16 rounded"/>
              </div>
            ))}
            <Skeleton className='h-2 w-full rounded-full mt-3'/>
          </div>
        ))}
      </div>
    );
  }

  // Map win rate distribution data
  const winRateData = [
    { label: ">500%", value: winRateDistribution?.[">500%"] ?? 0, color: "bg-cyan-400" },
    { label: "200% ~ 500%", value: winRateDistribution?.["200%-500%"] ?? 0, color: "bg-teal-500" },
    { label: "50% ~ 200%", value: winRateDistribution?.["50%-200%"] ?? 0, color: "bg-emerald-500" },
    { label: "0% ~ 50%", value: winRateDistribution?.["0%-50%"] ?? 0, color: "bg-green-600" },
    { label: "-50% ~ 0%", value: winRateDistribution?.["-50%-0%"] ?? 0, color: "bg-pink-500" },
    { label: "< -50%", value: winRateDistribution?.["<-50%"] ?? 0, color: "bg-purple-900" }
  ];

  // Map market cap distribution data
  const marketCapData = [
    { label: ">1000M", value: marketCapDistribution?.[">1000M"] ?? 0, color: "bg-blue-500" },
    { label: ">100M", value: marketCapDistribution?.[">100M"] ?? 0, color: "bg-indigo-500" },
    { label: "10M-100M", value: marketCapDistribution?.["10M-100M"] ?? 0, color: "bg-purple-500" },
    { label: "100k-1M", value: marketCapDistribution?.["100k-1M"] ?? 0, color: "bg-violet-500" },
    { label: "<100k", value: marketCapDistribution?.["<100k"] ?? 0, color: "bg-fuchsia-500" }
  ];

  const totalWinRate = winRateData.reduce((sum, item) => sum + item.value, 0);
  const totalMarketCap = marketCapData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex gap-8">
      {/* Win Rate Distribution */}
      <div className="flex-1 flex flex-col">
        <h4 className="text-xs text-textTertiary font-medium mb-3">Win Rate Distribution</h4>
        {/* Legend */}
        <div className="space-y-1 mb-3 flex-1">
          {winRateData.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                <span className="text-textTertiary">{item.label}</span>
              </div>
              <span className="text-white font-medium">{item.value}</span>
            </div>
          ))}
        </div>

        {/* Bar Chart */}
        <div className="flex h-1 rounded-full overflow-hidden bg-bgMuted">
          {totalWinRate > 0 ? (
            winRateData.map((item, i) => {
              const percentage = (item.value / totalWinRate) * 100;
              if (percentage === 0) return null;
              return (
                <div
                  key={i}
                  className={item.color}
                  style={{ width: `${percentage}%` }}
                ></div>
              );
            })
          ) : (
            <div className="w-full bg-borderDefault"></div>
          )}
        </div>
      </div>

      {/* Market Cap Distribution */}
      <div className="flex-1 flex flex-col">
        <h4 className="text-xs text-textTertiary font-medium mb-3">Market Cap Distribution</h4>
        {/* Legend */}
        <div className="space-y-1 mb-3 flex-1">
          {marketCapData.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                <span className="text-textTertiary">{item.label}</span>
              </div>
              <span className="text-white font-medium">{item.value}</span>
            </div>
          ))}
        </div>

        {/* Bar Chart */}
        <div className="flex h-1 rounded-full overflow-hidden bg-bgMuted">
          {totalMarketCap > 0 ? (
            marketCapData.map((item, i) => {
              const percentage = (item.value / totalMarketCap) * 100;
              if (percentage === 0) return null;
              return (
                <div
                  key={i}
                  className={item.color}
                  style={{ width: `${percentage}%` }}
                ></div>
              );
            })
          ) : (
            <div className="w-full bg-borderDefault"></div>
          )}
        </div>
      </div>
    </div>
  );
}