import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';

export function AuthScreen() {
  const { signIn, signUp, errorMessage } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isSignUp = mode === 'signup';

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      setFormError('Email and password are required.');
      return;
    }

    if (isSignUp && !displayName.trim()) {
      setFormError('Display name is required for sign up.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        await signUp(email.trim(), password.trim(), displayName.trim());
      } else {
        await signIn(email.trim(), password.trim());
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Beli Books</Text>
          <Text style={styles.subtitle}>Discover books from people you trust.</Text>

          {isSignUp ? (
            <TextInput
              autoCapitalize="words"
              onChangeText={setDisplayName}
              placeholder="Display name"
              style={styles.input}
              value={displayName}
            />
          ) : null}

          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            style={styles.input}
            value={email}
          />

          <TextInput
            autoCapitalize="none"
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            style={styles.input}
            value={password}
          />

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <Pressable
            onPress={handleSubmit}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>
              {isSubmitting ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setMode(isSignUp ? 'login' : 'signup');
              setFormError(null);
            }}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>
              {isSignUp ? 'Already have an account? Sign in' : 'No account yet? Sign up'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
  },
  primaryButton: {
    marginTop: 6,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
});
