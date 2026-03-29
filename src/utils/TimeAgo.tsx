import type React from 'react';
import { useSyncExternalStore } from 'react';

export function getTimeAgo(timestamp: string | Date): string {
  const then = typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp.getTime();
  const now = Date.now();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return `${diffSeconds}s`;
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ---- Global tick manager ----
// Single setInterval shared across ALL TimeAgo instances instead of one per component.
// Subscribers are notified once per tick; useSyncExternalStore handles the re-render.
let tickVersion = 0;
const subscribers = new Set<() => void>();
let tickInterval: ReturnType<typeof setInterval> | null = null;

function startTicking() {
  if (tickInterval) return;
  tickInterval = setInterval(() => {
    tickVersion++;
    for (const cb of subscribers) cb();
  }, 1000);
}

function stopTicking() {
  if (subscribers.size > 0) return;
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

function subscribeTick(callback: () => void): () => void {
  subscribers.add(callback);
  startTicking();
  return () => {
    subscribers.delete(callback);
    stopTicking();
  };
}

function getTickSnapshot(): number {
  return tickVersion;
}

interface TimeAgoProps {
  timestamp: string | Date | null | undefined;
  textColor?: string;
}

const TimeAgo: React.FC<TimeAgoProps> = ({ timestamp, textColor = 'text-success' }) => {
  // Subscribe to global tick — single interval for all instances
  useSyncExternalStore(subscribeTick, getTickSnapshot, getTickSnapshot);

  if (!timestamp) {
    return <span className={`${textColor} text-xs flex-shrink-0`}>-</span>;
  }

  return <span className={`${textColor} text-xs flex-shrink-0`}>{getTimeAgo(timestamp)}</span>;
};

export default TimeAgo;
