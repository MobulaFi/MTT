import { RangeValue, RangeValueWithUnit } from "@/features/pulse/store/usePulseModalFilterStore";
import { useCallback, useMemo, useState } from "react";

interface RangeInputProps {
    label?: string;
    value: RangeValue | RangeValueWithUnit;
    onChange: (value: RangeValue | RangeValueWithUnit) => void;
    unit?: string | null;
    showUnit?: boolean;
  }


  const convertToTimestamp = (value: string, unit: string): number => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0) return 0;
  
    const conversions: Record<string, number> = {
      S: 1, // 1 second
      Min: 60, // 1 minute in seconds
      H: 3600, // 1 hour in seconds
      D: 86400, // 1 day in seconds
      W: 604800, // 1 week in seconds
      M: 2592000, // 1 month (30 days) in seconds
      Y: 31536000, // 1 year in seconds
    };
  
    return num * (conversions[unit] || 0);
  };
  
  // Format timestamp to display (e.g., 3600 -> "1H")
  const formatTimestampDisplay = (timestamp: number): string => {
    if (timestamp === 0) return '-';
  
    const conversions: Array<[string, number]> = [
      ['Y', 31536000],
      ['M', 2592000],
      ['W', 604800],
      ['D', 86400],
      ['H', 3600],
      ['Min', 60],
      ['S', 1],
    ];
  
    for (const [unit, seconds] of conversions) {
      if (timestamp % seconds === 0) {
        return `${timestamp / seconds}${unit}`;
      }
    }
  
    return `${timestamp}s`;
  };

  
  const TIME_UNITS = ['S', 'Min', 'H', 'D', 'W', 'M', 'Y'] as const;
  

export const RangeInput: React.FC<RangeInputProps> = ({
    label,
    value,
    onChange,
    unit = null,
    showUnit = false,
  }) => {
    const [openSelect, setOpenSelect] = useState(false);
  
    const handleSelectChange = useCallback((newUnit: string) => {
      onChange({ ...value, unit: newUnit });
      setOpenSelect(false);
    }, [value, onChange]);
  
    const minTimestamp = useMemo(
      () => showUnit && (value as RangeValueWithUnit).min
        ? convertToTimestamp((value as RangeValueWithUnit).min, (value as RangeValueWithUnit).unit)
        : 0,
      [value, showUnit]
    );
  
    const maxTimestamp = useMemo(
      () => showUnit && (value as RangeValueWithUnit).max
        ? convertToTimestamp((value as RangeValueWithUnit).max, (value as RangeValueWithUnit).unit)
        : 0,
      [value, showUnit]
    );
  
    return (
      <div className="space-y-2 px-4">
        {label && <label className="text-[10px] font-normal text-white block">{label}</label>}
  
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Min"
            value={value.min}
            onChange={(e) => {
              const val = e.target.value;
              if (/^\d*$/.test(val)) onChange({ ...value, min: val });
            }}
            className="flex-1 bg-bgOverlay border border-borderDefault rounded px-2 py-1.5 text-xs text-white placeholder-textTertiary focus:outline-none focus:ring-1 focus:ring-success transition-colors"
          />
  
          {showUnit && unit && 'unit' in value && (
            <div className="relative">
              <button
                onClick={() => setOpenSelect(!openSelect)}
                onBlur={(e) => {
                  // Don't close if clicking inside the dropdown
                  if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
                    setTimeout(() => setOpenSelect(false), 150);
                  }
                }}
                className="bg-bgOverlay border border-borderDefault rounded px-2 py-1.5 text-xs font-normal text-white cursor-pointer hover:border-borderDefault hover:bg-bgContainer/20 transition-colors min-w-[50px] text-center"
              >
                {(value as RangeValueWithUnit).unit}
              </button>
  
              {openSelect && (
                <>
                  {/* Backdrop to close on click outside */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setOpenSelect(false)}
                  />

                  {/* Dropdown Menu */}
                  <div className="absolute top-full mt-1 bg-bgOverlay border border-borderDefault rounded shadow-lg z-50 min-w-[60px] overflow-hidden">
                    {TIME_UNITS.map((opt) => (
                      <button
                        key={opt}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectChange(opt);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-normal transition-colors ${(value as RangeValueWithUnit).unit === opt
                          ? 'bg-success/20 text-success font-semibold'
                          : 'text-textPrimary hover:bg-bgContainer/30 hover:text-textPrimary'
                          }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
  
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Max"
            value={value.max}
            onChange={(e) => {
              const val = e.target.value;
              if (/^\d*$/.test(val)) onChange({ ...value, max: val });
            }}
            className="flex-1 bg-bgOverlay border border-borderDefault rounded px-2 py-1.5 text-xs text-white placeholder-textTertiary focus:outline-none focus:ring-1 focus:ring-success transition-colors"
          />
        </div>
  
        {/* Display Timestamp Range */}
        {showUnit && unit && 'unit' in value && ((value as RangeValueWithUnit).min || (value as RangeValueWithUnit).max) && (
          <div className="text-xs text-textTertiary px-1 flex items-center justify-between">
            <span>Timestamp:</span>
            <span className="text-success font-semibold">
              {formatTimestampDisplay(minTimestamp)} → {formatTimestampDisplay(maxTimestamp)}
            </span>
          </div>
        )}
      </div>
    );
  };