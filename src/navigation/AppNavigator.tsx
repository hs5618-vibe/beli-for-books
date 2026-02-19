import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableScreens } from 'react-native-screens';

import { AuthProvider, useAuth } from '../context/AuthContext';
import { BookDetailScreen } from '../screens/BookDetailScreen';
import { FeedScreen } from '../screens/FeedScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { AuthScreen } from '../screens/AuthScreen';
import type { RootStackParamList, RootTabParamList } from '../types/navigation';

enableScreens();

const ONBOARDING_KEY_PREFIX = 'onboarding-complete';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const hiddenTabScreenOptions: BottomTabNavigationOptions = {
  tabBarButton: () => null,
  tabBarItemStyle: { display: 'none' },
  tabBarStyle: { display: 'none' },
};

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
      <Tab.Screen
        name="BookDetail"
        component={BookDetailScreen}
        options={hiddenTabScreenOptions}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { isLoading, session, user, signOut } = useAuth();
  const [isOnboardingLoading, setIsOnboardingLoading] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadOnboardingState() {
      if (!user) {
        if (isMounted) {
          setIsOnboardingComplete(false);
          setIsOnboardingLoading(false);
        }
        return;
      }

      const key = `${ONBOARDING_KEY_PREFIX}:${user.id}`;
      const value = await AsyncStorage.getItem(key);

      if (!isMounted) {
        return;
      }

      setIsOnboardingComplete(value === 'true');
      setIsOnboardingLoading(false);
    }

    setIsOnboardingLoading(true);
    loadOnboardingState().catch(() => {
      if (!isMounted) {
        return;
      }

      setIsOnboardingComplete(false);
      setIsOnboardingLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [user]);

  async function handleCompleteOnboarding() {
    if (!user) {
      return;
    }

    const key = `${ONBOARDING_KEY_PREFIX}:${user.id}`;
    await AsyncStorage.setItem(key, 'true');
    setIsOnboardingComplete(true);
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
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!session ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : !isOnboardingComplete ? (
        <Stack.Screen name="Onboarding">
          {() => (
            <OnboardingScreen
              onComplete={handleCompleteOnboarding}
              onSignOut={() => {
                signOut().catch(() => {
                  // No-op for now; auth screen will expose sign-in path anyway.
                });
              }}
            />
          )}
        </Stack.Screen>
      ) : (
        <Stack.Screen name="MainTabs" component={MainTabsNavigator} />
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
