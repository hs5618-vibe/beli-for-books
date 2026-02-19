import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

type BookCoverProps = {
  uri?: string;
  width?: number;
  height?: number;
};

export function BookCover({ uri, width = 52, height = 80 }: BookCoverProps) {
  if (!uri) {
    return <View style={[styles.placeholder, { width, height }]} />;
  }

  return (
    <Image
      source={{ uri }}
      style={[styles.image, { width, height }]}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    borderRadius: 6,
    resizeMode: 'cover',
  },
  placeholder: {
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
});

