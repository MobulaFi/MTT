'use client';

import { useXTrackerStore } from '../store/useXTrackerStore';

export default function XTrackerHeader() {
  const isConnected = useXTrackerStore((s) => s.isStreamConnected);
  const trackedCount = useXTrackerStore((s) => s.trackedUsers.length);
  const tweetCount = useXTrackerStore((s) => s.tweets.length);

  return (
    <div className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-textPrimary">Tracker</h1>
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-success animate-pulse' : 'bg-error'
            }`}
          />
          <span className="text-xs text-textTertiary">
            {isConnected ? 'Live' : trackedCount > 0 ? 'Connecting...' : 'No users tracked'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-textTertiary">
        <span>{trackedCount} tracked</span>
        <span>{tweetCount} tweets</span>
      </div>
    </div>
  );
}
