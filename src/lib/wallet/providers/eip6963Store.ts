import type { EIP6963ProviderDetail } from '@/types/wallet';

// Store to hold detected wallet providers
let providers: EIP6963ProviderDetail[] = [];

export const eip6963Store = {
  value: (): EIP6963ProviderDetail[] => providers,
  
  subscribe: (callback: () => void) => {
    function onAnnouncement(event: Event) {
      const customEvent = event as CustomEvent<{ info: EIP6963ProviderDetail['info']; provider: EIP6963ProviderDetail['provider'] }>;
      if (!customEvent.detail) return;
      
      if (providers.map((p) => p.info.uuid).includes(customEvent.detail.info.uuid)) {
        return;
      }
      providers = [...providers, customEvent.detail];
      callback();
    }

    // Listen for eip6963:announceProvider events
    window.addEventListener('eip6963:announceProvider', onAnnouncement);

    // Dispatch the event to request providers
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    // Return cleanup function
    return () => {
      window.removeEventListener('eip6963:announceProvider', onAnnouncement);
    };
  },
  
  // Get MetaMask provider specifically
  getMetaMaskProvider: (): EIP6963ProviderDetail | null => {
    return providers.find(
      (p) => p.info.rdns === 'io.metamask' || p.info.name.toLowerCase().includes('metamask')
    ) || null;
  },
  
  // Clear providers
  clear: () => {
    providers = [];
  },
};

