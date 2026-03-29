'use client';

import { useState } from 'react';
import { useXTrackerStore } from '@/features/x-tracker/store/useXTrackerStore';
import { useXTrackerData } from '@/features/x-tracker/hooks/useXTrackerData';
import { useXTrackerStream } from '@/features/x-tracker/hooks/useXTrackerStream';
import TrackedUsersList from '@/features/x-tracker/components/TrackedUsersList';
import TweetFeed from '@/features/x-tracker/components/TweetFeed';
import { Settings } from 'lucide-react';
import XTrackerSettings from '@/features/x-tracker/components/XTrackerSettings';

type Tab = 'feed' | 'alerts' | 'socials';

export function XTrackerInlinePanel() {
  const { isStreamConnected } = useXTrackerStore();
  const { trackedUsers, loading, isAdding, trackUser, untrackUser } = useXTrackerData();
  useXTrackerStream();

  const [tab, setTab] = useState<Tab>('feed');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'feed', label: 'Customize Feed' },
    { id: 'alerts', label: 'Twitter Alerts' },
    { id: 'socials', label: 'Socials' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-11 border-b border-borderDefault flex-shrink-0">
        <div className="flex items-center gap-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-xs font-medium py-0.5 transition-colors ${
                tab === t.id
                  ? 'text-white border-b border-white'
                  : 'text-textTertiary hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              isStreamConnected ? 'bg-success animate-pulse' : 'bg-error'
            }`}
          />
          <XTrackerSettings />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {tab === 'feed' ? (
          <div className="flex flex-col h-full">
            <div className="border-b border-borderDefault/40 max-h-[250px] overflow-y-auto">
              <TrackedUsersList
                users={trackedUsers}
                loading={loading}
                isAdding={isAdding}
                onTrack={trackUser}
                onUntrack={untrackUser}
              />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <TweetFeed />
            </div>
          </div>
        ) : tab === 'alerts' ? (
          <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-bgTertiary flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-textTertiary">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <p className="text-sm text-textTertiary">Start tracking accounts to see Twitter alerts!</p>
            <button
              onClick={() => setTab('feed')}
              className="mt-3 text-xs font-medium px-4 py-1.5 rounded border border-borderDefault bg-bgTertiary hover:bg-bgOverlay text-textPrimary transition-colors"
            >
              Add Twitter Handles
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
            <p className="text-sm text-textTertiary">Social tracking coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
