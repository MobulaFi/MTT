import type { XUserProfile } from '../types';

const BASE = '/api/x-tracker';

export async function trackUser(username: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE}/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Failed to track user');
  }
  return data;
}

export async function untrackUser(username: string): Promise<void> {
  const res = await fetch(`${BASE}/track`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to untrack user');
  }
}

export async function getTrackedUsers(): Promise<string[]> {
  const res = await fetch(`${BASE}/tracked-users`, { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch tracked users');
  }
  const users = data.tracked_users || [];
  // API returns objects {name, username, id} — extract usernames
  return users.map((u: string | { username: string }) =>
    typeof u === 'string' ? u : u.username,
  );
}

export async function getUserProfile(username: string): Promise<XUserProfile | null> {
  try {
    const res = await fetch(`${BASE}/user?username=${encodeURIComponent(username)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw = await res.json();

    // Scrape.st returns a flat object with Twitter user fields
    const d = raw?.legacy || raw?.data?.user?.result?.legacy || raw || {};
    const imageUrl =
      d.profile_image_url_https || d.profile_image_url || null;

    return {
      username: d.screen_name || username,
      name: d.name || username,
      profileImageUrl: imageUrl?.replace('_normal', '_200x200') || null,
      description: d.description || '',
      followersCount: d.followers_count || 0,
      followingCount: d.friends_count || 0,
      tweetCount: d.statuses_count || 0,
      verified: d.is_blue_verified || d.verified || false,
    };
  } catch {
    return null;
  }
}
