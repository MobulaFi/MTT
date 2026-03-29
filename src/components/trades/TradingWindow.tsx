'use client';

import { createPortal } from 'react-dom';
import { ChevronDown, Settings, Minus, X, Maximize2, Minimize2, Grip, ChevronUp } from 'lucide-react';
import { useTradingPanelStore } from '@/store/useTradingPanelStore';
import { SettingsModal } from './SettingsModal';
import { ProTab } from './ProTab';
import { useDragAndDrop } from '@/hooks/trading/useDragAndDrop';
import type { TradingWindowProps } from '@/types/trading';

export function TradingWindow({ className }: TradingWindowProps) {
  // Individual selectors — only re-render when these specific values change
  const isMinimized = useTradingPanelStore((s) => s.isMinimized);
  const isCollapsed = useTradingPanelStore((s) => s.isCollapsed);
  const isFloating = useTradingPanelStore((s) => s.isFloating);
  const windowPosition = useTradingPanelStore((s) => s.windowPosition);

  // Actions via getState() — stable references, no re-renders
  const actions = useTradingPanelStore.getState;

  const { windowRef, isDragging, handleMouseDown } = useDragAndDrop({
    position: windowPosition,
    isFloating,
    onPositionChange: (pos) => actions().setWindowPosition(pos),
    onDragStart: () => actions().setIsDragging(true),
    onDragEnd: () => actions().setIsDragging(false),
  });

  const windowContent = (
    <>
      <div
        onMouseDown={handleMouseDown}
        className={`flex items-center justify-between pl-4 py-2 border-y border-borderDefault ${
          isFloating && isDragging ? 'cursor-grabbing' : isFloating ? 'cursor-grab' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="font-normal text-sm text-textPrimary">Trade</span>
        </div>
        <div>
          <button
            onClick={() => actions().setSettingsOpen(true)}
            className="p-1.5 hover:bg-bgTertiary rounded transition text-grayGhost hover:text-textPrimary"
            aria-label="Settings"
          >
            <Settings size={16} />
          </button>

          {!isFloating && (
            <button
              onClick={() => actions().setFloating(true)}
              className="p-1.5 hover:bg-bgTertiary rounded transition text-grayGhost hover:text-textPrimary"
              aria-label="Float window"
            >
              <Minimize2 size={16} />
            </button>
          )}

          {isFloating && (
            <button
              onClick={() => actions().setMinimized(!isMinimized)}
              className="p-1.5 hover:bg-bgTertiary rounded transition text-grayGhost hover:text-textPrimary"
              aria-label={isMinimized ? 'Expand' : 'Minimize'}
            >
              <Grip size={16} />
            </button>
          )}

          <button
            onClick={() => actions().setCollapsed(!isCollapsed)}
            className="p-1.5 hover:bg-bgTertiary rounded transition text-grayGhost hover:text-textPrimary"
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronUp
              size={16}
              className={`transition-transform ${
                isCollapsed ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isFloating && (
            <button
              onClick={() => actions().setFloating(false)}
              className="p-1.5 hover:bg-bgTertiary rounded transition text-grayGhost hover:text-textPrimary"
              aria-label="Close floating window"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {!isMinimized && !isCollapsed && (
        <div className="max-h-[calc(100vh-120px)] overflow-y-auto bg-bgPrimary">
          <ProTab />
        </div>
      )}
    </>
  );

  if (!isFloating) {
    return (
      <>
        <div className={`w-full overflow-hidden ${className || ''}`}>
          {windowContent}
        </div>
        <SettingsModal />
      </>
    );
  }

  if (typeof document !== 'undefined') {
    const floatingWindow = (
      <div
        ref={windowRef}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          transform: `translate(${windowPosition.x}px, ${windowPosition.y}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
        }}
        className="w-96 z-[100] overflow-hidden rounded-md border border-borderDefault bg-bgPrimary shadow-lg"
      >
        {windowContent}
      </div>
    );

    return (
      <>
        {createPortal(floatingWindow, document.body)}
        <SettingsModal />
      </>
    );
  }

  return (
    <>
      <SettingsModal />
    </>
  );
}
