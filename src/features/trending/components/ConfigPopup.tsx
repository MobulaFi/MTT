'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2 } from 'lucide-react';
import { useTrendingStore, type FilterConfig, type PresetModel } from '../store/useTrendingStore';

const PRESET_MODELS: { value: PresetModel; label: string; description: string }[] = [
  { value: 'trending', label: 'Trending', description: 'Sorted by fees paid (5m)' },
  { value: 'surge', label: 'Surge', description: 'Sorted by surge score' },
  { value: 'new', label: 'New', description: 'Newest tokens' },
  { value: 'bonding', label: 'Bonding', description: 'On bonding curve' },
  { value: 'bonded', label: 'Bonded', description: 'Migrated tokens' },
  { value: 'topGainers', label: 'Top Gainers', description: 'Highest 6h gainers' },
  { value: 'explorer', label: 'Explorer', description: 'Broad exploration' },
];

const SORTABLE_FIELDS: { value: string; label: string }[] = [
  { value: '', label: 'Default (use model preset)' },
  { value: 'volume1hUSD', label: 'Volume (1h)' },
  { value: 'volume24hUSD', label: 'Volume (24h)' },
  { value: 'marketCapUSD', label: 'Market Cap' },
  { value: 'priceChangePercentage1h', label: 'Price Change (1h)' },
  { value: 'priceChangePercentage24h', label: 'Price Change (24h)' },
  { value: 'priceChangePercentage6h', label: 'Price Change (6h)' },
  { value: 'liquidityUSD', label: 'Liquidity' },
  { value: 'holdersCount', label: 'Holders' },
  { value: 'trades1h', label: 'Trades (1h)' },
  { value: 'trades24h', label: 'Trades (24h)' },
  { value: 'traders1h', label: 'Traders (1h)' },
  { value: 'traders24h', label: 'Traders (24h)' },
  { value: 'feesPaid1hUSD', label: 'Fees Paid (1h)' },
  { value: 'feesPaid24hUSD', label: 'Fees Paid (24h)' },
  { value: 'createdAt', label: 'Created At' },
  { value: 'bondingPercentage', label: 'Bonding %' },
  { value: 'surgeScore', label: 'Surge Score' },
];

const FILTER_FIELDS: { value: string; label: string }[] = [
  { value: 'volume1hUSD', label: 'Volume (1h)' },
  { value: 'volume24hUSD', label: 'Volume (24h)' },
  { value: 'marketCapUSD', label: 'Market Cap' },
  { value: 'liquidityUSD', label: 'Liquidity' },
  { value: 'holdersCount', label: 'Holders' },
  { value: 'trades1h', label: 'Trades (1h)' },
  { value: 'trades24h', label: 'Trades (24h)' },
  { value: 'traders1h', label: 'Traders (1h)' },
  { value: 'traders24h', label: 'Traders (24h)' },
  { value: 'priceUSD', label: 'Price' },
  { value: 'priceChangePercentage1h', label: 'Price Change (1h)' },
  { value: 'priceChangePercentage24h', label: 'Price Change (24h)' },
  { value: 'bondingPercentage', label: 'Bonding %' },
  { value: 'feesPaid1hUSD', label: 'Fees Paid (1h)' },
  { value: 'top10HoldingsPercentage', label: 'Top 10 Holdings %' },
  { value: 'devHoldingsPercentage', label: 'Dev Holdings %' },
  { value: 'insidersHoldingsPercentage', label: 'Insiders Holdings %' },
];

