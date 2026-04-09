'use client';

import { useEffect, useRef } from 'react';
import { useXTrackerStore } from '../store/useXTrackerStore';
import type { ResolvedTweet } from '../types';

/**
 * Parses a raw tweet object from the Scrape.st WebSocket into our ResolvedTweet shape.
 * The raw format may vary — this normalizes it.
 */
function parseTweet(raw: Record<string, unknown>): ResolvedTweet | null {
  try {
    const r = raw as Record<string, any>;

    // Scrape.st payload: { author: { username, name, profile_image_url, ... }, id, text, created_at, media, link }
    const author = r.author || r.user || {};
    const imgUrl =
      author.profile_image_url_https ||
      author.profile_image_url ||
      r.profileImageUrl ||
      null;

    return {
      tweetId: String(r.id || r.tweetId || r.rest_id || r.id_str || ''),
      text: r.text || r.full_text || '',
      username: author.username || author.screen_name || r.username || '',
      name: author.name || r.name || '',
      profileImageUrl: imgUrl?.replace('_normal', '_200x200') || null,
      createdAt: r.created_at || r.createdAt || new Date().toISOString(),
      media: r.media || [],
      urls: r.urls || [],
      replyTo: r.in_reply_to_status_id_str || r.replyTo || null,
      retweetOf: r.retweetOf || null,
      quoteOf: r.quoteOf || null,
      likeCount: r.likeCount ?? r.favorite_count ?? 0,
      retweetCount: r.retweetCount ?? r.retweet_count ?? 0,
      replyCount: r.replyCount ?? r.reply_count ?? 0,
      quoteCount: r.quoteCount ?? r.quote_count ?? 0,
      bookmarkCount: r.bookmarkCount ?? r.bookmark_count ?? 0,
    };
  } catch {
    return null;
  }
}

export function useXTrackerStream() {
  const controllerRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackedCount = useXTrackerStore((s) => s.trackedUsers.length);
  const addTweet = useXTrackerStore((s) => s.addTweet);
  const setStreamConnected = useXTrackerStore((s) => s.setStreamConnected);

  useEffect(() => {
    if (trackedCount === 0) {
      // No users to track — disconnect if connected
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
      setStreamConnected(false);
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;

    const connect = async () => {
      try {
        const response = await fetch('/api/x-tracker/stream', {
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          setStreamConnected(false);
          // Retry after 5s
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            if (!part.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(part.slice(6));

              if (data.event === 'connected') {
                setStreamConnected(true);
              } else if (data.event === 'disconnected') {
                setStreamConnected(false);
                // Server WS disconnected — reconnect
                reconnectTimeoutRef.current = setTimeout(connect, 3000);
                return;
              } else {
                // Tweet data
                const tweet = parseTweet(data);
                if (tweet && tweet.tweetId && tweet.text) {
                  addTweet(tweet);
                }
              }
            } catch {
              // skip malformed messages
            }
          }
        }

        // Stream ended normally — reconnect
        setStreamConnected(false);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        console.error('[useXTrackerStream] error:', error);
        setStreamConnected(false);
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      controller.abort();
      controllerRef.current = null;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      setStreamConnected(false);
    };
  }, [trackedCount, addTweet, setStreamConnected]);

  return {
    isConnected: useXTrackerStore((s) => s.isStreamConnected),
  };
}
