'use client';

import { MenuIcon } from '@/assets/icons/MenuIcon';
import DisplayModal from './DisplayModal';
import { ChevronDown, Zap, Radio } from 'lucide-react';
import { useState } from 'react';
import { useApiStore, type StreamMode } from '@/store/apiStore';

export default function PulseHeader() {
  const [isDisplayOpen, setDisplayOpen] = useState(false);
  const streamMode = useApiStore((state) => state.streamMode);
  const setStreamMode = useApiStore((state) => state.setStreamMode);

  const handleModeChange = (newMode: StreamMode) => {
    setStreamMode(newMode);
    // Clear data store when switching modes to avoid stale data
    window.location.reload();
  };

  return (
    <>
      {/* Desktop Header */}
      <div className="hidden text-textPrimary md:flex justify-between items-center px-4 ">
        <div className="flex items-center gap-4">
          <h1 className="text-xl text-textPrimary font-bold">Pulse</h1>
          
          {/* Stream Mode Toggle */}
          <div className="flex items-center bg-bgContainer rounded-lg border border-borderDefault overflow-hidden">
            <button
              type="button"
              onClick={() => handleModeChange('pulse-v2')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                streamMode === 'pulse-v2'
                  ? 'bg-primary text-white'
                  : 'text-textSecondary hover:text-textPrimary hover:bg-bgContainer/50'
              }`}
            >
              <Radio className="h-3 w-3" />
              V2
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('token-filters')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                streamMode === 'token-filters'
                  ? 'bg-primary text-white'
                  : 'text-textSecondary hover:text-textPrimary hover:bg-bgContainer/50'
              }`}
            >
              <Zap className="h-3 w-3" />
              V3
            </button>
          </div>
        </div>

        <div className="flex items-center rounded-3xl gap-2">
          <div className="relative">
            <button
              type="button"
              className="flex items-center bg-bgContainer rounded-3xl px-4 space-x-2 h-8 py-1.5 hover:bg-bgContainer/50 border-[1px] border-borderDefault cursor-pointer transition"
              onClick={() => setDisplayOpen((open) => !open)}
            >
              <MenuIcon />
              <span className="mr-2 text-sm text-textPrimary font-bold">Display</span>
              <ChevronDown className="h-4 w-4 text-textPrimary" />
            </button>
            <DisplayModal isOpen={isDisplayOpen} onClose={() => setDisplayOpen(false)} />
          </div>
        </div>
      </div>
    </>
  );
}
