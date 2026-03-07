'use client';

import { useXTrackerStore } from '../store/useXTrackerStore';
import TweetCard from './TweetCard';
import { Twitter } from 'lucide-react';

export default function TweetFeed() {
  const tweets = useXTrackerStore((s) => s.tweets);
  const isConnected = useXTrackerStore((s) => s.isStreamConnected);
  const trackedCount = useXTrackerStore((s) => s.trackedUsers.length);

  if (trackedCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
        <Twitter size={40} className="text-textTertiary mb-3" />
        <p className="text-sm text-textTertiary">Track X accounts to see their tweets here</p>
      </div>
    );
  }

  if (tweets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
        <Twitter size={40} className="text-textTertiary mb-3" />
        <p className="text-sm text-textTertiary">
          {isConnected
            ? 'Waiting for tweets from tracked accounts...'
            : 'Connecting to stream...'}
        </p>
        {isConnected && (
          <p className="text-xs text-textTertiary mt-1">
            Tweets will appear here in real-time when tracked accounts post
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-borderDefault">
        <h2 className="text-sm font-semibold text-textPrimary">Live Feed</h2>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {tweets.map((tweet) => (
          <TweetCard key={tweet.tweetId} tweet={tweet} />
        ))}
      </div>
    </div>
  );
}
