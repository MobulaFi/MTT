import { useState, useEffect } from 'react';
import { useMetaMaskProvider } from './useEIP6963Providers';

export function useWalletAvailability() {
  const metaMaskProvider = useMetaMaskProvider();
  const [isMetaMaskAvailable, setIsMetaMaskAvailable] = useState(false);
  const [isPhantomAvailable, setIsPhantomAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check MetaMask via EIP-6963 first, fallback to window.ethereum
    setIsMetaMaskAvailable(
      metaMaskProvider !== null ||
      (typeof window.ethereum !== 'undefined' && window.ethereum !== null)
    );
      
    // Check Phantom
    const checkPhantom = () => {
      const getPhantomProvider = () => {
        if ('phantom' in window) {
          const phantomWindow = window as typeof window & {
            phantom?: { 
              solana?: {
                isPhantom?: boolean;
                connect?: (options?: { onlyIfTrusted?: boolean }) => Promise<unknown>;
              };
            };
          };
          return phantomWindow.phantom?.solana;
        }
        return null;
      };

      const phantom = getPhantomProvider();
      const phantomAvailable = 
        phantom !== null &&
        phantom !== undefined &&
        (phantom.isPhantom === true || typeof phantom.connect === 'function');
      
  
      setIsPhantomAvailable(phantomAvailable);
    };

    checkPhantom();
    
    // Check periodically in case Phantom loads after page load
    const interval = setInterval(checkPhantom, 1000);
    
    // Also listen for Phantom's load event
    const handlePhantomLoad = () => {
      checkPhantom();
    };
    
    window.addEventListener('phantom#initialized', handlePhantomLoad);

    return () => {
      clearInterval(interval);
      window.removeEventListener('phantom#initialized', handlePhantomLoad);
    };
  }, [metaMaskProvider]);

  return { isMetaMaskAvailable, isPhantomAvailable };
}

