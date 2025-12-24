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

if (typeof window !== 'undefined') {
  const savedUrl = localStorage.getItem('mobula-api-storage');
  if (savedUrl) {
    try {
      const parsed = JSON.parse(savedUrl);
      
      // Priority: selectedRestUrl > currentUrl (fallback)
      if (parsed.state?.selectedRestUrl) {
        currentRestUrl = parsed.state.selectedRestUrl;
      } else if (parsed.state?.currentUrl) {
        currentRestUrl = parsed.state.currentUrl;
      }
      
      // Handle WSS URLs with proper priority
      if (parsed.state?.selectedIndividualWssType) {
        const customUrl = parsed.state?.customWssUrls?.find(
          (c: any) => c.type === parsed.state.selectedIndividualWssType
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
    apiKey: process.env.NEXT_PUBLIC_MOBULA_API_KEY,
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
      apiKey: process.env.NEXT_PUBLIC_MOBULA_API_KEY,
      debug: true,
      timeout: 200000,
      wsUrlMap: wsUrlMapToUse,
    });
    loggingClient = createLoggingMobulaClient(client);
  }
  
  return loggingClient!;
}

export function getMobulaClient(restUrlOverride?: string, force = false): MobulaClient {
  const defaultRestUrl = REST_ENDPOINTS[DEFAULT_REST_ENDPOINT];
  let restUrlToUse: string = process.env.MOBULA_API_URL || defaultRestUrl;


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
      apiKey: process.env.NEXT_PUBLIC_MOBULA_API_KEY,
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
      apiKey: process.env.NEXT_PUBLIC_MOBULA_API_KEY,
      debug: true,
      timeout: 200000,
      wsUrlMap: wsUrlMapToUse,
    });
    loggingClient = createLoggingMobulaClient(client);
  }
}