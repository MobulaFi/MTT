'use client';

import { useEffect, useRef, useState } from 'react';
import { useThemeStore } from '@/store/useThemeStore';

interface PricePoint {
  time: number;
  price: number;
}

interface PriceChartProps {
  data: PricePoint[];
  color?: string;
  height?: number;
}

export function PriceChart({ data, color: colorProp, height = 200 }: PriceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<PricePoint | null>(null);
  const themeSuccess = useThemeStore((s) => s.colors.success);
  const color = colorProp ?? themeSuccess;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);

    const width = rect.width;
    const canvasHeight = rect.height;
    const padding = { top: 10, right: 10, bottom: 30, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = canvasHeight - padding.top - padding.bottom;

    // Clear canvas
    ctx.clearRect(0, 0, width, canvasHeight);

    // Calculate min/max
    const prices = data.map((d) => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    // Draw grid lines
    ctx.strokeStyle = '#161616';
    ctx.lineWidth = 0.5;

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();

      // Price labels
      const price = maxPrice - (priceRange / 5) * i;
      ctx.fillStyle = '#555555';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText((price * 100).toFixed(1) + '%', padding.left - 5, y + 3);
    }

    // Draw area under line
    ctx.beginPath();
    data.forEach((point, i) => {
      const x = padding.left + (chartWidth / (data.length - 1)) * i;
      const y = padding.top + chartHeight - ((point.price - minPrice) / priceRange) * chartHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    gradient.addColorStop(0, color + '40');
    gradient.addColorStop(1, color + '05');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    data.forEach((point, i) => {
      const x = padding.left + (chartWidth / (data.length - 1)) * i;
      const y = padding.top + chartHeight - ((point.price - minPrice) / priceRange) * chartHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw current price line
    if (data.length > 0) {
      const lastPrice = data[data.length - 1].price;
      const y = padding.top + chartHeight - ((lastPrice - minPrice) / priceRange) * chartHeight;

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Price label box
      ctx.fillStyle = color;
      ctx.fillRect(padding.left + chartWidth + 2, y - 8, 50, 16);
      ctx.fillStyle = '#030303';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText((lastPrice * 100).toFixed(1) + '%', padding.left + chartWidth + 5, y + 3);
    }

    // Time labels
    ctx.fillStyle = '#555555';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    
    const timeLabels = [0, Math.floor(data.length / 2), data.length - 1];
    timeLabels.forEach((idx) => {
      if (data[idx]) {
        const x = padding.left + (chartWidth / (data.length - 1)) * idx;
        const date = new Date(data[idx].time);
        const label = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        ctx.fillText(label, x, canvasHeight - 10);
      }
    });
  }, [data, color, themeSuccess]);

  return (
    <div className="relative w-full" style={{ height: `${height}px` }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
