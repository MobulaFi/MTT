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
        textPrimary: '#E8E8E8',
        textSecondary: '#777777',
        textTertiary: '#505050',

        // Depth Layers
        bgBase: '#000000',
        bgDarkest: '#080808',
        bgBaseAlt: '#0A0A0A',
        bgOverlay: '#080808',
        bgOverlayAlt: '#060606',
        bgTableAlt: '#0F0F11',
        bgTableHover: '#141416',

        // Core Background Layers
        bgPrimary: '#0A0A0A',
        bgSecondary: '#0D0D0F',
        bgDeepAlt: '#0E0E10',
        bgTertiary: '#161616',

        // Neutral Layers
        bgNeutral: '#121212',
        bgNeutralDark: '#101010',

        // Surfaces & Components
        bgSurface: '#111111',
        bgSurfaceAlt: '#131313',
        bgContainer: '#121212',
        bgPanel: '#161616',
        bgSectionAlt: '#1A1A1A',
        bgCard: '#181818',
        bgElevated: '#1C1C1C',
        bgMuted: '#161616',
        bgHighlight: '#222222',

        // Overlays & Tints
        bgBackdrop: '#000000CC',
        bgSuccessTint: '#0ECB8115',

        // Grays & Whites
        grayLight: '#B0B0B0',
        grayMedium: '#707070',
        grayDark: '#505050',
        grayGhost: '#B0B0B0',
        grayNeutral: '#666666',
        grayBorder: '#999999',
        graySlate: '#606060',
        graySlateDark: '#454545',
        whiteOverlay: '#FFFFFFE6',
        whiteTranslucent: '#FFFFFF80',
        grayExtraLight: '#C0C0C0',
        grayCool: '#606060',

        // Status & Accent Colors
        success: '#0ECB81',
        error: '#EA3943',
        warning: '#FFD15C',
        errorBright: '#FF3B3B',
        accentRose: '#EC397A',
        accentPurple: '#8386FF',

        // Borders
        borderPrimary: '#1E1E1E',
        borderDefault: '#161616',
        borderSecondary: '#3A3A3A',
        borderSurface: '#1E1E1E',
        borderSuccess: '#0ECB81',
        borderMuted: '#2A2A2A',
        borderTertiary: '#1A1A1A',
        borderDarkSlateGray: '#262626',

      },      
      borderRadius: {
        none: '0px',
        sm: '2px',
        DEFAULT: '2px',
        md: '3px',
        lg: '4px',
        xl: '6px',
        '2xl': '8px',
        '3xl': '10px',
        full: '9999px',
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
