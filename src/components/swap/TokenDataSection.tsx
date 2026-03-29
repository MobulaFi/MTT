'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { useSwapPageStore } from '@/store/useSwapPageStore';
import { sdk } from '@/lib/sdkClient';
import SafeImage from '@/components/SafeImage';
import { formatPureNumber, formatCryptoPrice } from '@mobula_labs/sdk';
import { MOBULA_API_KEY } from '@/lib/mobulaClient';
import { DEFAULT_REST_ENDPOINT, REST_ENDPOINTS, WSS_REGIONS, DEFAULT_WSS_REGION } from '@/config/endpoints';
import { useApiStore } from '@/store/apiStore';

interface TokenDetails {
  priceUSD: number;
  priceChange24hPercentage: number;
  marketCapUSD: number;
  volume24hUSD: number;
  liquidityUSD: number;
  logo: string | null;
  symbol: string;
  name: string;
  address: string;
  chainId: string;
}

interface SparklineData {
  points: number[];
  isUp: boolean;
}

interface TrendingToken {
  address: string;
  chainId: string;
  symbol: string;
  name: string;
  priceUSD: number;
  marketCapUSD: number;
  volume24hUSD: number;
  priceChange5minPercentage: number;
  logo: string | null;
}

function MiniSparkline({ data, width = 80, height = 28 }: { data: SparklineData; width?: number; height?: number }) {
  if (!data.points.length) return null;
  const min = Math.min(...data.points);
  const max = Math.max(...data.points);
  const range = max - min || 1;
  const padding = 2;
  const pts = data.points.map((v, i) => {
    const x = (i / (data.points.length - 1)) * width;
    const y = padding + (height - 2 * padding) - ((v - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');
  const color = data.isUp ? '#0ECB81' : '#EA3943';
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="flex-shrink-0">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

function TokenCard({ details, sparkline, isLoading }: { details: TokenDetails | null; sparkline: SparklineData | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex-1 p-3 animate-pulse">
        <div className="flex items-center gap-2 mb-2"><div className="w-6 h-6 rounded-full bg-bgTertiary" /><div className="h-4 w-12 bg-bgTertiary rounded" /></div>
        <div className="h-5 w-16 bg-bgTertiary rounded mb-1" /><div className="h-3 w-10 bg-bgTertiary rounded" /><div className="mt-2 h-6 w-full bg-bgTertiary rounded" />
      </div>
    );
  }
  if (!details) return null;
  const change = details.priceChange24hPercentage ?? 0;
  const isUp = change >= 0;
  return (
    <div className="flex-1 p-3 min-w-0">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-bgHighlight">
          {details.logo ? <SafeImage src={details.logo} alt={details.symbol} width={24} height={24} className="rounded-full object-cover" /> : <div className="w-6 h-6 flex items-center justify-center text-[10px] font-bold text-textPrimary bg-bgHighlight rounded-full">{details.symbol.charAt(0)}</div>}
        </div>
        <span className="text-sm font-bold text-textPrimary truncate">{details.symbol}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-[15px] font-semibold text-textPrimary">${formatCryptoPrice(details.priceUSD)}</p>
        <p className={`text-[11px] font-semibold ${isUp ? 'text-success' : 'text-error'}`}>{isUp ? '+' : ''}{change.toFixed(2)}%</p>
      </div>
      {sparkline && <div className="mt-1.5"><MiniSparkline data={sparkline} width={100} height={24} /></div>}
    </div>
  );
}

function TrendingRow({ token, rank, onClick }: { token: TrendingToken; rank: number; onClick: () => void }) {
  const change = token.priceChange5minPercentage ?? 0;
  const isUp = change >= 0;
  const chainLabel = token.chainId.includes('solana') ? 'SOL' : token.chainId.includes(':56') ? 'BSC' : token.chainId.includes(':8453') ? 'BASE' : token.chainId.includes(':1') ? 'ETH' : '';
  return (
    <button onClick={onClick} className="flex items-center gap-3 px-5 py-3 w-full hover:bg-bgPrimary/40 transition-colors cursor-pointer">
      <span className="text-[11px] font-bold text-textTertiary w-4 text-center flex-shrink-0">{rank}</span>
      <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-bgHighlight">
        {token.logo ? <SafeImage src={token.logo} alt={token.symbol} width={28} height={28} className="rounded-full object-cover" /> : <div className="w-7 h-7 flex items-center justify-center text-[10px] font-bold text-textPrimary bg-bgHighlight rounded-full">{token.symbol.charAt(0)}</div>}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-bold text-textPrimary truncate">{token.symbol}</p>
          {chainLabel && <span className="text-[9px] font-semibold text-textTertiary bg-bgTertiary px-1.5 py-0.5 rounded">{chainLabel}</span>}
        </div>
        <p className="text-[11px] text-textTertiary truncate">{token.name}</p>
      </div>
      <div className="text-right flex-shrink-0 min-w-[100px]">
        <p className="text-sm font-semibold text-textPrimary">${formatCryptoPrice(token.priceUSD)}</p>
        <div className="flex items-center justify-end gap-2 text-[10px] text-textTertiary"><span>MC ${formatPureNumber(token.marketCapUSD)}</span></div>
      </div>
      <div className="text-right flex-shrink-0 min-w-[65px]">
        <p className={`text-[12px] font-bold ${isUp ? 'text-success' : 'text-error'}`}>{isUp ? '+' : ''}{change.toFixed(2)}%</p>
        <p className="text-[10px] text-textTertiary">5min</p>
      </div>
    </button>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (<div className="flex items-center justify-between py-1.5"><span className="text-[12px] text-textTertiary">{label}</span><span className="text-[12px] font-medium text-textPrimary">{value}</span></div>);
}

const TRENDING_PAYLOAD = {
  mode: 'token' as const,
  views: {
    trending: {
      sortBy: 'feesPaid1minUSD',
      sortOrder: 'desc',
      limit: 5,
    },
  },
};

const PING_INTERVAL = 30000;
const RECONNECT_DELAY = 3000;

function getRestUrl(): string {
  const defaultUrl = REST_ENDPOINTS[DEFAULT_REST_ENDPOINT];
  let restUrl = process.env.NEXT_PUBLIC_MOBULA_API_URL || defaultUrl;
  if (typeof document !== 'undefined') {
    const cookie = document.cookie.split('; ').find(c => c.trim().startsWith('customRestUrl='));
    if (cookie) {
      const val = decodeURIComponent(cookie.split('=')[1]).trim();
      if (val) restUrl = val;
    }
  }
  return restUrl;
}

function mapTokenFromFilters(t: Record<string, unknown>): TrendingToken | null {
  const address = (t.address as string) || '';
  const symbol = (t.symbol as string) || '';
  if (!address || !symbol) return null;
  return {
    address,
    chainId: (t.chainId as string) || 'solana:solana',
    symbol,
    name: (t.name as string) || symbol,
    priceUSD: (t.priceUSD as number) || 0,
    marketCapUSD: (t.marketCapUSD as number) || 0,
    volume24hUSD: (t.volume24hUSD as number) || 0,
    priceChange5minPercentage: (t.priceChange5minPercentage as number) || 0,
    logo: (t.logo as string) || null,
  };
}

export function TokenDataSection() {
  const { tokenIn, tokenOut, setTokenOut, setChainId } = useSwapPageStore();
  const [tokenInDetails, setTokenInDetails] = useState<TokenDetails | null>(null);
  const [tokenOutDetails, setTokenOutDetails] = useState<TokenDetails | null>(null);
  const [tokenInSparkline, setTokenInSparkline] = useState<SparklineData | null>(null);
  const [tokenOutSparkline, setTokenOutSparkline] = useState<SparklineData | null>(null);
  const [isLoadingIn, setIsLoadingIn] = useState(true);
  const [isLoadingOut, setIsLoadingOut] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [trendingTokens, setTrendingTokens] = useState<TrendingToken[]>([]);
  const [isTrendingLoading, setIsTrendingLoading] = useState(true);
  const lastFetchedIn = useRef('');
  const lastFetchedOut = useRef('');
  const mountedRef = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trendingMapRef = useRef<Map<string, TrendingToken>>(new Map());
  const selectedAllModeWssUrl = useApiStore((state) => state.selectedAllModeWssUrl);
  const selectedWssRegion = useApiStore((state) => state.selectedWssRegion);

  const fetchTokenData = useCallback(async (
    address: string, chainId: string,
    setDetails: (d: TokenDetails | null) => void, setSparkline: (s: SparklineData | null) => void,
    setLoading: (l: boolean) => void, lastRef: React.MutableRefObject<string>,
  ) => {
    const key = `${chainId}:${address}`;
    if (lastRef.current === key) return;
    lastRef.current = key;
    setLoading(true);
    try {
      const detailsRes = await sdk.fetchTokenDetails({ address, blockchain: chainId, currencies: 'USD' }) as { data?: Record<string, unknown> };
      if (detailsRes?.data) {
        const d = detailsRes.data;
        setDetails({ priceUSD: (d.priceUSD as number) || 0, priceChange24hPercentage: (d.priceChange24hPercentage as number) || 0, marketCapUSD: (d.marketCapUSD as number) || 0, volume24hUSD: (d.volume24hUSD as number) || 0, liquidityUSD: (d.liquidityUSD as number) || 0, logo: (d.logo as string) || null, symbol: (d.symbol as string) || '', name: (d.name as string) || '', address, chainId });
      }
      try {
        const ohlcvRes = await sdk.fetchTokenOHLCVHistory({ address, chainId, period: '1h', from: Math.floor(Date.now() / 1000) - 86400, to: Math.floor(Date.now() / 1000) } as Parameters<typeof sdk.fetchTokenOHLCVHistory>[0]) as { data?: Array<{ c?: number }> };
        if (ohlcvRes?.data && Array.isArray(ohlcvRes.data) && ohlcvRes.data.length > 1) {
          const closes = ohlcvRes.data.map((c) => c.c).filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
          if (closes.length > 1) setSparkline({ points: closes, isUp: closes[closes.length - 1] >= closes[0] });
        }
      } catch { /* ohlcv */ }
    } catch { /* details */ } finally { setLoading(false); }
  }, []);

  const updateTrendingFromMap = useCallback(() => {
    const tokens = [...trendingMapRef.current.values()].slice(0, 5);
    if (mountedRef.current) setTrendingTokens(tokens);
  }, []);

  useEffect(() => {
    if (tokenIn) fetchTokenData(tokenIn.address, tokenIn.chainId, setTokenInDetails, setTokenInSparkline, setIsLoadingIn, lastFetchedIn);
    else { setTokenInDetails(null); setTokenInSparkline(null); lastFetchedIn.current = ''; setIsLoadingIn(false); }
  }, [tokenIn?.address, tokenIn?.chainId, fetchTokenData]);

  useEffect(() => {
    if (tokenOut) fetchTokenData(tokenOut.address, tokenOut.chainId, setTokenOutDetails, setTokenOutSparkline, setIsLoadingOut, lastFetchedOut);
    else { setTokenOutDetails(null); setTokenOutSparkline(null); lastFetchedOut.current = ''; setIsLoadingOut(false); }
  }, [tokenOut?.address, tokenOut?.chainId, fetchTokenData]);

  // Fetch trending via REST API + live updates via WSS
  useEffect(() => {
    mountedRef.current = true;
    trendingMapRef.current.clear();

    const restUrl = getRestUrl();

    // Compute WSS URL from WSS config (never derive from REST URL)
    let wsUrl: string;
    if (selectedAllModeWssUrl) {
      wsUrl = selectedAllModeWssUrl;
    } else if (selectedWssRegion) {
      wsUrl = WSS_REGIONS[selectedWssRegion] || WSS_REGIONS[DEFAULT_WSS_REGION];
    } else {
      wsUrl = WSS_REGIONS[DEFAULT_WSS_REGION];
    }

    // 1. Initial data via REST POST /api/2/token/filters
    (async () => {
      try {
        const res = await fetch(`${restUrl}/api/2/token/filters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': MOBULA_API_KEY },
          body: JSON.stringify(TRENDING_PAYLOAD),
        });
        if (!res.ok) throw new Error(`REST ${res.status}`);
        const data = await res.json();
        const tokens = data?.views?.trending?.data as Array<Record<string, unknown>> | undefined;
        if (tokens && Array.isArray(tokens)) {
          for (const t of tokens) {
            const mapped = mapTokenFromFilters(t);
            if (mapped) trendingMapRef.current.set(`${mapped.address}_${mapped.chainId}`, mapped);
          }
          updateTrendingFromMap();
        }
      } catch (err) {
        console.error('[TokenDataSection] Trending REST error:', err);
      } finally {
        if (mountedRef.current) setIsTrendingLoading(false);
      }
    })();

    // 2. WSS for real-time updates
    let intentionalClose = false;
    console.log('[TokenDataSection] Opening WSS to', wsUrl);

    const connectWs = () => {
      if (intentionalClose || !mountedRef.current) return;
      console.log('[TokenDataSection] connectWs called, url:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[TokenDataSection] WSS opened, sending subscription');
        ws.send(JSON.stringify({
          type: 'token-filters',
          authorization: MOBULA_API_KEY,
          payload: TRENDING_PAYLOAD,
        }));
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event: 'ping' }));
        }, PING_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === 'pong' || msg.event === 'subscribed' || msg.error) return;

          if (msg.type === 'new-token' || msg.type === 'update-token') {
            const token = msg.payload?.token as Record<string, unknown> | undefined;
            if (!token || msg.payload?.viewName !== 'trending') return;
            const key = `${token.address}_${token.chainId}`;
            const existing = trendingMapRef.current.get(key);
            if (existing && msg.type === 'update-token') {
              const merged = { ...existing };
              for (const [k, v] of Object.entries(token)) {
                if (v != null) (merged as Record<string, unknown>)[k] = v;
              }
              const remapped = mapTokenFromFilters(merged as Record<string, unknown>);
              if (remapped) trendingMapRef.current.set(key, remapped);
            } else {
              const mapped = mapTokenFromFilters(token);
              if (mapped) trendingMapRef.current.set(key, mapped);
            }
            updateTrendingFromMap();
          } else if (msg.type === 'remove-token') {
            const token = msg.payload?.token as { address?: string; chainId?: string } | undefined;
            if (token && msg.payload?.viewName === 'trending') {
              trendingMapRef.current.delete(`${token.address}_${token.chainId}`);
              updateTrendingFromMap();
            }
          }
        } catch { /* parse error */ }
      };

      ws.onclose = (ev) => {
        console.log('[TokenDataSection] WSS closed:', ev.code, ev.reason);
        if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
        wsRef.current = null;
        if (!intentionalClose && mountedRef.current) {
          reconnectRef.current = setTimeout(connectWs, RECONNECT_DELAY);
        }
      };

      ws.onerror = (err) => { console.error('[TokenDataSection] WSS error:', err); };
    };

    connectWs();

    return () => {
      mountedRef.current = false;
      intentionalClose = true;
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
      if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, [selectedAllModeWssUrl, selectedWssRegion, updateTrendingFromMap]);

  const handleTrendingClick = (t: TrendingToken) => {
    setTokenOut({ address: t.address, symbol: t.symbol, name: t.name, decimals: 9, logo: t.logo, chainId: t.chainId });
    setChainId(t.chainId);
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="bg-bgSecondary rounded-xl border border-borderDefault overflow-hidden">
        <div className="flex divide-x divide-borderDefault/40">
          {(tokenIn || isLoadingIn) && <TokenCard details={tokenInDetails} sparkline={tokenInSparkline} isLoading={isLoadingIn} />}
          {(tokenOut || isLoadingOut) && <TokenCard details={tokenOutDetails} sparkline={tokenOutSparkline} isLoading={isLoadingOut} />}
        </div>
        {(tokenInDetails || tokenOutDetails) && (<>
          <button onClick={() => setExpanded(!expanded)} className="w-full px-5 py-2.5 text-[11px] text-textTertiary hover:text-textSecondary transition-colors border-t border-borderDefault/40 text-center font-medium">{expanded ? 'Hide details' : 'View market data'}</button>
          <div className={`overflow-hidden transition-all duration-300 ${expanded ? 'max-h-[500px]' : 'max-h-0'}`}>
            <div className="flex divide-x divide-borderDefault/40 border-t border-borderDefault/40">
              {tokenInDetails && (<div className="flex-1 px-4 py-3"><p className="text-[11px] font-bold text-textSecondary uppercase tracking-wider pb-1">{tokenInDetails.symbol}</p><StatRow label="Market Cap" value={`$${formatPureNumber(tokenInDetails.marketCapUSD)}`} /><StatRow label="24h Volume" value={`$${formatPureNumber(tokenInDetails.volume24hUSD)}`} /><StatRow label="Liquidity" value={`$${formatPureNumber(tokenInDetails.liquidityUSD)}`} /></div>)}
              {tokenOutDetails && (<div className="flex-1 px-4 py-3"><p className="text-[11px] font-bold text-textSecondary uppercase tracking-wider pb-1">{tokenOutDetails.symbol}</p><StatRow label="Market Cap" value={`$${formatPureNumber(tokenOutDetails.marketCapUSD)}`} /><StatRow label="24h Volume" value={`$${formatPureNumber(tokenOutDetails.volume24hUSD)}`} /><StatRow label="Liquidity" value={`$${formatPureNumber(tokenOutDetails.liquidityUSD)}`} /></div>)}
            </div>
          </div>
        </>)}
      </div>
      <div className="bg-bgSecondary rounded-xl border border-borderDefault overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-4 pb-2">
          <ArrowRightLeft size={14} className="text-success" />
          <span className="text-[12px] font-bold text-textSecondary uppercase tracking-wider">Trade any token, anywhere</span>
        </div>
        <div className="divide-y divide-borderDefault/40">
          {isTrendingLoading && <>{[1, 2, 3, 4, 5].map((i) => (<div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse"><div className="w-4 h-4 bg-bgTertiary rounded" /><div className="w-7 h-7 rounded-full bg-bgTertiary" /><div className="flex-1"><div className="h-4 w-16 bg-bgTertiary rounded mb-1" /><div className="h-3 w-24 bg-bgTertiary rounded" /></div><div className="h-4 w-16 bg-bgTertiary rounded" /><div className="h-4 w-14 bg-bgTertiary rounded" /></div>))}</>}
          {!isTrendingLoading && trendingTokens.length === 0 && <p className="text-xs text-textTertiary text-center py-6">No trending tokens</p>}
          {!isTrendingLoading && trendingTokens.map((t, idx) => <TrendingRow key={`${t.chainId}-${t.address}`} token={t} rank={idx + 1} onClick={() => handleTrendingClick(t)} />)}
        </div>
      </div>
    </div>
  );
}
