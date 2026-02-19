import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  ListRenderItem,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { searchBooks } from '../services/books';
import type { BookSummary } from '../types/book';
import type { RootTabParamList } from '../types/navigation';

export function SearchScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const canSearch = useMemo(() => query.trim().length > 0, [query]);

  const handleSearch = useCallback(async () => {
    if (!canSearch) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const nextResults = await searchBooks(query);
    setResults(nextResults);
    setIsSearching(false);
  }, [canSearch, query]);

  const renderItem: ListRenderItem<BookSummary> = useCallback(
    ({ item }) => (
      <Pressable
        onPress={() => navigation.navigate('BookDetail', { book: item })}
        style={styles.resultCard}
      >
        <Text style={styles.resultTitle}>{item.title}</Text>
        <Text style={styles.resultAuthor}>{item.author}</Text>
      </Pressable>
    ),
    [navigation],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          placeholder="Search by title or author"
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />
        <Pressable
          onPress={handleSearch}
          style={[styles.searchButton, !canSearch && styles.searchButtonDisabled]}
        >
          <Text style={styles.searchButtonLabel}>{isSearching ? 'Searching...' : 'Search'}</Text>
        </Pressable>
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.emptyState}>
            {canSearch ? 'No books found yet.' : 'Search for a book to rate.'}
          </Text>
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
    paddingVertical: 12,
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  searchButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  resultAuthor: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B7280',
  },
  emptyState: {
    marginTop: 8,
    textAlign: 'center',
    color: '#6B7280',
  },
});
