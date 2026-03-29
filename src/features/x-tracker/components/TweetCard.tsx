'use client';

import { memo, useMemo } from 'react';
import Link from 'next/link';
import { Heart, Repeat2, MessageCircle, ExternalLink } from 'lucide-react';
import type { ResolvedTweet } from '../types';
import { useTokenResolver, type ResolvedToken } from '../hooks/useTokenResolver';
import { useXTrackerStore } from '../store/useXTrackerStore';
import QuickBuyButton from './QuickBuyButton';
import TokenPreviewPopup from './TokenPreviewPopup';

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function getTokenUrl(token: ResolvedToken): string {
  if (token.poolAddress) {
    return `/pair/${token.chainId}/${token.poolAddress}`;
  }
  return `/token/${token.chainId}/${token.address}`;
}

// Regex to split text while preserving $SYMBOL and 0x addresses
const SPLIT_RE = /(\$[A-Za-z][A-Za-z0-9]{0,9}\b|0x[a-fA-F0-9]{40})/g;

function TweetText({
  text,
  resolved,
}: {
  text: string;
  resolved: Map<string, ResolvedToken>;
}) {
  const parts = useMemo(() => {
    const segments: Array<{ type: 'text' | 'token'; value: string; key: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    SPLIT_RE.lastIndex = 0;
    while ((match = SPLIT_RE.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', value: text.slice(lastIndex, match.index), key: `t-${lastIndex}` });
      }

      const raw = match[0];
      const lookupKey = raw.startsWith('$') ? `$${raw.slice(1).toUpperCase()}` : raw.toLowerCase();
      segments.push({ type: 'token', value: raw, key: lookupKey });
      lastIndex = match.index + raw.length;
    }

    if (lastIndex < text.length) {
      segments.push({ type: 'text', value: text.slice(lastIndex), key: `t-${lastIndex}` });
    }

    return segments;
  }, [text]);

  return (
    <p className="text-sm text-textPrimary mt-1 whitespace-pre-wrap break-words">
      {parts.map((part) => {
        if (part.type === 'text') {
          return <span key={part.key}>{part.value}</span>;
        }

        const token = resolved.get(part.key);
        if (token) {
          return (
            <TokenPreviewPopup key={part.key} token={token}>
              <Link
                href={getTokenUrl(token)}
                className="text-success hover:underline font-medium"
                title={`${token.name} (${token.symbol})`}
              >
                {part.value}
              </Link>
            </TokenPreviewPopup>
          );
        }

        // Unresolved $SYMBOL
        if (part.value.startsWith('$')) {
          return (
            <span key={part.key} className="text-blue-400 font-medium">
              {part.value}
            </span>
          );
        }

        // Unresolved address — truncate display
        return (
          <span key={part.key} className="text-textTertiary font-mono text-xs">
            {part.value.slice(0, 6)}...{part.value.slice(-4)}
          </span>
        );
      })}
    </p>
  );
}

interface TweetCardProps {
  tweet: ResolvedTweet;
}

function QuickBuyRow({ resolved }: { resolved: Map<string, ResolvedToken> }) {
  const quickBuyEnabled = useXTrackerStore((s) => s.quickBuyEnabled);
  const quickBuyPresets = useXTrackerStore((s) => s.quickBuyPresets);

  if (!quickBuyEnabled || resolved.size === 0) return null;

  const tokens = Array.from(new Map(
    Array.from(resolved.values()).map((t) => [`${t.chainId}:${t.address}`, t]),
  ).values());

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      {tokens.map((token) => (
        <div
          key={`${token.chainId}:${token.address}`}
          className="flex items-center gap-1 rounded-md bg-bgContainer/60 px-1.5 py-0.5"
        >
          {token.logo && (
            <img src={token.logo} alt="" className="w-3.5 h-3.5 rounded-full" />
          )}
          <span className="text-[10px] font-semibold text-textSecondary">
            {token.symbol}
          </span>
          {quickBuyPresets.slice(0, 3).map((amt) => (
            <QuickBuyButton
              key={amt}
              token={token}
              amountSol={amt}
              compact
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function TweetCard({ tweet }: TweetCardProps) {
  const tweetUrl = `https://x.com/${tweet.username}/status/${tweet.tweetId}`;
  const resolved = useTokenResolver(tweet.text);

  return (
    <div className="px-4 py-3 border-b border-borderDefault hover:bg-bgTableHover transition-colors">
      <div className="flex gap-3">
        {/* Avatar */}
        {tweet.profileImageUrl ? (
          <img
            src={tweet.profileImageUrl}
            alt={tweet.username}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-bgContainer flex items-center justify-center text-textTertiary font-bold flex-shrink-0">
            {tweet.username.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-semibold text-textPrimary truncate">
              {tweet.name}
            </span>
            <span className="text-sm text-textTertiary truncate">@{tweet.username}</span>
            <span className="text-textTertiary">·</span>
            <span className="text-sm text-textTertiary flex-shrink-0">
              {formatRelativeTime(tweet.createdAt)}
            </span>
            <a
              href={tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-textTertiary hover:text-textPrimary transition-colors flex-shrink-0"
            >
              <ExternalLink size={14} />
            </a>
          </div>

          {/* Tweet text with token detection */}
          <TweetText text={tweet.text} resolved={resolved} />

          {/* Media */}
          {tweet.media && tweet.media.length > 0 && (
            <div className="mt-2 grid gap-1 grid-cols-1">
              {tweet.media.slice(0, 4).map((m, i) => (
                <img
                  key={i}
                  src={m.previewUrl || m.url}
                  alt=""
                  className="rounded-lg max-h-64 object-cover w-full"
                />
              ))}
            </div>
          )}

          {/* Engagement */}
          <div className="flex items-center gap-4 mt-2 text-textTertiary">
            <span className="flex items-center gap-1 text-xs">
              <MessageCircle size={14} />
              {tweet.replyCount > 0 && formatCount(tweet.replyCount)}
            </span>
            <span className="flex items-center gap-1 text-xs">
              <Repeat2 size={14} />
              {tweet.retweetCount > 0 && formatCount(tweet.retweetCount)}
            </span>
            <span className="flex items-center gap-1 text-xs">
              <Heart size={14} />
              {tweet.likeCount > 0 && formatCount(tweet.likeCount)}
            </span>
          </div>

          {/* Quick Buy buttons per detected token */}
          <QuickBuyRow resolved={resolved} />
        </div>
      </div>
    </div>
  );
}

export default memo(TweetCard);
