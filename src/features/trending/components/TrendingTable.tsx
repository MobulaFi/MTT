'use client';

import { memo, useMemo, useCallback, useState } from 'react';
import { ChevronUp, ChevronDown, Copy } from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import { formatCryptoPrice } from '@mobula_labs/sdk';
import { useTrendingStore, type TrendingToken, type SortField } from '../store/useTrendingStore';
import { useTrendingMetadata } from '../hooks/useTrendingMetadata';
import { fmtUsdCrypto, fmtNum, fmtPct, timeAgoShort, toBlockchain, getMcColor } from '@/lib/format';
import { useNavigationStore } from '@/store/useNavigationStore';

const CHAIN_COLORS: Record<string, string> = {
  'solana:solana': '#9945FF',
  'evm:1': '#627EEA',
  'evm:56': '#F0B90B',
  'evm:137': '#8247E5',
  'evm:43114': '#E84142',
  'evm:42161': '#28A0F0',
  'evm:10': '#FF0420',
  'evm:8453': '#0052FF',
  'evm:250': '#1969FF',
  'evm:25': '#002D74',
  'sui:sui': '#6FBCF0',
  'tron:tron': '#FF0013',
};

function getChainColor(chainId: string): string {
  return CHAIN_COLORS[chainId] || '#555555';
}

/* ── Helpers ── */

function getVal(token: TrendingToken, field: SortField): number {
  const ext = token as Record<string, unknown>;
  const v = ext[field];
  if (v === undefined || v === null) return 0;
  if (field === 'createdAt' || field === 'latestTradeDate') {
    return new Date(v as string).getTime() || 0;
  }
  return Number(v) || 0;
}

/* ── Color helpers ── */
function pctColor(v: number): string {
  if (v > 0) return 'text-success';
  if (v < 0) return 'text-error';
  return 'text-textTertiary';
}

function valueColor(v: number): string {
  if (v >= 1e6) return 'text-warning';
  if (v >= 100_000) return 'text-grayLight';
  return 'text-textSecondary';
}

/* ── Column definitions ── */
interface Column {
  key: SortField | 'token' | 'exchange' | 'buySell';
  label: string;
  sortable: boolean;
  width: string;
  align: 'left' | 'right' | 'center';
}

const COLUMNS: Column[] = [
  { key: 'token', label: 'Token', sortable: false, width: '240px', align: 'left' },
  { key: 'priceUSD', label: 'Price', sortable: true, width: '110px', align: 'right' },
  { key: 'priceChange5minPercentage', label: '5m', sortable: true, width: '72px', align: 'right' },
  { key: 'priceChange1hPercentage', label: '1h', sortable: true, width: '72px', align: 'right' },
  { key: 'priceChange4hPercentage', label: '4h', sortable: true, width: '72px', align: 'right' },
  { key: 'priceChange24hPercentage', label: '24h', sortable: true, width: '72px', align: 'right' },
  { key: 'volume24hUSD', label: 'Volume', sortable: true, width: '95px', align: 'right' },
  { key: 'feesPaid24hUSD' as SortField, label: 'Fees 24h', sortable: true, width: '95px', align: 'right' },
  { key: 'marketCapUSD', label: 'Mkt Cap', sortable: true, width: '95px', align: 'right' },
  { key: 'holdersCount', label: 'Holders', sortable: true, width: '80px', align: 'right' },
  { key: 'liquidityUSD', label: 'Liquidity', sortable: true, width: '95px', align: 'right' },
  { key: 'trades24h', label: 'Txs', sortable: true, width: '75px', align: 'right' },
  { key: 'buySell', label: 'Buys/Sells', sortable: false, width: '140px', align: 'center' },
  { key: 'traders24h', label: 'Traders', sortable: true, width: '75px', align: 'right' },
  { key: 'avgTradeSize24hUSD', label: '$ Avg', sortable: true, width: '75px', align: 'right' },
  { key: 'createdAt', label: 'Age', sortable: true, width: '60px', align: 'right' },
  { key: 'latestTradeDate', label: 'Last Txn', sortable: true, width: '70px', align: 'right' },
  { key: 'exchange', label: 'Exchange', sortable: false, width: '80px', align: 'left' },
];

/* ── Sort Header ── */
const CELL_BORDER = '1px solid var(--color-borderDefault, #161616)';

