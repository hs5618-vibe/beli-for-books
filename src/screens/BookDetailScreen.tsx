import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

import { BookCover } from '../components/BookCover';
import { useAuth } from '../context/AuthContext';
import {
  getBookRatingState,
  getPairwisePrompts,
  submitComparisonResult,
  upsertRating,
  type ComparisonSelection,
  type PairwiseComparisonPrompt,
  type RatingRecord,
} from '../services/ratings';
import type { ReadingStatus, Sentiment } from '../types/feed';
import type { RootTabParamList } from '../types/navigation';

const SENTIMENTS: Sentiment[] = ['Loved', 'Liked', 'Okay'];
const READING_STATUSES: ReadingStatus[] = ['WantToRead', 'Reading', 'Read'];

function readableStatus(status: ReadingStatus): string {
  switch (status) {
    case 'WantToRead':
      return 'Want to Read';
    case 'Reading':
      return 'Reading';
    case 'Read':
      return 'Read';
    default:
      return status;
  }
}

export function BookDetailScreen() {
  const { user } = useAuth();
  const route = useRoute<RouteProp<RootTabParamList, 'BookDetail'>>();
  const [sentiment, setSentiment] = useState<Sentiment | undefined>();
  const [readingStatus, setReadingStatus] = useState<ReadingStatus | undefined>();
  const [note, setNote] = useState('');
  const [isNotePrivate, setIsNotePrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedRating, setSavedRating] = useState<RatingRecord | null>(null);
  const [prompts, setPrompts] = useState<PairwiseComparisonPrompt[]>([]);
  const [promptIndex, setPromptIndex] = useState(0);

  const book = route.params?.book;
  const activePrompt = useMemo(() => prompts[promptIndex], [promptIndex, prompts]);

  useEffect(() => {
    let isMounted = true;

    async function loadExistingState() {
      if (!book || !user?.id) {
        return;
      }

      try {
        const existingState = await getBookRatingState(user.id, book.id);
        if (!isMounted) {
          return;
        }

        setSentiment(existingState.sentiment);
        setReadingStatus(existingState.readingStatus);
        setNote(existingState.note);
        setIsNotePrivate(existingState.isNotePrivate);
        setSavedRating((previous) => {
          if (!existingState.sentiment || existingState.numericScore === undefined) {
            return null;
          }

          return {
            id: previous?.id ?? `existing-${book.id}`,
            userId: previous?.userId ?? user.id,
            book,
            sentiment: existingState.sentiment,
            note: existingState.note || undefined,
            isNotePrivate: existingState.isNotePrivate,
            readingStatus: existingState.readingStatus,
            numericScore: existingState.numericScore,
            createdAt: previous?.createdAt ?? new Date().toISOString(),
          };
        });
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Failed to load rating');
      }
    }

    loadExistingState().catch(() => {
      // Handled in function.
    });

    return () => {
      isMounted = false;
    };
  }, [book, user]);

  if (!book) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyStateWrap}>
          <Text style={styles.emptyStateTitle}>No book selected.</Text>
          <Text style={styles.emptyStateBody}>Open a book from Feed or Search first.</Text>
        </View>
      </SafeAreaView>
    );
  }

  async function handleSaveRating() {
    if (!user?.id) {
      setError('You must be signed in to rate a book.');
      return;
    }

    if (!sentiment) {
      setError('Select Loved, Liked, or Okay before saving.');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const rating = await upsertRating({
        authUserId: user.id,
        book,
        sentiment,
        note: note.trim() || undefined,
        isNotePrivate,
        readingStatus,
      });

      const nextPrompts = await getPairwisePrompts(user.id, book);
      setSavedRating(rating);
      setPrompts(nextPrompts);
      setPromptIndex(0);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save rating');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleComparisonSelection(selection: ComparisonSelection) {
    if (!user?.id) {
      setError('You must be signed in to compare books.');
      return;
    }

    if (!activePrompt) {
      return;
    }

    try {
      await submitComparisonResult({
        prompt: activePrompt,
        selection,
        authUserId: user.id,
      });

      setPromptIndex((index) => index + 1);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save comparison');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.bookHeader}>
          <BookCover
            uri={book.coverUrl}
            width={88}
            height={132}
          />
          <View style={styles.bookMeta}>
            <Text style={styles.title}>{book.title}</Text>
            <Text style={styles.author}>{book.author}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How did it feel?</Text>
          <View style={styles.row}>
            {SENTIMENTS.map((value) => (
              <Pressable
                key={value}
                onPress={() => setSentiment(value)}
                style={[styles.chip, sentiment === value && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, sentiment === value && styles.chipLabelActive]}>
                  {value}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reading Status</Text>
          <View style={styles.row}>
            {READING_STATUSES.map((status) => (
              <Pressable
                key={status}
                onPress={() => setReadingStatus(status)}
                style={[styles.chip, readingStatus === status && styles.chipActive]}
              >
                <Text
                  style={[styles.chipLabel, readingStatus === status && styles.chipLabelActive]}
                >
                  {readableStatus(status)}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setReadingStatus(undefined)}
              style={styles.clearChip}
            >
              <Text style={styles.clearChipLabel}>Clear</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Note (Optional)</Text>
          <TextInput
            multiline
            onChangeText={setNote}
            placeholder="Add a short note..."
            style={styles.noteInput}
            value={note}
          />
          <View style={styles.privateRow}>
            <Text style={styles.privateLabel}>Private note (only visible to me)</Text>
            <Switch
              onValueChange={setIsNotePrivate}
              value={isNotePrivate}
            />
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          onPress={handleSaveRating}
          style={styles.saveButton}
        >
          <Text style={styles.saveButtonLabel}>{isSaving ? 'Saving...' : 'Save Rating'}</Text>
        </Pressable>

        {savedRating ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Derived Score</Text>
            <Text style={styles.scoreValue}>{savedRating.numericScore.toFixed(1)} / 10</Text>
          </View>
        ) : null}

        {activePrompt ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Comparison</Text>
            <Text style={styles.comparisonText}>
              Which did you prefer more: "{activePrompt.leftBook.title}" or "
              {activePrompt.rightBook.title}"?
            </Text>
            <View style={styles.comparisonButtons}>
              <Pressable
                onPress={() => handleComparisonSelection('left')}
                style={styles.compareButton}
              >
                <Text style={styles.compareButtonLabel}>{activePrompt.leftBook.title}</Text>
              </Pressable>
              <Pressable
                onPress={() => handleComparisonSelection('tie')}
                style={styles.compareButton}
              >
                <Text style={styles.compareButtonLabel}>Tie</Text>
              </Pressable>
              <Pressable
                onPress={() => handleComparisonSelection('right')}
                style={styles.compareButton}
              >
                <Text style={styles.compareButtonLabel}>{activePrompt.rightBook.title}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {savedRating && prompts.length > 0 && promptIndex >= prompts.length ? (
          <Text style={styles.comparisonDone}>Comparisons complete. Score will keep refining.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 16,
    paddingBottom: 28,
    gap: 14,
  },
  bookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
  },
  bookMeta: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  author: {
    marginTop: 6,
    fontSize: 14,
    color: '#6B7280',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  chipLabel: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },
  chipLabelActive: {
    color: '#F9FAFB',
  },
  clearChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#E5E7EB',
  },
  clearChipLabel: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  noteInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  privateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  privateLabel: {
    fontSize: 13,
    color: '#4B5563',
    flex: 1,
    marginRight: 12,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonLabel: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '700',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  comparisonText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  comparisonButtons: {
    gap: 8,
  },
  compareButton: {
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  compareButtonLabel: {
    color: '#1F2937',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  comparisonDone: {
    textAlign: 'center',
    color: '#065F46',
    fontWeight: '600',
  },
  emptyStateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  emptyStateTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
  },
  emptyStateBody: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
});
