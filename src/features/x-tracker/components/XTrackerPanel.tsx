'use client';

import { createPortal } from 'react-dom';
import { Grip, X, Minus } from 'lucide-react';
import { useXTrackerStore } from '../store/useXTrackerStore';
import { useXTrackerData } from '../hooks/useXTrackerData';
import { useXTrackerStream } from '../hooks/useXTrackerStream';
import { useDragAndDrop } from '@/hooks/trading/useDragAndDrop';
import TrackedUsersList from './TrackedUsersList';
import TweetFeed from './TweetFeed';
import XTrackerSettings from './XTrackerSettings';

interface XTrackerPanelProps {
  /** When true, renders inline (for the /x-tracker page). When false, only renders when isFloating. */
  inline?: boolean;
}

export function XTrackerPanel({ inline = false }: XTrackerPanelProps) {
  const {
    isFloating,
    isMinimized,
    windowPosition,
    isDragging: isDraggingStore,
    isStreamConnected,
    setFloating,
    setMinimized,
    setWindowPosition,
    setIsDragging,
  } = useXTrackerStore();

  const { trackedUsers, loading, isAdding, trackUser, untrackUser } = useXTrackerData();
  useXTrackerStream();

  const { windowRef, isDragging, handleMouseDown } = useDragAndDrop({
    position: windowPosition,
    isFloating,
    onPositionChange: setWindowPosition,
    onDragStart: () => setIsDragging(true),
    onDragEnd: () => setIsDragging(false),
  });

  const content = (
    <>
      {/* Header */}
      <div
        onMouseDown={handleMouseDown}
        className={`flex items-center justify-between px-3 py-2 border-b border-borderDefault ${
          isFloating && isDragging ? 'cursor-grabbing' : isFloating ? 'cursor-grab' : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-textPrimary">Tracker</span>
          <div
            className={`w-2 h-2 rounded-full ${
              isStreamConnected ? 'bg-success animate-pulse' : 'bg-error'
            }`}
          />
          <XTrackerSettings />
        </div>
        {isFloating && (
          <div className="flex items-center">
            <button
              onClick={() => setMinimized(!isMinimized)}
              className="p-1.5 hover:bg-bgTertiary rounded transition text-grayGhost hover:text-textPrimary"
              aria-label={isMinimized ? 'Expand' : 'Minimize'}
            >
              {isMinimized ? <Grip size={14} /> : <Minus size={14} />}
            </button>
            <button
              onClick={() => setFloating(false)}
              className="p-1.5 hover:bg-bgTertiary rounded transition text-grayGhost hover:text-textPrimary"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      {!isMinimized && (
        <div className={isFloating ? 'flex flex-col h-[calc(70vh-40px)]' : 'flex-1 min-h-0'}>
          {isFloating ? (
            // Floating: single column stacked layout
            <div className="flex flex-col h-full">
              <div className="border-b border-borderDefault max-h-[200px] overflow-y-auto">
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
          ) : (
            // Inline: two-panel grid (for /x-tracker page)
            <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] min-h-[calc(100vh-250px)]">
              <div className="border border-borderDefault md:rounded-l-lg overflow-hidden">
                <TrackedUsersList
                  users={trackedUsers}
                  loading={loading}
                  isAdding={isAdding}
                  onTrack={trackUser}
                  onUntrack={untrackUser}
                />
              </div>
              <div className="border border-borderDefault md:border-l-0 md:rounded-r-lg overflow-hidden">
                <TweetFeed />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );

  // Inline mode: always render, never portal
  if (inline) {
    return (
      <div className="bg-bgPrimary min-h-[calc(100vh-200px)]">
        <div className="px-4 pb-4">
          {content}
        </div>
      </div>
    );
  }

  // Floating mode: only render when isFloating
  if (!isFloating || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={windowRef}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        transform: `translate(${windowPosition.x}px, ${windowPosition.y}px)`,
        transition: isDragging ? 'none' : 'transform 0.2s ease-out',
      }}
      className="w-[400px] max-h-[70vh] z-[100] overflow-hidden rounded-md border border-borderDefault bg-bgPrimary shadow-lg flex flex-col"
    >
      {content}
    </div>,
    document.body,
  );
}
