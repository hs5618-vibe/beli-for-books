import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Sentiment } from '../types/feed';

type SentimentPillProps = {
  value: Sentiment;
};

export function SentimentPill({ value }: SentimentPillProps) {
  const stylesBySentiment: Record<Sentiment, { backgroundColor: string; textColor: string }> = {
    Loved: { backgroundColor: '#F97316', textColor: '#111827' },
    Liked: { backgroundColor: '#10B981', textColor: '#022C22' },
    Okay: { backgroundColor: '#E5E7EB', textColor: '#111827' },
  };

  const { backgroundColor, textColor } = stylesBySentiment[value];

  return (
    <View style={[styles.pill, { backgroundColor }]}>
      <Text style={[styles.label, { color: textColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});

