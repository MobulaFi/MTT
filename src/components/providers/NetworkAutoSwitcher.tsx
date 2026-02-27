'use client';

import { useAutoSwitchNetwork } from '@/hooks/useAutoSwitchNetwork';

export function NetworkAutoSwitcher() {
  useAutoSwitchNetwork();
  return null;
}
