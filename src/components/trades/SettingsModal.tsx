import React from 'react';
import { useTradingPanelStore } from '@/store/useTradingPanelStore';
import { X } from 'lucide-react';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    setSettingsOpen,
    slippage,
    setSlippage,
    prequote,
    setPrequote,
  } = useTradingPanelStore();

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSettingsOpen(false)}>
      <div className="bg-bgPrimary rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border border-borderDefault" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-textPrimary text-lg font-semibold">Settings</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="text-grayGhost hover:text-textPrimary transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Slippage */}
        <div className="mb-6">
          <label className="text-textPrimary text-sm block mb-3">Slippage Tolerance (%)</label>
          <input
            type="number"
            min="0.1"
            max="100"
            step="0.1"
            value={slippage}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (!isNaN(value) && value >= 0.1 && value <= 100) {
                setSlippage(value);
              }
            }}
            className="w-full bg-bgTertiary border border-borderDefault rounded px-3 py-2 text-textPrimary text-sm focus:outline-none focus:border-success"
            placeholder="1"
          />
        </div>

        {/* Prequote */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <label className="text-textPrimary text-sm">Show Quote Preview</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPrequote(false)}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                  !prequote
                    ? 'bg-bgContainer text-textPrimary'
                    : 'bg-bgTertiary text-grayGhost hover:text-textPrimary'
                }`}
              >
                Off
              </button>
              <button
                onClick={() => setPrequote(true)}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                  prequote
                    ? 'bg-bgContainer text-textPrimary'
                    : 'bg-bgTertiary text-grayGhost hover:text-textPrimary'
                }`}
              >
                On
              </button>
            </div>
          </div>
          <p className="text-grayGhost text-xs mt-2">
            When disabled, clicking buy will execute the swap immediately without showing the quote preview.
          </p>
        </div>

        {/* Confirm Button */}
        <button
          onClick={() => setSettingsOpen(false)}
          className="w-full bg-success hover:bg-success/90 text-white font-semibold py-3 rounded transition-colors"
        >
          Confirm
        </button>
      </div>
    </div>
  );
};
