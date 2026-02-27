'use client';

import React, { useState } from 'react';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { Copy, Check, Wallet, ChevronDown } from 'lucide-react';

export function WalletInfoDropdown() {
  const { address, isConnected } = useWalletConnection();

  const [isOpen, setIsOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const shortenAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!isConnected || !address) {
    return null;
  }

  const displayAddress = address;

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors border border-neutral-700"
      >
        <Wallet className="w-4 h-4 text-green-400" />
        <span className="text-sm font-medium text-white">
          {shortenAddress(displayAddress)}
        </span>
        <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-80 bg-neutral-900 rounded-xl border border-neutral-700 shadow-xl z-50 overflow-hidden">
            <div className="p-4 space-y-3">
              <h4 className="text-xs text-neutral-400 uppercase tracking-wider mb-3">Wallet Address</h4>
              <AddressRow
                label="Connected"
                address={displayAddress}
                copied={copiedField === 'main'}
                onCopy={() => copyToClipboard(displayAddress, 'main')}
                highlight
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Address Row Component
function AddressRow({
  label,
  address,
  copied,
  onCopy,
  highlight = false,
}: {
  label: string;
  address: string;
  copied: boolean;
  onCopy: () => void;
  highlight?: boolean;
}) {
  const shortenAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
  };

  return (
    <div className={`p-2.5 rounded-lg ${highlight ? 'bg-green-900/20 border border-green-500/20' : 'bg-neutral-800/50'}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs ${highlight ? 'text-green-400' : 'text-neutral-400'}`}>
          {label}
        </span>
        <button
          onClick={onCopy}
          className="p-1 hover:bg-neutral-700 rounded transition-colors"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-neutral-400" />
          )}
        </button>
      </div>
      <p className="text-sm text-white font-mono mt-1">
        {shortenAddress(address)}
      </p>
    </div>
  );
}

export default WalletInfoDropdown;
