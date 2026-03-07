export interface XUserProfile {
  username: string;
  name: string;
  profileImageUrl: string | null;
  description: string;
  followersCount: number;
  followingCount: number;
  tweetCount: number;
  verified: boolean;
}

export interface TrackedUser {
  username: string;
  profile: XUserProfile | null;
  addedAt: number;
}

export interface ResolvedTweet {
  tweetId: string;
  text: string;
  username: string;
  name: string;
  profileImageUrl: string | null;
  createdAt: string;
  media?: TweetMedia[];
  urls?: string[];
  replyTo?: string | null;
  retweetOf?: string | null;
  quoteOf?: string | null;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  bookmarkCount: number;
}

export interface TweetMedia {
  type: 'photo' | 'video' | 'animated_gif';
  url: string;
  previewUrl?: string;
}
