// Promo Banners Configuration
// Edit this file to update wallet dropdown banners

export type BannerAccent = 'purple' | 'blue' | 'green' | 'orange' | 'pink' | 'neutral';

export type PromoBanner = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  image?: string;
  accent: BannerAccent; // Theme-compatible accent color
  link?: string;
  enabled?: boolean;
};

// Default banners - Mobula changelog & features
export const PROMO_BANNERS: PromoBanner[] = [
  {
    id: 'perps-engine',
    title: '✨ New Endpoint:',
    subtitle: 'Perpetual Engine',
    description: 'Trade perps via Lighter & Gains Network. Open, close, SL/TP orders in one API.',
    image: '/banners/perps-engine.png',
    accent: 'purple',
    link: 'https://docs.mobula.io/changelog/2026-01-24',
    enabled: true,
  },
  {
    id: 'sdk',
    title: '@mobula_labs/sdk',
    subtitle: 'TypeScript SDK',
    description: 'npm install @mobula_labs/sdk — Full typed SDK for all Mobula endpoints.',
    image: '/banners/sdk.png',
    accent: 'orange',
    link: 'https://www.npmjs.com/package/@mobula_labs/sdk',
    enabled: true,
  },
  {
    id: 'api',
    title: 'Mobula API',
    subtitle: 'Real-Time Data',
    description: 'Live prices, volumes & market data for 1M+ tokens across 80+ chains.',
    image: '/banners/mobula-api.png',
    accent: 'blue',
    link: 'https://docs.mobula.io',
    enabled: true,
  },
  {
    id: 'pulse-stream',
    title: 'Pulse Stream V2',
    subtitle: 'WebSocket Feed',
    description: 'Real-time token monitoring on EVM & Solana. Multiple views, organic metrics.',
    image: '/banners/pulse-stream.png',
    accent: 'pink',
    link: 'https://docs.mobula.io/indexing-stream/stream/websocket/pulse-stream-v2',
    enabled: true,
  },
  {
    id: 'search',
    title: 'Multi-Chain',
    subtitle: 'Token Search',
    description: 'Search tokens by name, symbol or address across all supported chains.',
    image: '/banners/token-search.png',
    accent: 'green',
    link: 'https://docs.mobula.io/api-reference/endpoint/search',
    enabled: true,
  },
  {
    id: 'perps',
    title: 'Trade Perps',
    subtitle: 'Lighter & Gains',
    description: 'Unified API for perpetual futures. Smart routing for optimal fills.',
    image: '/banners/perps.png',
    accent: 'neutral',
    link: 'https://docs.mobula.io/changelog/2026-01-24',
    enabled: true,
  },
];

// Get only enabled banners
export const getEnabledBanners = (): PromoBanner[] => {
  return PROMO_BANNERS.filter((banner) => banner.enabled !== false);
};

// API endpoint to fetch banners dynamically (optional)
export const BANNERS_API_URL = process.env.NEXT_PUBLIC_BANNERS_API_URL;

// Fetch banners from API
export const fetchBannersFromAPI = async (): Promise<PromoBanner[] | null> => {
  if (!BANNERS_API_URL) return null;
  
  try {
    const response = await fetch(BANNERS_API_URL);
    if (!response.ok) return null;
    const data = await response.json();
    return data.banners || data;
  } catch {
    console.error('Failed to fetch banners from API');
    return null;
  }
};
