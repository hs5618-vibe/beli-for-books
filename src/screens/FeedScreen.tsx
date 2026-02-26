import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
import { FeedItemCard } from '../components/FeedItemCard';
import { getFeedItems } from '../services/feed';
import type { FeedItem } from '../types/feed';
import type { RootStackParamList, RootTabParamList } from '../types/navigation';

type FeedScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function FeedScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<FeedScreenNavigationProp>();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(
    async (refresh = false) => {
      if (!user?.id) {
        setItems([]);
        setIsLoading(false);
        return;
      }

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const nextItems = await getFeedItems(user.id);
        setItems(nextItems);
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load feed');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    loadFeed().catch(() => {
      // Error state handled by loadFeed.
    });
  }, [loadFeed]);

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
          // Multi-profile navigation is next phase.
        }}
      />
    ),
    [navigation],
  );

  const keyExtractor = useCallback((item: FeedItem) => item.id, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator
            size="large"
            color="#111827"
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.appTitle}>Beli Books</Text>
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              loadFeed(true).catch(() => {
                // Error state handled by loadFeed.
              });
            }}
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Text style={styles.emptyText}>
              Follow at least 5 users in onboarding to start seeing activity here.
            </Text>
          </View>
        }
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
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    marginTop: 12,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  emptyText: {
    color: '#6B7280',
    textAlign: 'center',
  },
  errorText: {
    color: '#B91C1C',
    textAlign: 'center',
    marginBottom: 6,
  },
});
