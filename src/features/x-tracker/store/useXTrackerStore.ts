'use client';

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { TrackedUser, ResolvedTweet, XUserProfile } from '../types';

const TWEET_LIMIT = 200;

export interface XTrackerStoreState {
  trackedUsers: TrackedUser[];
  tweets: ResolvedTweet[];
  loading: boolean;
  error: string | null;
  isStreamConnected: boolean;

  // Floating panel
  isFloating: boolean;
  isMinimized: boolean;
  windowPosition: { x: number; y: number };
  isDragging: boolean;

  addTrackedUser: (username: string, profile: XUserProfile | null) => void;
  removeTrackedUser: (username: string) => void;
  setTrackedUsers: (users: TrackedUser[]) => void;
  updateUserProfile: (username: string, profile: XUserProfile) => void;

  addTweet: (tweet: ResolvedTweet) => void;
  clearTweets: () => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setStreamConnected: (connected: boolean) => void;

  setFloating: (floating: boolean) => void;
  setMinimized: (minimized: boolean) => void;
  setWindowPosition: (position: { x: number; y: number }) => void;
  setIsDragging: (isDragging: boolean) => void;
}

export const useXTrackerStore = create<XTrackerStoreState>()(
  devtools(
    persist(
      immer((set) => ({
        trackedUsers: [],
        tweets: [],
        loading: false,
        error: null,
        isStreamConnected: false,

        isFloating: false,
        isMinimized: false,
        windowPosition: { x: 50, y: 50 },
        isDragging: false,

        addTrackedUser: (username, profile) =>
          set((state) => {
            const exists = state.trackedUsers.some(
              (u) => u.username.toLowerCase() === username.toLowerCase(),
            );
            if (!exists) {
              state.trackedUsers.push({ username, profile, addedAt: Date.now() });
            }
          }),

        removeTrackedUser: (username) =>
          set((state) => {
            state.trackedUsers = state.trackedUsers.filter(
              (u) => u.username.toLowerCase() !== username.toLowerCase(),
            );
          }),

        setTrackedUsers: (users) =>
          set((state) => {
            state.trackedUsers = users;
          }),

        updateUserProfile: (username, profile) =>
          set((state) => {
            const user = state.trackedUsers.find(
              (u) => u.username.toLowerCase() === username.toLowerCase(),
            );
            if (user) user.profile = profile;
          }),

        addTweet: (tweet) =>
          set((state) => {
            state.tweets.unshift(tweet);
            if (state.tweets.length > TWEET_LIMIT) {
              state.tweets = state.tweets.slice(0, TWEET_LIMIT);
            }
          }),

        clearTweets: () =>
          set((state) => {
            state.tweets = [];
          }),

        setLoading: (loading) =>
          set((state) => {
            state.loading = loading;
          }),

        setError: (error) =>
          set((state) => {
            state.error = error;
            state.loading = false;
          }),

        setStreamConnected: (connected) =>
          set((state) => {
            state.isStreamConnected = connected;
          }),

        setFloating: (floating) =>
          set((state) => {
            state.isFloating = floating;
          }),

        setMinimized: (minimized) =>
          set((state) => {
            state.isMinimized = minimized;
          }),

        setWindowPosition: (position) =>
          set((state) => {
            state.windowPosition = position;
          }),

        setIsDragging: (isDragging) =>
          set((state) => {
            state.isDragging = isDragging;
          }),
      })),
      {
        name: 'x-tracker-storage',
        partialize: (state) => ({
          trackedUsers: state.trackedUsers,
          isFloating: state.isFloating,
          windowPosition: state.windowPosition,
        }),
      },
    ),
    { name: 'XTrackerStore' },
  ),
);
