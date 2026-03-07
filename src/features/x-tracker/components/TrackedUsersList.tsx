'use client';

import type { TrackedUser } from '../types';
import AddUserForm from './AddUserForm';
import TrackedUserCard from './TrackedUserCard';

interface TrackedUsersListProps {
  users: TrackedUser[];
  loading: boolean;
  isAdding: boolean;
  onTrack: (username: string) => Promise<void>;
  onUntrack: (username: string) => Promise<void>;
}

export default function TrackedUsersList({
  users,
  loading,
  isAdding,
  onTrack,
  onUntrack,
}: TrackedUsersListProps) {
  return (
    <div className="flex flex-col h-full">
      <AddUserForm onAdd={onTrack} isAdding={isAdding} />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-borderDefault border-t-textPrimary rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <p className="text-xs text-textTertiary">
              Track X accounts to see their tweets in real-time
            </p>
          </div>
        ) : (
          users.map((user) => (
            <TrackedUserCard key={user.username} user={user} onRemove={onUntrack} />
          ))
        )}
      </div>
    </div>
  );
}
