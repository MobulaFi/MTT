import { formatCryptoPrice } from '@mobula_labs/sdk';

/** Format a number as a compact USD string ($1.2K, $3.5M, $2.1B) */
export function fmtUsd(v: number): string {
  if (v === 0) return '$0';
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}K`;
  if (a >= 1) return `${s}$${a.toFixed(2)}`;
  if (a < 0.01) return `${s}<$0.01`;
  return `${s}$${a.toFixed(2)}`;
}

/** Format a number as a compact USD string, using formatCryptoPrice for sub-$1 */
export function fmtUsdCrypto(v: number): string {
  if (v === 0) return '$0';
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}K`;
  if (a >= 1) return `${s}$${a.toFixed(2)}`;
  const f = String(formatCryptoPrice(a));
  return f.startsWith('$') ? `${s}${f}` : `${s}$${f}`;
}

/** Format a token balance (human-readable) */
export function fmtBalance(v: number): string {
  if (v === 0) return '0';
  if (v < 0.0001) return '<0.0001';
  if (v < 1) return v.toFixed(4);
  if (v < 1000) return v.toFixed(2);
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** Format a compact number (1.2K, 3.5M) */
export function fmtNum(v: number): string {
  if (!v || v === 0) return '0';
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/** Format a percentage with sign */
export function fmtPct(v: number | undefined): string {
  if (v === undefined || v === null) return '-';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

/** Format a date as relative time (e.g., "3s ago", "5m ago") */
export function timeAgo(d: string | undefined): string {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 0) return '';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  if (s < 86400 * 365) return `${Math.floor(s / (86400 * 30))}mo ago`;
  return `${Math.floor(s / (86400 * 365))}y ago`;
}

/** Format a date as compact relative time without "ago" (e.g., "3s", "5m") */
export function timeAgoShort(d: string | undefined): string {
  if (!d) return '-';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 0) return '-';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d`;
  if (s < 86400 * 365) return `${Math.floor(s / (86400 * 30))}mo`;
  return `${Math.floor(s / (86400 * 365))}y`;
}

/** Market cap color: green (>=150k), blue (>=30k), yellow (below) */
export function getMcColor(mc: number): string {
  if (mc >= 150_000) return '#2FE2AB';
  if (mc >= 30_000) return '#60A5FA';
  return '#F0B90B';
}

/** Convert a chainId like "evm:1" or "solana:solana" to a blockchain slug */
export function toBlockchain(id: string): string {
  if (!id) return 'solana';
  const p = id.split(':');
  return p.length >= 2 ? (p[0] === 'evm' ? p[1] : p[0]) : id;
}
