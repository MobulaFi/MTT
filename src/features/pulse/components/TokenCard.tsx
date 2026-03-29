'use client';

import {
  Crown,
  Globe,
  Twitter,
  UserRound,
  Send,
  Bot,
  ChefHat,
  Bug,
  Crosshair,
  Ghost,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState, useRef, type MouseEvent } from 'react';
import SafeImage from '@/components/SafeImage';
import {
  formatCryptoPrice,
  formatPureNumber,
} from '@mobula_labs/sdk';
import { TradeTimeCell } from '@/components/ui/tradetimecell';
import { getBuyPercent } from '@/components/shared/StatsCard';
import type { PulseToken } from '@/features/pulse/store/usePulseDataStore';
import { usePulseDisplayStore } from '@/features/pulse/store/usePulseDisplayStore';
import type { DisplayState } from '@/features/pulse/store/usePulseDisplayStore';
import CopyAddress from '@/utils/CopyAddress';
import { getMcColor } from '@/lib/format';
import { validateImageUrl } from '@/components/SafeImage';

/**
 * Silent logo loader — shows nothing until the image successfully loads.
 * No loading state, no retry flicker, no fallback visible.
 * Just fades in smoothly when the image is ready.
 */
function SilentLogo({ src, size }: { src: string; size: number }) {
  const [loaded, setLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | null>(() => validateImageUrl(src));
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const srcRef = useRef(src);

  // Reset when src changes (e.g. WSS sends logo)
  if (src !== srcRef.current) {
    srcRef.current = src;
    const validated = validateImageUrl(src);
    if (validated) {
      setCurrentSrc(validated);
      setLoaded(false);
      retryRef.current = 0;
    }
  }

  // Cleanup timer
  useRef(() => () => { if (timerRef.current) clearTimeout(timerRef.current); });

  if (!currentSrc) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentSrc}
      alt=""
      width={size}
      height={size}
      style={{
        position: 'absolute', inset: 0, width: size, height: size,
        objectFit: 'cover',
        opacity: loaded ? 1 : 0,
      }}
      onLoad={() => setLoaded(true)}
      onError={() => {
        // Silent retry — 2 attempts with delay, then give up invisibly
        if (retryRef.current < 2 && validateImageUrl(src)) {
          const attempt = retryRef.current++;
          timerRef.current = setTimeout(() => {
            const original = validateImageUrl(src);
            if (original) {
              const sep = original.includes('?') ? '&' : '?';
              setCurrentSrc(`${original}${sep}_r=${attempt + 1}&_t=${Date.now()}`);
            }
          }, [2000, 4000][attempt]);
        }
        // On final failure, just stay invisible — initials badge shows through
      }}
    />
  );
}

/**
 * Resolve logo URL from a metadata URI (IPFS/Arweave JSON).
 * Fetches the JSON, extracts the `image` field, and returns the direct image URL.
 * Returns null while loading or if fetch fails. Caches results globally.
 */
const uriLogoCache = new Map<string, string | null>();

function useLogoFromUri(uri: string | undefined | null): string | null {
  const [logo, setLogo] = useState<string | null>(() =>
    uri ? uriLogoCache.get(uri) ?? null : null,
  );

  useEffect(() => {
    if (!uri) return;

    const cached = uriLogoCache.get(uri);
    if (cached !== undefined) {
      setLogo(cached);
      return;
    }

    let cancelled = false;
    fetch(uri, { signal: AbortSignal.timeout(4000) })
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('image/')) {
          uriLogoCache.set(uri, uri);
          if (!cancelled) setLogo(uri);
          return;
        }
        const json = (await res.json()) as Record<string, unknown>;
        const imageUrl = (json.image as string) || (json.logo as string) || null;
        uriLogoCache.set(uri, imageUrl);
        if (!cancelled) setLogo(imageUrl);
      })
      .catch(() => {
        uriLogoCache.set(uri, null);
      });

    return () => { cancelled = true; };
  }, [uri]);

  return logo;
}

type CustomizeRows = DisplayState['customizeRows'];

interface TokenCardProps {
  pulseData: PulseToken | null;
  shouldBonded?: boolean;
  viewName?: 'new' | 'bonding' | 'bonded';
  index?: number;
}

