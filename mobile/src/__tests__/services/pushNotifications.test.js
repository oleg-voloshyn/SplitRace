import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { api } from '../../api/client';

jest.mock('../../api/client', () => ({
  api: {
    registerPushToken: jest.fn().mockResolvedValue({}),
    unregisterPushToken: jest.fn().mockResolvedValue({}),
  },
}));

describe('registerForPushNotificationsAsync', () => {
  it('returns null when not a physical device', async () => {
    jest.resetModules();
    jest.mock('expo-device', () => ({ isDevice: false }));
    jest.mock('expo-notifications', () => ({
      setNotificationHandler: jest.fn(),
      AndroidImportance: { MAX: 5 },
    }));
    jest.mock('../../api/client', () => ({
      api: { registerPushToken: jest.fn() },
    }));

    const { registerForPushNotificationsAsync } = require('../../services/pushNotifications');
    const result = await registerForPushNotificationsAsync();
    expect(result).toBeNull();
  });

  it('returns null when permission is denied', async () => {
    jest.resetModules();
    jest.mock('expo-device', () => ({ isDevice: true }));
    jest.mock('expo-notifications', () => ({
      setNotificationHandler: jest.fn(),
      getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
      requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
      setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
      AndroidImportance: { MAX: 5 },
    }));
    jest.mock('expo-secure-store', () => ({
      getItemAsync: jest.fn().mockResolvedValue(null),
      setItemAsync: jest.fn().mockResolvedValue(undefined),
    }));
    jest.mock('expo-constants', () => ({
      default: { easConfig: { projectId: 'pid' } },
    }));
    jest.mock('../../api/client', () => ({
      api: { registerPushToken: jest.fn() },
    }));

    const { registerForPushNotificationsAsync } = require('../../services/pushNotifications');
    const result = await registerForPushNotificationsAsync();
    expect(result).toBeNull();
  });

  it('requests permissions when not yet granted', async () => {
    jest.resetModules();
    const mockRequestPermissions = jest.fn().mockResolvedValue({ status: 'granted' });
    jest.mock('expo-device', () => ({ isDevice: true }));
    jest.mock('expo-notifications', () => ({
      setNotificationHandler: jest.fn(),
      getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'undetermined' }),
      requestPermissionsAsync: mockRequestPermissions,
      getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[abc]' }),
      setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
      AndroidImportance: { MAX: 5 },
    }));
    jest.mock('expo-secure-store', () => ({
      setItemAsync: jest.fn().mockResolvedValue(undefined),
    }));
    jest.mock('expo-constants', () => ({
      default: { easConfig: { projectId: 'pid' } },
    }));
    jest.mock('../../api/client', () => ({
      api: { registerPushToken: jest.fn().mockResolvedValue({}) },
    }));

    const { registerForPushNotificationsAsync } = require('../../services/pushNotifications');
    await registerForPushNotificationsAsync();
    expect(mockRequestPermissions).toHaveBeenCalled();
  });
});

describe('unregisterPushNotificationsAsync', () => {
  it('does nothing when no token stored', async () => {
    jest.resetModules();
    jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn() }));
    jest.mock('expo-secure-store', () => ({
      getItemAsync: jest.fn().mockResolvedValue(null),
      deleteItemAsync: jest.fn().mockResolvedValue(undefined),
    }));
    jest.mock('../../api/client', () => ({
      api: { unregisterPushToken: jest.fn() },
    }));

    const { unregisterPushNotificationsAsync } = require('../../services/pushNotifications');
    await unregisterPushNotificationsAsync();

    const { api: mockApi } = require('../../api/client');
    expect(mockApi.unregisterPushToken).not.toHaveBeenCalled();
  });

  it('calls API and deletes stored token', async () => {
    jest.resetModules();
    const mockDeleteItem = jest.fn().mockResolvedValue(undefined);
    const mockUnregister = jest.fn().mockResolvedValue({});
    jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn() }));
    jest.mock('expo-secure-store', () => ({
      getItemAsync: jest.fn().mockResolvedValue('ExponentPushToken[xyz]'),
      deleteItemAsync: mockDeleteItem,
    }));
    jest.mock('../../api/client', () => ({
      api: { unregisterPushToken: mockUnregister },
    }));

    const { unregisterPushNotificationsAsync } = require('../../services/pushNotifications');
    await unregisterPushNotificationsAsync();

    expect(mockUnregister).toHaveBeenCalledWith('ExponentPushToken[xyz]');
    expect(mockDeleteItem).toHaveBeenCalled();
  });
});
