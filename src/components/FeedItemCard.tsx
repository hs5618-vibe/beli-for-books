import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FeedItem } from '../types/feed';
import { Avatar } from './Avatar';
import { BookCover } from './BookCover';

type FeedItemCardProps = {
  item: FeedItem;
  onPressBook?: (item: FeedItem) => void;
  onPressUser?: (item: FeedItem) => void;
};

export function FeedItemCard({ item, onPressBook, onPressUser }: FeedItemCardProps) {
  const handlePressBook = () => {
    if (onPressBook) {
      onPressBook(item);
    }
  };

  const handlePressUser = () => {
    if (onPressUser) {
      onPressUser(item);
    }
  };

  const subtitle =
    item.activityType === 'Rated'
      ? 'rated'
      : item.activityType === 'StatusChanged'
      ? 'updated status on'
      : 'added';

  return (
    <View style={styles.card}>
      <Pressable
        onPress={handlePressUser}
        style={styles.header}
      >
        <Avatar
          name={item.user.displayName}
          uri={item.user.avatarUrl}
          size={32}
        />
        <View style={styles.headerTextContainer}>
          <Text style={styles.userName}>{item.user.displayName}</Text>
          <Text style={styles.activityText}>
            {subtitle} · {formatTimeAgo(item.createdAt)}
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={handlePressBook}
        style={styles.body}
      >
        <BookCover
          uri={item.book.coverUrl}
          width={52}
          height={80}
        />
        <View style={styles.bookInfo}>
          <View style={styles.titleRow}>
            <View style={styles.titleContainer}>
              <Text
                numberOfLines={2}
                style={styles.bookTitle}
              >
                {item.book.title}
              </Text>
              <Text
                numberOfLines={1}
                style={styles.bookAuthor}
              >
                {item.book.author}
              </Text>
            </View>
            {item.activityType === 'Rated' && item.numericScore !== undefined ? (
              <View style={styles.scoreContainer}>
                <Text style={styles.numericScore}>{item.numericScore.toFixed(1)}</Text>
              </View>
            ) : null}
          </View>

          {item.readingStatus ? (
            <View style={styles.metaRow}>
              <Text style={styles.statusLabel}>{readableStatus(item.readingStatus)}</Text>
            </View>
          ) : null}

          {item.notePreview ? (
            <Text
              numberOfLines={2}
              style={styles.notePreview}
            >
              “{item.notePreview}”
            </Text>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

function formatTimeAgo(isoDate: string): string {
  const created = new Date(isoDate).getTime();
  const now = Date.now();
  const diffMs = now - created;

  const diffMinutes = Math.round(diffMs / (1000 * 60));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  const diffWeeks = Math.round(diffDays / 7);
  return `${diffWeeks}w ago`;
}

function readableStatus(status: FeedItem['readingStatus']): string {
  switch (status) {
    case 'WantToRead':
      return 'Want to Read';
    case 'Reading':
      return 'Reading';
    case 'Read':
      return 'Read';
    default:
      return '';
  }
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTextContainer: {
    marginLeft: 10,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  activityText: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  body: {
    flexDirection: 'row',
    marginTop: 4,
  },
  bookInfo: {
    flex: 1,
    marginLeft: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    marginRight: 8,
  },
  bookTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  bookAuthor: {
    marginTop: 2,
    fontSize: 13,
    color: '#6B7280',
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  numericScore: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  statusLabel: {
    fontSize: 12,
    color: '#4B5563',
  },
  notePreview: {
    marginTop: 8,
    fontSize: 13,
    color: '#4B5563',
  },
});

