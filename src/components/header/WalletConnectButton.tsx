'use client';

import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useHeaderStore } from '@/store/useHeaderStore';
import { FiChevronDown, FiCopy, FiCheck, FiRefreshCw, FiArrowDown } from 'react-icons/fi';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import Image from 'next/image';

// Map Mobula chain IDs to EVM chain IDs and names
const MOBULA_CHAIN_MAP: Record<string, { chainId: number; name: string }> = {
  'evm:1': { chainId: 1, name: 'Ethereum' },
  'evm:10': { chainId: 10, name: 'Optimism' },
  'evm:56': { chainId: 56, name: 'BNB Chain' },
  'evm:137': { chainId: 137, name: 'Polygon' },
  'evm:8453': { chainId: 8453, name: 'Base' },
  'evm:42161': { chainId: 42161, name: 'Arbitrum' },
  'evm:43114': { chainId: 43114, name: 'Avalanche' },
  'evm:250': { chainId: 250, name: 'Fantom' },
  'evm:100': { chainId: 100, name: 'Gnosis' },
  'evm:59144': { chainId: 59144, name: 'Linea' },
  'evm:324': { chainId: 324, name: 'zkSync' },
  'evm:534352': { chainId: 534352, name: 'Scroll' },
  'evm:5000': { chainId: 5000, name: 'Mantle' },
  'evm:169': { chainId: 169, name: 'Manta' },
  'evm:81457': { chainId: 81457, name: 'Blast' },
  'evm:34443': { chainId: 34443, name: 'Mode' },
  'evm:1284': { chainId: 1284, name: 'Moonbeam' },
  'evm:1285': { chainId: 1285, name: 'Moonriver' },
  'evm:42220': { chainId: 42220, name: 'Celo' },
  'evm:25': { chainId: 25, name: 'Cronos' },
  'evm:2222': { chainId: 2222, name: 'Kava' },
  'evm:1088': { chainId: 1088, name: 'Metis' },
  'evm:1101': { chainId: 1101, name: 'Polygon zkEVM' },
  'evm:204': { chainId: 204, name: 'opBNB' },
  'evm:1329': { chainId: 1329, name: 'Sei' },
  'evm:167000': { chainId: 167000, name: 'Taiko' },
  'evm:7000': { chainId: 7000, name: 'ZetaChain' },
  'evm:4200': { chainId: 4200, name: 'Merlin' },
  'evm:60808': { chainId: 60808, name: 'BOB' },
  'evm:7560': { chainId: 7560, name: 'Cyber' },
  'evm:122': { chainId: 122, name: 'Fuse' },
  'evm:4689': { chainId: 4689, name: 'IoTeX' },
  'evm:1030': { chainId: 1030, name: 'Conflux' },
  'evm:3776': { chainId: 3776, name: 'Astar zkEVM' },
  'evm:42766': { chainId: 42766, name: 'ZKFair' },
  'evm:195': { chainId: 195, name: 'XLayer' },
};