const SortHeader = memo(({ col, sortField, sortOrder, onToggle }: {
  col: Column;
  sortField: SortField;
  sortOrder: 'asc' | 'desc';
  onToggle: (field: SortField) => void;
}) => {
  const isActive = col.sortable && sortField === col.key;
  return (
    <th
      style={{ width: col.width, minWidth: col.width, textAlign: col.align, borderRight: CELL_BORDER }}
      className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest whitespace-nowrap ${
        col.sortable ? 'cursor-pointer select-none hover:text-textSecondary' : ''
      } ${isActive ? 'text-textSecondary' : 'text-textTertiary'}`}
      onClick={() => col.sortable && onToggle(col.key as SortField)}
    >
      <span className="inline-flex items-center gap-0.5">
        {col.label}
        {isActive && (
          sortOrder === 'desc'
            ? <ChevronDown size={9} className="text-success" />
            : <ChevronUp size={9} className="text-success" />
        )}
      </span>
    </th>
  );
});
SortHeader.displayName = 'SortHeader';

/* ── Buy/Sell Ratio Bar ── */
function BuySellBar({ buys, sells }: { buys: number; sells: number }) {
  const total = buys + sells;
  if (total === 0) return <span className="text-[10px] text-textTertiary">-</span>;
  const buyPct = (buys / total) * 100;
  return (
    <div className="flex flex-col items-center gap-0.5 w-full">
      <div className="flex items-center gap-1 text-[11px] font-mono w-full justify-between">
        <span className="text-success/80">{fmtNum(buys)}</span>
        <span className="text-error/80">{fmtNum(sells)}</span>
      </div>
      <div className="w-full h-[2px] rounded-full bg-error/30 overflow-hidden">
        <div
          className="h-full bg-success/70 rounded-full"
          style={{ width: `${buyPct}%` }}
        />
      </div>
    </div>
  );
}

/* ── Token Row ── */
const TokenRow = memo(({ token, chainLogoMap }: { token: TrendingToken; chainLogoMap: Record<string, string> }) => {
  const navigateToToken = useNavigationStore((s) => s.navigateToToken);
  const ext = token as Record<string, unknown>;
  const [copied, setCopied] = useState(false);

  const name = (token.name || ext.tokenName || 'Unknown') as string;
  const symbol = (token.symbol || ext.tokenSymbol || '??') as string;
  const logo = (token.logo || ext.tokenLogo || '') as string;

  const pc5m = Number(ext.priceChange5minPercentage ?? ext.priceChange5min ?? ext.price_change_5min ?? 0);
  const pc1h = Number(ext.priceChange1hPercentage ?? ext.priceChangePercentage1h ?? ext.price_change_1h ?? 0);
  const pc4h = Number(ext.priceChange4hPercentage ?? ext.priceChangePercentage4h ?? ext.price_change_4h ?? 0);
  const pc24h = Number(ext.priceChange24hPercentage ?? ext.priceChangePercentage24h ?? ext.price_change_24h ?? 0);

  const volume = Number(ext.volume24hUSD ?? ext.volumeUSD24h ?? 0);
  const mc = Number(token.marketCapUSD ?? 0);
  const holders = Number(token.holdersCount ?? ext.holders_count ?? 0);
  const liq = Number(token.liquidityUSD ?? 0);
  const txs = Number(ext.trades24h ?? ext.trades_24h ?? 0);
  const traders = Number(ext.traders24h ?? ext.traders_24h ?? 0);
  const price = Number(token.priceUSD ?? 0);
  const buys = Number(ext.buys24h ?? ext.buys_24h ?? 0);
  const sells = Number(ext.sells24h ?? ext.sells_24h ?? 0);

  const avgTrade = txs > 0 ? volume / txs : Number(ext.avgTradeSize24hUSD ?? 0);
  const fees24h = Number(ext.feesPaid24hUSD ?? ext.fees_paid_24h_usd ?? 0);

  const age = (token.createdAt ?? token.created_at ?? ext.created_at ?? '') as string;
  const lastTxn = (ext.latestTradeDate ?? ext.latest_trade_date ?? '') as string;

  const chainLogo = chainLogoMap[token.chainId] || '';
  const chainColor = getChainColor(token.chainId);

  const handleClick = useCallback(() => {
    navigateToToken(token.address, toBlockchain(token.chainId), token as unknown as Record<string, unknown>);
  }, [navigateToToken, token.chainId, token.address, token]);

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(token.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [token.address]);

  const cellStyle = { borderRight: CELL_BORDER };

  return (
    <tr
      onClick={handleClick}
      className="group cursor-pointer transition-colors bg-bgSecondary hover:bg-bgTableHover"
      style={{ borderBottom: CELL_BORDER }}
    >
      {/* Token */}
      <td className="px-3 py-1.5" style={{ ...cellStyle, width: '240px', minWidth: '240px' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex-shrink-0">
            <div
              className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center"
              style={{ border: `2px solid ${chainColor}90`, boxShadow: `0 0 6px ${chainColor}25` }}
            >
              {logo ? (
                <SafeImage src={logo} alt="" width={38} height={38} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-bgSecondary flex items-center justify-center text-[10px] font-semibold text-textTertiary">
                  {symbol.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            {chainLogo && (
              <img
                src={chainLogo}
                alt=""
                className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full"
                style={{ border: `1.5px solid ${chainColor}` }}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-medium text-textPrimary truncate max-w-[55px]">
                {symbol}
              </span>
              <span className="text-[12px] text-textTertiary truncate max-w-[100px]">
                {name}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5" onClick={e => e.stopPropagation()}>
              {token.socials?.twitter && (
                <button onClick={() => window.open(token.socials!.twitter!, '_blank')} className="text-textTertiary hover:text-textSecondary transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </button>
              )}
              {token.socials?.telegram && (
                <button onClick={() => window.open(token.socials!.telegram!, '_blank')} className="text-textTertiary hover:text-textSecondary transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                </button>
              )}
              {token.socials?.website && (
                <button onClick={() => window.open(token.socials!.website!, '_blank')} className="text-textTertiary hover:text-textSecondary transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                </button>
              )}
              <button
                onClick={handleCopy}
                className="text-textTertiary hover:text-textSecondary transition-colors"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                title="Copy address"
              >
                {copied ? (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <Copy size={9} />
                )}
              </button>
            </div>
          </div>
        </div>
      </td>

      <td className="px-3 py-1.5 text-right text-[13px] text-textSecondary font-mono" style={{ ...cellStyle, width: '110px' }}>
        {price > 0 ? `$${formatCryptoPrice(price)}` : '-'}
      </td>

      <td className={`px-3 py-1.5 text-right text-[13px] font-mono ${pctColor(pc5m)}`} style={{ ...cellStyle, width: '72px' }}>
        {fmtPct(pc5m)}
      </td>

      <td className={`px-3 py-1.5 text-right text-[13px] font-mono ${pctColor(pc1h)}`} style={{ ...cellStyle, width: '72px' }}>
        {fmtPct(pc1h)}
      </td>

      <td className={`px-3 py-1.5 text-right text-[13px] font-mono ${pctColor(pc4h)}`} style={{ ...cellStyle, width: '72px' }}>
        {fmtPct(pc4h)}
      </td>

      <td className={`px-3 py-1.5 text-right text-[13px] font-mono ${pctColor(pc24h)}`} style={{ ...cellStyle, width: '72px' }}>
        {fmtPct(pc24h)}
      </td>

      <td className={`px-3 py-1.5 text-right text-[13px] font-mono ${valueColor(volume)}`} style={{ ...cellStyle, width: '95px' }}>
        {fmtUsdCrypto(volume)}
      </td>

      <td className={`px-3 py-1.5 text-right text-[13px] font-mono ${valueColor(fees24h)}`} style={{ ...cellStyle, width: '95px' }}>
        {fmtUsdCrypto(fees24h)}
      </td>

      <td className="px-3 py-1.5 text-right text-[13px] font-mono" style={{ ...cellStyle, width: '95px', color: getMcColor(mc) }}>
        {fmtUsdCrypto(mc)}
      </td>

      <td className={`px-3 py-1.5 text-right text-[13px] font-mono ${valueColor(holders)}`} style={{ ...cellStyle, width: '80px' }}>
        {fmtNum(holders)}
      </td>

      <td className={`px-3 py-1.5 text-right text-[13px] font-mono ${valueColor(liq)}`} style={{ ...cellStyle, width: '95px' }}>
        {fmtUsdCrypto(liq)}
      </td>

      <td className={`px-3 py-1.5 text-right text-[13px] font-mono ${valueColor(txs)}`} style={{ ...cellStyle, width: '75px' }}>
        {fmtNum(txs)}
      </td>

      <td className="px-3 py-1.5" style={{ ...cellStyle, width: '140px' }}>
        <BuySellBar buys={buys} sells={sells} />
      </td>

      <td className={`px-3 py-1.5 text-right text-[13px] font-mono ${valueColor(traders)}`} style={{ ...cellStyle, width: '75px' }}>
        {fmtNum(traders)}
      </td>

      <td className="px-3 py-1.5 text-right text-[13px] text-textSecondary font-mono" style={{ ...cellStyle, width: '75px' }}>
        {fmtUsdCrypto(avgTrade)}
      </td>

      <td className="px-3 py-1.5 text-right text-[12px] text-textTertiary font-mono" style={{ ...cellStyle, width: '60px' }}>
        {timeAgoShort(age)}
      </td>

      <td className="px-3 py-1.5 text-right text-[12px] text-textTertiary font-mono" style={{ ...cellStyle, width: '70px' }}>
        {timeAgoShort(lastTxn)}
      </td>

      <td className="px-3 py-1.5" style={{ width: '80px' }}>
        <div className="flex items-center gap-1.5">
          {token.exchange?.logo && (
            <SafeImage src={token.exchange.logo} alt="" width={14} height={14} className="rounded flex-shrink-0 opacity-70" />
          )}
          <span className="text-[11px] text-textTertiary truncate">
            {token.exchange?.name ?? token.source ?? '-'}
          </span>
        </div>
      </td>
    </tr>
  );
});
TokenRow.displayName = 'TokenRow';

/* ── Skeleton Row ── */
function SkeletonRow() {
  return (
    <tr className="animate-pulse" style={{ borderBottom: CELL_BORDER }}>
      <td className="px-3 py-3" style={{ borderRight: CELL_BORDER }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-bgSecondary" />
          <div className="space-y-1.5">
            <div className="h-3 w-20 bg-bgSecondary rounded" />
            <div className="h-2 w-10 bg-bgSecondary rounded" />
          </div>
        </div>
      </td>
      {Array.from({ length: 17 }).map((_, i) => (
        <td key={i} className="px-3 py-3" style={{ borderRight: i < 16 ? CELL_BORDER : undefined }}>
          <div className="h-3 w-full bg-bgSecondary rounded" />
        </td>
      ))}
    </tr>
  );
}

/* ── Main Table ── */
export default function TrendingTable() {
  // Individual selectors — only re-render when these specific fields change
  const tokens = useTrendingStore((s) => s.tokens);
  const loading = useTrendingStore((s) => s.loading);
  const sortField = useTrendingStore((s) => s.sortField);
  const sortOrder = useTrendingStore((s) => s.sortOrder);
  const toggleSort = useTrendingStore((s) => s.toggleSort);
  const { chains } = useTrendingMetadata();

  const chainLogoMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of chains) {
      if (c.id && c.logo) map[c.id] = c.logo;
    }
    return map;
  }, [chains]);

  const sortedTokens = useMemo(() => {
    if (!tokens.length) return [];
    return [...tokens].sort((a, b) => {
      const aVal = getVal(a, sortField);
      const bVal = getVal(b, sortField);
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [tokens, sortField, sortOrder]);

  const showSkeletons = loading && tokens.length === 0;

  return (
    <div className="overflow-x-auto border-y border-borderDefault">
      <table className="w-full border-collapse" style={{ minWidth: 1600 }}>
        <thead>
          <tr className="bg-bgDarkest" style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: CELL_BORDER }}>
            {COLUMNS.map((col) => (
              <SortHeader
                key={col.key}
                col={col}
                sortField={sortField}
                sortOrder={sortOrder}
                onToggle={toggleSort}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {showSkeletons
            ? Array.from({ length: 20 }).map((_, i) => <SkeletonRow key={i} />)
            : sortedTokens.map((token) => (
                <TokenRow key={`${token.address}_${token.chainId}`} token={token} chainLogoMap={chainLogoMap} />
              ))
          }
          {!showSkeletons && sortedTokens.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="text-center py-16 text-textTertiary text-xs">
                No tokens found. Try adjusting your filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
