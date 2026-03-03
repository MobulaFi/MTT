'use client';

import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { Liveline } from 'liveline';
import type { WindowOption } from 'liveline';
import { useThemeStore } from '@/store/useThemeStore';

interface OHLCVCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades: number;
}

interface Trade {
  tradeId: string;
  side: 'buy' | 'sell';
  price: number; // 0-1
  amountUSD: number;
}

export type ChartPeriod = '1s' | '5s' | '10s' | '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export const CHART_WINDOWS: Array<WindowOption & { period: ChartPeriod }> = [
  { label: '5m',  secs: 300,    period: '1s'  },
  { label: '1h',  secs: 3600,   period: '1m'  },
  { label: '6h',  secs: 21600,  period: '5m'  },
  { label: '1d',  secs: 86400,  period: '15m' },
  { label: '1w',  secs: 604800, period: '1h'  },
];

export const DEFAULT_WINDOW_SECS = 300;
export const DEFAULT_PERIOD: ChartPeriod = '1s';

// A floating label that drifts upward then fades out
interface FloatingLabel {
  id: string;
  text: string;
  color: string; // green for buy, red for sell
  // y position as % from bottom (0 = bottom, 100 = top)
  startTime: number; // ms timestamp when spawned
}

const LABEL_DURATION = 1400; // ms to drift from bottom to top
const LABEL_FONT = '600 12px "SF Mono", Menlo, monospace';

interface LivelineChartProps {
  candles: OHLCVCandle[];
  latestPrice: number | null;
  trades?: Trade[];
  activeSecs: number;
  onWindowChange: (secs: number, period: ChartPeriod) => void;
}

function formatUSD(v: number) {
  if (v >= 1000) return `$${Math.round(v / 1000)}k`;
  if (v >= 10) return `$${Math.round(v)}`;
  return `$${v.toFixed(1)}`;
}

export function LivelineChart({ candles, latestPrice, trades = [], activeSecs, onWindowChange }: LivelineChartProps) {
  const successColor = useThemeStore((s) => s.colors.success);

  // ── Chart data with dynamic Y-range ─────────────────────────────────────────
  // Rescale values to 0-100 with padding proportional to the actual data range:
  //   Small range (price always ~4%, range 0.2%) → pad=4% → visible 0-8%  → tight zoom, centered
  //   Large range (30→90%, range=60%)            → pad=24% → visible 6-100% → natural scale, no cramping
  const { displayData, displayValue, yLo, ySpan } = useMemo(() => {
    const rawPoints = candles
      .filter((c) => c.close > 0 && c.close < 1 && !Number.isNaN(c.close))
      .map((c) => ({ time: Math.floor(c.time / 1000), value: c.close * 100 }));

    const latestVal =
      latestPrice != null && latestPrice > 0 && latestPrice < 1
        ? latestPrice * 100
        : rawPoints[rawPoints.length - 1]?.value;

    if (rawPoints.length === 0 || latestVal == null) {
      const v = latestVal ?? 50;
      return {
        displayData: [{ time: Math.floor(Date.now() / 1000) - 1, value: 50 }],
        displayValue: 50,
        yLo: Math.max(0, v - 5),
        ySpan: 10,
      };
    }

    const allValues = [...rawPoints.map((p) => p.value), latestVal];
    let rawMin = allValues[0];
    let rawMax = allValues[0];
    for (const v of allValues) {
      if (v < rawMin) rawMin = v;
      if (v > rawMax) rawMax = v;
    }
    const range = rawMax - rawMin;

    // 40% padding on each side, minimum 4% absolute — keeps line off the edges
    const pad = Math.max(range * 0.4, 4);
    const yLo = Math.max(0, rawMin - pad);
    const yHi = Math.min(100, rawMax + pad);
    const ySpan = yHi - yLo;
    const scale = (v: number) => ((v - yLo) / ySpan) * 100;

    return {
      displayData: rawPoints.map((p) => ({ ...p, value: scale(p.value) })),
      displayValue: scale(latestVal),
      yLo,
      ySpan,
    };
  }, [candles, latestPrice]);

  // ── Floating trade labels overlay ───────────────────────────────────────────
  // Each WS trade spawns one label that drifts up via CSS animation.
  // No interval, no queue — one setState per real trade, CSS handles the rest.
  const seenIdRef = useRef<string | undefined>(undefined);
  const bootedRef = useRef(false);
  const [labels, setLabels] = useState<FloatingLabel[]>([]);

  useEffect(() => {
    if (trades.length === 0) {
      bootedRef.current = false;
      seenIdRef.current = undefined;
      return;
    }
    const headId = trades[0].tradeId;
    if (!bootedRef.current) {
      bootedRef.current = true;
      seenIdRef.current = headId;
      return;
    }
    if (headId === seenIdRef.current) return;

    // Collect all new trades since last render
    const lastIdx = trades.findIndex((t) => t.tradeId === seenIdRef.current);
    const newTrades = (lastIdx > 0 ? trades.slice(0, lastIdx) : [trades[0]])
      .filter((t) => t.price > 0 && t.price < 1)
      .reverse(); // oldest first

    seenIdRef.current = headId;
    if (newTrades.length === 0) return;

    const now = Date.now();
    const spawned: FloatingLabel[] = newTrades.map((t, i) => ({
      id: t.tradeId,
      text: `${t.side === 'buy' ? '+' : '-'} ${formatUSD(t.amountUSD)}`,
      color: t.side === 'buy' ? successColor : '#F45B5B',
      startTime: now + i * 80, // stagger bursts by 80ms each
    }));

    setLabels((prev) => {
      // Keep only labels still in flight, add new ones (cap at 30)
      const alive = prev.filter((l) => now - l.startTime < LABEL_DURATION);
      return [...alive, ...spawned].slice(-30);
    });
  }, [trades]);

  // Prune expired labels every second
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setLabels((prev) => prev.filter((l) => now - l.startTime < LABEL_DURATION - 250));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Window change ────────────────────────────────────────────────────────────
  const handleWindowChange = useCallback(
    (secs: number) => {
      const w = CHART_WINDOWS.find((w) => w.secs === secs);
      if (w) onWindowChange(secs, w.period);
    },
    [onWindowChange],
  );

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full">
      {/* Trade labels overlay — CSS animation, no JS loop */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {labels.map((label) => (
          <FloatingTradeLabel key={label.id} label={label} />
        ))}
      </div>

      <Liveline
        data={displayData}
        value={displayValue}
        theme="dark"
        color={successColor}
        window={activeSecs}
        momentum
        showValue
        valueMomentumColor
        fill
        pulse
        scrub
        degen
        formatValue={(v) => `${(yLo + (v / 100) * ySpan).toFixed(1)}%`}
        windows={CHART_WINDOWS}
        onWindowChange={handleWindowChange}
        windowStyle="text"
        padding={{ top: 16, right: 80, bottom: 48, left: 12 }}
      />
    </div>
  );
}

// Separate component so each label manages its own animation lifecycle
function FloatingTradeLabel({ label }: { label: FloatingLabel }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const delay = Math.max(0, label.startTime - Date.now());
    const timer = setTimeout(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(-120px)';
    }, delay);
    return () => clearTimeout(timer);
  }, [label.startTime]);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        bottom: 36,
        left: 16,
        color: label.color,
        font: LABEL_FONT,
        opacity: 0,
        transform: 'translateY(0)',
        transition: `transform ${LABEL_DURATION}ms linear, opacity 200ms ease`,
        willChange: 'transform, opacity',
      }}
    >
      {label.text}
    </div>
  );
}
