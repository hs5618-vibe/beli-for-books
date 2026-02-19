import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type OnboardingScreenProps = {
  onComplete: () => void;
  onSignOut: () => void;
};

export function OnboardingScreen({ onComplete, onSignOut }: OnboardingScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Beli Books</Text>
      <Text style={styles.subtitle}>
        Onboarding gating is live. Next we will enforce "rate 5 books" and "follow 5 users" with
        real backend counts.
      </Text>

      <Pressable
        onPress={onComplete}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonLabel}>Continue to App</Text>
      </Pressable>

      <Pressable
        onPress={onSignOut}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryButtonLabel}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#F3F4F6',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    marginBottom: 20,
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    maxWidth: 420,
    lineHeight: 21,
  },
  primaryButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonLabel: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryButtonLabel: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
});
