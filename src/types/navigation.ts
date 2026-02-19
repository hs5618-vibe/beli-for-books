import type { BookSummary } from './book';

export type RootTabParamList = {
  Feed: undefined;
  Search: undefined;
  Profile: undefined;
  BookDetail: {
    book: BookSummary;
  };
};

export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
  MainTabs: undefined;
};
