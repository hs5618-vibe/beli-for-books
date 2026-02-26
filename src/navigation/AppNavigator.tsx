import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableScreens } from 'react-native-screens';

import { AuthProvider, useAuth } from '../context/AuthContext';
import { BookDetailScreen } from '../screens/BookDetailScreen';
import { FeedScreen } from '../screens/FeedScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { getOnboardingProgress, type OnboardingProgress } from '../services/onboarding';
import type { RootStackParamList, RootTabParamList } from '../types/navigation';

enableScreens();

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabsNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Feed"
      screenOptions={{
        headerTitleAlign: 'center',
      }}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { isLoading, session, user, signOut } = useAuth();
  const [isOnboardingLoading, setIsOnboardingLoading] = useState(true);
  const [onboardingProgress, setOnboardingProgress] = useState<OnboardingProgress | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadOnboardingState() {
      if (!user) {
        if (isMounted) {
          setOnboardingProgress(null);
          setOnboardingError(null);
          setIsOnboardingLoading(false);
        }
        return;
      }

      try {
        const progress = await getOnboardingProgress(user.id);
        if (!isMounted) {
          return;
        }

        setOnboardingProgress(progress);
        setOnboardingError(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setOnboardingError(error instanceof Error ? error.message : 'Failed to load onboarding');
      } finally {
        if (isMounted) {
          setIsOnboardingLoading(false);
        }
      }
    }

    setIsOnboardingLoading(true);
    loadOnboardingState().catch(() => {
      if (!isMounted) {
        return;
      }

      setOnboardingProgress(null);
      setOnboardingError('Failed to load onboarding');
      setIsOnboardingLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [user]);

  async function refreshOnboardingProgress() {
    if (!user) {
      return;
    }

    const progress = await getOnboardingProgress(user.id);
    setOnboardingProgress(progress);
    setOnboardingError(null);
  }

  const showLoading = isLoading || isOnboardingLoading;

  if (showLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator
          size="large"
          color="#111827"
        />
      </View>
    );
  }

  return (
    <Stack.Navigator>
      {!session ? (
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ headerShown: false }}
        />
      ) : !onboardingProgress?.isComplete ? (
        <Stack.Screen
          name="Onboarding"
          options={{ headerShown: false }}
        >
          {() => (
            <OnboardingScreen
              errorMessage={onboardingError}
              progress={onboardingProgress}
              onRefreshProgress={() => refreshOnboardingProgress()}
              onSignOut={() => {
                signOut().catch(() => {
                  // No-op for now; auth screen will expose sign-in path anyway.
                });
              }}
            />
          )}
        </Stack.Screen>
      ) : (
        <>
          <Stack.Screen
            name="MainTabs"
            component={MainTabsNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BookDetail"
            component={BookDetailScreen}
            options={{ title: 'Book' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export function AppNavigator() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
});
