'use client';

import { useMemo, useState, useRef, useEffect, Suspense } from 'react';
import { Copy, RefreshCw, ChevronDown, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams, useRouter } from 'next/navigation';
import type { EmbedResolution, EmbedTheme } from '@/lib/embed/validateEmbedParams';
import { useEmbedGeneratorStore, type EmbedType } from '@/store/useEmbedGeneratorStore';
import { useChainsAndProtocols } from '@/features/pulse/hooks/useChainsAndProtocols';

function EmbedPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const {
    embedType,
    chain,
    address,
    resolution,
    theme,
    candleUpColor,
    candleDownColor,
    bgColor,
    chartWidth,
    chartHeight,
    setEmbedType,
    setChain,
    setAddress,
    setResolution,
    setTheme,
    setCandleUpColor,
    setCandleDownColor,
    setBgColor,
    setChartWidth,
    setChartHeight,
  } = useEmbedGeneratorStore();

  const { chains, loading: chainsLoading } = useChainsAndProtocols('new-pairs');
  
  const [isInitialized, setIsInitialized] = useState(false);
  const prevValuesRef = useRef({ embedType, chain, address, resolution });

  const resolutionOptions: { value: EmbedResolution; label: string }[] = [
    { value: '1s', label: '1s' },
    { value: '5s', label: '5s' },
    { value: '15s', label: '15s' },
    { value: '30s', label: '30s' },
    { value: '1minute', label: '1m' },
    { value: '5minute', label: '5m' },
    { value: '15minute', label: '15m' },
    { value: '1hour', label: '1h' },
    { value: '1day', label: '1d' },
    { value: '1week', label: '1w' },
    { value: '1month', label: '1M' },
  ];

  const [showChainDropdown, setShowChainDropdown] = useState(false);
  const [chainSearchQuery, setChainSearchQuery] = useState('');
  const chainDropdownRef = useRef<HTMLDivElement>(null);
  const chainSearchInputRef = useRef<HTMLInputElement>(null);

  const [showResolutionDropdown, setShowResolutionDropdown] = useState(false);
  const [resolutionSearchQuery, setResolutionSearchQuery] = useState('');
  const resolutionDropdownRef = useRef<HTMLDivElement>(null);
  const resolutionSearchInputRef = useRef<HTMLInputElement>(null);

  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const themeDropdownRef = useRef<HTMLDivElement>(null);

  // Initialize from URL params on mount (Step 1 and Step 2)
  useEffect(() => {
    if (isInitialized) return;
    
    const typeParam = searchParams.get('type');
    const blockchainParam = searchParams.get('blockchain');
    const addressParam = searchParams.get('address') || searchParams.get('token') || searchParams.get('pair');
    const resolutionParam = searchParams.get('resolution');

    // Step 1: Initialize type, blockchain, and address
    if (typeParam && (typeParam === 'token' || typeParam === 'pool')) {
      setEmbedType(typeParam);
      prevValuesRef.current.embedType = typeParam;
    }
    if (blockchainParam) {
      setChain(blockchainParam);
      prevValuesRef.current.chain = blockchainParam;
    }
    if (addressParam) {
      setAddress(addressParam);
      prevValuesRef.current.address = addressParam;
    }
    
    // Step 2: Initialize resolution if present
    if (resolutionParam) {
      const validResolutions: EmbedResolution[] = ['1s', '5s', '15s', '30s', '1minute', '5minute', '15minute', '1hour', '1day', '1week', '1month'];
      if (validResolutions.includes(resolutionParam as EmbedResolution)) {
        setResolution(resolutionParam as EmbedResolution);
        prevValuesRef.current.resolution = resolutionParam as EmbedResolution;
      }
    }
    
    setIsInitialized(true);
  }, [isInitialized, searchParams, setEmbedType, setChain, setAddress, setResolution]);

  // Update URL when type, blockchain, address, or resolution changes (after initialization)
  useEffect(() => {
    if (!isInitialized) return;

    // Check if values actually changed to avoid unnecessary updates
    const hasChanged = 
      prevValuesRef.current.embedType !== embedType ||
      prevValuesRef.current.chain !== chain ||
      prevValuesRef.current.address !== address ||
      prevValuesRef.current.resolution !== resolution;

    if (!hasChanged) return;

    // Update ref with current values
    prevValuesRef.current = { embedType, chain, address, resolution };

    const params = new URLSearchParams();
    
    // Preserve other params from URL (theme, colors, etc.)
    searchParams.forEach((value, key) => {
      if (key !== 'type' && key !== 'blockchain' && key !== 'address' && key !== 'token' && key !== 'pair' && key !== 'resolution') {
        params.set(key, value);
      }
    });
    
    // Add Step 1 params
    if (embedType) {
      params.set('type', embedType);
    }
    
    if (chain) {
      params.set('blockchain', chain);
    }
    
    if (address) {
      params.set('address', address);
    }
    
    // Add Step 2 param
    if (resolution) {
      params.set('resolution', resolution);
    }

    const newSearch = params.toString();
    const newUrl = newSearch ? `/embed?${newSearch}` : '/embed';
    router.replace(newUrl, { scroll: false });
  }, [embedType, chain, address, resolution, isInitialized, searchParams, router]);

  // Filter chains based on search query
  const filteredChains = useMemo(() => {
    if (!chainSearchQuery.trim()) return chains;
    
    const query = chainSearchQuery.toLowerCase();
    return chains.filter(chain => 
      chain.name.toLowerCase().includes(query) ||
      chain.label.toLowerCase().includes(query) ||
      chain.id.toLowerCase().includes(query)
    );
  }, [chains, chainSearchQuery]);

  // Filter resolutions based on search query
  const filteredResolutions = useMemo(() => {
    if (!resolutionSearchQuery.trim()) return resolutionOptions;
    
    const query = resolutionSearchQuery.toLowerCase();
    return resolutionOptions.filter(opt => 
      opt.label.toLowerCase().includes(query) ||
      opt.value.toLowerCase().includes(query)
    );
  }, [resolutionSearchQuery]);

  // Handle click outside and escape key for chain dropdown
  useEffect(() => {
    if (!showChainDropdown) return;

    const handleClose = () => {
      setShowChainDropdown(false);
      setChainSearchQuery('');
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (chainDropdownRef.current && !chainDropdownRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showChainDropdown]);

  // Handle click outside and escape key for type dropdown
  useEffect(() => {
    if (!showTypeDropdown) return;

    const handleClose = () => {
      setShowTypeDropdown(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTypeDropdown]);

  // Handle click outside and escape key for theme dropdown
  useEffect(() => {
    if (!showThemeDropdown) return;

    const handleClose = () => {
      setShowThemeDropdown(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showThemeDropdown]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (showChainDropdown) {
      setTimeout(() => {
        chainSearchInputRef.current?.focus();
      }, 0);
    }
  }, [showChainDropdown]);

  // Handle resolution dropdown click outside and escape key
  useEffect(() => {
    if (!showResolutionDropdown) return;

    const handleClose = () => {
      setShowResolutionDropdown(false);
      setResolutionSearchQuery('');
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (resolutionDropdownRef.current && !resolutionDropdownRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showResolutionDropdown]);

  // Focus resolution search input when dropdown opens
  useEffect(() => {
    if (showResolutionDropdown) {
      setTimeout(() => {
        resolutionSearchInputRef.current?.focus();
      }, 0);
    }
  }, [showResolutionDropdown]);

  const handleChainSelect = (chainId: string) => {
    setChain(chainId);
    setShowChainDropdown(false);
    setChainSearchQuery('');
  };

  const handleResolutionSelect = (resolutionValue: EmbedResolution) => {
    setResolution(resolutionValue);
    setShowResolutionDropdown(false);
    setResolutionSearchQuery('');
  };

  const handleTypeSelect = (type: EmbedType) => {
    setEmbedType(type);
    setShowTypeDropdown(false);
  };

  const handleThemeSelect = (selectedTheme: EmbedTheme) => {
    setTheme(selectedTheme);
    setShowThemeDropdown(false);
    // Update bgColor based on theme
    const themeColors: Record<EmbedTheme, string> = {
      Navy: '#121319',
      Frog: '#0F1010',
      Abyss: '#070D13',
      Light: '#FFFFFF',
    };
    setBgColor(themeColors[selectedTheme]);
  };

  const selectedChain = chains.find(c => c.id === chain);
  const selectedChainLabel = selectedChain ? `${selectedChain.name} (${selectedChain.id})` : 'Select Blockchain';

  const selectedResolution = resolutionOptions.find(opt => opt.value === resolution);
  const selectedResolutionLabel = selectedResolution ? selectedResolution.label : 'Select Resolution';

  const typeOptions: { value: EmbedType; label: string }[] = [
    { value: 'token', label: 'Token' },
    { value: 'pool', label: 'Pool / Pair' },
  ];
  const selectedTypeLabel = typeOptions.find(opt => opt.value === embedType)?.label || 'Select Type';

  const themeOptions: { value: EmbedTheme; label: string }[] = [
    { value: 'Navy', label: 'Navy' },
    { value: 'Frog', label: 'Frog' },
    { value: 'Abyss', label: 'Abyss' },
    { value: 'Light', label: 'Light' },
  ];
  const selectedThemeLabel = theme ? themeOptions.find(opt => opt.value === theme)?.label || 'Select Theme' : 'Select Theme';

  // Generate iframe URL
  const iframeUrl = useMemo(() => {
    if (!chain || !address) return '';
    
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const route = embedType === 'token' ? 'embed/token' : 'embed/pool';
    const url = new URL(`${baseUrl}/${route}/${encodeURIComponent(chain)}/${address}`);
    
    url.searchParams.set('embed', '1');
    url.searchParams.set('resolution', resolution);
    url.searchParams.set('chart_type', 'price'); // Default to price chart
    if (theme) {
      url.searchParams.set('theme', theme);
    }
    // Only add bg_color if theme is not set (theme takes precedence)
    if (!theme && bgColor) {
      url.searchParams.set('bg_color', bgColor.replace('#', ''));
    }
    if (candleUpColor) {
      url.searchParams.set('candle_up_color', candleUpColor.replace('#', ''));
    }
    if (candleDownColor) {
      url.searchParams.set('candle_down_color', candleDownColor.replace('#', ''));
    }
    
    return url.toString();
  }, [embedType, chain, address, resolution, theme, bgColor, candleUpColor, candleDownColor]);

  // Generate iframe code
  const iframeCode = useMemo(() => {
    if (!iframeUrl) return '';
    
    return `<iframe
  id="mobula-chart-embed"
  title="Mobula Chart Embed"
  src="${iframeUrl}"
  frameborder="0"
  allow="clipboard-write"
  allowfullscreen
  style="width: ${chartWidth}; height: ${chartHeight}px;"
></iframe>`;
  }, [iframeUrl, chartWidth, chartHeight]);

  const handleCopy = async () => {
    if (!iframeCode) return;
    
    try {
      await navigator.clipboard.writeText(iframeCode);
      toast.success('Code copied to clipboard', {
        duration: 2000,
      });
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('Failed to copy code', {
        duration: 2000,
      });
    }
  };

  const handleRefreshPreview = () => {
    // Force iframe reload by updating a dummy state
    const iframe = document.querySelector('iframe[title="Chart Preview"]') as HTMLIFrameElement;
    if (iframe && iframeUrl) {
      iframe.src = iframeUrl + '&_refresh=' + Date.now();
    }
  };

  const isValidHexColor = (color: string): boolean => {
    if (!color) return true;
    return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
  };

  return (
    <div className="min-h-screen bg-bgPrimary text-textPrimary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-8">
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h1 className="text-lg sm:text-xl font-bold text-textPrimary mb-1 sm:mb-2">Chart Generator</h1>
          <p className="text-xs sm:text-sm text-textSecondary">Create embeddable charts for your website</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 lg:gap-8">
          {/* Left Column - Configuration */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 lg:space-y-8">
            {/* Step 1 */}
            <div className="bg-bgOverlay border border-borderDefault rounded-lg p-4 sm:p-6">
              <h2 className="text-xs sm:text-sm font-semibold text-textPrimary mb-3 sm:mb-4">
                Step 1: I want to generate a chart for
              </h2>
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label htmlFor="embedType" className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-textTertiary">
                    Type
                  </label>
                  <div className="relative" ref={typeDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-bgContainer border border-borderDefault rounded-md text-textPrimary text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-success focus:border-success cursor-pointer flex items-center justify-between"
                    >
                      <span className="truncate text-left">{selectedTypeLabel}</span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform flex-shrink-0 ml-2 ${showTypeDropdown ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {/* Type dropdown */}
                    {showTypeDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-bgPrimary border border-borderDefault shadow-lg rounded-md overflow-hidden flex flex-col">
                        <div className="overflow-y-auto">
                          {typeOptions.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleTypeSelect(opt.value)}
                              className={`w-full text-left px-3 py-2.5 text-xs transition-colors ${
                                embedType === opt.value
                                  ? 'bg-success/10 text-success'
                                  : 'text-textSecondary hover:bg-bgTertiary hover:text-textPrimary'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label htmlFor="address" className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-textTertiary">
                    Contract Address
                  </label>
                  <input
                    id="address"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={embedType === 'token' ? 'Token Contract Address' : 'Pool / Pair Contract Address'}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-bgContainer border border-borderDefault rounded-md text-textPrimary text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-success focus:border-success font-menlo placeholder:text-textSecondary"
                  />
                </div>
                <div>
                  <label htmlFor="chain" className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-textTertiary">
                    Blockchain
                  </label>
                  <div className="relative" ref={chainDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowChainDropdown(!showChainDropdown)}
                      disabled={chainsLoading || chains.length === 0}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-bgContainer border border-borderDefault rounded-md text-textPrimary text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-success focus:border-success cursor-pointer flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="truncate text-left">
                        {chainsLoading ? 'Loading chains...' : selectedChainLabel}
                      </span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform flex-shrink-0 ml-2 ${showChainDropdown ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {/* Chain dropdown */}
                    {showChainDropdown && !chainsLoading && chains.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-bgPrimary border border-borderDefault shadow-lg rounded-md overflow-hidden flex flex-col max-h-80">
                        {/* Search Input */}
                        <div className="sticky top-0 bg-bgPrimary border-b border-borderDefault p-2 flex-shrink-0">
                          <div className="relative flex items-center">
                            <Search
                              size={14}
                              className="absolute left-2.5 text-textTertiary flex-shrink-0"
                            />
                            <input
                              ref={chainSearchInputRef}
                              type="text"
                              placeholder="Search blockchain..."
                              value={chainSearchQuery}
                              onChange={(e) => setChainSearchQuery(e.target.value)}
                              className="w-full bg-bgOverlay border border-borderDefault rounded px-3 py-2 pl-8 pr-8 text-xs text-textPrimary placeholder:text-textTertiary focus:outline-none focus:ring-1 focus:ring-success/40 focus:border-success/40"
                            />
                            {chainSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setChainSearchQuery('')}
                                className="absolute right-2.5 text-textTertiary hover:text-textPrimary transition-colors flex-shrink-0"
                                aria-label="Clear search"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Chains List */}
                        <div className="overflow-y-auto flex-1">
                          {filteredChains.length > 0 ? (
                            filteredChains.map((chainOption) => (
                              <button
                                key={chainOption.id}
                                type="button"
                                onClick={() => handleChainSelect(chainOption.id)}
                                className={`w-full text-left px-3 py-2.5 text-xs transition-colors ${
                                  chain === chainOption.id
                                    ? 'bg-success/10 text-success'
                                    : 'text-textSecondary hover:bg-bgTertiary hover:text-textPrimary'
                                }`}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{chainOption.name}</span>
                                  <span className={`text-[10px] ${chain === chainOption.id ? 'text-success/70' : 'text-textTertiary'}`}>
                                    {chainOption.id}
                                  </span>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-6 text-center text-xs text-textTertiary">
                              No blockchain found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-bgOverlay border border-borderDefault rounded-lg p-4 sm:p-6">
              <h2 className="text-xs sm:text-sm font-semibold text-textPrimary mb-3 sm:mb-4">
                Step 2: I want the resolution to be
              </h2>
              <div>
                <label htmlFor="resolution" className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-textTertiary">
                  Default Resolution
                </label>
                <div className="relative" ref={resolutionDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowResolutionDropdown(!showResolutionDropdown)}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-bgContainer border border-borderDefault rounded-md text-textPrimary text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-success focus:border-success cursor-pointer flex items-center justify-between"
                  >
                    <span className="truncate text-left">{selectedResolutionLabel}</span>
                    <ChevronDown
                      size={16}
                      className={`transition-transform flex-shrink-0 ml-2 ${showResolutionDropdown ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Resolution dropdown */}
                  {showResolutionDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-bgPrimary border border-borderDefault shadow-lg rounded-md overflow-hidden flex flex-col max-h-80">
                      {/* Search Input */}
                      <div className="sticky top-0 bg-bgPrimary border-b border-borderDefault p-2 flex-shrink-0">
                        <div className="relative flex items-center">
                          <Search
                            size={14}
                            className="absolute left-2.5 text-textTertiary flex-shrink-0"
                          />
                          <input
                            ref={resolutionSearchInputRef}
                            type="text"
                            placeholder="Search resolution..."
                            value={resolutionSearchQuery}
                            onChange={(e) => setResolutionSearchQuery(e.target.value)}
                            className="w-full bg-bgOverlay border border-borderDefault rounded px-3 py-2 pl-8 pr-8 text-xs text-textPrimary placeholder:text-textTertiary focus:outline-none focus:ring-1 focus:ring-success/40 focus:border-success/40"
                          />
                          {resolutionSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setResolutionSearchQuery('')}
                              className="absolute right-2.5 text-textTertiary hover:text-textPrimary transition-colors flex-shrink-0"
                              aria-label="Clear search"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Resolutions List */}
                      <div className="overflow-y-auto flex-1">
                        {filteredResolutions.length > 0 ? (
                          filteredResolutions.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleResolutionSelect(opt.value)}
                              className={`w-full text-left px-3 py-2.5 text-xs transition-colors ${
                                resolution === opt.value
                                  ? 'bg-success/10 text-success'
                                  : 'text-textSecondary hover:bg-bgTertiary hover:text-textPrimary'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-6 text-center text-xs text-textTertiary">
                            No resolution found
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-bgOverlay border border-borderDefault rounded-lg p-4 sm:p-6">
              <h2 className="text-xs sm:text-sm font-semibold text-textPrimary mb-3 sm:mb-4">
                Step 3: I want the colours to be
              </h2>
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label htmlFor="candleUpColor" className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-textTertiary">
                    Candlestick Up Color
                  </label>
                  <div className="flex gap-2 sm:gap-3">
                    <input
                      id="candleUpColor"
                      type="text"
                      value={candleUpColor}
                      onChange={(e) => setCandleUpColor(e.target.value)}
                      placeholder="#18C722"
                      className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-bgContainer border rounded-md text-textPrimary text-xs sm:text-sm focus:outline-none focus:ring-2 font-menlo placeholder:text-textSecondary ${
                        isValidHexColor(candleUpColor)
                          ? 'border-borderDefault focus:ring-success focus:border-success'
                          : 'border-red-500 focus:ring-red-500'
                      }`}
                    />
                    <input
                      type="color"
                      value={candleUpColor || '#18C722'}
                      onChange={(e) => setCandleUpColor(e.target.value)}
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded cursor-pointer border border-borderDefault flex-shrink-0"
                    />
                    <div
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded border border-borderDefault flex-shrink-0"
                      style={{ backgroundColor: candleUpColor || '#18C722' }}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="candleDownColor" className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-textTertiary">
                    Candlestick Down Color
                  </label>
                  <div className="flex gap-2 sm:gap-3">
                    <input
                      id="candleDownColor"
                      type="text"
                      value={candleDownColor}
                      onChange={(e) => setCandleDownColor(e.target.value)}
                      placeholder="#EF4444"
                      className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-bgContainer border rounded-md text-textPrimary text-xs sm:text-sm focus:outline-none focus:ring-2 font-menlo placeholder:text-textSecondary ${
                        isValidHexColor(candleDownColor)
                          ? 'border-borderDefault focus:ring-success focus:border-success'
                          : 'border-red-500 focus:ring-red-500'
                      }`}
                    />
                    <input
                      type="color"
                      value={candleDownColor || '#EF4444'}
                      onChange={(e) => setCandleDownColor(e.target.value)}
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded cursor-pointer border border-borderDefault flex-shrink-0"
                    />
                    <div
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded border border-borderDefault flex-shrink-0"
                      style={{ backgroundColor: candleDownColor || '#EF4444' }}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="theme" className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-textTertiary">
                    Theme
                  </label>
                  <div className="relative" ref={themeDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowThemeDropdown(!showThemeDropdown)}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-bgContainer border border-borderDefault rounded-md text-textPrimary text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-success focus:border-success cursor-pointer flex items-center justify-between"
                    >
                      <span className="truncate text-left">{selectedThemeLabel}</span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform flex-shrink-0 ml-2 ${showThemeDropdown ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {/* Theme dropdown */}
                    {showThemeDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-bgPrimary border border-borderDefault shadow-lg rounded-md overflow-hidden flex flex-col">
                        <div className="overflow-y-auto">
                          {themeOptions.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleThemeSelect(opt.value)}
                              className={`w-full text-left px-3 py-2.5 text-xs transition-colors ${
                                theme === opt.value
                                  ? 'bg-success/10 text-success'
                                  : 'text-textSecondary hover:bg-bgTertiary hover:text-textPrimary'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label htmlFor="bgColor" className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-textTertiary">
                    Background Color (optional, overrides theme)
                  </label>
                  <div className="flex gap-2 sm:gap-3">
                    <input
                      id="bgColor"
                      type="text"
                      value={bgColor}
                      onChange={(e) => {
                        setBgColor(e.target.value);
                        // Clear theme when user manually changes bgColor
                        if (e.target.value && e.target.value !== bgColor) {
                          setTheme('');
                        }
                      }}
                      placeholder="#111827"
                      className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-bgContainer border rounded-md text-textPrimary text-xs sm:text-sm focus:outline-none focus:ring-2 font-menlo placeholder:text-textSecondary ${
                        isValidHexColor(bgColor)
                          ? 'border-borderDefault focus:ring-success focus:border-success'
                          : 'border-red-500 focus:ring-red-500'
                      }`}
                    />
                    <input
                      type="color"
                      value={bgColor || '#111827'}
                      onChange={(e) => {
                        setBgColor(e.target.value);
                        // Clear theme when user manually changes bgColor
                        setTheme('');
                      }}
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded cursor-pointer border border-borderDefault flex-shrink-0"
                    />
                    <div
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded border border-borderDefault flex-shrink-0"
                      style={{ backgroundColor: bgColor || '#111827' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4: Chart Size */}
            <div className="bg-bgOverlay border border-borderDefault rounded-lg p-4 sm:p-6">
              <h2 className="text-xs sm:text-sm font-semibold text-textPrimary mb-3 sm:mb-4">
                Step 4: I want the chart size to be
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label htmlFor="chartWidth" className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-textTertiary">
                    Width
                  </label>
                  <input
                    id="chartWidth"
                    type="text"
                    value={chartWidth}
                    onChange={(e) => setChartWidth(e.target.value)}
                    placeholder="100% or 800px"
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-bgContainer border border-borderDefault rounded-md text-textPrimary text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-success focus:border-success font-menlo placeholder:text-textSecondary"
                  />
                  <p className="text-[10px] sm:text-xs text-textTertiary mt-1">Use % for responsive or px for fixed</p>
                </div>
                <div>
                  <label htmlFor="chartHeight" className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-textTertiary">
                    Height
                  </label>
                  <input
                    id="chartHeight"
                    type="number"
                    value={chartHeight}
                    onChange={(e) => setChartHeight(e.target.value)}
                    placeholder="600"
                    min="300"
                    max="2000"
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-bgContainer border border-borderDefault rounded-md text-textPrimary text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-success focus:border-success"
                  />
                  <p className="text-[10px] sm:text-xs text-textTertiary mt-1">Height in pixels (300-2000)</p>
                </div>
              </div>
            </div>

            {/* Notes Section */}
            <div className="bg-bgOverlay border border-borderDefault rounded-lg p-4 sm:p-6">
              <h3 className="text-xs sm:text-sm font-semibold text-textPrimary mb-2">Notes</h3>
              <p className="text-xs sm:text-sm text-textSecondary leading-relaxed">
                You can use charts for multiple tokens by replacing the Mobula URL with your pool or token address.
                More embed options are available in Mobula by clicking "Share" then "Embed Charts".
              </p>
            </div>
          </div>

          {/* Right Column - Preview & Code */}
          <div className="lg:col-span-3 space-y-4 sm:space-y-6">
            {/* Preview */}
            <div className="bg-bgOverlay border border-borderDefault rounded-lg p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="text-xs sm:text-sm font-semibold text-textPrimary">Preview</h2>
                <button
                  type="button"
                  onClick={handleRefreshPreview}
                  disabled={!iframeUrl}
                  className="p-2 border border-borderDefault hover:bg-bgContainer rounded-md text-textPrimary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh Preview"
                >
                  <RefreshCw size={16} className="sm:w-4 sm:h-4" />
                </button>
              </div>
              {iframeUrl ? (
                <div className="border border-borderDefault rounded-lg overflow-hidden bg-white w-full max-w-full" style={{ width: chartWidth === '100%' ? '100%' : `min(${chartWidth}, 100%)` }}>
                  <div className="w-full overflow-x-auto">
                    <iframe
                      src={iframeUrl}
                      width={chartWidth === '100%' ? '100%' : chartWidth}
                      height={chartHeight}
                      frameBorder="0"
                      className="bg-white w-full"
                      title="Chart Preview"
                      style={{ minWidth: '100%', height: `${chartHeight}px` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center bg-bgContainer border border-borderDefault rounded-lg w-full" style={{ minHeight: '300px', height: `${Math.min(parseInt(chartHeight) || 600, 600)}px` }}>
                  <p className="text-textSecondary text-center px-4 text-xs sm:text-sm">
                    Enter contract address to see preview
                  </p>
                </div>
              )}
            </div>

            {/* Generated Code */}
            <div className="bg-bgOverlay border border-borderDefault rounded-lg p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="text-xs sm:text-sm font-semibold text-textPrimary">Generated Code</h2>
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!iframeCode}
                  className="p-2 border border-borderDefault hover:bg-bgContainer rounded-md text-textPrimary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Copy Code"
                >
                  <Copy size={16} className="sm:w-4 sm:h-4" />
                </button>
              </div>
              <div className="bg-bgContainer border border-borderDefault rounded-md p-3 sm:p-4">
                <pre className="text-[10px] sm:text-xs text-textPrimary font-menlo overflow-x-auto">
                  <code className="block whitespace-pre-wrap break-words">{iframeCode || 'Enter contract address to generate code'}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmbedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bgPrimary text-textPrimary flex items-center justify-center">
        <p className="text-textSecondary">Loading...</p>
      </div>
    }>
      <EmbedPageContent />
    </Suspense>
  );
}

