import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Avatar } from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { getOnboardingProgress, type OnboardingProgress } from '../services/onboarding';
import { upsertRating } from '../services/ratings';
import { getSuggestedUsers, followUser, type SuggestedUser } from '../services/social';
import { searchBooks } from '../services/books';
import type { BookSummary } from '../types/book';
import type { Sentiment } from '../types/feed';

type OnboardingScreenProps = {
  progress: OnboardingProgress | null;
  errorMessage?: string | null;
  onRefreshProgress: () => Promise<void>;
  onSignOut: () => void;
};

const SENTIMENTS: Sentiment[] = ['Loved', 'Liked', 'Okay'];

export function OnboardingScreen({ progress, errorMessage, onRefreshProgress, onSignOut }: OnboardingScreenProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<BookSummary[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isRatingBookId, setIsRatingBookId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [followLoadingUserId, setFollowLoadingUserId] = useState<string | null>(null);

  const ratingsDone = progress?.ratingsCount ?? 0;
  const followsDone = progress?.followingCount ?? 0;
  const ratingsTarget = progress?.ratingsTarget ?? 5;
  const followsTarget = progress?.followsTarget ?? 5;
  const isComplete = progress?.isComplete ?? false;

  const progressLabel = useMemo(() => {
    return `Rate ${ratingsDone}/${ratingsTarget} books • Follow ${followsDone}/${followsTarget} readers`;
  }, [followsDone, followsTarget, ratingsDone, ratingsTarget]);

  const loadSuggestions = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    setIsLoadingSuggestions(true);

    try {
      const nextSuggestions = await getSuggestedUsers(user.id, 20);
      setSuggestions(nextSuggestions);
    } catch {
      // Keep onboarding usable even if suggestion fetch fails.
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadSuggestions().catch(() => {
      // No-op.
    });
  }, [loadSuggestions]);

  const runSearch = useCallback(async () => {
    const normalized = query.trim();

    if (!normalized) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const results = await searchBooks(normalized);
      setSearchResults(results.slice(0, 8));
    } catch (error) {
      setSearchResults([]);
      setSearchError(error instanceof Error ? error.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  async function handleQuickRate(book: BookSummary, sentiment: Sentiment) {
    if (!user?.id) {
      return;
    }

    setIsRatingBookId(book.id);

    try {
      await upsertRating({
        authUserId: user.id,
        book,
        sentiment,
        isNotePrivate: false,
      });

      await onRefreshProgress();
    } catch {
      // Keep flow simple in MVP onboarding; inline error is optional.
    } finally {
      setIsRatingBookId(null);
    }
  }

  async function handleFollow(targetAppUserId: string) {
    if (!user?.id) {
      return;
    }

    setFollowLoadingUserId(targetAppUserId);

    try {
      await followUser(user.id, targetAppUserId);
      await Promise.all([onRefreshProgress(), loadSuggestions()]);
    } catch {
      // Keep onboarding usable; ignore transient follow errors.
    } finally {
      setFollowLoadingUserId(null);
    }
  }

  const renderBookResult: ListRenderItem<BookSummary> = ({ item }) => (
    <View style={styles.resultCard}>
      <View style={styles.resultTextWrap}>
        <Text style={styles.resultTitle}>{item.title}</Text>
        <Text style={styles.resultAuthor}>{item.author}</Text>
      </View>
      <View style={styles.sentimentRow}>
        {SENTIMENTS.map((sentiment) => (
          <Pressable
            key={`${item.id}-${sentiment}`}
            onPress={() => handleQuickRate(item, sentiment)}
            style={styles.sentimentButton}
            disabled={isRatingBookId === item.id}
          >
            <Text style={styles.sentimentButtonLabel}>{sentiment}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderUserSuggestion: ListRenderItem<SuggestedUser> = ({ item }) => (
    <View style={styles.userCard}>
      <View style={styles.userMetaWrap}>
        <Avatar
          name={item.displayName}
          size={34}
          uri={item.avatarUrl}
        />
        <View style={styles.userTextWrap}>
          <Text style={styles.userName}>{item.displayName}</Text>
          <Text style={styles.userSubtext}>{item.ratingsCount} ratings</Text>
        </View>
      </View>

      <Pressable
        disabled={item.isFollowing || followLoadingUserId === item.id}
        onPress={() => handleFollow(item.id)}
        style={[styles.followButton, item.isFollowing && styles.followedButton]}
      >
        <Text style={[styles.followButtonLabel, item.isFollowing && styles.followedButtonLabel]}>
          {item.isFollowing ? 'Following' : followLoadingUserId === item.id ? '...' : 'Follow'}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome to Beli Books</Text>
        <Text style={styles.subtitle}>Complete onboarding to unlock your full feed.</Text>

        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Progress</Text>
          <Text style={styles.progressBody}>{progressLabel}</Text>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>1) Rate books</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            onSubmitEditing={runSearch}
            placeholder="Search by title or author"
            style={styles.searchInput}
            value={query}
          />
          <Pressable
            onPress={runSearch}
            style={styles.searchButton}
          >
            <Text style={styles.searchButtonLabel}>{isSearching ? 'Searching...' : 'Search'}</Text>
          </Pressable>
          {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={renderBookResult}
            style={styles.compactList}
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>2) Follow readers</Text>
          {isLoadingSuggestions ? (
            <ActivityIndicator
              size="small"
              color="#111827"
            />
          ) : (
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item.id}
              renderItem={renderUserSuggestion}
              style={styles.compactList}
            />
          )}
        </View>

        <Pressable
          disabled={!isComplete}
          onPress={() => {
            onRefreshProgress().catch(() => {
              // No-op.
            });
          }}
          style={[styles.primaryButton, !isComplete && styles.primaryButtonDisabled]}
        >
          <Text style={styles.primaryButtonLabel}>
            {isComplete ? 'Onboarding complete - opening app...' : 'Complete targets to continue'}
          </Text>
        </Pressable>

        <Pressable
          onPress={onSignOut}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonLabel}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#4B5563',
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  progressBody: {
    fontSize: 14,
    color: '#374151',
  },
  sectionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
  },
  searchButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  searchButtonLabel: {
    color: '#F9FAFB',
    fontWeight: '700',
    fontSize: 14,
  },
  compactList: {
    flexGrow: 0,
  },
  resultCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  resultTextWrap: {
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  resultAuthor: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  sentimentRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sentimentButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    paddingVertical: 7,
    alignItems: 'center',
  },
  sentimentButtonLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 9,
    marginBottom: 8,
  },
  userMetaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userTextWrap: {
    marginLeft: 10,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  userSubtext: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  followButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#111827',
  },
  followButtonLabel: {
    color: '#F9FAFB',
    fontWeight: '700',
    fontSize: 12,
  },
  followedButton: {
    backgroundColor: '#E5E7EB',
  },
  followedButtonLabel: {
    color: '#4B5563',
  },
  primaryButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonLabel: {
    color: '#F9FAFB',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonLabel: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 13,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
  },
});
