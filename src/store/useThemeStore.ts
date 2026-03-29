// store/useThemeStore.ts
'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'Obsidian' | 'Carbon' | 'Void';

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
  Obsidian: {
    bgPrimary: '#0A0A0A',
    bgOverlay: '#080808',
    bgTableAlt: '#0F0F11',
    tableHover: '#141416',
    success: '#0ECB81',
  },
  Carbon: {
    bgPrimary: '#0C0C0C',
    bgOverlay: '#0A0A0A',
    bgTableAlt: '#111113',
    tableHover: '#161618',
    success: '#0ECB81',
  },
  Void: {
    bgPrimary: '#050505',
    bgOverlay: '#030303',
    bgTableAlt: '#0A0A0C',
    tableHover: '#0F0F11',
    success: '#0ECB81',
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
      theme: 'Obsidian',
      colors: themePresets.Obsidian,
      setTheme: (theme) => {
        const selected = themePresets[theme];
        applyCSSVariables(selected);
        set({ theme, colors: selected });
      },
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Migrate old theme names to new ones
          const themeMap: Record<string, Theme> = {
            Navy: 'Obsidian',
            Frog: 'Carbon',
            Abyss: 'Void',
          };
          const mapped = themeMap[state.theme as string];
          if (mapped) {
            state.theme = mapped;
            state.colors = themePresets[mapped];
          }
          applyCSSVariables(state.colors);
        }
      },
    }
  )
);
