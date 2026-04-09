'use client';

import { useState, useMemo, ReactNode } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { ChevronRight, ChevronLeft, Filter, User, Settings } from 'lucide-react';
import clsx from 'clsx';
import { useTradesPanelStore } from '@/store/useTradesPanelStore';

interface ResizablePanelsLayoutProps {
  chart: ReactNode;
  tradesSidebar?: ReactNode;
  tabs: {
    value: string;
    label: string;
    content: ReactNode;
    actions?: ReactNode;
  }[];
  defaultTab?: string;
  error?: string | null;
}

export default function ResizablePanelsLayout({
  chart,
  tradesSidebar,
  tabs,
  defaultTab = tabs[0]?.value,
  error,
}: ResizablePanelsLayoutProps) {
  const { showTrades, setShowTrades } = useTradesPanelStore();
  const [selectedTab, setSelectedTab] = useState(defaultTab);
  const scrollable =
    'scrollbar-thin scrollbar-thumb-[#22242D] scrollbar-track-transparent hover:scrollbar-thumb-[#343439]';

  if (error) {
    return (
      <main className="md:mt-15 text-textPrimary">
        <div className="flex w-full lg:h-auto h-full min-h-screenHeader items-center justify-center">
          <div className="text-error text-center">
            <p className="text-lg font-semibold mb-2">Error loading data</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <PanelGroup direction="vertical" autoSaveId="resizable-panels" className="h-full w-full">
      <Panel defaultSize={60} minSize={30} maxSize={70} className="relative">
        <div className="flex h-full w-full">
          <div
            className={clsx(
              'relative flex-1 bg-bgOverlayAlt border-b-2 border-bgContainer overflow-hidden',
              !showTrades && 'w-full',
            )}
          >
            {chart}

            {!showTrades && tradesSidebar && (
              <button
                onClick={() => setShowTrades(true)}
                className="
                  absolute right-0 top-1/2 -translate-y-1/2 z-20
                  w-4 h-10 bg-bgTertiary hover:bg-borderDefault
                  border-l border-t border-b border-borderTertiary rounded-l-lg
                  flex items-center justify-center text-gray-400 hover:text-white
                  transition-all shadow-lg
                "
              >
                <ChevronLeft size={16} color="#C8C9D1" />
              </button>
            )}
          </div>

          {showTrades && tradesSidebar && (
            <div className="w-[20%] bg-bgPrimary border-b-2 border-l border-borderDefault flex flex-col">
              <div className="h-10 flex items-center justify-between px-3 border-b border-bgContainer flex-shrink-0">
                <span className="text-xs font-medium text-grayGhost">TRADES</span>
                <button
                  onClick={() => setShowTrades(false)}
                  className="text-grayGhost bg-bgTertiary rounded-full p-1 hover:text-textPrimary hover:bg-opacity-40 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">{tradesSidebar}</div>
            </div>
          )}
        </div>
      </Panel>

      {/* Resize handle */}
      <PanelResizeHandle className="relative h-[6px] group cursor-row-resize flex items-center justify-center bg-bgContainer hover:bg-borderDefault transition-all duration-200 active:bg-primary/30 z-20">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-1 w-10 bg-grayGhost rounded-full group-hover:bg-primary group-hover:w-20 group-hover:h-1.5 group-active:bg-success group-active:h-2 transition-all duration-200" />
        </div>
      </PanelResizeHandle>

      <Panel defaultSize={40} minSize={30} maxSize={70} className="relative flex flex-col">
        <div className="h-full min-h-10 w-full flex flex-col bg-bgPrimary border-t-2 border-bgContainer overflow-hidden shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
        <div className="border-b min-h-10 border-borderDefault flex-shrink-0 flex items-center justify-between px-0">
            {/* Left side - Tabs */}
            <div className="flex items-center gap-0">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setSelectedTab(tab.value)}
                  className={clsx(
                    'relative px-4 py-2 text-xs font-medium  text-grayGhost hover:text-textPrimary transition-colors border-b-2',
                    selectedTab === tab.value
                      ? 'text-white border-white'
                      : 'text-textTertiary border-transparent hover:text-white hover:border-[#374151]',
                  )}
                >
                  {tab.label}
                  {selectedTab === tab.value && (
                 <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-textPrimary transition-all duration-300 ease-in-out" />
               )}
                </button>
              ))}
            </div>

            {/* Right side - Tab-specific actions */}
            <div className="flex items-center space-x-3 pr-3">
              {tabs.find((tab) => tab.value === selectedTab)?.actions}
            </div>
          </div>

          <div className="flex-1 relative overflow-hidden bg-bgOverlay">
            {tabs.map((tab) => (
              <div
                key={tab.value}
                className={clsx(
                  'absolute inset-0 h-full overflow-y-auto p-0',
                  scrollable,
                  selectedTab === tab.value ? 'block' : 'hidden'
                )}
              >
                {tab.content}
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </PanelGroup>
  );
}