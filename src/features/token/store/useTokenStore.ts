import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { WssTokenDetailsResponseType } from '@mobula_labs/types';

interface TokenDetailsState {
  token: WssTokenDetailsResponseType['tokenData'] | null;
  tokenLoading: boolean;
  error: string | null;
  setToken: (data: WssTokenDetailsResponseType['tokenData']) => void;
  setTokenLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useTokenStore = create<TokenDetailsState>()(
  devtools(
    immer((set) => ({
      token: null,
      tokenLoading: false,
      error: null,

      setToken: (data) => {
        set((state) => {
          state.token = data;
          state.tokenLoading = false;
          state.error = null;
        });
      },
      setTokenLoading: (tokenLoading) => {
        set((state) => {
          state.tokenLoading = tokenLoading;
        });
      },
      setError: (error) => {
        set((state) => {
          state.error = error;
        });
      },
      reset: () => {
        set((state) => {
          state.token = null;
          state.tokenLoading = false;
          state.error = null;
        });
      },
    })),
    { name: 'TokenStore' }
  )
);

