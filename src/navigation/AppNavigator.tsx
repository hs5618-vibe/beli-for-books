import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import { enableScreens } from 'react-native-screens';

import type { RootTabParamList } from '../types/navigation';
import { BookDetailScreen } from '../screens/BookDetailScreen';
import { FeedScreen } from '../screens/FeedScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SearchScreen } from '../screens/SearchScreen';

enableScreens();

const Tab = createBottomTabNavigator<RootTabParamList>();

const hiddenTabScreenOptions: BottomTabNavigationOptions = {
  tabBarButton: () => null,
  tabBarItemStyle: { display: 'none' },
  tabBarStyle: { display: 'none' },
};

export function AppNavigator() {
  return (
    <NavigationContainer>
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
        <Tab.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={hiddenTabScreenOptions}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

