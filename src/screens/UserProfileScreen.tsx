import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { CompositeNavigationProp, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { Avatar } from '../components/Avatar';
import { TasteProfile } from '../components/TasteProfile';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../services/analytics';
import {
  followUser,
  getUserProfileView,
  unfollowUser,
  type SocialActivity,
  type UserProfileView,
} from '../services/social';
import type { RootStackParamList, RootTabParamList } from '../types/navigation';

type UserProfileRouteProp = RouteProp<RootStackParamList, 'UserProfile'>;
type UserProfileNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<RootStackParamList>,
  BottomTabNavigationProp<RootTabParamList>
>;

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return `${Math.floor(days / 7)}w ago`;
}

function activityLabel(activity: SocialActivity): string {
  switch (activity.activityType) {
    case 'Rated':
      return activity.sentiment ? `rated ${activity.sentiment}` : 'rated';
    default:
      return 'added';
  }
}

export function UserProfileScreen() {
  const navigation = useNavigation<UserProfileNavigationProp>();
  const route = useRoute<UserProfileRouteProp>();
  const { user } = useAuth();

  const [profile, setProfile] = useState<UserProfileView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdatingFollow, setIsUpdatingFollow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetAppUserId = route.params.appUserId;

  const loadProfile = useCallback(
    async (refresh = false) => {
      if (!user?.id) {
        return;
      }

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const nextProfile = await getUserProfileView(user.id, targetAppUserId);
        setProfile(nextProfile);
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load profile');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [targetAppUserId, user?.id],
  );

  useEffect(() => {
    loadProfile().catch(() => {
      // Handled in loadProfile.
    });
  }, [loadProfile]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    trackEvent({
      event: 'profile_viewed',
      authUserId: user.id,
      properties: {
        target: 'other',
        target_app_user_id: targetAppUserId,
      },
    }).catch(() => {
      // Non-blocking analytics.
    });
  }, [targetAppUserId, user?.id]);

  async function handleFollowToggle() {
    if (!user?.id || !profile || isUpdatingFollow) {
      return;
    }

    setIsUpdatingFollow(true);

    try {
      if (profile.isFollowing) {
        await unfollowUser(user.id, profile.appUserId);
      } else {
        await followUser(user.id, profile.appUserId);
      }

      await loadProfile(true);
    } catch (followError) {
      Alert.alert('Follow update failed', followError instanceof Error ? followError.message : 'Please try again.');
    } finally {
      setIsUpdatingFollow(false);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>{error ?? 'Profile unavailable'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadProfile(true)} />}
      >
        <View style={styles.headerCard}>
          <Avatar name={profile.displayName} uri={profile.avatarUrl} size={62} />
          <View style={styles.headerMeta}>
            <Text style={styles.displayName}>{profile.displayName}</Text>
            <Text style={styles.subTitle}>{profile.ratingsCount} ratings</Text>
          </View>
        </View>

        <Pressable onPress={handleFollowToggle} style={styles.followButton}>
          <Text style={styles.followLabel}>
            {isUpdatingFollow ? 'Updating...' : profile.isFollowing ? 'Unfollow' : 'Follow'}
          </Text>
        </Pressable>

        <View style={styles.statsRow}>
          <Pressable
            style={styles.statCard}
            onPress={() =>
              navigation.navigate('Connections', {
                appUserId: profile.appUserId,
                kind: 'followers',
                title: `${profile.displayName}'s Followers`,
              })
            }
          >
            <Text style={styles.statValue}>{profile.followersCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </Pressable>

          <Pressable
            style={styles.statCard}
            onPress={() =>
              navigation.navigate('Connections', {
                appUserId: profile.appUserId,
                kind: 'following',
                title: `${profile.displayName}'s Following`,
              })
            }
          >
            <Text style={styles.statValue}>{profile.followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </Pressable>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profile.ratingsCount}</Text>
            <Text style={styles.statLabel}>Ratings</Text>
          </View>
        </View>

        <TasteProfile userId={profile.appUserId} />

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {profile.recentActivity.length === 0 ? (
            <Text style={styles.emptyText}>No activity yet.</Text>
          ) : (
            profile.recentActivity.map((activity) => (
              <View key={activity.id} style={styles.activityRow}>
                <Text style={styles.activityText}>
                  {profile.displayName} {activityLabel(activity)}{' '}
                  {activity.book ? `"${activity.book.title}"` : 'a book'}
                </Text>
                <Text style={styles.activityTime}>{formatRelativeTime(activity.createdAt)}</Text>
              </View>
            ))
          )}
        </View>

        {error ? <Text style={styles.errorTextInline}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F4F6' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 10, paddingBottom: 24 },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerMeta: { flex: 1 },
  displayName: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subTitle: { marginTop: 3, color: '#6B7280', fontSize: 13 },
  followButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 11,
  },
  followLabel: { color: '#F9FAFB', fontWeight: '700', fontSize: 14 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  statLabel: { marginTop: 2, color: '#6B7280', fontSize: 12 },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  emptyText: { color: '#6B7280', fontSize: 13 },
  activityRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 8,
    marginBottom: 2,
  },
  activityText: { color: '#1F2937', fontSize: 13 },
  activityTime: { marginTop: 3, color: '#6B7280', fontSize: 12 },
  errorText: { color: '#B91C1C', fontSize: 14 },
  errorTextInline: { textAlign: 'center', color: '#B91C1C', fontSize: 13 },
});
