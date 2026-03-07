'use client';

import { memo, useCallback } from 'react';
import { X } from 'lucide-react';
import type { TrackedUser } from '../types';

interface TrackedUserCardProps {
  user: TrackedUser;
  onRemove: (username: string) => Promise<void>;
}

function TrackedUserCard({ user, onRemove }: TrackedUserCardProps) {
  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove(user.username);
    },
    [user.username, onRemove],
  );

  return (
    <div className="flex items-center justify-between px-3 py-2 hover:bg-bgTableHover transition-colors group">
      <div className="flex items-center gap-2.5 min-w-0">
        {user.profile?.profileImageUrl ? (
          <img
            src={user.profile.profileImageUrl}
            alt={user.username}
            className="rounded-full w-8 h-8 object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-bgContainer flex items-center justify-center text-textTertiary text-sm font-bold flex-shrink-0">
            {user.username.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-sm text-textPrimary font-medium truncate">
            {user.profile?.name || user.username}
          </span>
          <span className="text-xs text-textTertiary truncate">@{user.username}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={handleRemove}
        className="text-textTertiary hover:text-error transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
        aria-label={`Untrack @${user.username}`}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default memo(TrackedUserCard);
