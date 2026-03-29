import { create } from 'zustand';

interface ReclaimATAState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useReclaimATAStore = create<ReclaimATAState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
