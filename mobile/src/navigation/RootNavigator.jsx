import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import LoginScreen       from '../screens/LoginScreen'
import TournamentsScreen from '../screens/TournamentsScreen'
import TournamentScreen  from '../screens/TournamentScreen'
import RunTrackerScreen  from '../screens/RunTrackerScreen'
import ProfileScreen     from '../screens/ProfileScreen'

const Stack = createNativeStackNavigator()
const Tab   = createBottomTabNavigator()

function TournamentsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#1a1a2e' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '700' } }}>
      <Stack.Screen name="TournamentsList" component={TournamentsScreen} options={{ title: 'Tournaments' }} />
      <Stack.Screen name="Tournament"      component={TournamentScreen}  options={({ route }) => ({ title: route.params?.slug || 'Tournament' })} />
    </Stack.Navigator>
  )
}

function TabIcon({ name, focused }) {
  const icons = { Tournaments: '🏆', Run: '▶', Profile: '👤' }
  return <Text style={{ fontSize: focused ? 22 : 18 }}>{icons[name]}</Text>
}

function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#e53935',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#eee' },
        headerStyle: { backgroundColor: '#1a1a2e' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      })}
    >
      <Tab.Screen name="Tournaments" component={TournamentsStack} options={{ headerShown: false }} />
      <Tab.Screen name="Run"         component={RunTrackerScreen} options={{ title: 'Run', tabBarLabel: 'Run' }} />
      <Tab.Screen name="Profile"     component={ProfileScreen} />
    </Tab.Navigator>
  )
}

export default function RootNavigator() {
  const { user, loading } = useAuth()
  if (loading) return null

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="App" component={AppTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
