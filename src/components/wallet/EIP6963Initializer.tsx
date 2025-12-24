'use client';

import { useEffect } from 'react';
import { useEIP6963Providers } from '@/hooks/wallet/useEIP6963Providers';
import { useAutoSwitchChain } from '@/hooks/wallet/useAutoSwitchChain';

/**
 * Component to initialize EIP-6963 provider detection and auto chain switching
 * This ensures the store is subscribed and listening for wallet announcements
 * and automatically switches MetaMask chain when URL changes
 */
export function EIP6963Initializer() {
  // This hook subscribes to EIP-6963 events and initializes the store
  useEIP6963Providers();
  
  // Automatically switch chain when URL changes (works even if wallet not connected yet)
  useAutoSwitchChain();

  return null;
}


