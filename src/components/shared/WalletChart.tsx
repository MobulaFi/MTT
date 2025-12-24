'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '../ui/skeleton';

const RechartsChart = dynamic(
  () => import('recharts').then((mod) => {
    const { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } = mod;
    return {
      default: ({ data }: { data: Array<{ date: string | Date; realized: number }> }) => {
        // Normalize date to string for Recharts
        const normalizedData = (data || []).map(item => ({
          ...item,
          date: item.date instanceof Date ? item.date.toISOString() : item.date
        }));
        
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={normalizedData} 
              margin={{ top: 1, right: 1, left: 1, bottom: 1 }}
            >
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#22242D",
                  border: "1px solid #22242D",
                  borderRadius: "4px",
                  color: "#fff",
                  fontSize: "12px",
                }}
                labelFormatter={(date: string) => new Date(date).toLocaleDateString()}
                formatter={(value: number) => [`$${value.toFixed(2)}`, "Realized PnL"]}
              />
              <Line type="linear" dataKey="realized" stroke="#18C722" strokeWidth={2} dot={false} />
            </LineChart>
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
}

export function WalletChart({ data }: WalletChartProps) {
  return <RechartsChart data={data || []} />;
}
