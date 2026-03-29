'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { X, Check, Copy } from 'lucide-react';
import { truncate } from '@mobula_labs/sdk';

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectWalletModal({ isOpen, onClose }: ConnectWalletModalProps) {
  const {
    connect,
    isConnected,
    solanaAddress,
    evmAddress,
    disconnect,
  } = useWalletConnection();

  const [copied, setCopied] = useState<string | null>(null);

  const handleConnect = () => {
    connect();
    onClose();
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  };

  const handleCopyAddress = async (address: string, key: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(key);
      setTimeout(() => setCopied(null), 800);
      toast.success('Copied', {
        icon: <Check className="w-4 h-4 text-success" />,
      });
    } catch {
      toast.error('Failed to copy address');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-3 sm:px-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-sm flex-col rounded-lg bg-bgPrimary shadow-2xl border border-borderDefault overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-borderDefault">
          <h2 className="text-sm sm:text-base font-semibold text-textPrimary">
            {isConnected ? 'Wallet Connected' : 'Connect Wallet'}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-textTertiary hover:text-textPrimary hover:bg-bgOverlay transition-all"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4">
          {isConnected ? (
            <>
              <div className="bg-bgSecondary/50 rounded-xl p-5 border border-borderDefault mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-textPrimary">Privy Wallet</p>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-bgOverlay/50 rounded-full mt-0.5">
                      <div className="w-1.5 h-1.5 bg-success rounded-full" />
                      <span className="text-[10px] text-success font-medium uppercase tracking-wide">Connected</span>
                    </div>
                  </div>
                </div>

                {/* Solana address */}
                {solanaAddress && (
                  <button
                    onClick={() => handleCopyAddress(solanaAddress, 'solana')}
                    className="w-full text-xs text-textTertiary font-mono bg-bgOverlay/30 hover:bg-bgOverlay/50 px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-2 border border-borderDefault/50 hover:border-borderDefault mb-2"
                  >
                    <span className="text-[10px] text-textTertiary font-sans mr-1">SOL</span>
                    <span className={`truncate flex-1 text-left ${copied === 'solana' ? 'text-textPrimary' : ''}`}>
                      {truncate(solanaAddress, { length: 12, mode: 'middle' })}
                    </span>
                    {copied === 'solana' ? (
                      <Check className="w-3.5 h-3.5 flex-shrink-0 text-success" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 flex-shrink-0 text-textTertiary" />
                    )}
                  </button>
                )}

                {/* EVM address */}
                {evmAddress && (
                  <button
                    onClick={() => handleCopyAddress(evmAddress, 'evm')}
                    className="w-full text-xs text-textTertiary font-mono bg-bgOverlay/30 hover:bg-bgOverlay/50 px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-2 border border-borderDefault/50 hover:border-borderDefault"
                  >
                    <span className="text-[10px] text-textTertiary font-sans mr-1">EVM</span>
                    <span className={`truncate flex-1 text-left ${copied === 'evm' ? 'text-textPrimary' : ''}`}>
                      {truncate(evmAddress, { length: 12, mode: 'middle' })}
                    </span>
                    {copied === 'evm' ? (
                      <Check className="w-3.5 h-3.5 flex-shrink-0 text-success" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 flex-shrink-0 text-textTertiary" />
                    )}
                  </button>
                )}
              </div>

              <button
                onClick={handleDisconnect}
                className="w-full bg-bgSecondary hover:bg-bgSecondary/80 border border-borderDefault text-textPrimary rounded-lg px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 hover:border-red-500/50 hover:text-red-400"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={handleConnect}
              className="w-full bg-success hover:brightness-110 text-white rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200"
            >
              Sign in with Privy
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