interface TD extends PulseToken {
  symbol?: string;
  name?: string;
  logo?: string;
  exchange?: { logo?: string; name?: string };
  socials?: { twitter?: string; website?: string; telegram?: string; uri?: string };
  holdersCount?: number;
  holders_count?: number;
  proTradersCount?: number;
  deployerMigrations?: number;
  createdAt?: string;
  created_at?: string;
  bonded_at?: string;
  marketCap?: number;
  organic_volume_sell_24h?: number;
  fees_paid_24h?: number;
  price_change_24h?: number;
  buys_24h?: number;
  sells_24h?: number;
  bondingPercentage?: number;
  source?: string;
  priceUSD?: number;
  liquidityUSD?: number;
  [key: string]: unknown;
}

function resolve(token: PulseToken | null): TD | null {
  if (!token) return null;
  if (token.token && typeof token.token === 'object') {
    const { token: nested, ...rest } = token;
    // nested first, rest (top-level) wins — updates write to top-level
    return { ...nested, ...rest } as TD;
  }
  return token as TD;
}

function extractTwitterHandle(url?: string): string {
  if (!url) return '';
  const m = url.match(/(?:twitter\.com|x\.com)\/(@?\w+)/i);
  return m ? `@${m[1].replace(/^@/, '')}` : '';
}

const C = {
  cardBg: '#0E0E12',
  hover:  '#151519',
  green:  '#00DC82',
  red:    '#FF4757',
  yellow: '#F0B90B',
  blue:   '#60A5FA',
  white:  '#E8E8EC',
  dim:    '#9A9AA0',
  label:  '#4A4A52',
  muted:  '#3A3A42',
  badgeBg: '#111114',
  border: '#1A1A1E',
} as const;

const f = 'var(--font-mono, monospace)';

const COLUMN_COLOR: Record<string, string> = {
  new: C.blue,
  bonding: C.green,
  bonded: C.yellow,
};


function holdingColor(value: number, threshold: number): string {
  if (value === 0) return C.dim;
  return value > threshold ? C.red : C.green;
}

