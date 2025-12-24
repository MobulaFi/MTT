'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { X, Loader, RotateCcw } from 'lucide-react';
import { usePulseFilterStore, Section } from '@/features/pulse/store/usePulseModalFilterStore';
import { SocialsTab } from './SocialTabs';
import { MetricsTab } from './MetricsTab';
import { AuditsTab } from './AuditsTab';
import { ProtocolSelector } from './ProtocolSelector';
import { ChainDropdown } from './ChainDropDown';
import { useChainsAndProtocols } from '@/features/pulse/hooks/useChainsAndProtocols';
import { usePulseDataStore, ViewName } from '@/features/pulse/store/usePulseDataStore';
import { usePulseStreamContext } from '@/features/pulse/context/PulseStreamContext';

interface TabItem {
  id: string;
  label: string;
  count?: number;
}

interface TypeTab {
  id: Section;
  label: string;
}

interface TabContentProps {
  tab: string;
  section: Section;
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSection?: string;
}

const TabContent: React.FC<TabContentProps> = ({ tab, section }) => {
  switch (tab) {
    case 'audits':
      return <AuditsTab section={section} />;
    case 'metrics':
      return <MetricsTab section={section} />;
    case 'socials':
      return <SocialsTab section={section} />;
    default:
      return null;
  }
};

const getTypeFromSection = (section: string): Section => {
  if (section === 'Final Stretch') return 'final-stretch';
  if (section === 'Migrated') return 'migrated';
  return 'new-pairs';
};

/**
 * FilterModal - Enhanced
 *
 * Enhancements:
 * - Apply loader with visual feedback
 * - Complete token clearing before showing new data
 * - Better state management during apply
 * - Clear indication of apply progress
 */
const MOBILE_BREAKPOINT = 1024;

