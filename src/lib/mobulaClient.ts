import { MobulaClient } from '@mobula_labs/sdk';
import type { SubscriptionPayload } from '@mobula_labs/sdk';
import {
  DEFAULT_REST_ENDPOINT,
  DEFAULT_WSS_REGION,
  REST_ENDPOINTS,
  WSS_REGIONS,
  WSS_TYPES,
} from '@/config/endpoints';
import { createLoggingMobulaClient } from './networkLogger';

let client: MobulaClient | null = null;
let loggingClient: MobulaClient | null = null;
let currentRestUrl: string = REST_ENDPOINTS[DEFAULT_REST_ENDPOINT];
let currentWssUrlMap: Partial<Record<keyof SubscriptionPayload, string>> = {};

interface StoredCustomWss {
  type: keyof SubscriptionPayload;
  url: string;
  label?: string;
  mode?: string;
}

function getResolvedApiKey(): string | undefined {
  // Server (SSR): use server-only env key (not exposed to browser)
  if (typeof window === 'undefined') {
    return process.env.MOBULA_SERVER_SIDE_KEY;
  }
  // Client: use only user-entered key from localStorage
  try {
    const raw = localStorage.getItem('mobula-api-storage');
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { state?: { apiKey?: string } };
    const key = parsed.state?.apiKey;
    if (key && typeof key === 'string' && key.trim()) return key.trim();
  } catch {
    // ignore
  }
  return undefined;
}

if (typeof window !== 'undefined') {
  const savedUrl = localStorage.getItem('mobula-api-storage');
  if (savedUrl) {
    try {
      const parsed = JSON.parse(savedUrl) as {
        state?: {
          selectedRestUrl?: string;
          currentUrl?: string;
          selectedIndividualWssType?: keyof SubscriptionPayload;
          customWssUrls?: StoredCustomWss[];
          selectedAllModeWssUrl?: string;
          selectedWssRegion?: string;
        };
      };
      
      // Priority: selectedRestUrl > currentUrl (fallback)
      if (parsed.state?.selectedRestUrl) {
        currentRestUrl = parsed.state.selectedRestUrl;
      } else if (parsed.state?.currentUrl) {
        currentRestUrl = parsed.state.currentUrl;
      }
      
      // Handle WSS URLs with proper priority
      if (parsed.state?.selectedIndividualWssType) {
        const customUrl = parsed.state?.customWssUrls?.find(
          (c: StoredCustomWss) => c.type === parsed.state?.selectedIndividualWssType
        );
        if (customUrl) {
          const wssType = parsed.state.selectedIndividualWssType as keyof SubscriptionPayload;
          if (wssType) {
            currentWssUrlMap[wssType] = customUrl.url;
          }
        }
      } else if (parsed.state?.selectedAllModeWssUrl) {
        const selectedUrl = parsed.state.selectedAllModeWssUrl;
        for (const type of WSS_TYPES) {
          currentWssUrlMap[type] = selectedUrl;
        }
      } else if (
        parsed.state?.selectedWssRegion &&
        parsed.state.selectedWssRegion !== DEFAULT_WSS_REGION
      ) {
        const regionUrl =
          WSS_REGIONS[parsed.state.selectedWssRegion as keyof typeof WSS_REGIONS];
        if (regionUrl) {
          for (const type of WSS_TYPES) {
            currentWssUrlMap[type] = regionUrl;
          }
        }
      } else {
        currentWssUrlMap = {};
      }
    } catch (e) {
      console.error('Error parsing localStorage:', e);
    }
  }
  
  const wsUrlMapToUse = Object.keys(currentWssUrlMap).length > 0 ? currentWssUrlMap : undefined;
  
  // Initialize client on load
  client = new MobulaClient({
    restUrl: currentRestUrl,
    apiKey: getResolvedApiKey(),
    debug: true,
    timeout: 200000,
    wsUrlMap: wsUrlMapToUse,
  });
  loggingClient = createLoggingMobulaClient(client);
}

export function initMobulaClient(
  restUrl: string,
  wsUrlMap?: Partial<Record<keyof SubscriptionPayload, string>>
): MobulaClient {
  if (wsUrlMap) {
    currentWssUrlMap = wsUrlMap;
  }
  if (!client || currentRestUrl !== restUrl) {
    currentRestUrl = restUrl;
    const wsUrlMapToUse = Object.keys(currentWssUrlMap).length > 0 ? currentWssUrlMap : undefined;
    client = new MobulaClient({
      restUrl,
      apiKey: getResolvedApiKey(),
      debug: true,
      timeout: 200000,
      wsUrlMap: wsUrlMapToUse,
    });
    loggingClient = createLoggingMobulaClient(client);
  }
  
  return loggingClient!;
}

export function reinitMobulaClient(): void {
  const wsUrlMapToUse = Object.keys(currentWssUrlMap).length > 0 ? currentWssUrlMap : undefined;
  client = new MobulaClient({
    restUrl: currentRestUrl,
    apiKey: getResolvedApiKey(),
    debug: true,
    timeout: 200000,
    wsUrlMap: wsUrlMapToUse,
  });
  loggingClient = createLoggingMobulaClient(client);
}

export function getMobulaClient(restUrlOverride?: string, force = false): MobulaClient {
  const defaultRestUrl = REST_ENDPOINTS[DEFAULT_REST_ENDPOINT];
  let restUrlToUse: string = process.env.MOBULA_SERVER_SIDE_API_URL || defaultRestUrl;


  if (restUrlOverride?.trim()) {
    restUrlToUse = restUrlOverride.trim();
  }
  else if (typeof document !== 'undefined') {
    const cookie = document.cookie
      .split('; ')
      .find(c => c.trim().startsWith('customRestUrl='));
    
    if (cookie) {
      const urlFromCookie = decodeURIComponent(cookie.split('=')[1]).trim();
      if (urlFromCookie) {
        restUrlToUse = urlFromCookie;
      }
    }
  }

  if (force || !loggingClient || currentRestUrl !== restUrlToUse) {
    currentRestUrl = restUrlToUse;
    const wsUrlMapToUse = Object.keys(currentWssUrlMap).length > 0 ? currentWssUrlMap : undefined;

    client = new MobulaClient({
      restUrl: restUrlToUse,
      apiKey: getResolvedApiKey(),
      debug: true,
      timeout: 200000,
      wsUrlMap: wsUrlMapToUse,
    });
    loggingClient = createLoggingMobulaClient(client);

  }

  return loggingClient!;
}

export function updateWssUrlMap(wsUrlMap: Partial<Record<keyof SubscriptionPayload, string>>): void {
  currentWssUrlMap = wsUrlMap;
  if (client) {
    const wsUrlMapToUse = Object.keys(currentWssUrlMap).length > 0 ? currentWssUrlMap : undefined;
    client = new MobulaClient({
      restUrl: currentRestUrl,
      apiKey: getResolvedApiKey(),
      debug: true,
      timeout: 200000,
      wsUrlMap: wsUrlMapToUse,
    });
    loggingClient = createLoggingMobulaClient(client);
  }
}