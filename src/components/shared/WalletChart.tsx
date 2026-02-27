'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '../ui/skeleton';
import { formatCryptoPrice } from '@mobula_labs/sdk';

export type ChartMode = 'pnl' | 'balance';

interface ChartProps {
  data: Array<{ date: string | Date; realized: number }>;
  mode: ChartMode;
}

// Interpolate crossings at a reference line for smooth color transitions
const interpolateCrossings = (data: Array<{ date: string | Date; realized: number }>, referenceValue: number = 0) => {
  if (!data || data.length < 2) return data.map(d => ({
    ...d,
    date: d.date instanceof Date ? d.date.toISOString() : d.date,
  }));

  const result: Array<{ date: string; realized: number }> = [];
  
  for (let i = 0; i < data.length; i++) {
    const current = data[i];
    const currentDate = current.date instanceof Date ? current.date.toISOString() : current.date;
    const currentValue = current.realized;
    
    if (i > 0) {
      const prev = data[i - 1];
      const prevValue = prev.realized;
      
      // Check if we cross the reference value between prev and current
      if ((prevValue > referenceValue && currentValue < referenceValue) || (prevValue < referenceValue && currentValue > referenceValue)) {
        const prevDate = prev.date instanceof Date ? prev.date.toISOString() : prev.date;
        const prevTime = new Date(prevDate).getTime();
        const currTime = new Date(currentDate).getTime();
        
        // Linear interpolation
        const ratio = Math.abs(prevValue - referenceValue) / (Math.abs(prevValue - referenceValue) + Math.abs(currentValue - referenceValue));
        const crossTime = prevTime + (currTime - prevTime) * ratio;
        
        result.push({
          date: new Date(crossTime).toISOString(),
          realized: referenceValue,
        });
      }
    }
    
    result.push({
      date: currentDate,
      realized: currentValue,
    });
  }
  
  return result;
};

// Chart with proper crossing handling
const SegmentedChart = dynamic(
  () => import('recharts').then((mod) => {
    const { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } = mod;
    return {
      default: ({ data, mode }: ChartProps) => {
        const isPnl = mode === 'pnl';
        
        // For balance mode, use starting value as reference for red/green
        const startValue = !isPnl && data && data.length > 0 ? data[0].realized : 0;
        const referenceValue = isPnl ? 0 : startValue;
        
        // Interpolate crossings at reference value
        const processedData = interpolateCrossings(data || [], referenceValue);
        
        const normalizedData = processedData.map((item) => {
          const value = item.realized;
          const isAboveRef = value >= referenceValue;
          return {
            date: item.date,
            realized: value,
            // Split into positive and negative based on reference value
            positiveArea: isAboveRef ? value : referenceValue,
            negativeArea: !isAboveRef ? value : referenceValue,
          };
        });

        const formatXAxis = (dateStr: string) => {
          const date = new Date(dateStr);
          // Check if data spans more than 2 days
          const firstDate = new Date(normalizedData[0]?.date || dateStr);
          const lastDate = new Date(normalizedData[normalizedData.length - 1]?.date || dateStr);
          const daysDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysDiff < 2) {
            // Show time for intraday data
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          }
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        };

        const formatYAxis = (value: number) => {
          if (value === 0) return '$0';
          if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
          if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
          return `$${value.toFixed(0)}`;
        };

        const allValues = normalizedData.map(d => d.realized);
        const minValue = Math.min(...allValues, referenceValue);
        const maxValue = Math.max(...allValues, referenceValue);
        const range = maxValue - minValue;
        const padding = Math.max(range * 0.15, 10);
        
        return (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart 
              data={normalizedData} 
              margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
            >
              <defs>
                <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#18C722" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#18C722" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="redGradient" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#F45B5B" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#F45B5B" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.05} />
                </linearGradient>
              </defs>

              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="#22242D" 
                vertical={false}
              />
              
              <XAxis 
                dataKey="date"
                tickFormatter={formatXAxis}
                axisLine={{ stroke: '#22242D' }}
                tickLine={{ stroke: '#22242D' }}
                tick={{ fill: '#777A8C', fontSize: 10 }}
                interval={Math.max(0, Math.floor(normalizedData.length / 6) - 1)}
                minTickGap={50}
              />
              
              <YAxis 
                tickFormatter={formatYAxis}
                axisLine={{ stroke: '#22242D' }}
                tickLine={{ stroke: '#22242D' }}
                tick={{ fill: '#777A8C', fontSize: 10 }}
                domain={[minValue - padding, maxValue + padding]}
                width={55}
              />
              
              {/* Reference line - at 0 for PNL, at starting balance for Balance mode */}
              <ReferenceLine 
                y={referenceValue} 
                stroke="#555"
                strokeWidth={1}
                strokeDasharray={isPnl ? undefined : "3 3"}
              />
              
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1A1C23",
                  border: "1px solid #343439",
                  borderRadius: "4px",
                  color: "#fff",
                  fontSize: "12px",
                  padding: "8px 12px",
                }}
                labelFormatter={(date: string) => new Date(date).toLocaleDateString('en-US', { 
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                })}
                formatter={(value: number, name: string) => {
                  // Only show the realized value in tooltip
                  if (name !== 'realized') return [null, null];
                  const isAboveRef = value >= referenceValue;
                  const color = isAboveRef ? '#18C722' : '#F45B5B';
                  
                  if (isPnl) {
                    const sign = value >= 0 ? '+' : '';
                    return [
                      <span key="val" style={{ color, fontWeight: 500 }}>
                        {sign}{formatCryptoPrice(value)}
                      </span>,
                      'Realized PnL'
                    ];
                  }
                  // For balance mode, show change from start
                  const change = value - referenceValue;
                  const changeSign = change >= 0 ? '+' : '';
                  return [
                    <span key="val" style={{ fontWeight: 500 }}>
                      <span style={{ color: '#fff' }}>{formatCryptoPrice(value)}</span>
                      <span style={{ color, marginLeft: '4px', fontSize: '11px' }}>
                        ({changeSign}{formatCryptoPrice(change)})
                      </span>
                    </span>,
                    'Balance'
                  ];
                }}
              />
              
              {/* Positive area (above reference) */}
              <Area 
                type="monotone" 
                dataKey="positiveArea"
                stroke="#18C722"
                strokeWidth={2}
                fill="url(#greenGradient)"
                connectNulls={true}
                isAnimationActive={false}
                baseValue={referenceValue}
              />
              
              {/* Negative area (below reference) */}
              <Area 
                type="monotone" 
                dataKey="negativeArea"
                stroke="#F45B5B"
                strokeWidth={2}
                fill="url(#redGradient)"
                connectNulls={true}
                isAnimationActive={false}
                baseValue={referenceValue}
              />
              
              {/* Invisible line for tooltip data - renders the actual realized value */}
              <Line
                type="monotone"
                dataKey="realized"
                stroke="transparent"
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        );
      },
    };
  }),
  { 
    ssr: false,
    loading: () => <Skeleton className="w-full h-full rounded" />
  }
);

interface WalletChartProps {
  data?: Array<{ date: string | Date; realized: number }>;
  mode?: ChartMode;
}

export function WalletChart({ data, mode = 'pnl' }: WalletChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-xs text-textTertiary">No data</span>
      </div>
    );
  }
  
  return <SegmentedChart data={data} mode={mode} />;
}
