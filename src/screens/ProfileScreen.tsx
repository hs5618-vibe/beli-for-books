import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../context/AuthContext';

export function ProfileScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{user?.email ?? 'Profile'}</Text>
      <Pressable
        onPress={() => {
          signOut().catch(() => {
            // No-op: auth state listener will still drive navigation.
          });
        }}
        style={styles.signOutButton}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  signOutButton: {
    marginTop: 12,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  signOutText: {
    color: '#F9FAFB',
    fontWeight: '700',
  },
});
