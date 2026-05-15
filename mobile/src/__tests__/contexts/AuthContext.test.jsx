import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { api, tokenStore } from '../../api/client';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

jest.mock('../../api/client', () => ({
  api: {
    me: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
  },
  tokenStore: {
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../services/pushNotifications', () => ({
  registerForPushNotificationsAsync: jest.fn().mockResolvedValue(null),
  unregisterPushNotificationsAsync: jest.fn().mockResolvedValue(undefined),
}));

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

describe('AuthContext — initial load', () => {
  it('sets user when me() resolves', async () => {
    api.me.mockResolvedValueOnce({ id: 1, email: 'a@b.com' });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual({ id: 1, email: 'a@b.com' });
  });

  it('starts with loading true', () => {
    api.me.mockResolvedValueOnce({ id: 1 });
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(true);
  });

  it('leaves user null and deletes token when me() fails', async () => {
    api.me.mockRejectedValueOnce(new Error('Unauthorized'));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(tokenStore.delete).toHaveBeenCalled();
  });
});

describe('AuthContext — login', () => {
  beforeEach(() => {
    api.me.mockRejectedValueOnce(new Error(''));
  });

  it('sets user after successful login', async () => {
    api.login.mockResolvedValueOnce({ token: 'tok', user: { id: 2 } });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login('a@b.com', 'pass');
    });

    expect(result.current.user).toEqual({ id: 2 });
    expect(tokenStore.set).toHaveBeenCalledWith('tok');
  });

  it('throws when login API fails', async () => {
    api.login.mockRejectedValueOnce({ errors: ['Bad credentials'] });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.login('x@y.com', 'wrong')).rejects.toEqual({
      errors: ['Bad credentials'],
    });
  });
});

describe('AuthContext — register', () => {
  beforeEach(() => {
    api.me.mockRejectedValueOnce(new Error(''));
  });

  it('sets user after successful register', async () => {
    api.register.mockResolvedValueOnce({ token: 'tok2', user: { id: 3 } });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.register({ email: 'new@x.com', password: 'pw' });
    });

    expect(result.current.user).toEqual({ id: 3 });
    expect(tokenStore.set).toHaveBeenCalledWith('tok2');
  });
});

describe('AuthContext — logout', () => {
  it('clears user and deletes token', async () => {
    api.me.mockResolvedValueOnce({ id: 1 });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual({ id: 1 }));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(tokenStore.delete).toHaveBeenCalled();
  });
});
