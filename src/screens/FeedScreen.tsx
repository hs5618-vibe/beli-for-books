import React, { useCallback } from 'react';
import {
  FlatList,
  ListRenderItem,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import type { FeedItem } from '../types/feed';
import type { RootTabParamList } from '../types/navigation';
import { FeedItemCard } from '../components/FeedItemCard';

const MOCK_FEED_ITEMS: FeedItem[] = [
  {
    id: '1',
    createdAt: new Date().toISOString(),
    activityType: 'Rated',
    sentiment: 'Loved',
    numericScore: 9.2,
    notePreview: 'One of the most moving character studies I have read in years.',
    readingStatus: 'Read',
    user: {
      id: 'user-1',
      displayName: 'Sarah Lee',
    },
    book: {
      id: 'book-1',
      title: 'Tomorrow, and Tomorrow, and Tomorrow',
      author: 'Gabrielle Zevin',
    },
  },
  {
    id: '2',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    activityType: 'Rated',
    sentiment: 'Liked',
    numericScore: 7.5,
    readingStatus: 'Reading',
    notePreview: 'Cozy, atmospheric, and exactly what I wanted before bed.',
    user: {
      id: 'user-2',
      displayName: 'Maya Patel',
    },
    book: {
      id: 'book-2',
      title: 'The Thursday Murder Club',
      author: 'Richard Osman',
    },
  },
  {
    id: '3',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    activityType: 'StatusChanged',
    readingStatus: 'WantToRead',
    user: {
      id: 'user-3',
      displayName: 'Alex Kim',
    },
    book: {
      id: 'book-3',
      title: 'The Rabbit Hutch',
      author: 'Tess Gunty',
    },
  },
];

export function FeedScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();

  const renderItem: ListRenderItem<FeedItem> = useCallback(
    ({ item }) => (
      <FeedItemCard
        item={item}
        onPressBook={() => {
          navigation.navigate('BookDetail', {
            book: {
              id: item.book.id,
              title: item.book.title,
              author: item.book.author,
              coverUrl: item.book.coverUrl,
            },
          });
        }}
        onPressUser={() => {
          // Navigation to ProfileScreen will be wired up in a later phase.
        }}
      />
    ),
    [navigation],
  );

  const keyExtractor = useCallback((item: FeedItem) => item.id, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.appTitle}>Beli Books</Text>
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        data={MOCK_FEED_ITEMS}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});

