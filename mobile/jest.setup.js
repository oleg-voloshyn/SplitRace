// Silence noisy native warnings in tests
jest.mock('expo-location', () => ({
  getLastKnownPositionAsync: jest.fn().mockResolvedValue(null),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 50.45, longitude: 30.52, accuracy: 20 },
    timestamp: Date.now()
  }),
  watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  startLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
  stopLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
  Accuracy: { BestForNavigation: 6, High: 5 }
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn()
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
  AndroidImportance: { MAX: 5 }
}));

jest.mock('expo-device', () => ({
  isDevice: true
}));

jest.mock('expo-constants', () => ({
  default: {
    easConfig: { projectId: 'test-project-id' },
    expoConfig: { extra: { eas: { projectId: 'test-project-id' } } }
  },
  easConfig: { projectId: 'test-project-id' }
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-localization', () => ({
  getLocales: jest.fn().mockReturnValue([{ languageCode: 'en' }])
}));

global.fetch = jest.fn();
