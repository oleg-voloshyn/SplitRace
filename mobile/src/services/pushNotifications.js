import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { api } from '../api/client';

const PUSH_TOKEN_KEY = 'expo_push_token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
});

async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'SplitRace',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#ff454d'
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  await api.registerPushToken({ token, platform: Platform.OS });
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);

  return token;
}

async function unregisterPushNotificationsAsync() {
  const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  if (!token) {
    return;
  }

  try {
    await api.unregisterPushToken(token);
  } finally {
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  }
}

export { registerForPushNotificationsAsync, unregisterPushNotificationsAsync };
