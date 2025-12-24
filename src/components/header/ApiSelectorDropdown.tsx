'use client';
import { useState, useEffect, useRef } from 'react';
import { useApiStore } from '@/store/apiStore';
import { initMobulaClient } from '@/lib/mobulaClient';
import { FiServer, FiEdit2, FiPlus, FiX, FiRadio } from 'react-icons/fi';
import type { SubscriptionPayload } from '@mobula_labs/sdk';
import {
  DEFAULT_WSS_REGION,
  REST_ENDPOINTS,
  WSS_REGIONS,
  WSS_TYPES,
} from '@/config/endpoints';
import type { RestEndpointKey, WssRegionKey } from '@/config/endpoints';

interface WssRegion {
  key: string;
  label: string;
  url: string;
}

interface ApiSelectorDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  buttonRef?: React.RefObject<HTMLButtonElement>;
}

export const ApiSelectorDropdown = ({
  isOpen,
  onClose,
  buttonRef,
}: ApiSelectorDropdownProps) => {
  const {
    currentUrl,
    customUrls,
    customWssUrls,
    selectedAllModeWssUrl,
    selectedIndividualWssType,
    selectedWssRegion,
    selectedRestUrl,
    setCurrentUrl,
    setSelectedRestUrl,
    addCustomUrl,
    removeCustomUrl,
    setCustomLabel,
    getLabel,
    addCustomWssUrl,
    removeCustomWssUrl,
    removeAllModeWssUrl,
    setSelectedAllModeWssUrl,
    setSelectedIndividualWssType,
    setSelectedWssRegion,
    getCustomWssUrls
  } = useApiStore();

  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'rest' | 'wss'>('rest');
  const [latencies, setLatencies] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [currentWssRegionUrl, setCurrentWssRegionUrl] = useState<string>('');
  const [wssAddMode, setWssAddMode] = useState<'all' | 'individual'>('all');
  const [selectedWssType, setSelectedWssType] = useState<keyof SubscriptionPayload>('market');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const regionLabels: Record<WssRegionKey, string> = {
    default: 'Default',
    ovh: 'OVH',
    mobula: 'Mobula',
    'pulse-v2': 'Pulse-V2',
  };

  const restLabels: Record<RestEndpointKey, string> = {
    PREMIUM: 'PRM',
    STANDARD: 'STD',
    EXPLORER: 'EXP',
  };

  const wssRegions: WssRegion[] = (
    Object.entries(WSS_REGIONS) as [WssRegionKey, string][]
  ).map(([key, url]) => ({
    key,
    label: regionLabels[key],
    url,
  }));

  const wssTypes: (keyof SubscriptionPayload)[] = [...WSS_TYPES];

  useEffect(() => {
    setIsMounted(true);
    if (selectedWssRegion && !wssRegions.find(r => r.key === selectedWssRegion)) {
      setSelectedWssRegion(DEFAULT_WSS_REGION);
    }
  }, []);

  useEffect(() => {
    // Re-apply WSS selection after hydration/reload
    if (isMounted) {
      const wssUrlMap: Record<string, string> = {};

      if (selectedIndividualWssType) {
        const customUrl = customWssUrls.find(c => c.type === selectedIndividualWssType);
        if (customUrl) {
          wssUrlMap[selectedIndividualWssType] = customUrl.url;
        }
      } else if (selectedAllModeWssUrl) {
        wssTypes.forEach((type) => {
          wssUrlMap[type] = selectedAllModeWssUrl;
        });
      } else if (selectedWssRegion && selectedWssRegion !== DEFAULT_WSS_REGION) {
        const region = wssRegions.find(r => r.key === selectedWssRegion);
        if (region) {
          wssTypes.forEach((type) => {
            wssUrlMap[type] = region.url;
          });
        }
      }

      if (Object.keys(wssUrlMap).length > 0) {
        initMobulaClient(currentUrl, wssUrlMap);
      }
    }
  }, [isMounted, selectedIndividualWssType, selectedAllModeWssUrl, selectedWssRegion, customWssUrls, currentUrl]);

  useEffect(() => {
    if (isOpen && activeTab === 'rest') {
      checkLatencies();
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef?.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, buttonRef]);

  const checkLatencies = async () => {
    const defaultUrls = (
      Object.entries(REST_ENDPOINTS) as [RestEndpointKey, string][]
    ).map(([key, url]) => [restLabels[key], url] as [string, string]);
    const allUrls = [...defaultUrls, ...customUrls.map(c => [c.key, c.url] as [string, string])];

    for (const [key, url] of allUrls) {
      try {
        const start = performance.now();
        await fetch(url, { method: 'GET', cache: 'no-cache' });
        const end = performance.now();
        const latency = Math.round(end - start);

        setLatencies(prev => ({
          ...prev,
          [key]: `${latency}ms`
        }));
      } catch (error) {
        setLatencies(prev => ({
          ...prev,
          [key]: 'error'
        }));
      }
    }
  };

  if (!isOpen) return null;
  const handleSelectUrl = (url: string) => {
    setCurrentUrl(url);
    setSelectedRestUrl(url);
    const wssUrlMap = getCustomWssUrls();
    initMobulaClient(url, wssUrlMap);

    // 🔑 THIS ONE LINE FIXES EVERYTHING:
    document.cookie = `customRestUrl=${encodeURIComponent(url)}; path=/; max-age=604800; SameSite=Lax`;

    // RELOAD PAGE
    window.location.reload();
    onClose();
  };

  const handleSaveLabel = (key: string, label: string) => {
    setCustomLabel(key, label);
    setEditingKey(null);
    setEditLabel('');
  };

  const handleAddCustomUrl = () => {
    if (!newLabel.trim() || !newUrl.trim()) return;

    addCustomUrl(newUrl.trim(), newLabel.trim());
    setNewLabel('');
    setNewUrl('');
    setShowAddForm(false);
    checkLatencies();
  };

  const handleAddCustomWssUrl = () => {
    if (!newLabel.trim() || !newUrl.trim()) return;

    const urlTrimmed = newUrl.trim();
    const labelTrimmed = newLabel.trim();

    if (wssAddMode === 'all') {
      for (const type of wssTypes) {
        addCustomWssUrl(type, urlTrimmed, labelTrimmed, 'all');
      }
    } else {
      addCustomWssUrl(selectedWssType, urlTrimmed, labelTrimmed, 'individual');
    }

    setNewLabel('');
    setNewUrl('');
    setShowAddForm(false);

    const updatedWssMap = getCustomWssUrls();
    initMobulaClient(currentUrl, updatedWssMap);
  };

  const handleSelectAllModeWssUrl = (url: string) => {
    setSelectedAllModeWssUrl(url);

    const wssUrlMap: Record<string, string> = {};
    wssTypes.forEach((type) => {
      wssUrlMap[type] = url;
    });

    initMobulaClient(currentUrl, wssUrlMap);
    // No reload needed - client-side change is immediate
  };

  const handleSelectIndividualWssUrl = (type: keyof SubscriptionPayload) => {
    setSelectedIndividualWssType(type);

    const wssUrlMap = getCustomWssUrls();
    initMobulaClient(currentUrl, wssUrlMap);
  };

  const handleSelectWssRegion = (regionKey: string) => {
    const region = wssRegions.find(r => r.key === regionKey);
    if (!region) {
      setSelectedWssRegion(DEFAULT_WSS_REGION);
      return;
    }

    setSelectedWssRegion(regionKey as WssRegionKey);
    setCurrentWssRegionUrl(region.url);

    const wssUrlMap: Record<string, string> = {};
    for (const type of wssTypes) {
      wssUrlMap[type] = region.url;
    }

    initMobulaClient(currentUrl, wssUrlMap);
  };

  const urlOptions = (
    Object.entries(REST_ENDPOINTS) as [RestEndpointKey, string][]
  ).map(([key, url]) => ({
    key: restLabels[key],
    url,
    defaultLabel: restLabels[key],
  }));

  const buttonRect = buttonRef?.current?.getBoundingClientRect();
  const dropdownStyle = buttonRect
    ? {
      position: 'fixed' as const,
      top: buttonRect.bottom + 6,
      left: Math.max(8, Math.min(buttonRect.left, window.innerWidth - 320)),
    }
    : {};

  const getLatencyColor = (key: string) => {
    const latency = latencies[key];
    if (!latency || latency === '...') return 'text-gray-500';
    if (latency === 'error') return 'text-red-500';

    const ms = parseInt(latency);
    if (ms < 50) return 'text-green-500';
    if (ms < 100) return 'text-yellow-500';
    if (ms < 150) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="z-[9999] w-72 bg-bgSurface border border-borderSurface rounded-lg shadow-2xl max-h-[65vh] overflow-hidden flex flex-col"
    >
      {/* Tabs */}
      <div className="flex border-b border-borderSurface bg-bgDeepAlt px-1.5 py-1.5 gap-1">
        <button
          onClick={() => setActiveTab('rest')}
          className={`flex-1 px-2.5 py-1.5 text-[11px] font-semibold rounded transition-all duration-200 flex items-center justify-center gap-1 ${isMounted && activeTab === 'rest'
              ? 'text-white bg-success/20 border border-success/30'
              : 'text-textTertiary hover:text-ghost'
            }`}
        >
          <FiServer size={12} />
          <span>REST API</span>
        </button>
        <button
          onClick={() => setActiveTab('wss')}
          className={`flex-1 px-2.5 py-1.5 text-[11px] font-semibold rounded transition-all duration-200 flex items-center justify-center gap-1 ${isMounted && activeTab === 'wss'
              ? 'text-white bg-success/20 border border-success/30'
              : 'text-textTertiary hover:text-ghost'
            }`}
        >
          <FiRadio size={12} />
          <span>WebSocket</span>
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1 transition-all duration-300">
        {isMounted && activeTab === 'rest' ? (
          <>
            {/* Header */}
            <div className="px-3 py-1.5 border-b border-borderSurface bg-bgDeepAlt/50 sticky top-0">
              <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Regions</h3>
            </div>
            <div className="py-1">
              {urlOptions.map((option) => {
                const isSelected = currentUrl === option.url;
                const isEditing = editingKey === option.key;
                const label = getLabel(option.key, option.defaultLabel);
                const latency = latencies[option.key] || '...';
                const latencyColor = getLatencyColor(option.key);

                if (isEditing) {
                  return (
                    <div key={option.key} className="px-2 py-1 mx-1 rounded-md bg-bgPanel">
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveLabel(option.key, editLabel);
                          } else if (e.key === 'Escape') {
                            setEditingKey(null);
                            setEditLabel('');
                          }
                        }}
                        onBlur={() => {
                          if (editLabel.trim()) {
                            handleSaveLabel(option.key, editLabel);
                          } else {
                            setEditingKey(null);
                            setEditLabel('');
                          }
                        }}
                        className="w-full bg-bgSurface border border-bgElevated rounded px-2 py-0.5 text-[10px] text-white focus:outline-none focus:border-green-500/50"
                        autoFocus
                        placeholder={option.defaultLabel}
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={option.key}
                    className={`mx-1 my-0.5 rounded px-2 py-1.5 transition-all duration-150 flex items-center justify-between group ${isSelected
                        ? 'bg-green-500/10 border border-green-500/30'
                        : 'hover:bg-bgPanel/50 border border-transparent'
                      }`}
                  >
                    <button
                      onClick={() => handleSelectUrl(option.url)}
                      className="flex items-center gap-1.5 flex-1 min-w-0"
                    >
                      <div className={`p-0.5 rounded-md flex-shrink-0 ${isSelected ? 'bg-green-500/20' : 'bg-gray-700/40'}`}>
                        <FiServer
                          size={10}
                          className={isSelected ? 'text-green-400' : 'text-gray-500'}
                        />
                      </div>
                      <span
                        className={`text-[12px] font-medium truncate ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'
                          }`}
                      >
                        {label}
                      </span>
                    </button>

                    <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                      <span className={`text-[10px] font-mono tabular-nums ${latencyColor}`}>
                        {latency}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingKey(option.key);
                          setEditLabel(label);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 transition-opacity p-0.5"
                        title="Edit label"
                      >
                        <FiEdit2 size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom URLs */}
            {customUrls.length > 0 && (
              <>
                <div className="px-3 py-1.5 border-t border-borderSurface bg-bgDeepAlt/50 mt-1 sticky top-0">
                  <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Custom</h3>
                </div>
                <div className="py-1">
                  {customUrls.map((custom) => {
                    const isSelected = currentUrl === custom.url;
                    const latency = latencies[custom.key] || '...';
                    const latencyColor = getLatencyColor(custom.key);

                    return (
                      <div
                        key={custom.key}
                        className={`mx-1 my-0.5 rounded px-2 py-1.5 transition-all duration-150 flex items-center justify-between group ${isSelected
                            ? 'bg-green-500/10 border border-green-500/30'
                            : 'hover:bg-bgPanel/50 border border-transparent'
                          }`}
                      >
                        <button
                          onClick={() => handleSelectUrl(custom.url)}
                          className="flex items-center gap-1.5 flex-1 min-w-0"
                        >
                          <div className={`p-0.5 rounded-md flex-shrink-0 ${isSelected ? 'bg-green-500/20' : 'bg-gray-700/40'}`}>
                            <FiServer
                              size={10}
                              className={isSelected ? 'text-green-400' : 'text-gray-500'}
                            />
                          </div>
                          <span
                            className={`text-[12px] font-medium truncate ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'
                              }`}
                            title={custom.url}
                          >
                            {custom.label}
                          </span>
                        </button>

                        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                          <span className={`text-[10px] font-mono tabular-nums ${latencyColor}`}>
                            {latency}
                          </span>
                          <button
                            onClick={() => removeCustomUrl(custom.key)}
                            className="text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-0.5"
                            title="Remove"
                          >
                            <FiX size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Add Custom URL Section */}
            <div className="border-t border-bgElevated mt-1 sticky bottom-0 bg-bgSurface">
              {!showAddForm ? (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full px-3 py-1.5 flex items-center gap-1.5 text-gray-400 hover:text-white hover:bg-bgPanel transition-all duration-150 text-[11px] font-medium"
                >
                  <FiPlus size={13} />
                  Add Custom URL
                </button>
              ) : (
                <div className="p-2 space-y-1.5 bg-bgDeepAlt border-t border-bgElevated transition-all duration-200">
                  <input
                    type="text"
                    placeholder="Label"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="w-full bg-bgPanel border border-bgElevated rounded px-2 py-1 text-[10px] text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50 transition-colors"
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="https://api.example.com"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="w-full bg-bgPanel border border-bgElevated rounded px-2 py-1 text-[10px] text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50 transition-colors"
                  />
                  <div className="flex gap-1 pt-0.5">
                    <button
                      onClick={handleAddCustomUrl}
                      disabled={!newLabel.trim() || !newUrl.trim()}
                      className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-green-500/40 disabled:cursor-not-allowed text-white rounded px-2 py-0.5 text-[10px] font-semibold transition-colors duration-150"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setShowAddForm(false);
                        setNewLabel('');
                        setNewUrl('');
                      }}
                      className="flex-1 bg-bgElevated hover:bg-bgPanel text-gray-300 rounded px-2 py-0.5 text-[10px] font-semibold transition-colors duration-150"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : isMounted && activeTab === 'wss' ? (
          <>
            <div className="px-3 py-1.5 border-b border-borderSurface bg-bgDeepAlt/50 sticky top-0">
              <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Regions
              </h3>
            </div>

            <div className="py-1">
              {wssRegions.map((region) => {
                const isSelected = selectedWssRegion === region.key;

                return (
                  <div
                    key={region.key}
                    className={`mx-1 my-0.5 rounded px-2 py-1.5 transition-all duration-150 flex items-center justify-between group ${isSelected
                        ? 'bg-green-500/10 border border-green-500/30'
                        : 'hover:bg-bgPanel/50 border border-transparent'
                      }`}
                  >
                    <button
                      onClick={() => handleSelectWssRegion(region.key)}
                      className="flex items-center gap-1.5 flex-1 min-w-0"
                    >
                      <div className={`p-0.5 rounded-md flex-shrink-0 ${isSelected ? 'bg-green-500/20' : 'bg-gray-700/40'}`}>
                        <FiRadio
                          size={10}
                          className={isSelected ? 'text-green-400' : 'text-gray-500'}
                        />
                      </div>
                      <span
                        className={`text-[12px] font-medium truncate ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'
                          }`}
                      >
                        {region.label}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>

            {customWssUrls.length > 0 && (
              <>
                <div className="px-3 py-1.5 border-t border-borderSurface bg-bgDeepAlt/50 mt-1 sticky top-0">
                  <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Custom</h3>
                </div>
                <div className="py-1">
                  {(() => {
                    const allModeEntries: JSX.Element[] = [];
                    const indModeEntries: JSX.Element[] = [];
                    const seenAllUrls = new Set<string>();

                    customWssUrls.forEach((custom) => {
                      if (custom.mode === 'all' && !seenAllUrls.has(custom.url)) {
                        seenAllUrls.add(custom.url);
                        const isSelected = selectedAllModeWssUrl === custom.url;

                        allModeEntries.push(
                          <div
                            key={`all-${custom.url}`}
                            className={`mx-1 my-0.5 group rounded transition-all duration-150 flex items-center justify-between ${isSelected
                                ? 'bg-green-500/10 border border-green-500/30 px-2 py-1'
                                : 'hover:bg-bgPanel/50 border border-transparent hover:border-green-500/20 px-2 py-1'
                              }`}
                          >
                            <button
                              onClick={() => handleSelectAllModeWssUrl(custom.url)}
                              className="flex items-start gap-1 flex-1 text-left min-w-0"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <div className={`p-0.5 rounded-md flex-shrink-0 ${isSelected ? 'bg-green-500/20' : 'bg-gray-700/40'}`}>
                                    <FiRadio size={9} className={isSelected ? 'text-green-400' : 'text-gray-400'} />
                                  </div>
                                  <span className={`text-[11px] font-semibold ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>
                                    All
                                  </span>
                                  <span className="text-[8px] px-0.5 py-0.5 bg-green-500/20 text-green-300 rounded font-medium">
                                    Custom
                                  </span>
                                </div>
                                <span className={`text-[9px] block mt-0.5 truncate ${isSelected ? 'text-gray-300' : 'text-gray-500'}`} title={custom.label}>
                                  {custom.label}
                                </span>
                                <span className="text-[8px] text-gray-600 block truncate font-mono" title={custom.url}>
                                  {custom.url}
                                </span>
                              </div>
                            </button>
                            <button
                              onClick={() => removeAllModeWssUrl(custom.url)}
                              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all duration-150 flex-shrink-0 p-0.5"
                              title="Remove"
                            >
                              <FiX size={11} />
                            </button>
                          </div>
                        );
                      } else if (custom.mode === 'individual') {
                        const isSelected = selectedIndividualWssType === custom.type;
                        indModeEntries.push(
                          <div
                            key={`individual-${custom.type}-${custom.url}`}
                            className={`mx-1 my-0.5 group rounded transition-all duration-150 flex items-center justify-between ${isSelected
                                ? 'bg-green-500/10 border border-green-500/30 px-2 py-1'
                                : 'hover:bg-bgPanel/50 border border-transparent hover:border-green-500/20 px-2 py-1'
                              }`}
                          >
                            <button
                              onClick={() => handleSelectIndividualWssUrl(custom.type)}
                              className="flex items-start gap-1 flex-1 text-left min-w-0"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <div className={`p-0.5 rounded-md flex-shrink-0 ${isSelected ? 'bg-green-500/20' : 'bg-gray-700/40'}`}>
                                    <FiRadio size={9} className={isSelected ? 'text-green-400' : 'text-gray-400'} />
                                  </div>
                                  <span className={`text-[11px] font-semibold ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>
                                    {custom.type}
                                  </span>
                                  <span className="text-[8px] px-0.5 py-0.5 bg-green-500/20 text-green-300 rounded font-medium">
                                    Custom
                                  </span>
                                </div>
                                <span className={`text-[9px] block mt-0.5 truncate ${isSelected ? 'text-gray-300' : 'text-gray-500'}`} title={custom.label}>
                                  {custom.label}
                                </span>
                                <span className="text-[8px] text-gray-600 block truncate font-mono" title={custom.url}>
                                  {custom.url}
                                </span>
                              </div>
                            </button>
                            <button
                              onClick={() => removeCustomWssUrl(custom.type)}
                              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all duration-150 flex-shrink-0 p-0.5"
                              title="Remove"
                            >
                              <FiX size={11} />
                            </button>
                          </div>
                        );
                      }
                    });

                    return [...allModeEntries, ...indModeEntries];
                  })()}
                </div>
              </>
            )}

            <div className={`${customWssUrls.length > 0 ? 'border-t border-bgElevated' : 'border-t border-bgElevated mt-1'} sticky bottom-0 bg-bgSurface`}>
              {!showAddForm ? (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full px-3 py-1.5 flex items-center gap-1.5 text-gray-400 hover:text-white hover:bg-bgPanel transition-all duration-150 text-[11px] font-medium"
                >
                  <FiPlus size={13} />
                  Add Custom WSS URL
                </button>
              ) : (
                <div className="p-2 space-y-1.5 bg-bgDeepAlt border-t border-bgElevated transition-all duration-200">
                  {/* Mode Toggle */}
                  <div className="flex gap-1 bg-bgPanel rounded p-1">
                    <button
                      onClick={() => setWssAddMode('all')}
                      className={`flex-1 px-2 py-0.5 rounded text-[9px] font-semibold transition-all duration-150 ${wssAddMode === 'all'
                          ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                          : 'text-gray-400 hover:text-gray-300'
                        }`}
                    >
                      All Types
                    </button>
                    <button
                      onClick={() => setWssAddMode('individual')}
                      className={`flex-1 px-2 py-0.5 rounded text-[9px] font-semibold transition-all duration-150 ${wssAddMode === 'individual'
                          ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                          : 'text-gray-400 hover:text-gray-300'
                        }`}
                    >
                      Individual
                    </button>
                  </div>

                  {wssAddMode === 'individual' && (
                    <div>
                      <label className="text-[9px] text-gray-500 font-semibold uppercase block mb-0.5">
                        Type
                      </label>
                      <select
                        value={selectedWssType}
                        onChange={(e) => setSelectedWssType(e.target.value as keyof SubscriptionPayload)}
                        className="w-full bg-bgPanel border border-bgElevated rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-green-500/50 appearance-none cursor-pointer transition-colors"
                      >
                        {wssTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-[9px] text-gray-500 font-semibold uppercase block mb-0.5">
                      Label
                    </label>
                    <input
                      type="text"
                      placeholder={wssAddMode === 'all' ? 'e.g., Custom WSS' : 'e.g., OVH-market-staging'}
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      className="w-full bg-bgPanel border border-bgElevated rounded px-2 py-1 text-[10px] text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50 transition-colors"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-[9px] text-gray-500 font-semibold uppercase block mb-0.5">
                      URL {wssAddMode === 'all' && '(Applied to All Types)'}
                    </label>
                    <input
                      type="text"
                      placeholder="wss://custom.example.com"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      className="w-full bg-bgPanel border border-bgElevated rounded px-2 py-1 text-[10px] text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50 font-mono transition-colors"
                    />
                  </div>

                  <div className="flex gap-1 pt-0.5">
                    <button
                      onClick={handleAddCustomWssUrl}
                      disabled={!newLabel.trim() || !newUrl.trim()}
                      className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-green-500/40 disabled:cursor-not-allowed text-white rounded px-2 py-0.5 text-[10px] font-semibold transition-colors duration-150"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setShowAddForm(false);
                        setNewLabel('');
                        setNewUrl('');
                      }}
                      className="flex-1 bg-bgElevated hover:bg-bgPanel text-gray-300 rounded px-2 py-0.5 text-[10px] font-semibold transition-colors duration-150"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};