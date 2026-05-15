import { useCallback, useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import CreatorScreen from '../screens/CreatorScreen';
import CreatorTournamentScreen from '../screens/CreatorTournamentScreen';
import LoginScreen from '../screens/LoginScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RunTrackerScreen from '../screens/RunTrackerScreen';
import TournamentScreen from '../screens/TournamentScreen';
import TournamentsScreen from '../screens/TournamentsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const stackScreenOptions = {
  headerStyle: { backgroundColor: '#1a1a2e' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' }
};

function TournamentsStack() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="TournamentsList" component={TournamentsScreen} options={{ title: t('nav.tournaments') }} />
      <Stack.Screen
        name="Tournament"
        component={TournamentScreen}
        options={({ route }) => ({ title: route.params?.slug || t('nav.tournaments') })}
      />
    </Stack.Navigator>
  );
}

function CreatorStack() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="CreatorHome" component={CreatorScreen} options={{ title: t('nav.creator') }} />
      <Stack.Screen
        name="CreatorTournament"
        component={CreatorTournamentScreen}
        options={({ route }) => ({ title: route.params?.name || t('nav.creator') })}
      />
    </Stack.Navigator>
  );
}

function TabIcon({ name, focused }) {
  const icons = { Tournaments: '🏆', Run: '▶', Creator: '＋', Notifications: '🔔', Profile: '👤' };
  return <Text style={{ fontSize: focused ? 22 : 18 }}>{icons[name]}</Text>;
}

function AppTabs() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(() => {
    api
      .notifications()
      .then((data) => setUnreadCount(data.unread_count || 0))
      .catch(() => setUnreadCount(0));
  }, []);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener(() => {
      refreshUnreadCount();
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const slug = response.notification.request.content.data?.tournament_slug;

      refreshUnreadCount();
      if (slug) {
        navigation.navigate('Tournaments', {
          screen: 'Tournament',
          params: { slug }
        });
      }
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [navigation, refreshUnreadCount]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#e53935',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#eee' },
        headerStyle: { backgroundColor: '#1a1a2e' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' }
      })}
    >
      <Tab.Screen
        name="Tournaments"
        component={TournamentsStack}
        options={{ headerShown: false, tabBarLabel: t('nav.tournaments') }}
      />
      <Tab.Screen
        name="Run"
        component={RunTrackerScreen}
        options={{ title: t('nav.run'), tabBarLabel: t('nav.run') }}
      />
      <Tab.Screen
        name="Creator"
        component={CreatorStack}
        options={{ headerShown: false, tabBarLabel: t('nav.creator') }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: t('nav.notifications'),
          tabBarLabel: t('nav.notifications'),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t('nav.profile'), tabBarLabel: t('nav.profile') }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? <Stack.Screen name="App" component={AppTabs} /> : <Stack.Screen name="Login" component={LoginScreen} />}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default RootNavigator;
