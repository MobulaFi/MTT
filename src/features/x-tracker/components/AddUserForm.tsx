'use client';

import { useState, useCallback } from 'react';
import { Loader2, Search } from 'lucide-react';

interface AddUserFormProps {
  onAdd: (username: string) => Promise<void>;
  isAdding: boolean;
}

export default function AddUserForm({ onAdd, isAdding }: AddUserFormProps) {
  const [username, setUsername] = useState('');

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const cleaned = username.trim().replace(/^@/, '');
      if (!cleaned) return;
      await onAdd(cleaned);
      setUsername('');
    },
    [username, onAdd],
  );

  return (
    <form onSubmit={handleSubmit} className="relative px-3 py-2">
      <Search
        size={14}
        className="absolute left-5.5 top-1/2 -translate-y-1/2 text-textTertiary pointer-events-none"
      />
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Track @username"
        className="w-full bg-bgOverlay border border-borderDefault rounded-md pl-8 pr-8 py-1.5 text-sm text-textPrimary placeholder-textTertiary focus:outline-none focus:border-borderSecondary transition"
        disabled={isAdding}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit(e);
        }}
      />
      {isAdding && (
        <Loader2
          size={14}
          className="absolute right-5.5 top-1/2 -translate-y-1/2 text-textTertiary animate-spin"
        />
      )}
    </form>
  );
}
