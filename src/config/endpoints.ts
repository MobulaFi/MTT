import type { SubscriptionPayload } from '@mobula_labs/sdk';

export const REST_ENDPOINTS = {
  API2: 'https://api-2.mobula.io',
  PREMIUM: 'https://pulse-v2-api.mobula.io',
  STANDARD: 'https://api-2.mobula.io',
  EXPLORER: 'https://demo-api.mobula.io',
} as const;

export type RestEndpointKey = keyof typeof REST_ENDPOINTS;

export const DEFAULT_REST_ENDPOINT: RestEndpointKey = 'API2';

export const WSS_REGIONS = {
  'api-2': 'wss://api-2.mobula.io',
  default: 'wss://default.mobula.io',
  ovh: 'wss://api.zobula.xyz',
  mobula: 'wss://api-2.mobula.io',
  'pulse-v2': 'wss://pulse-v2-api.mobula.io',
} as const;

export type WssRegionKey = keyof typeof WSS_REGIONS;

export const DEFAULT_WSS_REGION: WssRegionKey = 'api-2';

export const WSS_TYPES: readonly (keyof SubscriptionPayload)[] = [
  'market',
  'pair',
  'trade',
  'fast-trade',
  'ohlcv',
  'holders',
  'pulse-v2',
  'pulse-v2-pause',
  'stream-evm',
  'stream-svm',
  'funding',
  'market-details',
  'token-details',
  'feed',
  'position',
  'positions',
  'balance',
  'token-filters',
] as const;

