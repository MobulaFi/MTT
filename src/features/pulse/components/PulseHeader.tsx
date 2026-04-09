'use client';

import { MenuIcon } from '@/assets/icons/MenuIcon';
import DisplayModal from './DisplayModal';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export default function PulseHeader() {
  const [isDisplayOpen, setDisplayOpen] = useState(false);

  return (
    <>
      {/* Desktop Header */}
      <div className="hidden text-textPrimary md:flex justify-between items-center px-4 ">
        <div className="flex items-center gap-4">
          <h1 className="text-xl text-textPrimary font-bold">Pulse</h1>
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