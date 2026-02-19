import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

type AvatarProps = {
  name: string;
  size?: number;
  uri?: string;
};

export function Avatar({ name, size = 36, uri }: AvatarProps) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join('');

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Text style={styles.initials}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  initials: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '600',
  },
});

