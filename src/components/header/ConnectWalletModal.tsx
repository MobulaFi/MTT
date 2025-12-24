'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { X, Check, Copy } from 'lucide-react';
import { truncate } from '@mobula_labs/sdk';
import SafeImage from '@/components/SafeImage';

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ConnectingProvider = 'metamask' | 'phantom' | null;

export function ConnectWalletModal({ isOpen, onClose }: ConnectWalletModalProps) {
  const {
    connectMetaMask,
    connectPhantom,
    isMetaMaskAvailable,
    isPhantomAvailable,
    isConnected,
    address,
    disconnect,
    activeProvider,
  } = useWalletConnection();

  const [isConnecting, setIsConnecting] = useState<ConnectingProvider>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsConnecting(null);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isConnected) {
      setIsConnecting(null);
    }
  }, [isConnected]);

  const handleConnectMetaMask = async () => {
    if (!isMetaMaskAvailable) {
      setError('MetaMask is not installed. Please install MetaMask extension and refresh the page.');
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    setIsConnecting('metamask');
    setError(null);

    try {
      await connectMetaMask();
      setIsConnecting(null);
      setError(null);
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
        setError('Connection was rejected. Please try again and approve the connection in MetaMask.');
      } else if (errorMessage.includes('not installed')) {
        setError('MetaMask is not installed. Please install MetaMask extension and refresh the page.');
      } else {
        setError(`Failed to connect: ${errorMessage}. Please check your MetaMask extension and try again.`);
      }
      setIsConnecting(null);
    }
  };

  const handleConnectPhantom = async () => {
    if (!isPhantomAvailable) {
      setError('Phantom wallet is not installed. Please install Phantom extension and refresh the page.');
      window.open('https://phantom.app/', '_blank');
      return;
    }

    setIsConnecting('phantom');
    setError(null);

    try {
      await connectPhantom();
      setIsConnecting(null);
      setError(null);
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      if (errorMessage.includes('rejected') || errorMessage.includes('cancelled') || errorMessage.includes('denied') || errorMessage.includes('cancel')) {
        setError('Connection was rejected. Please try again and approve the connection in Phantom.');
      } else if (errorMessage.includes('not installed') || errorMessage.includes('not available')) {
        setError('Phantom is not installed. Please install Phantom extension and refresh the page.');
      } else if (errorMessage.includes('timeout')) {
        setError('Connection timeout. Please try again.');
      } else {
        setError(`Failed to connect: ${errorMessage}. Please check your Phantom extension and try again.`);
      }
      setIsConnecting(null);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsConnecting(null);
      await disconnect();
      setError(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
      setIsConnecting(null);
    }
  };

  const handleCopyAddress = async () => {
    if (!address) return;
    
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 800);
      toast.success('Address copied to clipboard', {
        duration: 2000,
        icon: <Check className="w-4 h-4 text-success" />,
      });
    } catch {
      toast.error('Failed to copy address');
    }
  };

  if (!isOpen) return null;

  const isMetaMask = activeProvider === 'metamask';

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
            {isConnected && address ? 'Wallet Connected' : 'Connect Wallet'}
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
          {isConnected && address ? (
            <>
              <div className="bg-bgSecondary/50 rounded-xl p-5 border border-borderDefault mb-4">
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 p-2.5 ${
                    isMetaMask ? 'bg-orange-500/10' : 'bg-purple-500/10'
                  }`}>
                    <SafeImage
                      src={isMetaMask ? '/metamask.svg' : '/phantom.svg'}
                      alt={isMetaMask ? 'MetaMask' : 'Phantom'}
                      width={36}
                      height={36}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <p className="text-sm sm:text-base font-semibold text-textPrimary">
                        {isMetaMask ? 'MetaMask' : 'Phantom'}
                      </p>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-bgOverlay/50 rounded-full">
                        <div className="w-1.5 h-1.5 bg-textTertiary rounded-full" />
                        <span className="text-[10px] text-textTertiary font-medium uppercase tracking-wide whitespace-nowrap">Connected</span>
                      </div>
                    </div>
                      <button
                        onClick={handleCopyAddress}
                      className="text-xs sm:text-sm text-textTertiary font-mono bg-bgOverlay/30 hover:bg-bgOverlay/50 px-2 sm:px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-2 group border border-borderDefault/50 hover:border-borderDefault w-full justify-between"
                      >
                      <span className={`truncate ${copied ? 'text-textPrimary' : ''}`}>
                          {truncate(address, { length: 12, mode: 'middle' })}
                        </span>
                        {copied ? (
                        <Check className="w-3.5 h-3.5 flex-shrink-0 text-textPrimary" />
                        ) : (
                        <Copy className="w-3.5 h-3.5 flex-shrink-0 text-textTertiary group-hover:text-textPrimary transition-colors" />
                        )}
                      </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 mb-3">
                  <p className="text-[10px] text-red-400">{error}</p>
                </div>
              )}

              <button
                onClick={handleDisconnect}
                className="w-full bg-bgSecondary hover:bg-bgSecondary/80 border border-borderDefault text-textPrimary rounded-lg px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 hover:border-red-500/50 hover:text-red-400"
              >
                Disconnect Wallet
              </button>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  onClick={handleConnectMetaMask}
                  disabled={isConnecting !== null || !isMetaMaskAvailable}
                  className={`group flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-200 ${
                    isConnecting === 'metamask'
                      ? 'bg-blue-500/20 border-blue-500/50 cursor-wait'
                      : !isMetaMaskAvailable
                      ? 'bg-bgSecondary/20 border-borderDefault/30 cursor-not-allowed opacity-40'
                      : 'bg-bgSecondary border-borderDefault hover:border-orange-500/50 hover:bg-bgSecondary/90 cursor-pointer'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 bg-bgOverlay/50 p-1.5 ${
                    isConnecting === 'metamask' 
                      ? 'opacity-50' 
                      : isMetaMaskAvailable
                      ? 'group-hover:bg-bgOverlay/70'
                      : 'opacity-40'
                  }`}>
                    {isConnecting === 'metamask' ? (
                      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <SafeImage
                        src="/metamask.svg"
                        alt="MetaMask"
                        width={28}
                        height={28}
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                  <span className={`text-xs font-medium transition-colors ${
                    isMetaMaskAvailable ? 'text-textPrimary' : 'text-textTertiary'
                  }`}>
                    MetaMask
                  </span>
                </button>

                <button
                  onClick={handleConnectPhantom}
                  disabled={isConnecting !== null || !isPhantomAvailable}
                  className={`group flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-200 ${
                    isConnecting === 'phantom'
                      ? 'bg-purple-500/20 border-purple-500/50 cursor-wait'
                      : !isPhantomAvailable
                      ? 'bg-bgSecondary/20 border-borderDefault/30 cursor-not-allowed opacity-40'
                      : 'bg-bgSecondary border-borderDefault hover:border-purple-500/50 hover:bg-bgSecondary/90 cursor-pointer'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 bg-bgOverlay/50 p-1.5 ${
                    isConnecting === 'phantom' 
                      ? 'opacity-50' 
                      : isPhantomAvailable
                      ? 'group-hover:bg-bgOverlay/70'
                      : 'opacity-40'
                  }`}>
                    {isConnecting === 'phantom' ? (
                      <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <SafeImage
                        src="/phantom.svg"
                        alt="Phantom"
                        width={28}
                        height={28}
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                  <span className={`text-xs font-medium transition-colors ${
                    isPhantomAvailable ? 'text-textPrimary' : 'text-textTertiary'
                  }`}>
                    Phantom
                  </span>
                </button>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                  <p className="text-[10px] text-red-400 leading-relaxed">{error}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
