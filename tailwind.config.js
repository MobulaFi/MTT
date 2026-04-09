/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/layout/**/*.{js,ts,jsx,tsx,mdx}',
    './src/utils/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Text
        textPrimary: '#FCFCFC',      // main text
        textSecondary: '#9B9B9B',    // secondary text
        textTertiary: '#777A8C',     // tertiary or dim text
      
        // Depth Layers
        bgBase: '#030303',
        bgDarkest: '#0F0F0F',        // smoother neutral black
        bgBaseAlt: '#111111',        // alternate pure dark base
        bgOverlay: '#0F1116',        // general overlay
        bgOverlayAlt: '#0F1016',     // darker variant of overlay
        bgTableAlt: '#181A21',       // lighter table row background
        bgTableHover: '#1D2028',

      
        // Core Background Layers
        bgPrimary: '#121319',        // primary background
        bgSecondary: '#15161D',      // secondary background
        bgDeepAlt: '#16181F',        // bluish variant (table rows, lists)
        bgTertiary: '#20222B',       // mid-depth background (headers, panels)
      
        // Neutral Layers
        bgNeutral: '#1A1B23',        // balanced neutral
        bgNeutralDark: '#1A1A1A',    // flat neutral fallback
      
        // Surfaces & Components
        bgSurface: '#1A1C23',        // surface elements
        bgSurfaceAlt: '#1A1D28',     // alternate surface (hover)
        bgContainer: '#1C1E27',      // container backgrounds
        bgPanel: '#23252D',          // panels or modals
        bgSectionAlt: '#2A2E39',     // cool-toned section background
        bgCard: '#2C2C33',           // card backgrounds
        bgElevated: '#2A2D35',       // elevated or popup surfaces
        bgMuted: '#2A2A2A',          // muted/inactive background
        bgHighlight: '#343439',      // hover or active highlight background
      
        // Overlays & Tints
        bgBackdrop: '#0C0C10BF',     // semi-transparent dark backdrop
        bgSuccessTint: '#18C72226',  // translucent green tint (success/hover)
      
        // Grays & Whites
        grayLight: '#C9C9CE',
        grayMedium: '#848489',
        grayDark: '#666666',
        grayGhost: '#C8C9D1',
        grayNeutral: '#797979',
        grayBorder: '#CCCCCC',
        graySlate: '#6B7280',
        graySlateDark: '#555A66',
        whiteOverlay: '#FFFFFFEB',   // slightly opaque white
        whiteTranslucent: '#FFFFFF99',
        grayExtraLight: '#E0E0E5',
        grayCool: '#76767A',
      
        // Status & Accent Colors
        success: '#18C722',
        error: '#F45B5B',
        warning: '#FFD15C',
        errorBright: '#FF4D4D',
        accentRose: '#EC397A',
        accentPurple: '#8386FF',
      
        // Borders
        borderPrimary: '#343439',
        borderDefault: '#22242D',
        borderSecondary: '#6D6D72',
        borderSurface: '#2A2D35',
        borderSuccess: '#00C853',
        borderMuted: '#444444',
        borderTertiary: '#2C2E37',
        borderDarkSlateGray: '#424349'

      },      
      fontFamily: {
        menlo: ['Menlo', 'monospace'],
        geist: ['Geist', 'monospace'],
        sans: ['Inter', 'sans-serif'], // optional for body text
      },
      fontSize: {
        sm: ['14px', '20px'],
        base: ['16px', '24px'],
        lg: ['18px', '28px'],
        xl: ['20px', '30px'],
        '2xl': ['24px', '36px'],
        '3xl': ['32px', '48px'],
      },
      letterSpacing: {
        tighter: '-0.32px',
        normal: '0px',
        wide: '0.5px',
      },
      fontWeight: {
        regular: 400,
        medium: 500,
        bold: 700,
      },
      animation: {
        blink: 'blink 10s infinite',
        spinSlow: 'spinSlow 10s linear infinite',
      },
      keyframes: {
        blink: {
          '0%': {
            opacity: '0.2',
          },
          '50%': {
            opacity: '1',
          },
          '100%': {
            opacity: '0.2',
          },
        },
        spinSlow: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
    },
  },
  plugins: [],
};
