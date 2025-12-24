// src/components/pulse/MetricsTab.tsx
'use client';

import { usePulseFilterStore, Section, RangeValue, RangeValueWithUnit } from '@/features/pulse/store/usePulseModalFilterStore';
import { RangeInput } from './RangeInput';

interface MetricsTabProps {
  section: Section;
}

export const MetricsTab: React.FC<MetricsTabProps> = ({ section }) => {
  const sectionState = usePulseFilterStore((state) => state.sections[section]);
  const setSection = usePulseFilterStore((state) => state.setSection);

  // SAFETY: Prevent crash if section is invalid
  if (!sectionState) {
    console.error(`[MetricsTab] Invalid section: "${section}"`);
    return (
      <div className="p-4 text-red-500 text-xs">
        Error: Invalid section &quot;{section}&quot;
      </div>
    );
  }

  const metrics = sectionState.metrics;

  const setMetric = <K extends keyof typeof metrics>(key: K, value: (typeof metrics)[K]) => {
    setSection(section, 'metrics', { ...metrics, [key]: value });
  };

  return (
    <div className="space-y-3">
      <RangeInput
        label="Liquidity ($)"
        value={metrics.liquidity}
        onChange={(value) => setMetric('liquidity', value)}
      />
      <RangeInput
        label="Volume ($)"
        value={metrics.volume}
        onChange={(value) => setMetric('volume', value)}
      />
      <RangeInput
        label="Market Cap ($)"
        value={metrics.marketCap}
        onChange={(value) => setMetric('marketCap', value)}
      />
      <RangeInput
        label="B Curve %"
        value={metrics.bCurvePercent}
        onChange={(value) => setMetric('bCurvePercent', value)}
      />
      <RangeInput
        label="Global Fees Paid"
        value={metrics.globalFeesPaid}
        onChange={(value) => setMetric('globalFeesPaid', value)}
      />
      <RangeInput
        label="TXNs"
        value={metrics.txns}
        onChange={(value) => setMetric('txns', value)}
      />
      <RangeInput
        label="Num Buys"
        value={metrics.numBuys}
        onChange={(value) => setMetric('numBuys', value)}
      />
      <RangeInput
        label="Num Sells"
        value={metrics.numSells}
        onChange={(value) => setMetric('numSells', value)}
      />
    </div>
  );
};
