'use client';

import { useWalletConnection } from '@/hooks/useWalletConnection';
import { FiChevronDown, FiCopy, FiCheck, FiArrowDown, FiArrowUp } from 'react-icons/fi';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Image from 'next/image';
import { WithdrawModal } from './WithdrawModal';
import { useUserPortfolioStore, type UserPosition } from '@/store/useUserPortfolioStore';
import { useNavigationStore } from '@/store/useNavigationStore';
import { fmtUsd } from '@/lib/format';
import SafeImage from '@/components/SafeImage';
import { BalanceChart } from '@/features/portfolio/components/BalanceChart';
import { buildExplorerUrl } from '@mobula_labs/sdk';

export const WalletConnectButton = () => {
  const { address, isConnected, evmAddress, solanaAddress, disconnect, connect } = useWalletConnection();
  const totalBalanceUsd = useUserPortfolioStore((s) => s.totalBalanceUsd);
  const positions = useUserPortfolioStore((s) => s.positions);
  const balanceHistory = useUserPortfolioStore((s) => s.balanceHistory);
  const isHistoryLoading = useUserPortfolioStore((s) => s.isHistoryLoading);
  const totalUsd = isConnected && totalBalanceUsd > 0 ? totalBalanceUsd : null;

  // Top holdings (non-dust, max 6)
  const topHoldings = useMemo(() =>
    positions.filter((p) => p.balanceUSD >= 0.01).slice(0, 6),
    [positions],
  );

  // Aggregate unrealized PnL across all positions
  const totalUnrealizedPnl = useMemo(() =>
    positions.reduce((sum, p) => sum + p.unrealizedPnlUSD, 0),
    [positions],
  );

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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

  const handleConnect = () => {
    connect();
  };

  const handleDisconnect = () => {
    disconnect();
    setIsDropdownOpen(false);
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

  if (isConnected && address) {
    return (
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="header-btn px-3 sm:px-4 py-1.5 sm:py-2 h-9 sm:h-10 flex items-center gap-2 sm:gap-2.5 bg-bgContainer border border-borderDefault rounded-lg hover:bg-bgTertiary hover:border-borderMuted cursor-pointer"
        >
          <div className="w-2 h-2 rounded-full flex-shrink-0 bg-success" />
          {totalUsd !== null && (
            <span className="text-[12px] sm:text-[13px] font-bold text-textPrimary tracking-wide">
              {fmtUsd(totalUsd)}
            </span>
          )}
          <span className="text-[12px] sm:text-[13px] font-medium font-mono text-success tracking-wide">
            {formatAddress(address)}
          </span>
          <FiChevronDown
            size={13}
            className={`transition-transform duration-200 flex-shrink-0 text-success opacity-50 ${isDropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isDropdownOpen && (
          <div
            ref={dropdownRef}
            className="dropdown-animate fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-auto sm:top-full mt-2 z-[9999] sm:w-[360px] bg-bgPrimary border border-borderMuted rounded-xl shadow-2xl shadow-black/60 overflow-hidden"
          >
            {/* ─── Balance Section ─── */}
            <div className="px-5 pt-5 pb-4">
              <div className="text-center">
                <p className="text-[11px] text-textTertiary tracking-widest uppercase font-medium mb-1">Total Balance</p>
                <p className="text-[28px] font-bold text-white font-mono tracking-tight leading-none">
                  {totalUsd !== null ? fmtUsd(totalUsd) : '$0.00'}
                </p>
                {totalUnrealizedPnl !== 0 && (
                  <p className={`text-[12px] font-mono font-medium mt-1.5 ${totalUnrealizedPnl >= 0 ? 'text-success' : 'text-error'}`}>
                    {totalUnrealizedPnl >= 0 ? '+' : ''}{fmtUsd(totalUnrealizedPnl)} unrealized
                  </p>
                )}
              </div>

              {/* Addresses */}
              <div className="flex items-center justify-center gap-3 mt-3">
                {solanaAddress && (
                  <button
                    onClick={() => handleCopyUAAddress(solanaAddress, 'sol')}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-bgContainer/50 hover:bg-bgContainer transition-colors group"
                  >
                    <span className="text-[9px] text-textTertiary font-bold">SOL</span>
                    <span className="text-[10px] font-mono text-textSecondary">{formatAddress(solanaAddress)}</span>
                    {copiedField === 'sol' ? <FiCheck size={9} className="text-success" /> : <FiCopy size={9} className="text-textTertiary group-hover:text-textSecondary" />}
                  </button>
                )}
                {evmAddress && (
                  <button
                    onClick={() => handleCopyUAAddress(evmAddress, 'evm')}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-bgContainer/50 hover:bg-bgContainer transition-colors group"
                  >
                    <span className="text-[9px] text-textTertiary font-bold">EVM</span>
                    <span className="text-[10px] font-mono text-textSecondary">{formatAddress(evmAddress)}</span>
                    {copiedField === 'evm' ? <FiCheck size={9} className="text-success" /> : <FiCopy size={9} className="text-textTertiary group-hover:text-textSecondary" />}
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => { setShowReceiveModal(true); setIsDropdownOpen(false); }}
                  className="flex-1 py-2.5 flex items-center justify-center gap-2 bg-bgContainer border border-borderDefault rounded-lg hover:bg-bgTertiary hover:border-borderMuted transition-all"
                >
                  <FiArrowDown size={13} className="text-success" />
                  <span className="text-[11px] text-textPrimary font-medium">Deposit</span>
                </button>
                <button
                  onClick={() => { setShowWithdrawModal(true); setIsDropdownOpen(false); }}
                  className="flex-1 py-2.5 flex items-center justify-center gap-2 bg-bgContainer border border-borderDefault rounded-lg hover:bg-bgTertiary hover:border-borderMuted transition-all"
                >
                  <FiArrowUp size={13} className="text-textSecondary" />
                  <span className="text-[11px] text-textPrimary font-medium">Withdraw</span>
                </button>
              </div>
            </div>

            {/* ─── Balance History Chart ─── */}
            {balanceHistory.length > 1 && (
              <div className="border-t border-borderDefault px-4 py-3 h-[140px]">
                <BalanceChart history={balanceHistory} isLoading={isHistoryLoading} />
              </div>
            )}

            {/* ─── Holdings ─── */}
            {topHoldings.length > 0 && (
              <div className="border-t border-borderDefault">
                <div className="px-4 py-2 flex items-center justify-between">
                  <span className="text-[10px] text-textTertiary tracking-widest uppercase font-medium">Holdings</span>
                  <button
                    onClick={() => { useNavigationStore.getState().navigateToPage('/portfolio'); setIsDropdownOpen(false); }}
                    className="text-[10px] text-textTertiary hover:text-textSecondary transition-colors"
                  >
                    View all
                  </button>
                </div>
                <div className="px-2 pb-2 space-y-px">
                  {topHoldings.map((pos) => (
                    <HoldingRow key={`${pos.address}_${pos.chainId}`} pos={pos} onClose={() => setIsDropdownOpen(false)} />
                  ))}
                </div>
              </div>
            )}

            {/* ─── Disconnect ─── */}
            <div className="border-t border-borderDefault px-4 py-2.5">
              <button
                onClick={handleDisconnect}
                className="w-full py-1.5 flex items-center justify-center gap-1.5 text-textTertiary hover:text-error transition-colors text-[11px] font-medium"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Disconnect
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

        {/* Withdraw Modal */}
        {showWithdrawModal && (
          <WithdrawModal
            onClose={() => setShowWithdrawModal(false)}
            solanaAddress={solanaAddress || null}
          />
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      className="header-btn px-4 sm:px-5 py-1.5 sm:py-2 h-9 sm:h-10 flex items-center gap-2 bg-bgContainer border border-borderDefault rounded-lg hover:bg-bgTertiary hover:border-borderMuted cursor-pointer"
    >
      <span className="text-[12px] sm:text-[13px] font-medium text-textSecondary hover:text-textPrimary transition-colors tracking-wide">
        Connect
      </span>
    </button>
  );
};

/* ─── Holding Row ─── */
function HoldingRow({ pos, onClose }: { pos: UserPosition; onClose: () => void }) {
  const navigateToToken = useNavigationStore((s) => s.navigateToToken);
  const pnl = pos.unrealizedPnlUSD;
  const pnlPct = pos.avgBuyPriceUSD > 0
    ? ((pos.priceUSD - pos.avgBuyPriceUSD) / pos.avgBuyPriceUSD) * 100
    : 0;

  const explorerUrl = pos.chainId && pos.address ? buildExplorerUrl(pos.chainId, 'token', pos.address) : null;

  return (
    <a
      href={explorerUrl || '#'}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        if (!explorerUrl) {
          e.preventDefault();
          if (pos.blockchain && pos.address) {
            navigateToToken(pos.address, pos.blockchain, pos as unknown as Record<string, unknown>);
          }
        }
        onClose();
      }}
      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-bgContainer/60 transition-colors group"
    >
      <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-bgTertiary">
        {pos.logo ? (
          <SafeImage src={pos.logo} alt={pos.symbol} width={28} height={28} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-textTertiary">
            {pos.symbol.charAt(0)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-textPrimary">{pos.symbol}</span>
          <span className="text-[12px] font-mono font-medium text-textPrimary">{fmtUsd(pos.balanceUSD)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-textTertiary font-mono">{fmtUsd(pos.priceUSD)}</span>
          {pnl !== 0 && (
            <span className={`text-[10px] font-mono font-medium ${pnl >= 0 ? 'text-success' : 'text-error'}`}>
              {pnl >= 0 ? '+' : ''}{fmtUsd(pnl)} {pnlPct !== 0 ? `(${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)` : ''}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

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
  const [showQR, setShowQR] = useState<string | null>(null);

  const handleCopy = async (address: string, key: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(key);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const formatAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const networks = [
    solanaAddress ? {
      id: 'solana',
      name: 'Solana',
      address: solanaAddress,
      logo: 'https://assets.coingecko.com/coins/images/4128/standard/solana.png',
      subtext: 'SVM Network',
    } : null,
    evmAddress ? {
      id: 'evm',
      name: 'EVM Networks',
      address: evmAddress,
      logo: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png',
      subtext: 'Ethereum, Base, Arbitrum, Polygon, Optimism +15',
    } : null,
  ].filter(Boolean) as Array<{ id: string; name: string; address: string; logo: string; subtext: string }>;

  if (networks.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-bgBackdrop backdrop-blur-[2px] p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-bgPrimary border border-borderDefault rounded-xl shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
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

        <div className="p-4">
          <p className="text-xs text-textSecondary mb-4">
            Deposit tokens to your Privy embedded wallet addresses.
          </p>

          {networks.map((network) => (
            <div key={network.id} className={`rounded-lg overflow-hidden border mb-2 ${
              showQR === network.id ? 'bg-bgTertiary border-borderDefault' : 'bg-bgOverlay border-transparent hover:bg-bgTertiary'
            }`}>
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
                    onClick={() => handleCopy(network.address, network.id)}
                    className="p-1.5 rounded-md hover:bg-bgContainer transition-colors"
                  >
                    {copiedAddress === network.id ? (
                      <FiCheck size={14} className="text-success" />
                    ) : (
                      <FiCopy size={14} className="text-textTertiary" />
                    )}
                  </button>
                  <button
                    onClick={() => setShowQR(showQR === network.id ? null : network.id)}
                    className={`p-1.5 rounded-md transition-colors ${
                      showQR === network.id ? 'bg-success/10 text-success' : 'hover:bg-bgContainer text-textTertiary'
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

              {showQR === network.id && (
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
                    onClick={() => handleCopy(network.address, network.id)}
                    className="mt-2 px-4 py-1.5 bg-bgContainer hover:bg-bgTertiary rounded-md text-xs text-textPrimary transition-colors flex items-center gap-2"
                  >
                    {copiedAddress === network.id ? (
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
          ))}
        </div>
      </div>
    </div>
  );
}
