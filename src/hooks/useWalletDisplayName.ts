import { useMemo } from 'react';
import { useWalletNicknameStore } from '@/store/useWalletNicknameStore';
import { truncate } from '@mobula_labs/sdk';

export interface WalletDisplay {
  emoji: string;
  name: string;
  address: string;
  displayName: string;
  hasCustomName: boolean;
}

export function useWalletDisplayName(address: string | undefined | null): WalletDisplay {
  const nicknames = useWalletNicknameStore((state) => state.nicknames);

  return useMemo(() => {
    if (!address) {
      return {
        emoji: '👻',
        name: '',
        address: '',
        displayName: '',
        hasCustomName: false,
      };
    }

    const nickname = nicknames[address.toLowerCase()];
    const truncatedAddress = truncate(address, { length: 4, mode: 'middle' });
    
    const emoji = nickname?.emoji || '👻';
    const name = nickname?.name || '';
    
    return {
      emoji,
      name,
      address: truncatedAddress,
      displayName: name || truncatedAddress,
      hasCustomName: !!name,
    };
  }, [address, nicknames]);
}

