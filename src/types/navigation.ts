import type { BookSummary } from './book';

export type RootTabParamList = {
  Feed: undefined;
  Search: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
  MainTabs: undefined;
  BookDetail: {
    book: BookSummary;
  };
  UserProfile: {
    appUserId: string;
  };
  Connections: {
    appUserId: string;
    kind: 'followers' | 'following';
    title: string;
  };
};
