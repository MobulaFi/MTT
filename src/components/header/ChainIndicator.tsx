'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FiChevronDown, FiCheck } from 'react-icons/fi';
import { useWalletConnectionStore } from '@/store/useWalletConnectionStore';
import { EVM_CHAINS } from '@/config/evmChains';

const CHAIN_LOGOS: Record<number, string> = {
  8453: '/chains/base.svg',
  1: '/chains/ethereum.svg',
  56: '/chains/bsc.svg',
};

export function ChainIndicator() {
  const activeChainId = useWalletConnectionStore((s) => s.activeEvmChainId);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const activeChain = EVM_CHAINS.find((c) => c.id === activeChainId) ?? EVM_CHAINS[0];

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

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-borderDefault bg-bgContainer hover:bg-bgOverlay transition text-xs text-textPrimary"
      >
        <div
          style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: activeChain.color, flexShrink: 0 }}
        />
        <span className="font-medium">{activeChain.shortName}</span>
        <FiChevronDown size={12} className="text-textTertiary" />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 z-50 w-52 rounded-xl border border-borderDefault bg-bgPrimary shadow-xl overflow-hidden"
        >
          <div style={{ padding: '10px 12px 6px', fontSize: 10, color: '#6B6B76', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Network
          </div>

          {EVM_CHAINS.map((chain) => {
            const isActive = chain.id === activeChainId;
            const isDisabled = !isActive;

            return (
              <button
                key={chain.id}
                disabled={isDisabled}
                onClick={() => {
                  if (!isDisabled) setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 12px',
                  background: 'none',
                  border: 'none',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.35 : 1,
                  color: '#FCFCFC',
                  fontSize: 13,
                  textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isDisabled) (e.currentTarget.style.background = '#111114');
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none';
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    backgroundColor: chain.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1 }}>{chain.name}</span>
                {isActive ? (
                  <FiCheck size={14} style={{ color: '#0ECB81' }} />
                ) : (
                  <span style={{ fontSize: 9, color: '#4A4A52', whiteSpace: 'nowrap' }}>Coming Soon</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
