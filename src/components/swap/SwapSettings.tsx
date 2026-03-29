'use client';

import { useSwapPageStore } from '@/store/useSwapPageStore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Settings } from 'lucide-react';

export function SwapSettings() {
  const { slippage, setSlippage, isSettingsOpen, setSettingsOpen } = useSwapPageStore();

  const presets = [0.5, 1, 2, 5];

  return (
    <Popover open={isSettingsOpen} onOpenChange={setSettingsOpen}>
      <PopoverTrigger asChild>
        <button
          className="p-2 rounded-lg text-textTertiary hover:text-textPrimary hover:bg-bgTertiary transition-colors"
          aria-label="Swap settings"
        >
          <Settings size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[300px] bg-bgSecondary border border-borderDefault rounded-xl p-4 shadow-2xl"
      >
        <h3 className="text-sm font-bold text-textPrimary mb-4">Settings</h3>

        {/* Slippage */}
        <div>
          <label className="text-[11px] text-textTertiary uppercase tracking-wider mb-2.5 block font-medium">
            Slippage tolerance
          </label>
          <div className="flex gap-1.5">
            {presets.map((value) => (
              <button
                key={value}
                onClick={() => setSlippage(value)}
                className={`flex-1 px-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                  slippage === value
                    ? 'bg-success/15 text-success border border-success/30'
                    : 'bg-bgPrimary text-textSecondary hover:bg-bgTertiary hover:text-textPrimary border border-borderDefault/50'
                }`}
              >
                {value}%
              </button>
            ))}
          </div>

          {/* Custom Input */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] text-textTertiary">Custom</span>
            <div className="flex items-center bg-bgPrimary rounded-lg border border-borderDefault px-3 py-1.5 flex-1">
              <input
                type="number"
                value={slippage}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v >= 0 && v <= 50) setSlippage(v);
                }}
                step="0.1"
                min="0"
                max="50"
                className="flex-1 bg-transparent text-xs text-textPrimary outline-none text-right"
              />
              <span className="text-xs text-textTertiary ml-1">%</span>
            </div>
          </div>

          {slippage > 5 && (
            <div className="mt-2.5 px-2.5 py-2 bg-warning/10 border border-warning/20 rounded-lg">
              <p className="text-[10px] text-warning font-medium">
                High slippage. Your trade may be frontrun.
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
