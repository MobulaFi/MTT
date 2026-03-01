import { NextRequest, NextResponse } from 'next/server';
import { MobulaClient } from '@mobula_labs/sdk';
import { REST_ENDPOINTS, DEFAULT_REST_ENDPOINT } from '@/config/endpoints';

// Server-side SDK client with API key
function getServerClient(request: NextRequest) {
  // Priority: 1. Cookie customRestUrl, 2. Env var, 3. Default
  let restUrl = process.env.MOBULA_SERVER_SIDE_API_URL || REST_ENDPOINTS[DEFAULT_REST_ENDPOINT];
  
  // Check for custom REST URL from cookie (set by ApiSelectorDropdown)
  const customRestUrlCookie = request.cookies.get('customRestUrl');
  if (customRestUrlCookie?.value) {
    try {
      const urlFromCookie = decodeURIComponent(customRestUrlCookie.value).trim();
      if (urlFromCookie) {
        restUrl = urlFromCookie;
      }
    } catch (e) {
      console.error('Error parsing customRestUrl cookie:', e);
    }
  }
  
  const apiKey = 'a1ca9490-e255-42cd-96eb-9ddb5931c8fd';
  
  return new MobulaClient({
    restUrl,
    apiKey,
    debug: false,
    timeout: 200000,
  });
}

// Supported SDK methods
type SdkMethod = 
  | 'fetchTokenDetails'
  | 'fetchMarketDetails'
  | 'fetchTokenMarkets'
  | 'fetchWalletPortfolio'
  | 'fetchWalletPositions'
  | 'fetchWalletActivity'
  | 'fetchWalletHistory'
  | 'fetchWalletDeployer'
  | 'fetchWalletAnalysis'
  | 'fetchTokenTraderPositions'
  | 'fetchTokenHolderPositions'
  | 'fetchTokenTrades'
  | 'fetchMarketTokenHolders'
  | 'fetchMarketHistoricalPairData'
  | 'fetchMarketOHLCVHistory'
  | 'fetchTokenOHLCVHistory'
  | 'fetchSearchFast'
  | 'fetchSwapQuote'
  | 'fetchPulseV2'
  | 'fetchSystemMetadata'
  | 'swapSend'
  | 'fetchWalletPosition'
  | 'fetchMarketLighthouse';

interface SdkRequest {
  method: SdkMethod;
  params: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SdkRequest;
    const { method, params } = body;

    if (!method || !params) {
      return NextResponse.json({ error: 'Missing method or params' }, { status: 400 });
    }

    const client = getServerClient(request);

    let response: unknown;

    switch (method) {
      case 'fetchTokenDetails':
        response = await client.fetchTokenDetails(params as Parameters<typeof client.fetchTokenDetails>[0]);
        break;
      case 'fetchMarketDetails':
        response = await client.fetchMarketDetails(params as Parameters<typeof client.fetchMarketDetails>[0]);
        break;
      case 'fetchTokenMarkets':
        response = await client.fetchTokenMarkets(params as Parameters<typeof client.fetchTokenMarkets>[0]);
        break;
      case 'fetchWalletPortfolio':
        response = await client.fetchWalletPortfolio(params as Parameters<typeof client.fetchWalletPortfolio>[0]);
        break;
      case 'fetchWalletPositions':
        response = await client.fetchWalletPositions(params as Parameters<typeof client.fetchWalletPositions>[0]);
        break;
      case 'fetchWalletActivity':
        response = await client.fetchWalletActivity(params as Parameters<typeof client.fetchWalletActivity>[0]);
        break;
      case 'fetchWalletHistory':
        response = await client.fetchWalletHistory(params as Parameters<typeof client.fetchWalletHistory>[0]);
        break;
      case 'fetchWalletDeployer':
        response = await client.fetchWalletDeployer(params as Parameters<typeof client.fetchWalletDeployer>[0]);
        break;
      case 'fetchWalletAnalysis':
        response = await client.fetchWalletAnalysis(params as Parameters<typeof client.fetchWalletAnalysis>[0]);
        break;
      case 'fetchTokenTraderPositions':
        response = await client.fetchTokenTraderPositions(params as Parameters<typeof client.fetchTokenTraderPositions>[0]);
        break;
      case 'fetchTokenHolderPositions':
        response = await client.fetchTokenHolderPositions(params as Parameters<typeof client.fetchTokenHolderPositions>[0]);
        break;
      case 'fetchTokenTrades':
        response = await client.fetchTokenTrades(params as Parameters<typeof client.fetchTokenTrades>[0]);
        break;
      case 'fetchMarketTokenHolders':
        response = await client.fetchMarketTokenHolders(params as Parameters<typeof client.fetchMarketTokenHolders>[0]);
        break;
      case 'fetchMarketHistoricalPairData':
        response = await client.fetchMarketHistoricalPairData(params as Parameters<typeof client.fetchMarketHistoricalPairData>[0]);
        break;
      case 'fetchMarketOHLCVHistory':
        response = await client.fetchMarketOHLCVHistory(params as Parameters<typeof client.fetchMarketOHLCVHistory>[0]);
        break;
      case 'fetchTokenOHLCVHistory':
        response = await client.fetchTokenOHLCVHistory(params as Parameters<typeof client.fetchTokenOHLCVHistory>[0]);
        break;
      case 'fetchSearchFast':
        response = await client.fetchSearchFast(params as Parameters<typeof client.fetchSearchFast>[0]);
        break;
      case 'fetchSwapQuote':
        response = await client.fetchSwapQuote(params as Parameters<typeof client.fetchSwapQuote>[0]);
        break;
      case 'fetchPulseV2':
        response = await client.fetchPulseV2(params as Parameters<typeof client.fetchPulseV2>[0]);
        break;
      case 'fetchSystemMetadata':
        response = await client.fetchSystemMetadata();
        break;
      case 'swapSend':
        response = await client.fetchSwapTransaction(params as Parameters<typeof client.fetchSwapTransaction>[0]);
        break;
      case 'fetchWalletPosition':
        response = await client.request<typeof params, unknown>(
          'get',
          '/api/2/wallet/position',
          params as Record<string, unknown>,
        );
        break;
      case 'fetchMarketLighthouse':
        response = await client.request<typeof params, unknown>(
          'get',
          '/api/2/market/lighthouse',
          params as Record<string, unknown>,
        );
        break;
      default:
        return NextResponse.json({ error: `Unknown method: ${method}` }, { status: 400 });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('SDK API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'SDK request failed' },
      { status: 500 }
    );
  }
}