export const WalletConnectButton = () => {
  const pathname = usePathname();
  const { address, isConnected, chainId, evmChain, evmAddress, solanaAddress, disconnect, switchChain } = useWalletConnection();
  const openWalletModal = useHeaderStore((state) => state.openWalletModal);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Detect required chain from URL (EVM only for switch network)
  const requiredChain = useMemo(() => {
    if (!pathname) return null;
    const match = pathname.match(/\/(token|pair)\/([^/]+)\//);
    if (match && match[2]) {
      return MOBULA_CHAIN_MAP[match[2]] || null;
    }
    return null;
  }, [pathname]);

  const isWrongNetwork = useMemo(() => {
    if (!requiredChain || !chainId) return false;
    return chainId !== requiredChain.chainId;
  }, [requiredChain, chainId]);

  const handleSwitchNetwork = useCallback(async () => {
    if (!requiredChain || isSwitching) return;
    setIsSwitching(true);
    try {
      await switchChain(requiredChain.chainId);
    } catch (error) {
      console.error('Failed to switch network:', error);
    } finally {
      setIsSwitching(false);
    }
  }, [requiredChain, isSwitching, switchChain]);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node) &&
      buttonRef.current &&
      !buttonRef.current.contains(event.target as Node)
    ) {
      setIsDropdownOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, handleClickOutside]);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  const formatAddressMedium = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleConnect = () => {
    openWalletModal();
  };

  const handleDisconnect = () => {
    disconnect();
    setIsDropdownOpen(false);
  };

  const handleCopyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const handleCopyUAAddress = async (addr: string, field: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const getExplorerUrl = (): string | null => {
    if (!address) return null;
    if (evmAddress && evmChain?.blockExplorers?.default?.url) {
      return `${evmChain.blockExplorers.default.url}/address/${address}`;
    }
    if (solanaAddress) {
      return `https://solscan.io/account/${address}`;
    }
    return null;
  };

  const handleOpenExplorer = () => {
    const url = getExplorerUrl();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  if (isConnected && address) {
    const explorerUrl = getExplorerUrl();

    return (
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`px-2 py-1 h-7 flex items-center gap-1.5 sm:gap-2 bg-bgContainer border rounded hover:bg-bgContainer/50 transition-colors cursor-pointer ${
            isWrongNetwork ? 'border-warning/50' : 'border-borderDefault'
          }`}
        >
          <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full relative flex-shrink-0 ${
            isWrongNetwork ? 'bg-warning/30' : 'bg-success/30'
          }`}>
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
              isWrongNetwork ? 'bg-warning' : 'bg-success'
            }`} />
          </div>
          <span className={`text-[11px] sm:text-[12px] font-medium ${
            isWrongNetwork ? 'text-warning' : 'text-success'
          }`}>
            {formatAddress(address)}
          </span>
          <FiChevronDown
            size={12}
            className={`transition-transform duration-200 flex-shrink-0 ${
              isWrongNetwork ? 'text-warning' : 'text-success'
            } ${isDropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isDropdownOpen && (
          <div
            ref={dropdownRef}
            className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-auto sm:top-full mt-1.5 z-[9999] sm:w-[320px] bg-bgPrimary border border-borderDefault rounded-xl shadow-xl overflow-hidden"
          >
            {/* Header - Compact */}
            <div className="px-3 pt-3 pb-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Compact Avatar */}
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-bgTertiary">
                    <svg viewBox="0 0 8 8" className="w-full h-full">
                      <rect fill="#F59E0B" x="2" y="1" width="1" height="1"/>
                      <rect fill="#8B5CF6" x="3" y="1" width="2" height="1"/>
                      <rect fill="#F59E0B" x="5" y="1" width="1" height="1"/>
                      <rect fill="#10B981" x="1" y="2" width="1" height="1"/>
                      <rect fill="#F59E0B" x="2" y="2" width="1" height="1"/>
                      <rect fill="#3B82F6" x="3" y="2" width="1" height="1"/>
                      <rect fill="#EC4899" x="4" y="2" width="1" height="1"/>
                      <rect fill="#F59E0B" x="5" y="2" width="1" height="1"/>
                      <rect fill="#10B981" x="6" y="2" width="1" height="1"/>
                      <rect fill="#8B5CF6" x="1" y="3" width="1" height="1"/>
                      <rect fill="#F59E0B" x="2" y="3" width="2" height="2"/>
                      <rect fill="#3B82F6" x="4" y="3" width="2" height="2"/>
                      <rect fill="#8B5CF6" x="6" y="3" width="1" height="1"/>
                      <rect fill="#10B981" x="1" y="4" width="1" height="1"/>
                      <rect fill="#EC4899" x="6" y="4" width="1" height="1"/>
                      <rect fill="#F59E0B" x="1" y="5" width="1" height="1"/>
                      <rect fill="#8B5CF6" x="2" y="5" width="1" height="1"/>
                      <rect fill="#10B981" x="3" y="5" width="2" height="1"/>
                      <rect fill="#EC4899" x="5" y="5" width="1" height="1"/>
                      <rect fill="#3B82F6" x="6" y="5" width="1" height="1"/>
                      <rect fill="#F59E0B" x="2" y="6" width="1" height="1"/>
                      <rect fill="#8B5CF6" x="3" y="6" width="2" height="1"/>
                      <rect fill="#3B82F6" x="5" y="6" width="1" height="1"/>
                    </svg>
                  </div>
                  <span className="text-[13px] text-textPrimary font-semibold">MTT Account</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-textTertiary">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  <span className="px-1.5 py-px bg-accentPurple/20 text-accentPurple text-[9px] font-bold rounded">LV1</span>
                </div>
              </div>
              
              {/* Addresses Row - Inline */}
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => handleCopyUAAddress(address, 'main')}
                  className="flex items-center gap-1 text-textSecondary hover:text-textPrimary transition-colors group"
                >
                  <span className="text-[11px] font-mono">{formatAddress(address)}</span>
                  {copiedField === 'main' ? (
                    <FiCheck size={10} className="text-success" />
                  ) : (
                    <FiCopy size={10} className="opacity-40 group-hover:opacity-100" />
                  )}
                </button>
                {evmAddress && solanaAddress && (
                  <button
                    onClick={() => handleCopyUAAddress(evmAddress === address ? solanaAddress : evmAddress, 'alt')}
                    className="flex items-center gap-1 text-textSecondary hover:text-textPrimary transition-colors group"
                  >
                    <span className="text-[11px] font-mono">{formatAddress(evmAddress === address ? solanaAddress : evmAddress)}</span>
                    {copiedField === 'alt' ? (
                      <FiCheck size={10} className="text-success" />
                    ) : (
                      <FiCopy size={10} className="opacity-40 group-hover:opacity-100" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Deposit Button */}
            <div className="px-3 py-2.5">
              <button
                onClick={() => { setShowReceiveModal(true); setIsDropdownOpen(false); }}
                className="w-full px-3 py-2 flex items-center justify-center gap-2 bg-bgTertiary hover:bg-bgContainer rounded-lg transition-colors group"
              >
                <FiArrowDown size={14} className="text-textPrimary" />
                <span className="text-xs text-textPrimary font-medium">Deposit</span>
              </button>
            </div>

            {/* Wrong network warning */}
            {isWrongNetwork && requiredChain && (
              <div className="px-4 py-2 bg-warning/5 border-t border-warning/20">
                <button
                  onClick={handleSwitchNetwork}
                  disabled={isSwitching}
                  className="w-full px-3 py-2 flex items-center justify-center gap-2 bg-warning/10 hover:bg-warning/20 text-warning rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <FiRefreshCw size={12} className={isSwitching ? 'animate-spin' : ''} />
                  <span>{isSwitching ? 'Switching...' : `Switch to ${requiredChain.name}`}</span>
                </button>
              </div>
            )}

            {/* Promo Banner Carousel */}
            <PromoBannerCarousel />

            {/* Disconnect Button - Compact */}
            <div className="px-3 pb-2.5">
              <button
                onClick={handleDisconnect}
                className="w-full py-1.5 flex items-center justify-center gap-1.5 bg-[#E8606A]/80 hover:bg-[#E8606A] text-white rounded-lg transition-colors text-xs font-medium"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 7h3a5 5 0 0 1 0 10h-3m-6 0H6a5 5 0 0 1 0-10h3"/>
                  <line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        )}

        {/* Receive Modal */}
        {showReceiveModal && (
          <ReceiveModal 
            onClose={() => setShowReceiveModal(false)}
            evmAddress={evmAddress || null}
            solanaAddress={solanaAddress || null}
          />
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      className="px-2 py-1 h-7 flex items-center gap-2 bg-bgContainer border border-borderDefault rounded hover:bg-bgContainer/50 transition-colors cursor-pointer"
    >
      <span className="text-[12px] font-medium text-textTertiary hover:text-white transition-colors">
        Connect
      </span>
    </button>
  );
};

import { 
  type PromoBanner,
  type BannerAccent,
  getEnabledBanners, 
  fetchBannersFromAPI 
} from '@/config/promoBanners';

// Theme-compatible accent styles for banners
const BANNER_ACCENT_STYLES: Record<BannerAccent, {
  border: string;
  glow1: string;
  glow2: string;
  subtitle: string;
  gradient: string;
}> = {
  purple: {
    border: 'border-accentPurple/20',
    glow1: 'bg-accentPurple/20',
    glow2: 'bg-accentRose/20',
    subtitle: 'text-accentPurple',
    gradient: 'from-bgPrimary via-bgTertiary to-bgSurface',
  },
  blue: {
    border: 'border-blue-500/20',
    glow1: 'bg-blue-500/20',
    glow2: 'bg-cyan-500/20',
    subtitle: 'text-blue-400',
    gradient: 'from-bgPrimary via-bgSecondary to-bgSurface',
  },
  green: {
    border: 'border-success/20',
    glow1: 'bg-success/20',
    glow2: 'bg-emerald-500/20',
    subtitle: 'text-success',
    gradient: 'from-bgPrimary via-bgTertiary to-bgSurface',
  },
  orange: {
    border: 'border-orange-500/20',
    glow1: 'bg-orange-500/20',
    glow2: 'bg-amber-500/20',
    subtitle: 'text-orange-400',
    gradient: 'from-bgPrimary via-bgTertiary to-bgSurface',
  },
  pink: {
    border: 'border-accentRose/20',
    glow1: 'bg-accentRose/20',
    glow2: 'bg-pink-500/20',
    subtitle: 'text-accentRose',
    gradient: 'from-bgPrimary via-bgSecondary to-bgSurface',
  },
  neutral: {
    border: 'border-borderDefault',
    glow1: 'bg-textTertiary/10',
    glow2: 'bg-grayLight/10',
    subtitle: 'text-textSecondary',
    gradient: 'from-bgPrimary via-bgTertiary to-bgSurface',
  },
};

// Promo Banner Carousel Component
function PromoBannerCarousel({ 
  banners: propBanners,
  autoScrollInterval = 4000,
  fetchFromAPI = false,
}: { 
  banners?: PromoBanner[];
  autoScrollInterval?: number;
  fetchFromAPI?: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [banners, setBanners] = useState<PromoBanner[]>(propBanners || getEnabledBanners());

  // Fetch banners from API if enabled
  useEffect(() => {
    if (fetchFromAPI) {
      fetchBannersFromAPI().then((apiBanners) => {
        if (apiBanners && apiBanners.length > 0) {
          setBanners(apiBanners);
        }
      });
    }
  }, [fetchFromAPI]);

  // Update banners if props change
  useEffect(() => {
    if (propBanners) {
      setBanners(propBanners);
    }
  }, [propBanners]);

  // Auto-scroll effect
  useEffect(() => {
    if (isHovered || banners.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, autoScrollInterval);

    return () => clearInterval(interval);
  }, [banners.length, isHovered, autoScrollInterval]);

  const currentBanner = banners[currentIndex];

  const handleDotClick = (index: number) => {
    setCurrentIndex(index);
  };

  const handleBannerClick = () => {
    if (currentBanner.link) {
      window.open(currentBanner.link, '_blank');
    }
  };

  const accentStyle = BANNER_ACCENT_STYLES[currentBanner.accent] || BANNER_ACCENT_STYLES.neutral;

  return (
    <div className="px-3 py-2">
      <div 
        className={`relative w-full h-[90px] rounded-lg overflow-hidden bg-bgTertiary border ${accentStyle.border} cursor-pointer transition-all duration-300 hover:border-opacity-40`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleBannerClick}
      >
        {/* Background glow effects - subtle */}
        <div className={`absolute right-0 top-0 w-20 h-20 ${accentStyle.glow1} blur-2xl rounded-full`} />
        <div className={`absolute right-2 bottom-0 w-16 h-16 ${accentStyle.glow2} blur-xl rounded-full`} />
        
        {/* Content */}
        <div className="relative z-10 p-3 h-full flex flex-col justify-center">
          <h3 className="text-[11px] font-bold text-textPrimary leading-tight">{currentBanner.title}</h3>
          <h3 className={`text-[11px] font-bold ${accentStyle.subtitle} leading-tight`}>{currentBanner.subtitle}</h3>
          <p className="text-[9px] text-textTertiary mt-1 leading-snug max-w-[160px] line-clamp-2">
            {currentBanner.description}
          </p>
        </div>

        {/* Banner Image */}
        <div className="absolute right-0 top-0 bottom-0 w-[40%] overflow-hidden">
          {currentBanner.image && (
            <div 
              className="absolute inset-0 bg-contain bg-right bg-no-repeat opacity-80"
              style={{ backgroundImage: `url(${currentBanner.image})` }}
            />
          )}
          {/* Fallback decoration */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-16 h-16 opacity-30">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <polygon 
                points="50,10 90,30 90,70 50,90 10,70 10,30" 
                fill="none" 
                className={`stroke-current ${accentStyle.subtitle}`}
                strokeWidth="1.5" 
                opacity="0.6"
              />
            </svg>
          </div>
        </div>
      </div>
      
      {/* Carousel dots */}
      {banners.length > 1 && (
        <div className="flex items-center justify-center gap-1 mt-2">
          {banners.map((banner, index) => (
            <button
              key={banner.id}
              onClick={() => handleDotClick(index)}
              className={`h-1 rounded-full transition-all duration-200 ${
                index === currentIndex 
                  ? `w-2.5 ${BANNER_ACCENT_STYLES[banner.accent]?.subtitle.replace('text-', 'bg-') || 'bg-textPrimary'}` 
                  : 'w-1 bg-textTertiary/30 hover:bg-textTertiary/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}


// Receive Modal Component - Shows only the connected wallet type
function ReceiveModal({ 
  onClose, 
  evmAddress, 
  solanaAddress 
}: { 
  onClose: () => void; 
  evmAddress: string | null;
  solanaAddress: string | null;
}) {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [showQR, setShowQR] = useState<boolean>(false);

  const handleCopy = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress('main');
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const formatAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  // Show only the connected wallet type
  const isSolana = !!solanaAddress;
  const address = isSolana ? solanaAddress : evmAddress;
  
  if (!address) {
    return null;
  }

  const network = isSolana ? {
    id: 'solana',
    name: 'Solana',
    address: address,
    logo: 'https://metadata.mobula.io/assets/logos/solana_solana_So11111111111111111111111111111111111111112.webp',
    subtext: 'SVM Network',
  } : {
    id: 'evm',
    name: 'EVM Networks',
    address: address,
    logo: 'https://metadata.mobula.io/assets/logos/evm_1_0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.webp',
    subtext: 'Ethereum, Base, Arbitrum, Polygon, Optimism, BNB, Avalanche +15',
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-bgBackdrop backdrop-blur-[2px] p-4" onClick={onClose}>
      <div 
        className="w-full max-w-sm bg-bgPrimary border border-borderDefault rounded-xl shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-borderDefault">
          <h2 className="text-base font-semibold text-textPrimary">Receive</h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-md text-textTertiary hover:text-textPrimary hover:bg-bgTertiary transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-xs text-textSecondary mb-4">
            {isSolana ? 'Deposit tokens to your Solana address.' : 'Deposit tokens to your EVM address. Same address for all EVM chains.'}
          </p>

          {/* Network Card */}
          <div className={`rounded-lg overflow-hidden border ${
            showQR ? 'bg-bgTertiary border-borderDefault' : 'bg-bgOverlay border-transparent hover:bg-bgTertiary'
          }`}>
            {/* Network Row */}
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Image 
                  src={network.logo} 
                  alt={network.name}
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full flex-shrink-0"
                  unoptimized
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-textPrimary font-medium">{network.name}</p>
                  <p className="text-[10px] text-textTertiary truncate">{network.subtext}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-textSecondary font-mono">{formatAddr(network.address)}</span>
                <button
                  onClick={() => handleCopy(network.address)}
                  className="p-1.5 rounded-md hover:bg-bgContainer transition-colors"
                >
                  {copiedAddress === 'main' ? (
                    <FiCheck size={14} className="text-success" />
                  ) : (
                    <FiCopy size={14} className="text-textTertiary" />
                  )}
                </button>
                <button
                  onClick={() => setShowQR(!showQR)}
                  className={`p-1.5 rounded-md transition-colors ${
                    showQR ? 'bg-success/10 text-success' : 'hover:bg-bgContainer text-textTertiary'
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/>
                    <rect x="14" y="14" width="3" height="3"/>
                    <rect x="18" y="14" width="3" height="3"/>
                    <rect x="14" y="18" width="3" height="3"/>
                    <rect x="18" y="18" width="3" height="3"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* QR Code Expanded */}
            {showQR && (
              <div className="px-4 pb-4 pt-3 flex flex-col items-center border-t border-borderDefault/50">
                <div className="bg-white p-3 rounded-lg relative">
                  <QRCodeSVG
                    value={network.address}
                    size={160}
                    level="H"
                    includeMargin={false}
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                  />
                  <Image 
                    src={network.logo}
                    alt={network.name}
                    width={36}
                    height={36}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full shadow-md bg-white p-0.5"
                    unoptimized
                  />
                </div>
                <p className="text-[10px] text-textTertiary mt-3 font-mono text-center break-all px-4">
                  {network.address}
                </p>
                <button
                  onClick={() => handleCopy(network.address)}
                  className="mt-2 px-4 py-1.5 bg-bgContainer hover:bg-bgTertiary rounded-md text-xs text-textPrimary transition-colors flex items-center gap-2"
                >
                  {copiedAddress === 'main' ? (
                    <>
                      <FiCheck size={12} className="text-success" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <FiCopy size={12} />
                      Copy Address
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

