// store/useThemeStore.ts
'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'Navy' | 'Frog' | 'Abyss';

interface ThemeColors {
  bgPrimary: string;
  bgOverlay: string;
  bgTableAlt: string;
  tableHover: string;
  success: string;
}

interface ThemeState {
  theme: Theme;
  colors: ThemeColors;
  setTheme: (theme: Theme) => void;
}

const themePresets: Record<Theme, ThemeColors> = {
  Navy: { 
    bgPrimary: '#121319', 
    bgOverlay: '#0F1116', 
    bgTableAlt: '#181A21', 
    tableHover: '#1D2028', 
    success: '#18C722' 
  },
  Frog: { 
    bgPrimary: '#0F1010', 
    bgOverlay: '#0F1010', 
    bgTableAlt: '#131416', 
    tableHover: '#18191B', 
    success: '#90E059' 
  },
  Abyss: { 
    bgPrimary: '#070D13', 
    bgOverlay: '#070D13', 
    bgTableAlt: '#0E1218', 
    tableHover: '#14181F', 
    success: '#75CA43' 
  },
};

const applyCSSVariables = (colors: ThemeColors) => {
  if (typeof document !== 'undefined') {
    const root = document.documentElement.style;
    root.setProperty('--bg-primary', colors.bgPrimary);
    root.setProperty('--success', colors.success);
    root.setProperty('--bg-overlay', colors.bgOverlay);
    root.setProperty('--bg-tableAlt', colors.bgTableAlt);
    root.setProperty('--bg-tableHover', colors.tableHover);
  }
};

export const useThemeStore = create(
  persist<ThemeState>(
    (set) => ({
      theme: 'Navy',
      colors: themePresets.Navy,
      setTheme: (theme) => {
        const selected = themePresets[theme];
        applyCSSVariables(selected);
        set({ theme, colors: selected });
      },
    }),
    { 
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        // Re-apply on hydration (belt-and-suspenders approach)
        if (state) {
          applyCSSVariables(state.colors);
        }
      },
    }
  )
);