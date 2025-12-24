import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WalletNickname {
  name: string;
  emoji: string;
}

interface WalletNicknameState {
  nicknames: Record<string, WalletNickname>;
  emojiUsageCount: Record<string, number>;
  setWalletNickname: (address: string, name: string) => void;
  setWalletEmoji: (address: string, emoji: string) => void;
  getWalletNickname: (address: string) => WalletNickname;
  clearWalletNickname: (address: string) => void;
  getFrequentlyUsedEmojis: () => string[];
}

const DEFAULT_EMOJI = '👻';

export const useWalletNicknameStore = create<WalletNicknameState>()(
  persist(
    (set, get) => ({
      nicknames: {},
      emojiUsageCount: {},

      setWalletNickname: (address: string, name: string) => {
        set((state) => ({
          nicknames: {
            ...state.nicknames,
            [address.toLowerCase()]: {
              ...state.nicknames[address.toLowerCase()],
              name,
              emoji: state.nicknames[address.toLowerCase()]?.emoji || DEFAULT_EMOJI,
            },
          },
        }));
      },

      setWalletEmoji: (address: string, emoji: string) => {
        set((state) => {
          const currentCount = state.emojiUsageCount[emoji] || 0;
          
          return {
            nicknames: {
              ...state.nicknames,
              [address.toLowerCase()]: {
                name: state.nicknames[address.toLowerCase()]?.name || '',
                emoji,
              },
            },
            emojiUsageCount: {
              ...state.emojiUsageCount,
              [emoji]: currentCount + 1,
            },
          };
        });
      },

      getWalletNickname: (address: string) => {
        const nickname = get().nicknames[address.toLowerCase()];
        return nickname || { name: '', emoji: DEFAULT_EMOJI };
      },

      clearWalletNickname: (address: string) => {
        set((state) => {
          const newNicknames = { ...state.nicknames };
          delete newNicknames[address.toLowerCase()];
          return { nicknames: newNicknames };
        });
      },

      getFrequentlyUsedEmojis: () => {
        const counts = get().emojiUsageCount;
        return Object.entries(counts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 15)
          .map(([emoji]) => emoji);
      },
    }),
    {
      name: 'wallet-nicknames-storage',
    }
  )
);