function TokenCard({ pulseData, shouldBonded = true, viewName, index }: TokenCardProps) {
  const { customizeRows: cr } = usePulseDisplayStore();
  const td = useMemo(() => resolve(pulseData), [pulseData]);
  const [logoHover, setLogoHover] = useState(false);
  const logoRef = useRef<HTMLDivElement>(null);

  // When logo is null, resolve it client-side from the metadata URI (~25ms IPFS fetch)
  const uriLogo = useLogoFromUri(!td?.logo ? td?.socials?.uri : null);
  const effectiveLogo = td?.logo || uriLogo;

  const imgClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation(); e.preventDefault();
    if (effectiveLogo) window.open(`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(effectiveLogo)}`, '_blank', 'noopener,noreferrer');
  }, [effectiveLogo]);

  if (!td) return null;

  const x = td as Record<string, unknown>;
  const mc = Number(x.marketCapUSD ?? td.marketCap ?? 0);
  const vol = Number(x.organicVolumeSell24hUSD ?? td.organic_volume_sell_24h ?? 0);
  const fees = Number(x.feesPaid24hUSD ?? td.fees_paid_24h ?? 0);
  const buys = Number(x.organicBuys24h ?? td.buys_24h ?? 0);
  const sells = Number(x.organicSells24h ?? td.sells_24h ?? 0);
  const total = buys + sells;
  const buyPct = getBuyPercent(buys, sells);
  const holders = Number(td.holdersCount ?? td.holders_count ?? 0);
  const rawMig = Number(x.deployerMigrations ?? td.deployerMigrations ?? 0);
  const rawMigTotal = Number(x.deployerCreations ?? x.deployer_creations ?? x.deployerTokensCount ?? 0);
  const migTotal = Math.max(rawMigTotal, 1);
  const mig = viewName === 'bonded' ? Math.max(rawMig, 1) : rawMig;
  const bond = td.bondingPercentage ?? 0;
  const pro = td.proTradersCount ?? 0;
  const paid = Boolean(x.dexPaid ?? x.dex_paid);
  const ts = viewName === 'bonded' && td.bonded_at && td.bonded_at !== td.created_at
    ? td.bonded_at : td.createdAt ?? td.created_at ?? '';
  const exLogo = td.exchange?.logo ?? null;
  const twitterHandle = extractTwitterHandle(td.socials?.twitter);
  const colColor = COLUMN_COLOR[viewName ?? 'new'] ?? C.blue;

  const t10 = Number(td.top10HoldingsPercentage ?? 0);
  const dev = Number(td.devHoldingsPercentage ?? 0);
  const snp = Number(td.snipersHoldingsPercentage ?? 0);
  const ins = Number(td.insidersHoldingsPercentage ?? 0);
  const bun = Number(td.bundlersHoldingsPercentage ?? 0);

  const openUrl = useCallback((e: MouseEvent, url: string) => {
    e.stopPropagation(); e.preventDefault();
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const holdingBadge = (Icon: typeof ChefHat, value: number, threshold: number, label: string) => {
    const color = holdingColor(value, threshold);
    return (
      <span style={{
        position: 'relative',
        color, fontSize: 14, padding: '2px 8px',
        borderRadius: 2, border: `1px solid ${color}30`,
        background: `${color}10`, whiteSpace: 'nowrap',
        display: 'inline-flex', alignItems: 'center', gap: 3,
        cursor: 'default', flex: 1, justifyContent: 'center',
      }}
        onMouseEnter={e => {
          const tip = e.currentTarget.querySelector('[data-tip]') as HTMLElement;
          if (tip) tip.style.opacity = '1';
        }}
        onMouseLeave={e => {
          const tip = e.currentTarget.querySelector('[data-tip]') as HTMLElement;
          if (tip) tip.style.opacity = '0';
        }}
      >
        <Icon size={10} />{value.toFixed(0)}%
        <span data-tip="" style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: 4, padding: '3px 8px', borderRadius: 3,
          background: '#222228', color: C.white, fontSize: 12, whiteSpace: 'nowrap',
          pointerEvents: 'none', opacity: 0, transition: 'opacity 0.05s',
          zIndex: 30,
        }}>
          {label}
        </span>
      </span>
    );
  };

  return (
    <div
      style={{
        padding: '12px 14px', cursor: 'pointer', fontFamily: f,
        background: C.cardBg, borderBottom: `1px solid ${C.border}`,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.hover; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.cardBg; }}
    >
      <div style={{ display: 'flex', gap: 12 }}>

        {/* LOGO with bonding progress border */}
        <div
          ref={logoRef}
          onClick={imgClick}
          onMouseEnter={() => setLogoHover(true)}
          onMouseLeave={() => setLogoHover(false)}
          style={{
            width: 68, height: 68, flexShrink: 0, position: 'relative',
          }}
        >
          {/* SVG progress border — perimeter fills based on bonding % */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: 68, height: 68 }} viewBox="0 0 68 68">
            {/* bg track */}
            <rect x="1" y="1" width="66" height="66" rx="2" ry="2"
              fill="none" stroke={`${colColor}25`} strokeWidth="2" />
            {/* progress fill */}
            <rect x="1" y="1" width="66" height="66" rx="2" ry="2"
              fill="none" stroke={colColor} strokeWidth="2"
              strokeDasharray="264"
              strokeDashoffset={bond > 0 && bond < 100 ? 264 * (1 - bond / 100) : 0}
              style={{ transition: 'stroke-dashoffset 0.3s' }}
            />
          </svg>
          {/* Logo image — always show initials underneath, overlay logo only when loaded */}
          <div style={{
            position: 'absolute', top: 2, left: 2, width: 64, height: 64,
            borderRadius: 1, overflow: 'hidden', background: C.badgeBg,
          }}>
            {/* Initials fallback — always visible as background */}
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: C.label, position: 'absolute', inset: 0 }}>
              {(td.symbol?.charAt(0) ?? '?').toUpperCase()}
            </div>
            {/* Logo overlay — silent: invisible until loaded, no visible retry/fallback */}
            {effectiveLogo && (
              <SilentLogo src={effectiveLogo} size={64} />
            )}
          </div>
          {exLogo && (
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 2, background: C.cardBg, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
              <SafeImage src={exLogo} alt="" width={18} height={18} className="rounded" quality={70} />
            </div>
          )}
          {/* Hover tooltip — enlarged logo */}
          {logoHover && effectiveLogo && (
            <div style={{
              position: 'absolute', bottom: 76, left: 0, zIndex: 50,
              width: 200, height: 200, borderRadius: 4,
              border: `1px solid ${C.border}`, background: C.cardBg,
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              overflow: 'hidden', pointerEvents: 'none',
            }}>
              <SilentLogo src={effectiveLogo} size={200} />
            </div>
          )}
        </div>

        {/* CENTER */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>

          {/* ROW 1: Symbol + name + copy */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, lineHeight: '22px' }}>
            <span style={{ fontSize: 21, color: C.white, whiteSpace: 'nowrap' }}>
              {td.symbol ?? '???'}
            </span>
            <span style={{ fontSize: 16, color: C.label, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
              {td.name ?? ''}
            </span>
            <span onClick={e => e.stopPropagation()} style={{ flexShrink: 0, lineHeight: 0 }}>
              <CopyAddress display="" value={td.address ?? ''} />
            </span>
          </div>

          {/* ROW 2: age + social icons + holders + pro traders + buys/sells + Paid */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 16, lineHeight: '20px', flexWrap: 'wrap' }}>
            <span style={{ color: C.dim }}><TradeTimeCell timestamp={ts} showAbsolute={false} hash="" /></span>
            {td.socials?.twitter && (
              <span onClick={e => openUrl(e as unknown as MouseEvent, td.socials!.twitter!)} style={{ cursor: 'pointer', color: C.blue, lineHeight: 0, flexShrink: 0 }}><Twitter size={15} /></span>
            )}
            {cr.socials && td.socials?.website && (
              <span onClick={e => openUrl(e as unknown as MouseEvent, td.socials!.website!)} style={{ cursor: 'pointer', color: C.muted, lineHeight: 0, flexShrink: 0 }}><Globe size={15} /></span>
            )}
            {cr.socials && td.socials?.telegram && (
              <span onClick={e => openUrl(e as unknown as MouseEvent, td.socials!.telegram!)} style={{ cursor: 'pointer', color: C.muted, lineHeight: 0, flexShrink: 0 }}><Send size={15} /></span>
            )}
            {cr.devMigrations && (mig > 0 || migTotal > 0) && (
              <span style={{ color: mig > 0 ? C.green : C.dim, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Crown size={15} />{migTotal > 0 ? `${mig}/${migTotal}` : mig}
              </span>
            )}
            {cr.holders && (
              <span style={{ color: C.white, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <UserRound size={15} />{formatPureNumber(holders, { maxFractionDigits: 0, minFractionDigits: 0 })}
              </span>
            )}
            {cr.proTraders && pro > 0 && (
              <span style={{ color: C.white, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Bot size={15} />{pro}
              </span>
            )}
            {cr.tx && (buys > 0 || sells > 0) && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: C.green }}>{formatPureNumber(buys, { maxFractionDigits: 0, minFractionDigits: 0 })}</span>
                <span style={{ color: C.red }}>{formatPureNumber(sells, { maxFractionDigits: 0, minFractionDigits: 0 })}</span>
              </span>
            )}
            {cr.dexPaid && paid && (
              <span style={{ fontSize: 13, color: C.green, background: `${C.green}15`, padding: '1px 6px', borderRadius: 2 }}>Paid</span>
            )}
          </div>

          {/* ROW 3: @twitterHandle (fixed height even if empty) */}
          <div style={{ minHeight: 18, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, lineHeight: '18px' }}>
            {twitterHandle && (
              <span
                onClick={e => openUrl(e as unknown as MouseEvent, td.socials!.twitter!)}
                style={{ cursor: 'pointer', color: C.blue }}
              >
                {twitterHandle}
              </span>
            )}
          </div>

          {/* ROW 4: holdings % badges with icons */}
          {(cr.top10Holdings || cr.devHoldings || cr.snipersHoldings || cr.insidersHoldings || cr.bundlersHoldings) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {cr.top10Holdings && holdingBadge(UserRound, t10, 10, 'Top 10 Holding')}
              {cr.devHoldings && holdingBadge(ChefHat, dev, 1, 'Dev Holding')}
              {cr.snipersHoldings && holdingBadge(Crosshair, snp, 5, 'Snipers Holding')}
              {cr.insidersHoldings && holdingBadge(Ghost, ins, 5, 'Insiders Holding')}
              {cr.bundlersHoldings && holdingBadge(Bug, bun, 5, 'Bundlers Holding')}
            </div>
          )}
        </div>

        {/* RIGHT — rows aligned with center: row1=mc, row2=volume, row3=F/TX/bar */}
        <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Row 1 — mc (aligned with symbol/name) */}
          {cr.marketCap && (
            <div style={{ whiteSpace: 'nowrap', lineHeight: '22px' }}>
              <span style={{ fontSize: 15, color: C.label, marginRight: 4 }}>mc</span>
              <span style={{ fontSize: 19, color: getMcColor(mc) }}>${formatCryptoPrice(mc)}</span>
            </div>
          )}
          {/* Row 2 — volume (aligned with age/social/holders) */}
          {cr.volume && (
            <div style={{ fontSize: 15, color: C.white, whiteSpace: 'nowrap', lineHeight: '20px' }}>
              ${formatCryptoPrice(vol)}
            </div>
          )}
          {/* Row 3 — F + TX + bar (aligned with twitter handle) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, minHeight: 18 }}>
            {cr.fees && (
              <span style={{ color: C.white, whiteSpace: 'nowrap' }}>F ${formatCryptoPrice(fees)}</span>
            )}
            {cr.tx && (
              <>
                <span style={{ color: C.white, whiteSpace: 'nowrap' }}>TX {formatPureNumber(total, { maxFractionDigits: 0, minFractionDigits: 0 })}</span>
                <div style={{
                  flex: 1, height: 3, borderRadius: 1, minWidth: 20,
                  background: total > 0 ? C.red : C.muted, overflow: 'hidden', position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', top: 0, left: 0,
                    height: '100%', background: C.green,
                    width: `${buyPct}%`, borderRadius: 1,
                  }} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(TokenCard, (prev, next) => {
  if (prev.shouldBonded !== next.shouldBonded || prev.viewName !== next.viewName || prev.index !== next.index) return false;
  const a = resolve(prev.pulseData);
  const b = resolve(next.pulseData);
  if (!a || !b) return a === b;
  const x1 = a as Record<string, unknown>;
  const x2 = b as Record<string, unknown>;
  return (
    (x1.marketCapUSD ?? a.marketCap) === (x2.marketCapUSD ?? b.marketCap) &&
    (x1.organicVolumeSell24hUSD ?? a.organic_volume_sell_24h) === (x2.organicVolumeSell24hUSD ?? b.organic_volume_sell_24h) &&
    (x1.feesPaid24hUSD ?? a.fees_paid_24h) === (x2.feesPaid24hUSD ?? b.fees_paid_24h) &&
    (x1.organicBuys24h ?? a.buys_24h) === (x2.organicBuys24h ?? b.buys_24h) &&
    (x1.organicSells24h ?? a.sells_24h) === (x2.organicSells24h ?? b.sells_24h) &&
    (a.holdersCount ?? a.holders_count) === (b.holdersCount ?? b.holders_count) &&
    a.proTradersCount === b.proTradersCount &&
    a.deployerMigrations === b.deployerMigrations &&
    (x1.deployerCreations ?? x1.deployer_creations ?? x1.deployerTokensCount) === (x2.deployerCreations ?? x2.deployer_creations ?? x2.deployerTokensCount) &&
    a.bondingPercentage === b.bondingPercentage &&
    a.top10HoldingsPercentage === b.top10HoldingsPercentage &&
    a.devHoldingsPercentage === b.devHoldingsPercentage &&
    a.snipersHoldingsPercentage === b.snipersHoldingsPercentage &&
    a.insidersHoldingsPercentage === b.insidersHoldingsPercentage &&
    a.bundlersHoldingsPercentage === b.bundlersHoldingsPercentage &&
    a.logo === b.logo &&
    a.symbol === b.symbol &&
    a.name === b.name &&
    a.socials?.twitter === b.socials?.twitter &&
    a.socials?.website === b.socials?.website &&
    a.socials?.telegram === b.socials?.telegram &&
    a.exchange?.logo === b.exchange?.logo &&
    (x1.dexPaid ?? x1.dex_paid) === (x2.dexPaid ?? x2.dex_paid) &&
    (a.createdAt ?? a.created_at) === (b.createdAt ?? b.created_at) &&
    a.bonded_at === b.bonded_at
  );
});
