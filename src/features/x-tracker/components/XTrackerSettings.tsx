'use client';

import { memo, useState, useCallback } from 'react';
import { Settings2, Pencil, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useXTrackerStore } from '../store/useXTrackerStore';

function PresetEditor({
  presets,
  onSave,
}: {
  presets: number[];
  onSave: (presets: number[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(presets.join(', '));

  const handleSave = useCallback(() => {
    const parsed = draft
      .split(',')
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
    if (parsed.length > 0) {
      onSave(parsed);
    }
    setEditing(false);
  }, [draft, onSave]);

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="flex-1 bg-bgContainer border border-borderDefault rounded px-2 py-1 text-xs text-textPrimary outline-none focus:border-success"
          autoFocus
          placeholder="0.1, 0.5, 1, 5"
        />
        <button
          onClick={handleSave}
          className="p-1 text-success hover:bg-success/10 rounded transition"
        >
          <Check size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-1">
        {presets.map((p) => (
          <span
            key={p}
            className="px-1.5 py-0.5 bg-bgContainer rounded text-xs font-medium text-textSecondary"
          >
            {p}
          </span>
        ))}
      </div>
      <button
        onClick={() => {
          setDraft(presets.join(', '));
          setEditing(true);
        }}
        className="p-1 text-textTertiary hover:text-textPrimary transition"
      >
        <Pencil size={10} />
      </button>
    </div>
  );
}

function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-8 h-[18px] rounded-full transition-colors ${
        enabled ? 'bg-success' : 'bg-bgContainer'
      }`}
    >
      <div
        className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-[16px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
}

function XTrackerSettings() {
  const quickBuyEnabled = useXTrackerStore((s) => s.quickBuyEnabled);
  const quickBuyPresets = useXTrackerStore((s) => s.quickBuyPresets);
  const soundEnabled = useXTrackerStore((s) => s.soundEnabled);
  const setQuickBuyEnabled = useXTrackerStore((s) => s.setQuickBuyEnabled);
  const setQuickBuyPresets = useXTrackerStore((s) => s.setQuickBuyPresets);
  const setSoundEnabled = useXTrackerStore((s) => s.setSoundEnabled);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="p-1.5 hover:bg-bgTertiary rounded transition text-grayGhost hover:text-textPrimary"
          aria-label="Tracker Settings"
        >
          <Settings2 size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-[260px] border-borderDefault bg-bgPrimary shadow-2xl p-0 z-[200]"
      >
        {/* Quick Buy section */}
        <div className="px-3 pt-3 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-textTertiary mb-2">
            Quick Buy
          </p>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-textSecondary">Enabled</span>
            <Toggle enabled={quickBuyEnabled} onChange={setQuickBuyEnabled} />
          </div>
          {quickBuyEnabled && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-textSecondary">Presets (SOL)</span>
              </div>
              <PresetEditor presets={quickBuyPresets} onSave={setQuickBuyPresets} />
            </div>
          )}
        </div>

        {/* Notifications section */}
        <div className="px-3 pb-3 pt-2 border-t border-borderDefault/50">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-textTertiary mb-2">
            Alerts
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-textSecondary">Sound on token tweet</span>
            <Toggle enabled={soundEnabled} onChange={setSoundEnabled} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default memo(XTrackerSettings);
