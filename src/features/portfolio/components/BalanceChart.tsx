'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { fmtUsd } from '@/lib/format';

interface BalanceChartProps {
  history: Array<{ date: string; value: number }>;
  isLoading: boolean;
}

export function BalanceChart({ history, isLoading }: BalanceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const chartData = useMemo(() => {
    if (history.length < 2) return null;
    const values = history.map((h) => h.value);
    const dates = history.map((h) => h.date);
    const first = values[0];
    const last = values[values.length - 1];
    const change = last - first;
    const changePct = first !== 0 ? (change / first) * 100 : 0;
    const isPositive = change >= 0;
    return { values, dates, first, last, change, changePct, isPositive };
  }, [history]);

  const displayData = useMemo(() => {
    if (!chartData) return null;
    if (hoverIndex !== null && hoverIndex < chartData.values.length) {
      const val = chartData.values[hoverIndex];
      const change = val - chartData.first;
      const changePct = chartData.first !== 0 ? (change / chartData.first) * 100 : 0;
      return { value: val, change, changePct, isPositive: change >= 0, date: chartData.dates[hoverIndex] };
    }
    return {
      value: chartData.last,
      change: chartData.change,
      changePct: chartData.changePct,
      isPositive: chartData.isPositive,
      date: null,
    };
  }, [chartData, hoverIndex]);

  const draw = useCallback(
    (hoveredIdx: number | null = null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      if (!chartData || chartData.values.length < 2) return;

      const { values, isPositive } = chartData;
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);
      const range = maxVal - minVal || 1;
      const pad = 2;
      const chartH = h - pad * 2;

      const points = values.map((v, i) => ({
        x: (i / (values.length - 1)) * w,
        y: pad + (1 - (v - minVal) / range) * chartH,
      }));

      const color = isPositive ? '#0ECB81' : '#EA3943';

      // Gradient fill
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, isPositive ? 'rgba(14, 203, 129, 0.08)' : 'rgba(234, 57, 67, 0.08)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.moveTo(points[0].x, h);
      for (const p of points) ctx.lineTo(p.x, p.y);
      ctx.lineTo(points[points.length - 1].x, h);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Hover
      if (hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < points.length) {
        const px = points[hoveredIdx].x;
        const py = points[hoveredIdx].y;

        // Vertical line
        ctx.save();
        ctx.setLineDash([2, 3]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();
        ctx.restore();

        // Dot
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#0A0A0A';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    },
    [chartData],
  );

  useEffect(() => {
    draw(hoverIndex);
  }, [draw, hoverIndex]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => draw(hoverIndex));
    observer.observe(el);
    return () => observer.disconnect();
  }, [draw, hoverIndex]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !chartData || chartData.values.length < 2) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const idx = Math.round((mouseX / rect.width) * (chartData.values.length - 1));
      setHoverIndex(Math.max(0, Math.min(idx, chartData.values.length - 1)));
    },
    [chartData],
  );

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(null);
  }, []);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col gap-2">
        <div className="h-3 w-24 bg-bgTertiary/20 rounded animate-pulse" />
        <div className="flex-1 bg-bgTertiary/10 rounded animate-pulse" />
      </div>
    );
  }

  if (!chartData) return null;

  const hoverDateStr = displayData?.date
    ? new Date(displayData.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div className="h-full flex flex-col">
      {/* Compact header — change info + optional hover date */}
      <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          {hoverIndex !== null && displayData ? (
            <span className="text-[11px] font-mono font-medium text-white">
              {fmtUsd(displayData.value)}
            </span>
          ) : (
            <span className="text-[10px] text-textTertiary tracking-widest uppercase font-medium">30D</span>
          )}
          {displayData && (
            <span
              className={`text-[10px] font-mono font-medium ${displayData.isPositive ? 'text-success' : 'text-error'}`}
            >
              {displayData.isPositive ? '+' : ''}
              {displayData.changePct.toFixed(2)}%
            </span>
          )}
        </div>
        {hoverDateStr && (
          <span className="text-[10px] text-textTertiary font-mono">{hoverDateStr}</span>
        )}
      </div>

      {/* Chart */}
      <div ref={containerRef} className="flex-1 relative min-h-0">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>
    </div>
  );
}
