'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FiChevronDown, FiCopy, FiCheck } from 'react-icons/fi';
import type { SelectedWalletType } from '../hooks/usePortfolioData';

interface WalletSelectorProps {
  selectedWalletType: SelectedWalletType;
  onSelect: (type: SelectedWalletType) => void;
  solanaAddress: string | null;
  evmAddress: string | null;
}

const fmt = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

function ChainRow({ name, color, address, isSelected, onSelect, onCopy, copied }: {
  name: string;
  color: string;
  address: string;
  isSelected: boolean;
  onSelect: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-center">
      <button
        onClick={onSelect}
        className="flex-1 px-3 py-2.5 flex items-center gap-3 hover:bg-bgOverlay transition-colors min-w-0"
      >
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}33` }}
        >
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        </div>
        <div className="flex flex-col items-start flex-1 min-w-0">
          <span className="text-[13px] text-textPrimary">{name}</span>
          <span className="text-[11px] text-textTertiary font-mono">{fmt(address)}</span>
        </div>
        {isSelected && (
          <FiCheck size={14} className="text-success flex-shrink-0" />
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onCopy(); }}
        className="px-3 py-2.5 text-textTertiary hover:text-textPrimary transition-colors flex-shrink-0"
      >
        {copied ? <FiCheck size={13} className="text-success" /> : <FiCopy size={13} />}
      </button>
    </div>
  );
}

export function WalletSelector({
  selectedWalletType,
  onSelect,
  solanaAddress,
  evmAddress,
}: WalletSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node) &&
      buttonRef.current &&
      !buttonRef.current.contains(event.target as Node)
    ) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleClickOutside]);

  const handleCopy = async (addr: string, field: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Determine display label
  const displayLabel = selectedWalletType === 'solana' && solanaAddress
    ? fmt(solanaAddress)
    : selectedWalletType === 'evm' && evmAddress
      ? fmt(evmAddress)
      : 'All Wallets';

  const dotColor = selectedWalletType === 'solana'
    ? '#9945FF'
    : selectedWalletType === 'evm'
      ? '#627EEA'
      : '#0ECB81';

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 bg-bgOverlay hover:bg-bgTertiary rounded-lg px-4 py-2 transition-colors group"
      >
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor }}
        />
        <span className="text-sm text-textSecondary font-medium">
          {displayLabel}
        </span>
        <FiChevronDown
          size={14}
          className={`text-textTertiary group-hover:text-white transition-all ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute left-0 top-full mt-1.5 z-50 w-[280px] bg-bgPrimary border border-borderDefault rounded-xl shadow-xl overflow-hidden"
        >
          {/* All Wallets */}
          <button
            onClick={() => { onSelect('all'); setIsOpen(false); }}
            className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-bgOverlay transition-colors"
          >
            <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-success" />
            </div>
            <span className="text-[13px] text-textPrimary flex-1 text-left">All Wallets</span>
            {selectedWalletType === 'all' && (
              <FiCheck size={14} className="text-success flex-shrink-0" />
            )}
          </button>

          <div className="mx-3 border-t border-borderDefault" />

          {/* Solana */}
          {solanaAddress && (
            <ChainRow
              name="Solana"
              color="#9945FF"
              address={solanaAddress}
              isSelected={selectedWalletType === 'solana'}
              onSelect={() => { onSelect('solana'); setIsOpen(false); }}
              onCopy={() => handleCopy(solanaAddress, 'sol')}
              copied={copiedField === 'sol'}
            />
          )}

          {/* EVM chains — same address, shown as separate chains */}
          {evmAddress && (
            <>
              <ChainRow
                name="Base"
                color="#0052FF"
                address={evmAddress}
                isSelected={selectedWalletType === 'evm'}
                onSelect={() => { onSelect('evm'); setIsOpen(false); }}
                onCopy={() => handleCopy(evmAddress, 'base')}
                copied={copiedField === 'base'}
              />
              <ChainRow
                name="Ethereum"
                color="#627EEA"
                address={evmAddress}
                isSelected={selectedWalletType === 'evm'}
                onSelect={() => { onSelect('evm'); setIsOpen(false); }}
                onCopy={() => handleCopy(evmAddress, 'eth')}
                copied={copiedField === 'eth'}
              />
              <ChainRow
                name="BSC"
                color="#F0B90B"
                address={evmAddress}
                isSelected={selectedWalletType === 'evm'}
                onSelect={() => { onSelect('evm'); setIsOpen(false); }}
                onCopy={() => handleCopy(evmAddress, 'bsc')}
                copied={copiedField === 'bsc'}
              />
            </>
          )}

          <div className="h-1" />
        </div>
      )}
    </div>
  );
}
