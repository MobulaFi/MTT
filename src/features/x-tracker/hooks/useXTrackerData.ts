'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { useXTrackerStore } from '../store/useXTrackerStore';
import {
  trackUser as apiTrackUser,
  untrackUser as apiUntrackUser,
  getTrackedUsers,
  getUserProfile,
} from '../api/xTrackerApi';
import { toast } from 'sonner';

export function useXTrackerData() {
  const trackedUsers = useXTrackerStore((s) => s.trackedUsers);
  const loading = useXTrackerStore((s) => s.loading);
  const error = useXTrackerStore((s) => s.error);
  const addTrackedUser = useXTrackerStore((s) => s.addTrackedUser);
  const removeTrackedUser = useXTrackerStore((s) => s.removeTrackedUser);
  const updateUserProfile = useXTrackerStore((s) => s.updateUserProfile);
  const setLoading = useXTrackerStore((s) => s.setLoading);
  const setError = useXTrackerStore((s) => s.setError);

  const [isAdding, setIsAdding] = useState(false);
  const loadedRef = useRef(false);

  // Sync with API on mount — load tracked users and enrich profiles
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const load = async () => {
      setLoading(true);
      try {
        const usernames = await getTrackedUsers();

        // Add any users from API that aren't in local store
        for (const username of usernames) {
          const exists = trackedUsers.some(
            (u) => u.username.toLowerCase() === username.toLowerCase(),
          );
          if (!exists) {
            addTrackedUser(username, null);
          }
        }

        // Enrich users missing profile data, staggered to respect rate limits
        const currentUsers = useXTrackerStore.getState().trackedUsers;
        const needsProfile = currentUsers.filter((u) => !u.profile);
        for (let i = 0; i < needsProfile.length; i++) {
          const username = needsProfile[i].username;
          // Stagger requests by 1.5s to stay within 2 req/min rate limit
          setTimeout(() => {
            getUserProfile(username).then((profile) => {
              if (profile) updateUserProfile(username, profile);
            });
          }, i * 1500);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tracked users');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleTrackUser = useCallback(
    async (username: string) => {
      setIsAdding(true);
      try {
        await apiTrackUser(username);
        const profile = await getUserProfile(username);
        addTrackedUser(username, profile);
        toast.success(`Now tracking @${username}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Failed to track @${username}`);
      } finally {
        setIsAdding(false);
      }
    },
    [addTrackedUser],
  );

  const handleUntrackUser = useCallback(
    async (username: string) => {
      try {
        await apiUntrackUser(username);
        removeTrackedUser(username);
        toast.success(`Stopped tracking @${username}`);
      } catch (err) {
        toast.error(`Failed to untrack @${username}`);
      }
    },
    [removeTrackedUser],
  );

  return {
    trackedUsers,
    loading,
    error,
    isAdding,
    trackUser: handleTrackUser,
    untrackUser: handleUntrackUser,
  };
}
