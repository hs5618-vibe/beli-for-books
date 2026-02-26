import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Avatar } from '../components/Avatar';
import { BookCover } from '../components/BookCover';
import { useAuth } from '../context/AuthContext';
import {
  getProfileDashboard,
  profileShareUrl,
  updateOwnProfile,
  type ProfileActivity,
  type ProfileDashboard,
} from '../services/profile';

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));

  if (minutes < 1) {
    return 'just now';
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function activityLabel(activity: ProfileActivity): string {
  switch (activity.activityType) {
    case 'Rated':
      return 'rated';
    case 'StatusChanged':
      return 'updated status for';
    case 'Added':
      return 'added';
    default:
      return 'updated';
  }
}

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [dashboard, setDashboard] = useState<ProfileDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftDisplayName, setDraftDisplayName] = useState('');
  const [draftAvatarUrl, setDraftAvatarUrl] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const loadDashboard = useCallback(async (options?: { refresh?: boolean }) => {
    if (!user?.id) {
      setDashboard(null);
      setIsLoading(false);
      return;
    }

    if (options?.refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const nextDashboard = await getProfileDashboard(user.id);
      setDashboard(nextDashboard);
      setDraftDisplayName(nextDashboard.displayName);
      setDraftAvatarUrl(nextDashboard.avatarUrl ?? '');
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadDashboard().catch(() => {
      // Errors are handled in loadDashboard.
    });
  }, [loadDashboard]);

  const rankLabel = useMemo(() => {
    if (!dashboard || dashboard.rank === null || dashboard.rankPopulation === 0) {
      return 'N/A';
    }

    return `#${dashboard.rank}/${dashboard.rankPopulation}`;
  }, [dashboard]);

  async function handleShareProfile() {
    if (!dashboard) {
      return;
    }

    try {
      await Share.share({
        message: `Check out my Beli Books profile: ${profileShareUrl(dashboard.appUserId)}`,
      });
    } catch (shareError) {
      Alert.alert('Share failed', shareError instanceof Error ? shareError.message : 'Please try again.');
    }
  }

  async function handleSaveProfile() {
    if (!user?.id) {
      return;
    }

    if (!draftDisplayName.trim()) {
      Alert.alert('Display name required', 'Please add a display name before saving.');
      return;
    }

    setIsSavingProfile(true);

    try {
      await updateOwnProfile({
        authUserId: user.id,
        displayName: draftDisplayName,
        avatarUrl: draftAvatarUrl,
      });

      setIsEditing(false);
      await loadDashboard();
    } catch (saveError) {
      Alert.alert('Save failed', saveError instanceof Error ? saveError.message : 'Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerWrap}>
          <ActivityIndicator
            size="large"
            color="#111827"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!dashboard) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>{error ?? 'Profile unavailable.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              loadDashboard({ refresh: true }).catch(() => {
                // Errors are handled in loadDashboard.
              });
            }}
          />
        }
      >
        <View style={styles.headerCard}>
          <Avatar
            name={dashboard.displayName}
            size={62}
            uri={dashboard.avatarUrl}
          />
          <View style={styles.headerTextWrap}>
            <Text style={styles.displayName}>{dashboard.displayName}</Text>
            <Text style={styles.emailText}>{user?.email ?? 'reader@beli.books'}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            onPress={() => setIsEditing((value) => !value)}
            style={styles.actionButton}
          >
            <Text style={styles.actionButtonLabel}>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</Text>
          </Pressable>

          <Pressable
            onPress={handleShareProfile}
            style={styles.actionButton}
          >
            <Text style={styles.actionButtonLabel}>Share Profile</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              signOut().catch(() => {
                // No-op: auth flow will route to sign in.
              });
            }}
            style={[styles.actionButton, styles.signOutButton]}
          >
            <Text style={[styles.actionButtonLabel, styles.signOutButtonLabel]}>Sign Out</Text>
          </Pressable>
        </View>

        {isEditing ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Edit Profile</Text>
            <TextInput
              onChangeText={setDraftDisplayName}
              placeholder="Display name"
              style={styles.input}
              value={draftDisplayName}
            />
            <TextInput
              autoCapitalize="none"
              onChangeText={setDraftAvatarUrl}
              placeholder="Avatar image URL (optional)"
              style={styles.input}
              value={draftAvatarUrl}
            />
            <Pressable
              onPress={handleSaveProfile}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonLabel}>{isSavingProfile ? 'Saving...' : 'Save Profile'}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Beli Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{dashboard.followersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{dashboard.followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{rankLabel}</Text>
              <Text style={styles.statLabel}>Rank</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{dashboard.booksReadCount}</Text>
              <Text style={styles.statLabel}>Books Read</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{dashboard.booksWantToTryCount}</Text>
              <Text style={styles.statLabel}>Want to Try</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{dashboard.streakWeeks}</Text>
              <Text style={styles.statLabel}>Week Streak</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Recs For You</Text>
          {dashboard.recommendations.length === 0 ? (
            <Text style={styles.emptyText}>Rate more books to unlock personalized recs.</Text>
          ) : (
            dashboard.recommendations.map((book) => (
              <View
                key={book.id}
                style={styles.bookRow}
              >
                <BookCover
                  uri={book.coverUrl}
                  width={42}
                  height={64}
                />
                <View style={styles.bookRowTextWrap}>
                  <Text style={styles.bookTitle}>{book.title}</Text>
                  <Text style={styles.bookMeta}>{book.author}</Text>
                  <Text style={styles.bookMeta}>{book.lovedByCount} readers loved this</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {dashboard.recentActivity.length === 0 ? (
            <Text style={styles.emptyText}>No activity yet. Rate a book to get started.</Text>
          ) : (
            dashboard.recentActivity.map((activity) => (
              <View
                key={activity.id}
                style={styles.activityRow}
              >
                <Text style={styles.activityText}>
                  You {activityLabel(activity)} {activity.book ? `"${activity.book.title}"` : 'a book'}
                </Text>
                <Text style={styles.activityTime}>{formatRelativeTime(activity.createdAt)}</Text>
              </View>
            ))
          )}
        </View>

        {error ? <Text style={styles.inlineError}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 26,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  displayName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  emailText: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 13,
  },
  actionRow: {
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  signOutButton: {
    backgroundColor: '#111827',
  },
  signOutButtonLabel: {
    color: '#F9FAFB',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statItem: {
    width: '31%',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    marginTop: 3,
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryButtonLabel: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 13,
  },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bookRowTextWrap: {
    flex: 1,
  },
  bookTitle: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 14,
  },
  bookMeta: {
    marginTop: 2,
    color: '#6B7280',
    fontSize: 12,
  },
  activityRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 8,
    marginBottom: 2,
  },
  activityText: {
    color: '#1F2937',
    fontSize: 13,
  },
  activityTime: {
    marginTop: 3,
    color: '#6B7280',
    fontSize: 12,
  },
  inlineError: {
    color: '#B91C1C',
    textAlign: 'center',
    fontSize: 13,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    textAlign: 'center',
  },
});
