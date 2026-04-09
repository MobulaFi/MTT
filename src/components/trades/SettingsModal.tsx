import React, { useMemo } from 'react';
import { useTradingPanelStore } from '@/store/useTradingPanelStore';
import { useTradingDataStore } from '@/store/useTradingDataStore';
import { usePathname } from 'next/navigation';
import { extractChainFromPath } from '@/hooks/useAutoSwitchNetwork';
import { X, Info } from 'lucide-react';
import type { PriorityFeePreset } from '@/store/useTradingPanelStore';

const PRIORITY_FEE_PRESETS: { value: PriorityFeePreset; label: string; description: string }[] = [
  { value: 'auto', label: 'Auto', description: 'Automatically set based on network conditions' },
  { value: 'low', label: 'Low', description: 'Lower priority, may take longer' },
  { value: 'medium', label: 'Medium', description: 'Balanced speed and cost' },
  { value: 'high', label: 'High', description: 'Faster confirmation' },
  { value: 'veryHigh', label: 'Very High', description: 'Maximum priority' },
  { value: 'custom', label: 'Custom', description: 'Set your own value' },
];

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    setSettingsOpen,
    slippage,
    setSlippage,
    prequote,
    setPrequote,
    solanaSwapSettings,
    setSolanaSwapSettings,
  } = useTradingPanelStore();

  const pathname = usePathname();
  
  const isSolanaChain = useMemo(() => {
    const chain = pathname ? extractChainFromPath(pathname) : null;
    return chain?.startsWith('solana:') || false;
  }, [pathname]);

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

        {isSolanaChain && (
          <>
            <div className="border-t border-borderDefault my-6 pt-6">
              <h3 className="text-textPrimary text-sm font-semibold mb-4 flex items-center gap-2">
                Solana Settings
                <Info size={14} className="text-grayGhost" />
              </h3>

              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-textPrimary text-sm">Custom Transaction Mode</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSolanaSwapSettings({ useInstructionsMode: false })}
                      className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                        !solanaSwapSettings.useInstructionsMode
                          ? 'bg-bgContainer text-textPrimary'
                          : 'bg-bgTertiary text-grayGhost hover:text-textPrimary'
                      }`}
                    >
                      Off
                    </button>
                    <button
                      onClick={() => setSolanaSwapSettings({ useInstructionsMode: true })}
                      className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                        solanaSwapSettings.useInstructionsMode
                          ? 'bg-bgContainer text-textPrimary'
                          : 'bg-bgTertiary text-grayGhost hover:text-textPrimary'
                      }`}
                    >
                      On
                    </button>
                  </div>
                </div>
                <p className="text-grayGhost text-xs mt-2">
                  Use instructions mode for custom transaction building with Jito tips and priority fees.
                </p>
              </div>

              <div className="mb-6">
                <label className="text-textPrimary text-sm block mb-3">Priority Fee</label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {PRIORITY_FEE_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setSolanaSwapSettings({ priorityFeePreset: preset.value })}
                      className={`px-3 py-2 rounded text-xs font-medium transition-colors ${
                        solanaSwapSettings.priorityFeePreset === preset.value
                          ? 'bg-success/20 text-success border border-success'
                          : 'bg-bgTertiary text-grayGhost hover:text-textPrimary border border-transparent'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {solanaSwapSettings.priorityFeePreset === 'custom' && (
                  <div className="mt-3">
                    <label className="text-grayGhost text-xs block mb-2">Custom Priority Fee (microLamports/CU)</label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={solanaSwapSettings.priorityFeeCustom}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value) && value >= 0) {
                          setSolanaSwapSettings({ priorityFeeCustom: value });
                        }
                      }}
                      className="w-full bg-bgTertiary border border-borderDefault rounded px-3 py-2 text-textPrimary text-sm focus:outline-none focus:border-success"
                      placeholder="100000"
                    />
                  </div>
                )}
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-textPrimary text-sm">Jito MEV Protection</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSolanaSwapSettings({ jitoEnabled: false })}
                      className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                        !solanaSwapSettings.jitoEnabled
                          ? 'bg-bgContainer text-textPrimary'
                          : 'bg-bgTertiary text-grayGhost hover:text-textPrimary'
                      }`}
                    >
                      Off
                    </button>
                    <button
                      onClick={() => setSolanaSwapSettings({ jitoEnabled: true })}
                      className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                        solanaSwapSettings.jitoEnabled
                          ? 'bg-bgContainer text-textPrimary'
                          : 'bg-bgTertiary text-grayGhost hover:text-textPrimary'
                      }`}
                    >
                      On
                    </button>
                  </div>
                </div>
                {solanaSwapSettings.jitoEnabled && (
                  <div className="mt-3">
                    <label className="text-grayGhost text-xs block mb-2">Jito Tip (lamports)</label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={solanaSwapSettings.jitoTipLamports}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value) && value >= 0) {
                          setSolanaSwapSettings({ jitoTipLamports: value });
                        }
                      }}
                      className="w-full bg-bgTertiary border border-borderDefault rounded px-3 py-2 text-textPrimary text-sm focus:outline-none focus:border-success"
                      placeholder="10000"
                    />
                    <p className="text-grayGhost text-xs mt-2">
                      Tip amount in lamports (1 SOL = 1,000,000,000 lamports). Current: {(solanaSwapSettings.jitoTipLamports / 1_000_000_000).toFixed(9)} SOL
                    </p>
                  </div>
                )}
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-textPrimary text-sm">Compute Unit Limit</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSolanaSwapSettings({ computeUnitLimitAuto: true })}
                      className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                        solanaSwapSettings.computeUnitLimitAuto
                          ? 'bg-bgContainer text-textPrimary'
                          : 'bg-bgTertiary text-grayGhost hover:text-textPrimary'
                      }`}
                    >
                      Auto
                    </button>
                    <button
                      onClick={() => setSolanaSwapSettings({ computeUnitLimitAuto: false })}
                      className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                        !solanaSwapSettings.computeUnitLimitAuto
                          ? 'bg-bgContainer text-textPrimary'
                          : 'bg-bgTertiary text-grayGhost hover:text-textPrimary'
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                </div>
                {!solanaSwapSettings.computeUnitLimitAuto && (
                  <div className="mt-3">
                    <input
                      type="number"
                      min="0"
                      step="10000"
                      value={solanaSwapSettings.computeUnitLimit}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value) && value >= 0) {
                          setSolanaSwapSettings({ computeUnitLimit: value });
                        }
                      }}
                      className="w-full bg-bgTertiary border border-borderDefault rounded px-3 py-2 text-textPrimary text-sm focus:outline-none focus:border-success"
                      placeholder="400000"
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}

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
