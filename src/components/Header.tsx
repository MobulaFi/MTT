'use client';
import { useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { ApiSelectorDropdown } from './header/ApiSelectorDropdown';
import { WalletConnectButton } from './header/WalletConnectButton';

const SearchModal = dynamic(() => import('./SearchModal').then(mod => ({ default: mod.SearchModal })), { ssr: false });
const NetworkDebuggerModal = dynamic(() => import('./NetworkDebuggerModal').then(mod => ({ default: mod.NetworkDebuggerModal })), { ssr: false });
import { Plus_Jakarta_Sans } from 'next/font/google';
import { FiSearch } from 'react-icons/fi';
import { useApiStore } from '@/store/apiStore';
import { useHeaderStore } from '@/store/useHeaderStore';
import { initMobulaClient } from '@/lib/mobulaClient';
import { LatencyIndicator } from './header/LatencyIndicator';
import SafeImage from '@/components/SafeImage';
import { usePathname } from 'next/navigation';
import { useNavigationStore, type SpaPagePath } from '@/store/useNavigationStore';
import { MobileWarningBanner } from '@/components/MobileWarningBanner';
import { PositionsBar } from '@/components/header/PositionsBar';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
  variable: '--font-plus-jakarta',
});

const Header = () => {
  const apiButtonRef = useRef<HTMLButtonElement>(null);
  const latencyIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();
  const spaView = useNavigationStore((s) => s.view);
  const navigateToPage = useNavigationStore((s) => s.navigateToPage);
  // Derive active path from SPA view (pushState doesn't update usePathname)
  const activePath = spaView
    ? spaView.type === 'page' ? spaView.path : null
    : pathname;

  const { currentUrl, getLabelForUrl, apiKeySource, serverDisplayLabel, serverLatency, setServerDisplayInfo } = useApiStore();

  
  
  const {
    isSearchOpen,
    isApiSelectorOpen,
    isNetworkDebuggerOpen,
    latency,
    openSearch,
    closeSearch,
    toggleApiSelector,
    closeApiSelector,
    openNetworkDebugger,
    closeNetworkDebugger,
    setLatency,
  } = useHeaderStore();

  useEffect(() => {
    initMobulaClient(currentUrl);
  }, [currentUrl]);

  const checkLatency = useCallback(async () => {
    try {
      const start = performance.now();
      await fetch(currentUrl, { method: 'GET', cache: 'no-cache' });
      const end = performance.now();

      const latencyMs = Math.round(end - start);
      const newLatency = `${latencyMs}ms`;
      
      // Get current latency from store without creating dependency
      const currentLatency = useHeaderStore.getState().latency;
      
      // Only update if latency changed to avoid unnecessary re-renders
      if (currentLatency !== newLatency) {
        setLatency(newLatency);
      }
    } catch {
      setLatency('offline');
    }
  }, [currentUrl, setLatency]);

  // When Server is selected but no display info (e.g. after refresh), fetch server config for header
  useEffect(() => {
    if (apiKeySource !== 'server' || serverDisplayLabel != null) return;
    let cancelled = false;
    setServerDisplayInfo('Server (env)', '...');
    fetch('/api/mobula-server-config', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { restUrl: string }) => {
        if (cancelled) return;
        const start = performance.now();
        fetch(data.restUrl, { method: 'GET', cache: 'no-cache' })
          .then(() => {
            if (cancelled) return;
            const ms = Math.round(performance.now() - start);
            setServerDisplayInfo('Server (env)', `${ms}ms`);
          })
          .catch(() => {
            if (cancelled) return;
            setServerDisplayInfo('Server (env)', 'error');
          });
      })
      .catch(() => {
        if (cancelled) return;
        setServerDisplayInfo('Server (env)', 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [apiKeySource, serverDisplayLabel, setServerDisplayInfo]);

  // Check latency once on mount (client mode only) — no polling to save CPU/network.
  useEffect(() => {
    if (apiKeySource === 'server') return;
    checkLatency();
  }, [checkLatency, apiKeySource]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const handleSlashShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable;

      if (isEditable) return;

      if (event.key === '/' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        openSearch();
      }
    };

    window.addEventListener('keydown', handleSlashShortcut, { signal });
    return () => controller.abort();
  }, []);

  return (
    <>
      <header className="w-full bg-bgPrimary text-white">
        <div className="flex items-center border-b h-[56px] sm:h-[72px] border-borderDefault justify-between px-4 sm:px-6 lg:px-8">
          {/* Left side: Logo, Search, Nav */}
          <div className="flex items-center gap-3 sm:gap-4 md:gap-5 lg:gap-8 flex-1 min-w-0">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0">
              <SafeImage
                src="/hawk.jpg"
                alt="Hawk Logo"
                width={64}
                height={64}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full"
                priority
              />
            </div>

            {/* Search - Hidden on small mobile, visible from sm */}
            <div
              onClick={openSearch}
              className="hidden sm:flex flex-1 max-w-xs md:max-w-sm lg:max-w-md h-10 sm:h-11 relative cursor-pointer"
            >
              <input
                type="text"
                placeholder="Search token or address..."
                className="w-full bg-bgOverlay border border-borderDefault text-grayLight text-[13px] sm:text-sm placeholder-textTertiary rounded-lg pl-11 pr-12 py-2 focus:outline-none cursor-pointer tracking-wide"
                readOnly
              />
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-textTertiary" size={17} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 border-borderSecondary border rounded-[3px] text-[10px] font-semibold text-textTertiary px-1.5 py-0.5 flex justify-center items-center">
                <span className="animate-spinSlow inline-block">/</span>
              </span>
            </div>

            {/* Search Icon for Mobile */}
            <button
              onClick={openSearch}
              className="sm:hidden p-2 text-textTertiary hover:text-textPrimary hover:bg-bgOverlay rounded-lg transition"
              aria-label="Search"
            >
              <FiSearch size={20} />
            </button>

            {/* Nav - Hidden on mobile/tablet, visible from lg */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {([
                { path: '/trendings' as SpaPagePath, label: 'Trending' },
                { path: '/surge' as SpaPagePath, label: 'Surge' },
                { path: '/pulse' as SpaPagePath, label: 'Pulse' },
                { path: '/portfolio' as SpaPagePath, label: 'Portfolio' },
              ] as const).map(({ path, label }) => (
                <button
                  key={path}
                  type="button"
                  onClick={() => navigateToPage(path)}
                  className={`nav-item-hover text-[13px] xl:text-sm px-3.5 py-2 rounded-md whitespace-nowrap tracking-wide ${
                    activePath === path
                      ? 'nav-item-active text-white font-medium'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => navigateToPage('/x-tracker')}
                className={`nav-item-hover text-[13px] xl:text-sm px-3.5 py-2 rounded-md whitespace-nowrap tracking-wide ${
                  activePath === '/x-tracker'
                    ? 'nav-item-active text-white font-medium'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Tracker
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 text-sm flex-shrink-0">
            <div className="flex-shrink-0">
              <WalletConnectButton />
            </div>

            <div className="flex-shrink-0">
            <LatencyIndicator
              currentUrl={currentUrl}
              latency={latency}
              isApiSelectorOpen={isApiSelectorOpen}
              toggleSelector={toggleApiSelector}
              buttonRef={apiButtonRef}
              getLabelForUrl={getLabelForUrl}
              displayLabel={apiKeySource === 'server' ? serverDisplayLabel : undefined}
              displayLatency={apiKeySource === 'server' ? serverLatency : undefined}
            />
            </div>
          </div>
        </div>
        <PositionsBar />
        <MobileWarningBanner />
      </header>

      {/* Modals */}
      <SearchModal isOpen={isSearchOpen} onClose={closeSearch} />
      <ApiSelectorDropdown
        isOpen={isApiSelectorOpen}
        onClose={closeApiSelector}
        buttonRef={apiButtonRef}
      />
      <NetworkDebuggerModal
        isOpen={isNetworkDebuggerOpen}
        onClose={closeNetworkDebugger}
      />
    </>
  );
};

export default Header;