'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { fmtUsd } from '@/lib/format';

type ChartMode = 'pnl' | 'balance';

interface PnlChartProps {
  history: Array<{ date: string; value: number }>;
  calendarBreakdown?: Array<{ date: string; realizedPnlUSD: number }>;
  isLoading: boolean;
}

interface ChartData {
  points: Array<{ x: number; y: number }>;
  values: number[];
  dates: string[];
  isNegative: boolean;
}

export function PnlChart({ history, calendarBreakdown, isLoading }: PnlChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mode, setMode] = useState<ChartMode>('pnl');
  const chartDataRef = useRef<ChartData | null>(null);

  // Precompute chart values and dates based on mode
  const { chartValues, chartDates } = useMemo(() => {
    if (mode === 'pnl') {
      if (calendarBreakdown && calendarBreakdown.length > 1) {
        let cumulative = 0;
        const vals = calendarBreakdown.map((d) => {
          cumulative += d.realizedPnlUSD;
          return cumulative;
        });
        return { chartValues: vals, chartDates: calendarBreakdown.map(d => d.date) };
      }
    } else {
      if (history && history.length > 1) {
        return { chartValues: history.map(h => h.value), chartDates: history.map(h => h.date) };
      }
    }
    return { chartValues: [] as number[], chartDates: [] as string[] };
  }, [calendarBreakdown, history, mode]);

  const draw = useCallback((hoveredIdx: number | null = null) => {
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

    if (chartValues.length < 2) {
      ctx.fillStyle = '#555';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No data', w / 2, h / 2);
      return;
    }

    const minVal = Math.min(...chartValues);
    const maxVal = Math.max(...chartValues);
    const range = maxVal - minVal || 1;
    const lastVal = chartValues[chartValues.length - 1];
    const firstVal = chartValues[0];
    const isNegative = mode === 'pnl' ? lastVal < 0 : lastVal < firstVal;
    const padding = 6;
    const chartH = h - padding * 2 - 16;

    const points = chartValues.map((v, i) => ({
      x: padding + (i / (chartValues.length - 1)) * (w - padding * 2),
      y: padding + (1 - (v - minVal) / range) * chartH,
    }));

    chartDataRef.current = { points, values: chartValues, dates: chartDates, isNegative };

    // PnL mode: red/green based on sign. Balance mode: blue gradient.
    const color = mode === 'balance' ? '#3B82F6' : (isNegative ? '#EA3943' : '#0ECB81');
    const colorAlphaStart = mode === 'balance'
      ? 'rgba(59, 130, 246, 0.15)'
      : (isNegative ? 'rgba(244, 91, 91, 0.15)' : 'rgba(24, 199, 34, 0.15)');
    const colorAlphaEnd = mode === 'balance'
      ? 'rgba(59, 130, 246, 0.02)'
      : (isNegative ? 'rgba(244, 91, 91, 0.02)' : 'rgba(24, 199, 34, 0.02)');

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, colorAlphaStart);
    gradient.addColorStop(1, colorAlphaEnd);

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

    // Hover crosshair + dot + tooltip
    if (hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < points.length) {
      const px = points[hoveredIdx].x;
      const py = points[hoveredIdx].y;
      const val = chartValues[hoveredIdx];

      // Vertical dashed line
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
      ctx.restore();

      // Horizontal dashed line
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
      ctx.stroke();
      ctx.restore();

      // Dot on line
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#0A0A0A';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Tooltip
      const valStr = mode === 'pnl' ? `${val >= 0 ? '+' : ''}${fmtUsd(val)}` : fmtUsd(val);
      const dateStr = chartDates[hoveredIdx]
        ? new Date(chartDates[hoveredIdx]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';

      ctx.font = 'bold 11px -apple-system, sans-serif';
      const valWidth = ctx.measureText(valStr).width;
      ctx.font = '9px -apple-system, sans-serif';
      const dateWidth = ctx.measureText(dateStr).width;
      const boxW = Math.max(valWidth, dateWidth) + 16;
      const boxH = 32;

      // Position tooltip — flip if near edge
      let tooltipX = px - boxW / 2;
      let tooltipY = py - boxH - 10;
      if (tooltipX < 2) tooltipX = 2;
      if (tooltipX + boxW > w - 2) tooltipX = w - boxW - 2;
      if (tooltipY < 2) tooltipY = py + 14;

      // Background
      ctx.fillStyle = 'rgba(26, 28, 35, 0.95)';
      ctx.strokeStyle = 'rgba(52, 52, 57, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const r = 4;
      ctx.moveTo(tooltipX + r, tooltipY);
      ctx.lineTo(tooltipX + boxW - r, tooltipY);
      ctx.quadraticCurveTo(tooltipX + boxW, tooltipY, tooltipX + boxW, tooltipY + r);
      ctx.lineTo(tooltipX + boxW, tooltipY + boxH - r);
      ctx.quadraticCurveTo(tooltipX + boxW, tooltipY + boxH, tooltipX + boxW - r, tooltipY + boxH);
      ctx.lineTo(tooltipX + r, tooltipY + boxH);
      ctx.quadraticCurveTo(tooltipX, tooltipY + boxH, tooltipX, tooltipY + boxH - r);
      ctx.lineTo(tooltipX, tooltipY + r);
      ctx.quadraticCurveTo(tooltipX, tooltipY, tooltipX + r, tooltipY);
      ctx.fill();
      ctx.stroke();

      // Value text
      ctx.fillStyle = mode === 'balance' ? '#3B82F6' : (val >= 0 ? '#0ECB81' : '#EA3943');
      ctx.font = 'bold 11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(valStr, tooltipX + boxW / 2, tooltipY + 14);

      // Date text
      ctx.fillStyle = '#555555';
      ctx.font = '9px -apple-system, sans-serif';
      ctx.fillText(dateStr, tooltipX + boxW / 2, tooltipY + 26);
    }

    // Watermark
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('TradingView', w - 8, h - 6);
  }, [chartValues, chartDates, mode]);

  useEffect(() => {
    draw(hoverIndex);
  }, [draw, hoverIndex]);

  useEffect(() => {
    const observer = new ResizeObserver(() => draw(hoverIndex));
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [draw, hoverIndex]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const data = chartDataRef.current;
    if (!canvas || !data || data.points.length < 2) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // Find closest point
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < data.points.length; i++) {
      const dist = Math.abs(data.points[i].x - mouseX);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    setHoverIndex(closestIdx);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(null);
  }, []);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <span className="text-base text-textTertiary font-medium mb-2">Realized PNL</span>
        <div className="flex-1 bg-bgTertiary/20 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-1 bg-bgMuted rounded p-0.5">
          <button
            onClick={() => setMode('pnl')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              mode === 'pnl' ? 'bg-bgPrimary text-success' : 'text-textTertiary hover:text-white'
            }`}
          >
            PNL
          </button>
          <button
            onClick={() => setMode('balance')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              mode === 'balance' ? 'bg-bgPrimary text-blue-500' : 'text-textTertiary hover:text-white'
            }`}
          >
            Balance
          </button>
        </div>
        <button className="text-textTertiary hover:text-white transition-colors" title="Copy chart">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
      </div>
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
