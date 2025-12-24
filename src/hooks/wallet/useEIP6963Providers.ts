'use client';

import { useSyncExternalStore } from 'react';
import { eip6963Store } from '@/lib/wallet/providers/eip6963Store';
import type { EIP6963ProviderDetail } from '@/types/wallet';

export function useEIP6963Providers(): EIP6963ProviderDetail[] {
  return useSyncExternalStore(
    eip6963Store.subscribe,
    eip6963Store.value,
    eip6963Store.value
  );
}

export function useMetaMaskProvider(): EIP6963ProviderDetail | null {
  const providers = useEIP6963Providers();
  return eip6963Store.getMetaMaskProvider();
}


