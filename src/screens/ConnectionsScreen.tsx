import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { CompositeNavigationProp, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { Avatar } from '../components/Avatar';
import { TasteMatchBadge } from '../components/TasteMatchBadge';
import { useAuth } from '../context/AuthContext';
import { followUser, getConnections, unfollowUser, type ConnectionUser } from '../services/social';
import type { RootStackParamList, RootTabParamList } from '../types/navigation';

type ConnectionsRouteProp = RouteProp<RootStackParamList, 'Connections'>;
type ConnectionsNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<RootStackParamList>,
  BottomTabNavigationProp<RootTabParamList>
>;

export function ConnectionsScreen() {
  const route = useRoute<ConnectionsRouteProp>();
  const navigation = useNavigation<ConnectionsNavigationProp>();
  const { user } = useAuth();

  const [items, setItems] = useState<ConnectionUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const { appUserId, kind, title } = route.params;

  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  const loadConnections = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    setIsLoading(true);

    try {
      const list = await getConnections(user.id, appUserId, kind);
      setItems(list);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load list');
    } finally {
      setIsLoading(false);
    }
  }, [appUserId, kind, user?.id]);

  useEffect(() => {
    loadConnections().catch(() => {
      // Handled in loadConnections.
    });
  }, [loadConnections]);

  async function handleFollowToggle(item: ConnectionUser) {
    if (!user?.id) {
      return;
    }

    setUpdatingUserId(item.id);

    try {
      if (item.isFollowing) {
        await unfollowUser(user.id, item.id);
      } else {
        await followUser(user.id, item.id);
      }

      await loadConnections();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Failed to update follow state');
    } finally {
      setUpdatingUserId(null);
    }
  }

  const renderItem: ListRenderItem<ConnectionUser> = ({ item }) => (
    <Pressable
      onPress={() => navigation.navigate('UserProfile', { appUserId: item.id })}
      style={styles.card}
    >
      <View style={styles.leftBlock}>
        <Avatar name={item.displayName} uri={item.avatarUrl} size={34} />
        <View style={styles.nameWrap}>
          <Text style={styles.name}>{item.displayName}</Text>
          <TasteMatchBadge percentage={item.tasteMatchPercentage} />
        </View>
      </View>

      <Pressable
        onPress={() => handleFollowToggle(item)}
        style={[styles.followButton, item.isFollowing && styles.followingButton]}
      >
        <Text style={[styles.followLabel, item.isFollowing && styles.followingLabel]}>
          {updatingUserId === item.id ? '...' : item.isFollowing ? 'Following' : 'Follow'}
        </Text>
      </Pressable>
    </Pressable>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.emptyText}>No users yet.</Text>}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F4F6' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, gap: 8, paddingBottom: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  leftBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 },
  nameWrap: { gap: 4, flex: 1 },
  name: { color: '#111827', fontSize: 14, fontWeight: '600' },
  followButton: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  followingButton: { backgroundColor: '#E5E7EB' },
  followLabel: { color: '#F9FAFB', fontSize: 12, fontWeight: '700' },
  followingLabel: { color: '#4B5563' },
  emptyText: { textAlign: 'center', color: '#6B7280', marginTop: 10 },
  errorText: { textAlign: 'center', color: '#B91C1C', marginBottom: 10 },
});
