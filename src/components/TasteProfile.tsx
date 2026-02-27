import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { BookCover } from './BookCover';
import { TasteMatchBadge } from './TasteMatchBadge';
import { useAuth } from '../context/AuthContext';
import { getTasteProfile, type TasteProfileData } from '../services/tasteProfile';
import type { RootStackParamList, RootTabParamList } from '../types/navigation';

type TasteProfileProps = {
  userId: string;
};

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function TasteProfile({ userId }: TasteProfileProps) {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const [data, setData] = useState<TasteProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTasteProfile() {
      setIsLoading(true);
      try {
        const nextData = await getTasteProfile({
          targetAppUserId: userId,
          viewerAuthUserId: user?.id,
        });
        if (!isMounted) {
          return;
        }
        setData(nextData);
        setError(null);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Failed to load taste profile');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTasteProfile().catch(() => {
      // Handled in loadTasteProfile.
    });

    return () => {
      isMounted = false;
    };
  }, [user?.id, userId]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Taste Profile</Text>
        {data?.viewerTasteMatchPercentage !== null && data?.viewerTasteMatchPercentage !== undefined ? (
          <TasteMatchBadge percentage={data.viewerTasteMatchPercentage} />
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#111827" />
        </View>
      ) : null}

      {!isLoading && data ? (
        <>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {data.averageRatingScore === null ? 'N/A' : `${data.averageRatingScore.toFixed(1)}/10`}
              </Text>
              <Text style={styles.statLabel}>Average Rating</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{data.ratingsCount}</Text>
              <Text style={styles.statLabel}>Books Rated</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Favorite Genres</Text>
            {data.favoriteGenres.length === 0 ? (
              <Text style={styles.helperText}>Rate more books to reveal genre patterns.</Text>
            ) : (
              <View style={styles.genreWrap}>
                {data.favoriteGenres.map((genre) => (
                  <View key={genre} style={styles.genreChip}>
                    <Text style={styles.genreLabel}>{genre}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Top Rated Books</Text>
            {data.topBooks.length === 0 ? (
              <Text style={styles.helperText}>No ratings yet.</Text>
            ) : (
              data.topBooks.map((book) => (
                <Pressable
                  key={book.id}
                  style={styles.bookRow}
                  onPress={() => {
                    navigation.navigate('BookDetail', {
                      book: {
                        id: book.id,
                        title: book.title,
                        author: book.author,
                        coverUrl: book.coverUrl,
                      },
                    });
                  }}
                >
                  <BookCover uri={book.coverUrl} width={36} height={54} />
                  <View style={styles.bookTextWrap}>
                    <Text style={styles.bookTitle}>{book.title}</Text>
                    <Text style={styles.bookMeta}>{book.author}</Text>
                  </View>
                  <Text style={styles.bookScore}>{book.numericScore.toFixed(1)}</Text>
                </Pressable>
              ))
            )}
          </View>
        </>
      ) : null}

      {!isLoading && error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  loadingWrap: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statItem: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  helperText: {
    color: '#6B7280',
    fontSize: 12,
  },
  genreWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  genreChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  genreLabel: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '600',
  },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 10,
    padding: 8,
  },
  bookTextWrap: {
    flex: 1,
  },
  bookTitle: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  bookMeta: {
    marginTop: 2,
    color: '#6B7280',
    fontSize: 12,
  },
  bookScore: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 12,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
  },
});
