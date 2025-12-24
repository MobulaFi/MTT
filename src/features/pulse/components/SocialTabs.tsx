'use client';

import { usePulseFilterStore, Section, RangeValueWithUnit } from '@/features/pulse/store/usePulseModalFilterStore';
import { Checkbox } from '@/components/ui/checkbox';
import { RangeInput } from './RangeInput';

interface SocialsTabProps {
  section: Section;
}

export const SocialsTab: React.FC<SocialsTabProps> = ({ section }) => {
  const sectionState = usePulseFilterStore((state) => state.sections[section]);
  const setSection = usePulseFilterStore((state) => state.setSection);

  // SAFETY: Prevent crash if section is invalid
  if (!sectionState) {
    console.error(`[SocialsTab] Invalid section: "${section}"`);
    return (
      <div className="p-4 text-red-500 text-xs">
        Error: Invalid filter section &quot;{section}&quot;
      </div>
    );
  }

  const socials = sectionState.socials;

  const setSocial = <K extends keyof typeof socials>(key: K, value: (typeof socials)[K]) => {
    setSection(section, 'socials', { ...socials, [key]: value });
  };

  return (
    <div className="space-y-3">
      <RangeInput
        label="Twitter Reuses"
        value={socials.twitterReuses}
        onChange={(value) => setSocial('twitterReuses', value)}
      />

      <div className="grid grid-cols-3 gap-4 px-4">
        <label htmlFor="twitter" className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            id="twitter"
            checked={socials.twitter}
            onCheckedChange={(checked) => setSocial('twitter', checked === true)}
            className="border-[#323542] data-[state=checked]:bg-success data-[state=checked]:border-success"
          />
          <span className="text-xs text-textPrimary font-normal">Twitter</span>
        </label>

        <label htmlFor="website" className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            id="website"
            checked={socials.website}
            onCheckedChange={(checked) => setSocial('website', checked === true)}
            className="border-[#323542] data-[state=checked]:bg-success data-[state=checked]:border-success"
          />
          <span className="text-xs text-textPrimary font-normal">Website</span>
        </label>

        <label htmlFor="telegram" className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            id="telegram"
            checked={socials.telegram}
            onCheckedChange={(checked) => setSocial('telegram', checked === true)}
            className="border-[#323542] data-[state=checked]:bg-success data-[state=checked]:border-success"
          />
          <span className="text-xs text-textPrimary font-normal">Telegram</span>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4 px-4">
        <label htmlFor="at-least-one-social" className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            id="at-least-one-social"
            checked={socials.atLeastOneSocial}
            onCheckedChange={(checked) => setSocial('atLeastOneSocial', checked === true)}
            className="border-[#323542] data-[state=checked]:bg-success data-[state=checked]:border-success"
          />
          <span className="text-xs text-textPrimary font-normal">At Least One Social</span>
        </label>
      </div>
    </div>
  );
};
