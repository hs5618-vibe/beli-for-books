export type Sentiment = 'Loved' | 'Liked' | 'Okay';

export type ReadingStatus = 'WantToRead' | 'Reading' | 'Read';

export type FeedActivityType = 'Rated' | 'StatusChanged' | 'Added';

export type FeedItemUser = {
  id: string;
  displayName: string;
  avatarUrl?: string;
};

export type FeedItemBook = {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
};

export type FeedItem = {
  id: string;
  user: FeedItemUser;
  book: FeedItemBook;
  activityType: FeedActivityType;
  sentiment?: Sentiment;
  numericScore?: number; // 0-10 with one decimal point (e.g., 9.2)
  notePreview?: string;
  readingStatus?: ReadingStatus;
  createdAt: string;
};

