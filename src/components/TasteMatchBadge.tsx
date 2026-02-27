import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type TasteMatchBadgeProps = {
  percentage: number | null;
};

function toneStyles(percentage: number | null): { backgroundColor: string; textColor: string } {
  if (percentage === null) {
    return { backgroundColor: '#E5E7EB', textColor: '#4B5563' };
  }

  if (percentage >= 80) {
    return { backgroundColor: '#D1FAE5', textColor: '#065F46' };
  }

  if (percentage >= 60) {
    return { backgroundColor: '#DBEAFE', textColor: '#1E40AF' };
  }

  if (percentage >= 40) {
    return { backgroundColor: '#FEF3C7', textColor: '#92400E' };
  }

  return { backgroundColor: '#FEE2E2', textColor: '#991B1B' };
}

export function TasteMatchBadge({ percentage }: TasteMatchBadgeProps) {
  const tone = toneStyles(percentage);
  const label = percentage === null ? 'Taste Match --' : `Taste Match ${percentage}%`;

  return (
    <View style={[styles.badge, { backgroundColor: tone.backgroundColor }]}>
      <Text style={[styles.label, { color: tone.textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
});
