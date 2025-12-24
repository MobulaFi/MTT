'use client';

import { useEffect, useRef } from 'react';
import { usePulseDisplayStore } from '@/features/pulse/store/usePulseDisplayStore';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DisplayModal({ isOpen, onClose }: DisplayModalProps) {
  const {
    metricSize,
    squareImages,
    compactTables,
    customizeRows,
    hideSearchBar,
    setMetricSize,
    setSquareImages,
    setCompactTables,
    setHideSearchBar,
    toggleCustomizeRow,
  } = usePulseDisplayStore();
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!modalRef.current) return;
      if (!modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const customizeOptions = [
    { id: 'marketCap', label: 'M.Cap' },
    { id: 'volume', label: 'Volume' },
    { id: 'tx', label: 'TX' },
    { id: 'fees', label: 'Fees' },
    { id: 'socials', label: 'Socials' },
    { id: 'holders', label: 'Holders' },
    { id: 'proTraders', label: 'Pro Traders' },
    { id: 'devMigrations', label: 'Dev Mig' },
    { id: 'top10Holdings', label: 'Top 10 Hold.' },
    { id: 'devHoldings', label: 'Dev Holding' },
    { id: 'snipersHoldings', label: 'Snipers' },
    { id: 'insidersHoldings', label: 'Insiders' },
    { id: 'bundlersHoldings', label: 'Bundlers' },
    { id: 'dexPaid', label: 'Dex Paid' },
  ];

  return (
    <>
      {/* Backdrop */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: need it */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Modal */}
      <div
        className="absolute top-full mt-2 w-80 rounded-3xl max-w-[90vw] bg-bgPrimary border-[1px] border-borderDefault shadow-xl z-50 p-4"
        style={{ right: 0 }}
        ref={modalRef}
      >
        {/* Metric Size */}
        <div className="mb-6 pb-2 border-borderDefault border-b">
          <h3 className="text-sm font-medium text-textTertiary mb-3">Metrics</h3>
          <div className="grid grid-cols-2 gap-2">
            {['small', 'large'].map((size) => (
              <button
                key={size}
                type="button"
                className={cn(
                  'p-3 rounded-lg cursor-pointer text-sm border-borderDefault border-[1px] font-medium transition-all duration-200',
                  metricSize === size
                    ? 'bg-success/10 border-success/40 text-success shadow-sm'
                    : 'bg-bgContainer/5 border-borderDarkSlateGray text-grayCool hover:border-borderDefault hover:text-textPrimary hover:bg-bgContainer/10',
                )}
                onClick={() => setMetricSize(size as 'small' | 'large')}
              >
                <div className="text-xs font-medium">MC 77K</div>
                <div className="capitalize">{size}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3 mb-6 pb-2 border-borderDefault border-b text-textPrimary">
          <button
            type="button"
            className="flex cursor-pointer items-center justify-between w-full text-left text-sm text-primary-white hover:text-primary-gray transition-colors"
            onClick={() => setSquareImages(!squareImages)}
          >
            <div className="flex items-center space-x-2">
              <span>{squareImages ? 'Square' : 'Circle'} Images</span>
            </div>
            <div
              className={cn(
                'w-4 h-4 rounded border transition-all duration-200',
                squareImages
                  ? 'bg-success/50 border-success/60 shadow-sm'
                  : 'border-borderDarkSlateGray bg-bgContainer/50'
              )}
            />
          </button>

          {/* Compact Tables Toggle */}
          <button
            type="button"
            className="flex cursor-pointer items-center justify-between w-full text-left text-sm text-primary-white hover:text-primary-gray transition-colors"
            onClick={() => setCompactTables(!compactTables)}
          >
            <div className="flex items-center space-x-2">
              <span>Compact Tables</span>
            </div>
            <div
              className={cn(
                'w-4 h-4 rounded border-[1px] transition-all duration-200',
                compactTables
                  ? 'bg-success/50 border-success/60 shadow-sm'
                  : 'border-borderDarkSlateGray bg-bgContainer/50'
              )}
            />
          </button>
          <button
            type="button"
            className="flex cursor-pointer items-center justify-between w-full text-left text-sm text-primary-white hover:text-primary-gray transition-colors"
            onClick={() => setHideSearchBar(!hideSearchBar)}
          >
            <div className="flex items-center space-x-2">
              <span>Hide Search Bar</span>
            </div>
            <div
              className={cn(
                'w-4 h-4 rounded border-[1px] transition-all duration-200',
                hideSearchBar
                  ? 'bg-success/50 border-success/60 shadow-sm'
                  : 'border-borderDarkSlateGray bg-bgContainer/50'
              )}
            />
          </button>
        </div>

        {/* Customize Rows */}
        <div>
          <h3 className="text-sm font-medium text-white mb-3">Customize Rows</h3>
          <div className="grid grid-cols-3 gap-2">
            {customizeOptions.map((option) => {
              const isActive = customizeRows[option.id as keyof typeof customizeRows];
              return (
                <TooltipProvider key={option.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'p-1 rounded cursor-pointer text-xs font-medium transition-all duration-200 border-[1px] h-8 flex items-center justify-center truncate',
                          isActive
                            ? 'bg-success/20 border-success/60 text-success shadow-sm'
                            : 'bg-bgContainer/30 border-borderDarkSlateGray text-textTertiary hover:border-borderDefault hover:bg-bgContainer/50 hover:text-textPrimary'
                        )}
                        onClick={() => toggleCustomizeRow(option.id)}
                      >
                        {option.label}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {option.label}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}