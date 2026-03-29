'use client';

import { useEffect, useRef, useCallback, memo } from 'react';
import type { OhlcvCandle } from '../store/useSurgeStore';

const G = '#00DC82', R = '#FF4757';

// Wider candles for better visibility matching the reference design
const BODY_W = 8;    // candle body width in px
const STEP_W = 11;   // body + spacing between candles
const WICK_W = 1;    // wick line width

function clean(bars: OhlcvCandle[]): OhlcvCandle[] {
  if (bars.length < 5) return bars;
  const sorted = bars.map(b => b.c).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return bars.filter(b =>
    Math.max(b.o, b.c, b.h) < median * 10 &&
    Math.min(b.o, b.c, b.l) > median * 0.1
  );
}

interface ChartProps {
  candles?: OhlcvCandle[];
  avgBuyPrice?: number;
  avgSellPrice?: number;
}

function MiniCandlestickChart({ candles, avgBuyPrice, avgSellPrice }: ChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const cv = canvasRef.current, bx = boxRef.current;
    if (!cv || !bx) return;
    if (!candles || !candles.length) return;

    const valid = candles.filter(b => b.h > 0 && b.l > 0 && b.o > 0 && b.c > 0);
    const cleaned = clean(valid);
    if (cleaned.length < 1) return;

    const dpr = window.devicePixelRatio || 1;
    const { width: w, height: h } = bx.getBoundingClientRect();
    if (w < 1 || h < 1) return;

    cv.width = w * dpr;
    cv.height = h * dpr;
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    const c = cv.getContext('2d');
    if (!c) return;
    c.scale(dpr, dpr);
    c.clearRect(0, 0, w, h);

    // Minimal margins — chart fills nearly the entire area
    const M = { t: 2, b: 2, l: 2, r: 2 };
    const availW = w - M.l - M.r;
    const ch = h - M.t - M.b;

    // How many candles fit
    const maxFit = Math.floor(availW / STEP_W);
    const bars = cleaned.length > maxFit ? cleaned.slice(-maxFit) : cleaned;
    const n = bars.length;
    const contentW = n * STEP_W;

    // Few candles = young chart -> left-align after a small offset
    // Many candles = right-align like the reference
    const FADE_ZONE = 20;
    let offsetX: number;
    if (contentW < availW * 0.5) {
      offsetX = M.l + FADE_ZONE;
    } else {
      offsetX = w - M.r - contentW;
    }

    // Price range - use full chart height
    let lo = Infinity, hi = -Infinity;
    for (const b of bars) {
      if (b.l < lo) lo = b.l;
      if (b.h > hi) hi = b.h;
    }
    const rng = hi - lo;
    // For single candle or flat price, create artificial range
    const effectiveRng = rng > 0 ? rng : (hi * 0.02 || 1);
    const effectiveLo = rng > 0 ? lo : lo - effectiveRng / 2;
    // Slight padding so wicks don't clip the edge
    const pad = effectiveRng * 0.02;
    const aLo = effectiveLo - pad, aR = effectiveRng + pad * 2;
    const y = (p: number) => M.t + ch - ((p - aLo) / aR) * ch;

    for (let i = 0; i < n; i++) {
      const b = bars[i];
      const cx = offsetX + i * STEP_W + STEP_W / 2;
      const up = b.c >= b.o;
      // Fade: oldest candles slightly more transparent
      const a = n <= 1 ? 1 : 0.3 + (i / (n - 1)) * 0.7;

      const bt = y(Math.max(b.o, b.c));
      const bb = y(Math.min(b.o, b.c));
      const bh = Math.max(1, bb - bt);

      // Wick
      c.globalAlpha = a * 0.6;
      c.strokeStyle = up ? G : R;
      c.lineWidth = WICK_W;
      c.beginPath();
      c.moveTo(cx, y(b.h));
      c.lineTo(cx, y(b.l));
      c.stroke();

      // Body
      c.globalAlpha = a;
      c.fillStyle = up ? G : R;
      c.fillRect(cx - BODY_W / 2, bt, BODY_W, bh);
    }

    c.globalAlpha = 1;

    // ── Avg price lines ──
    const drawPriceLine = (price: number, color: string, label: string) => {
      if (price <= 0 || price < aLo || price > aLo + aR) return;
      const ly = y(price);
      c.save();
      c.globalAlpha = 0.7;
      c.strokeStyle = color;
      c.lineWidth = 1;
      c.setLineDash([4, 3]);
      c.beginPath();
      c.moveTo(M.l, ly);
      c.lineTo(w - M.r, ly);
      c.stroke();
      c.setLineDash([]);

      // Label on right edge
      c.globalAlpha = 0.85;
      c.font = `600 7px ${getComputedStyle(bx).fontFamily || 'monospace'}`;
      const text = label;
      const tw = c.measureText(text).width;
      const px = 3, py = 2;
      c.fillStyle = color;
      c.fillRect(w - M.r - tw - px * 2, ly - 5 - py, tw + px * 2, 10 + py * 2);
      c.fillStyle = '#0C0C10';
      c.textBaseline = 'middle';
      c.fillText(text, w - M.r - tw - px, ly);
      c.restore();
    };

    if (avgBuyPrice && avgBuyPrice > 0) drawPriceLine(avgBuyPrice, G, 'AVG BUY');
    if (avgSellPrice && avgSellPrice > 0) drawPriceLine(avgSellPrice, R, 'AVG SELL');

  }, [candles, avgBuyPrice, avgSellPrice]);

  // Use ResizeObserver for reliable layout detection
  useEffect(() => {
    const bx = boxRef.current;
    if (!bx) return;

    // Initial draw with rAF to ensure layout is computed
    requestAnimationFrame(() => draw());

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => draw());
    });
    ro.observe(bx);

    return () => ro.disconnect();
  }, [draw]);

  // Also redraw on window resize as fallback
  useEffect(() => {
    const f = () => draw();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, [draw]);

  return (
    <div ref={boxRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
    </div>
  );
}

export default memo(MiniCandlestickChart);