const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  activeSection = 'New Pairs',
}) => {
  const [activeTab, setActiveTab] = useState<string>('audits');
  const [isApplying, setIsApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [activeFilterSection, setActiveFilterSection] = useState<string>(activeSection);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const applyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clearTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const activeType = getTypeFromSection(activeFilterSection) as Section;

  const {
    sections,
    setSection,
    resetSection,
    applyFilters: storeApplyFilters,
    resetFilters: storeResetFilters,
  } = usePulseFilterStore();

  const { applyFilters: hookApplyFilters, resetFilters: hookResetFilters } = usePulseStreamContext();

  // NEW: Get pulse data store for clearing tokens
  const pulseDataStore = usePulseDataStore();

  const current = sections[activeType];
  const { chains, chainProtocolMap, loading: metadataLoading } = useChainsAndProtocols(activeType);

  const sanitizeProtocols = useCallback(
    (chainIds: string[]) => {
      const validProtocolIds = new Set(
        chainIds.flatMap((id) => (chainProtocolMap[id] || []).map((protocol) => protocol.id))
      );
      if (current.protocols.some((protocolId) => !validProtocolIds.has(protocolId))) {
        setSection(
          activeType,
          'protocols',
          current.protocols.filter((protocolId) => validProtocolIds.has(protocolId))
        );
      }
    },
    [chainProtocolMap, current.protocols, activeType, setSection]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !contentRef.current?.contains(e.target as Node)) {
        if (modalRef.current.contains(e.target as Node)) onClose();
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    return () => {
      if (applyTimeoutRef.current) clearTimeout(applyTimeoutRef.current);
      if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const updateViewport = () => {
      setIsMobileViewport(window.innerWidth < MOBILE_BREAKPOINT);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const handleTypeChange = useCallback((newType: Section) => {
    const sectionLabels: Record<Section, string> = {
      'new-pairs': 'New Pairs',
      'final-stretch': 'Final Stretch',
      'migrated': 'Migrated',
    };
    setActiveFilterSection(sectionLabels[newType]);
    setActiveTab('audits');
  }, []);

  /**
   * handleApplyAll - Apply selected filters and update subscription
   *
   * Enhanced Flow:
   * 1. Show loading state
   * 2. CLEAR existing tokens immediately
   * 3. Call storeApplyFilters() - increments appliedFiltersTrigger in store
   * 4. Call hookApplyFilters() - pauses/resumes UI and updates payload
   * 5. Show success, auto-close
   *
   * This ensures users see that the filters are being applied
   * and old data is cleared
   */
  const handleApplyAll = useCallback(() => {
    if (isApplying) return;
    setIsApplying(true);
    setApplySuccess(false);

    if (applyTimeoutRef.current) clearTimeout(applyTimeoutRef.current);
    if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);

    // NEW: Map section types to view names
    const getViewName = (section: Section): ViewName => {
      if (section === 'new-pairs') return 'new';
      if (section === 'final-stretch') return 'bonding';
      if (section === 'migrated') return 'bonded';
      return 'new';
    };

    const viewName = getViewName(activeType);

    // STEP 1: Immediately show loading and clear old tokens
    pulseDataStore.setLoading(viewName, true);

    // Clear existing tokens immediately so user sees empty state
    clearTimeoutRef.current = setTimeout(() => {
      pulseDataStore.clearView(viewName);
    }, 100);

    // STEP 2: After clearing, apply filters
    applyTimeoutRef.current = setTimeout(() => {

      // Apply in store (persists to localStorage)
      storeApplyFilters();

      // Trigger hook pause/resume (this fetches new data)
      hookApplyFilters();

      // Show success feedback
      setApplySuccess(true);
      setIsApplying(false);

      // Auto-close after success
      applyTimeoutRef.current = setTimeout(() => {
        setApplySuccess(false);
        onClose();
      }, 500);
    }, 300);
  }, [isApplying, activeType, storeApplyFilters, hookApplyFilters, onClose, pulseDataStore]);

  /**
   * handleResetTab - Reset filters for the active tab only
   *
   * Flow:
   * 1. Reset the specific tab (audits, metrics, or socials) to defaults
   * 2. Update the section state
   */
  const handleResetTab = useCallback((tab: string) => {

    if (tab === 'audits') {
      setSection(activeType, 'audits', {
        dexPaid: false,
        caEndsInPump: false,
        age: { min: '', max: '', unit: 'H' },
        top10HoldersPercent: { min: '', max: '' },
        devHoldingPercent: { min: '', max: '' },
        snipersPercent: { min: '', max: '' },
        insidersPercent: { min: '', max: '' },
        bundlePercent: { min: '', max: '' },
        holders: { min: '', max: '' },
        proTraders: { min: '', max: '' },
        devMigration: { min: '', max: '' },
        devPairsCreated: { min: '', max: '' },
      });
    } else if (tab === 'metrics') {
      setSection(activeType, 'metrics', {
        liquidity: { min: '', max: '' },
        volume: { min: '', max: '' },
        marketCap: { min: '', max: '' },
        bCurvePercent: { min: '', max: '' },
        globalFeesPaid: { min: '', max: '' },
        txns: { min: '', max: '' },
        numBuys: { min: '', max: '' },
        numSells: { min: '', max: '' },
      });
    } else if (tab === 'socials') {
      setSection(activeType, 'socials', {
        twitterReuses: { min: '', max: '' },
        tweetAge: { min: '', max: '', unit: 'D' },
        twitter: false,
        website: false,
        telegram: false,
        atLeastOneSocial: false,
        onlyPumpLive: false,
      });
    }
  }, [activeType, setSection]);

  /**
   * handleReset - Reset all filters and update subscription
   *
   * Flow:
   * 1. Call storeResetFilters() - resets all sections in store
   * 2. Call hookResetFilters() - pauses/resumes and updates payload with defaults
   * 3. Close modal
   */
  const handleReset = useCallback(() => {
    storeResetFilters();
    hookResetFilters();
    onClose();
  }, [storeResetFilters, hookResetFilters, onClose]);

  const typeTabsData: TypeTab[] = useMemo(
    () => [
      { id: 'new-pairs', label: 'New Pairs' },
      { id: 'final-stretch', label: 'Final Stretch' },
      { id: 'migrated', label: 'Migrated' },
    ],
    []
  );

  const auditsCount = useMemo(() => {
    const a = current.audits;
    return [
      a.dexPaid,
      a.caEndsInPump,
      a.age.min || a.age.max,
      a.top10HoldersPercent.min || a.top10HoldersPercent.max,
      a.devHoldingPercent.min || a.devHoldingPercent.max,
      a.snipersPercent.min || a.snipersPercent.max,
      a.insidersPercent.min || a.insidersPercent.max,
      a.bundlePercent.min || a.bundlePercent.max,
      a.holders.min || a.holders.max,
      a.proTraders.min || a.proTraders.max,
      a.devMigration.min || a.devMigration.max,
      a.devPairsCreated.min || a.devPairsCreated.max,
    ].filter(Boolean).length;
  }, [current.audits]);

  const metricsCount = useMemo(() => {
    const m = current.metrics;
    return [
      m.liquidity.min || m.liquidity.max,
      m.volume.min || m.volume.max,
      m.marketCap.min || m.marketCap.max,
      m.bCurvePercent.min || m.bCurvePercent.max,
      m.globalFeesPaid.min || m.globalFeesPaid.max,
      m.txns.min || m.txns.max,
      m.numBuys.min || m.numBuys.max,
      m.numSells.min || m.numSells.max,
    ].filter(Boolean).length;
  }, [current.metrics]);

  const socialsCount = useMemo(() => {
    const s = current.socials;
    return [
      s.twitterReuses.min || s.twitterReuses.max,
      s.tweetAge.min || s.tweetAge.max,
      s.twitter,
      s.website,
      s.telegram,
      s.atLeastOneSocial,
      s.onlyPumpLive,
    ].filter(Boolean).length;
  }, [current.socials]);

  const filterTabsData: TabItem[] = useMemo(
    () => [
      { id: 'audits', label: 'Audits', count: auditsCount },
      { id: 'metrics', label: 'Metrics', count: metricsCount },
      { id: 'socials', label: 'Socials', count: socialsCount },
    ],
    [auditsCount, metricsCount, socialsCount]
  );

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className={`fixed inset-0 bg-black/80 flex ${isMobileViewport ? 'items-start' : 'items-center'
        } justify-center p-4 sm:p-6 z-50`}
    >
      <div
        ref={contentRef}
        className={`bg-bgPrimary border border-borderDefault w-full flex flex-col overflow-hidden ${isMobileViewport
            ? 'h-full max-h-none rounded-none'
            : 'max-w-lg max-h-[85vh] rounded-md'
          }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between py-3 px-4 border-b border-borderDefault flex-shrink-0">
          <h2 className="text-base font-semibold text-textPrimary">Filters</h2>
          <button
            onClick={onClose}
            className="text-textTertiary hover:text-textPrimary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Type Tabs */}
        <div className="border-b bg-bgOverlay border-borderDefault flex-shrink-0">
          <div className="flex items-center">
            {typeTabsData.map((t) => (
              <button
                key={t.id}
                onClick={() => handleTypeChange(t.id)}
                className={`flex-1 text-xs font-medium pt-4 pb-2 border-b-2 transition-colors duration-200 text-center ${activeType === t.id
                    ? 'text-textPrimary border-[#D9D9D9]'
                    : 'text-textPrimary/60 border-transparent hover:text-textTertiary'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-borderDefault scrollbar-track-bgOverlay">
          <div className="bg-bgPrimary">
            {/* Networks & Protocols */}
            <div className="border-y border-borderDefault py-3">
              <h3 className="text-sm px-4 font-semibold text-textPrimary mb-3">
                Networks & Protocols
              </h3>
              <div className="px-4 flex items-start justify-between gap-3 mb-3">
                <div className="flex-1" style={{ maxWidth: '70%' }}>
                  <ProtocolSelector
                    selectedProtocols={current.protocols}
                    onChange={(p) => {
                      setSection(activeType, 'protocols', p);
                    }}
                    availableProtocols={
                      current.chainIds.length > 0
                        ? current.chainIds.flatMap((id) => chainProtocolMap[id] || [])
                        : []
                    }
                  />
                </div>
                <div className="flex-shrink-0" style={{ width: '30%', minWidth: '120px' }}>
                  <ChainDropdown
                    selectedChains={current.chainIds}
                    chains={chains}
                    loading={metadataLoading}
                    onChainSelect={(chainId) => {
                      const newChains = current.chainIds.includes(chainId)
                        ? current.chainIds.filter((c) => c !== chainId)
                        : [...current.chainIds, chainId];
                      const sanitizedChains = newChains.length > 0 ? newChains : ['solana:solana'];
                      setSection(activeType, 'chainIds', sanitizedChains);
                      sanitizeProtocols(sanitizedChains);
                    }}
                  />
                </div>
              </div>

              {current.chainIds.length > 0 && (
                <div className="px-4 flex flex-wrap gap-2">
                  {current.chainIds.map((chainId) => {
                    const chain = chains.find((c) => c.id === chainId);
                    return (
                      <button
                        key={chainId}
                        onClick={() => {
                          const newChains = current.chainIds.filter((c) => c !== chainId);
                          const sanitizedChains = newChains.length > 0 ? newChains : ['solana:solana'];
                          setSection(activeType, 'chainIds', sanitizedChains);
                          sanitizeProtocols(sanitizedChains);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 font-geist text-[11px] font-semibold whitespace-nowrap transition-all duration-200 border bg-success/10 border-success/40 text-success hover:bg-success/20 hover:border-success/60"
                      >
                        <span>{chain?.name}</span>
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Keywords */}
            <div className="border-b border-borderDefault py-3">
              <h3 className="text-sm px-4 font-semibold text-white pb-3">Search Keywords</h3>
              <div className="grid grid-cols-2 gap-4 px-4">
                <div>
                  <label className="text-xs font-normal text-textTertiary mb-1 block">
                    Include (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="keywords1,keywords2"
                    value={current.includeKeywords}
                    onChange={(e) => {
                      setSection(activeType, 'includeKeywords', e.target.value);
                    }}
                    className="w-full bg-bgOverlay border border-borderDefault rounded-md px-3 py-2 text-sm text-textPrimary placeholder:text-xs placeholder:text-textTertiary focus:outline-none focus:ring-1 focus:ring-green-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-normal text-textTertiary mb-1 block">
                    Exclude (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="keywords1,keywords2"
                    value={current.excludeKeywords}
                    onChange={(e) => {
                      setSection(activeType, 'excludeKeywords', e.target.value);
                    }}
                    className="w-full bg-bgOverlay border border-borderDefault rounded-md px-3 py-2 text-sm text-textPrimary placeholder:text-xs placeholder:text-textTertiary focus:outline-none focus:ring-1 focus:ring-green-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sub Tabs */}
          <div className="sticky top-0 bg-bgPrimary z-10">
            <div className="flex items-center border-b border-borderDefault pt-2 px-4">
              {filterTabsData.map((tab) => (
                <div key={tab.id} className="flex-1 flex items-center justify-center gap-1">
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 text-sm px-4 font-medium flex items-center justify-center gap-2 border-b-2 pb-1.5 transition-colors duration-200 ${activeTab === tab.id
                        ? 'text-textPrimary border-[#D9D9D9] medium'
                        : 'text-textPrimary/60 font-normal border-transparent hover:text-textTertiary'
                      }`}
                  >
                    {tab.label}
                    {tab.count! > 0 && (
                      <span className="bg-success text-white text-[11px] font-bold rounded-sm size-4 flex items-center justify-center">
                        {tab.count}
                      </span>
                    )}
                    {activeTab === tab.id && tab.count! > 0 && (
                      <button
                        onClick={() => handleResetTab(tab.id)}
                        className="text-textTertiary hover:text-textPrimary transition-colors p-1"
                        title={`Reset ${tab.label} filters`}
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </button>

                </div>
              ))}
            </div>
            <div className="py-4 pt-3 min-h-[380px]">
              <TabContent tab={activeTab} section={activeType} />
            </div>
          </div>
        </div>

        {/* Footer with Enhanced Apply Feedback */}
        <div className="flex justify-end gap-3 p-4 border-t border-borderDefault bg-bgPrimary flex-shrink-0">
          <button
            onClick={handleReset}
            disabled={isApplying}
            className="px-2 py-1 rounded border text-sm font-medium bg-bgContainer/5 border-borderDarkSlateGray text-grayCool hover:border-borderDefault hover:text-textPrimary transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset
          </button>

          {/* Enhanced Apply Button with Loader */}
          <button
            onClick={handleApplyAll}
            disabled={isApplying}
            className={`px-2 py-1 rounded text-sm font-medium transition-all duration-200 flex items-center gap-2 ${applySuccess
                ? 'bg-success/20 border border-success text-success'
                : isApplying
                  ? 'bg-success/10 border border-success/40 text-success opacity-100 cursor-not-allowed'
                  : 'bg-success/10 border border-success/40 text-success hover:bg-success/20'
              }`}
          >
            {applySuccess ? (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Applied
              </>
            ) : isApplying ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Applying...
              </>
            ) : (
              'Apply All'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterModal;