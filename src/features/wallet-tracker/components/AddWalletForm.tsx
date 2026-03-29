'use client';

import { forwardRef } from 'react';
import { Search } from 'lucide-react';

interface AddWalletFormProps {
  value: string;
  onChange: (value: string) => void;
}

const AddWalletForm = forwardRef<HTMLInputElement, AddWalletFormProps>(
  function AddWalletForm({ value, onChange }, ref) {
    return (
      <div className="relative px-4 py-3">
        <Search
          size={17}
          className="absolute left-7 top-1/2 -translate-y-1/2 text-textTertiary pointer-events-none"
        />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search tracked wallets..."
          className="w-full bg-bgOverlay border border-borderDefault rounded-md pl-10 pr-4 py-2.5 text-base text-textPrimary placeholder-textTertiary focus:outline-none focus:border-borderSecondary transition"
        />
      </div>
    );
  },
);

export default AddWalletForm;
