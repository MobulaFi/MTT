'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { usePulseFilterStore, Section, RangeValueWithUnit } from '@/features/pulse/store/usePulseModalFilterStore';
import { RangeInput } from './RangeInput';

interface AuditsTabProps {
  section: Section;
}

export const AuditsTab: React.FC<AuditsTabProps> = ({ section }) => {
  const sectionState = usePulseFilterStore((state) => state.sections[section]);
  const setSection = usePulseFilterStore((state) => state.setSection);

  if (!sectionState) {
    return (
      <div className="text-red-500 text-xs p-4">
        Error: Invalid section &quot;{section}&quot;
      </div>
    );
  }

  const audits = sectionState.audits;

  const setAudit = <K extends keyof typeof audits>(key: K, value: (typeof audits)[K]) => {
    setSection(section, 'audits', { ...audits, [key]: value });
  };

  return (
    <div className="space-y-3">
      <div className="border-b border-borderDefault">
        <div className="flex items-center space-x-3 pb-[10px]">
          <label htmlFor="dex-paid" className="flex items-center gap-2 pl-4 cursor-pointer">
            <Checkbox
              id="dex-paid"
              checked={audits.dexPaid}
              onCheckedChange={(checked) => setAudit('dexPaid', checked === true)}
              className="border-[#323542] data-[state=checked]:bg-success data-[state=checked]:border-success"
            />
            <span className="text-xs text-textPrimary font-normal">DEX Paid</span>
          </label>

          <label htmlFor="ca-ends-with-pump" className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              id="ca-ends-with-pump"
              checked={audits.caEndsInPump}
              onCheckedChange={(checked) => setAudit('caEndsInPump', checked === true)}
              className="border-[#323542] data-[state=checked]:bg-success data-[state=checked]:border-success"
            />
            <span className="text-xs text-textPrimary font-normal">
              CA ends in &apos;pump&apos;
            </span>
          </label>
        </div>
      </div>

      <RangeInput
        label="Age"
        value={audits.age}
        onChange={(value) => setAudit('age', value as RangeValueWithUnit)}
        showUnit
        unit={audits.age.unit}
      />
      <RangeInput
        label="Top 10 Holders %"
        value={audits.top10HoldersPercent}
        onChange={(value) => setAudit('top10HoldersPercent', value)}
      />
      <RangeInput
        label="Dev Holding %"
        value={audits.devHoldingPercent}
        onChange={(value) => setAudit('devHoldingPercent', value)}
      />
      <RangeInput
        label="Snipers %"
        value={audits.snipersPercent}
        onChange={(value) => setAudit('snipersPercent', value)}
      />
      <RangeInput
        label="Insiders %"
        value={audits.insidersPercent}
        onChange={(value) => setAudit('insidersPercent', value)}
      />
      <RangeInput
        label="Bundle %"
        value={audits.bundlePercent}
        onChange={(value) => setAudit('bundlePercent', value)}
      />
      <RangeInput
        label="Holders"
        value={audits.holders}
        onChange={(value) => setAudit('holders', value)}
      />
      <RangeInput
        label="Pro Traders"
        value={audits.proTraders}
        onChange={(value) => setAudit('proTraders', value)}
      />
      <RangeInput
        label="Dev Migration"
        value={audits.devMigration}
        onChange={(value) => setAudit('devMigration', value)}
      />
    </div>
  );
};