export default function ConfigPopup() {
  const configOpen = useTrendingStore((s) => s.configOpen);
  const storeModel = useTrendingStore((s) => s.model);
  const backendSortBy = useTrendingStore((s) => s.backendSortBy);
  const backendSortOrder = useTrendingStore((s) => s.backendSortOrder);
  const filters = useTrendingStore((s) => s.filters);

  const [localModel, setLocalModel] = useState<PresetModel>(storeModel);
  const [localSortBy, setLocalSortBy] = useState(backendSortBy);
  const [localSortOrder, setLocalSortOrder] = useState(backendSortOrder);
  const [localFilters, setLocalFilters] = useState<FilterConfig[]>(filters);

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (configOpen) {
      setLocalModel(storeModel);
      setLocalSortBy(backendSortBy);
      setLocalSortOrder(backendSortOrder);
      setLocalFilters([...filters]);
    }
  }, [configOpen, storeModel, backendSortBy, backendSortOrder, filters]);

  useEffect(() => {
    if (!configOpen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') useTrendingStore.getState().setConfigOpen(false); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [configOpen]);

  if (!configOpen) return null;

  const addFilter = () => {
    setLocalFilters([...localFilters, { field: FILTER_FIELDS[0].value }]);
  };

  const removeFilter = (idx: number) => {
    setLocalFilters(localFilters.filter((_, i) => i !== idx));
  };

  const updateFilter = (idx: number, updates: Partial<FilterConfig>) => {
    const updated = [...localFilters];
    updated[idx] = { ...updated[idx], ...updates };
    setLocalFilters(updated);
  };

  const handleApply = () => {
    const store = useTrendingStore.getState();
    store.setModel(localModel);
    store.setBackendSortBy(localSortBy);
    store.setBackendSortOrder(localSortOrder);
    store.setFilters(localFilters.filter(f => f.min !== undefined || f.max !== undefined));
    store.setConfigOpen(false);
  };

  const hasCustomSort = localSortBy !== '';
  const hasFilters = localFilters.length > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
      style={{ overflow: 'hidden' }}
      onClick={() => useTrendingStore.getState().setConfigOpen(false)}
    >
      <div
        ref={contentRef}
        onClick={e => e.stopPropagation()}
        className="bg-bgPrimary border border-borderDefault w-full max-w-lg rounded-md flex flex-col"
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between py-3 px-4 border-b border-borderDefault flex-shrink-0">
          <h2 className="text-base font-semibold text-textPrimary">Panel Configuration</h2>
          <button
            onClick={() => useTrendingStore.getState().setConfigOpen(false)}
            className="text-textTertiary hover:text-textPrimary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-borderDefault scrollbar-track-bgOverlay">
          {/* Model Selection */}
          <div className="py-4 px-4 border-b border-borderDefault">
            <label className="text-[10px] font-semibold text-textTertiary uppercase tracking-wider mb-2.5 block">
              Model
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {PRESET_MODELS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setLocalModel(preset.value)}
                  className={`px-2.5 py-2 rounded text-xs font-medium transition-all duration-200 text-center ${
                    localModel === preset.value
                      ? 'bg-success/15 border border-success/40 text-success'
                      : 'bg-bgOverlay border border-borderDefault text-textSecondary hover:bg-bgTertiary hover:text-textPrimary'
                  }`}
                >
                  <div className="font-semibold">{preset.label}</div>
                </button>
              ))}
            </div>
            <p className="text-[9px] text-textTertiary mt-2">
              Each model has its own default sort and filters. You can override them below.
            </p>
          </div>

          {/* Sort Override */}
          <div className="py-4 px-4 border-b border-borderDefault">
            <label className="text-[10px] font-semibold text-textTertiary uppercase tracking-wider mb-2 block">
              Sort Override
            </label>
            <div className="flex gap-2">
              <select
                value={localSortBy}
                onChange={e => setLocalSortBy(e.target.value)}
                className="flex-1 bg-bgOverlay border border-borderDefault rounded-md px-3 py-2 text-xs text-textPrimary focus:outline-none focus:ring-1 focus:ring-success/50"
              >
                {SORTABLE_FIELDS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              {hasCustomSort && (
                <select
                  value={localSortOrder}
                  onChange={e => setLocalSortOrder(e.target.value as 'asc' | 'desc')}
                  className="w-24 bg-bgOverlay border border-borderDefault rounded-md px-3 py-2 text-xs text-textPrimary focus:outline-none focus:ring-1 focus:ring-success/50"
                >
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              )}
            </div>
            <p className="text-[9px] text-textTertiary mt-1">
              Leave as "Default" to use the model's built-in sort. Column sorting in the table is separate (frontend-only).
            </p>
          </div>

          {/* Filters */}
          <div className="py-4 px-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-semibold text-textTertiary uppercase tracking-wider">
                Filters (Min / Max)
              </label>
              <button
                onClick={addFilter}
                className="flex items-center gap-1 text-[10px] text-success hover:text-success/80 transition-colors"
              >
                <Plus size={10} /> Add Filter
              </button>
            </div>

            {localFilters.length === 0 && (
              <p className="text-[10px] text-textTertiary py-2">No filters applied. Click &quot;Add Filter&quot; to set min/max constraints.</p>
            )}

            <div className="space-y-2">
              {localFilters.map((f, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={f.field}
                    onChange={e => updateFilter(idx, { field: e.target.value })}
                    className="flex-1 bg-bgOverlay border border-borderDefault rounded-md px-2 py-1.5 text-[11px] text-textPrimary focus:outline-none focus:ring-1 focus:ring-success/50"
                  >
                    {FILTER_FIELDS.map(ff => (
                      <option key={ff.value} value={ff.value}>{ff.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Min"
                    value={f.min ?? ''}
                    onChange={e => updateFilter(idx, { min: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-20 bg-bgOverlay border border-borderDefault rounded-md px-2 py-1.5 text-[11px] text-textPrimary focus:outline-none placeholder-textTertiary focus:ring-1 focus:ring-success/50"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={f.max ?? ''}
                    onChange={e => updateFilter(idx, { max: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-20 bg-bgOverlay border border-borderDefault rounded-md px-2 py-1.5 text-[11px] text-textPrimary focus:outline-none placeholder-textTertiary focus:ring-1 focus:ring-success/50"
                  />
                  <button
                    onClick={() => removeFilter(idx)}
                    className="text-error hover:text-error/70 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-borderDefault bg-bgPrimary flex-shrink-0">
          <button
            onClick={() => useTrendingStore.getState().setConfigOpen(false)}
            className="px-3 py-1.5 rounded text-xs font-medium bg-bgContainer/5 border border-borderDefault text-textTertiary hover:border-borderDefault hover:text-textPrimary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-3 py-1.5 rounded text-xs font-medium bg-success/10 border border-success/40 text-success hover:bg-success/20 transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
