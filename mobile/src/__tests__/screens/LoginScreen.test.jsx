import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AuthProvider } from '../../contexts/AuthContext';
import LoginScreen from '../../screens/LoginScreen';

jest.mock('../../api/client', () => ({
  api: {
    me: jest.fn().mockRejectedValue(new Error('')),
    login: jest.fn(),
    register: jest.fn()
  },
  tokenStore: {
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('../../services/pushNotifications', () => ({
  registerForPushNotificationsAsync: jest.fn().mockResolvedValue(null),
  unregisterPushNotificationsAsync: jest.fn().mockResolvedValue(undefined)
}));

function renderLogin() {
  return render(
    <AuthProvider>
      <LoginScreen />
    </AuthProvider>
  );
}

describe('LoginScreen — render', () => {
  it('shows SplitRace logo', () => {
    renderLogin();
    expect(screen.getByText('SplitRace')).toBeTruthy();
  });

  it('shows Sign In tab by default', () => {
    renderLogin();
    expect(screen.getAllByText('Sign In').length).toBeGreaterThanOrEqual(1);
  });

  it('shows email and password inputs', () => {
    renderLogin();
    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Password')).toBeTruthy();
  });

  it('shows language switcher', () => {
    renderLogin();
    expect(screen.getByText('EN')).toBeTruthy();
    expect(screen.getByText('UK')).toBeTruthy();
  });
});

describe('LoginScreen — register tab', () => {
  it('shows register fields after switching tab', () => {
    renderLogin();
    fireEvent.press(screen.getByText('Register'));
    expect(screen.getByPlaceholderText('First name')).toBeTruthy();
    expect(screen.getByPlaceholderText('Last name')).toBeTruthy();
  });

  it('shows gender selection on register', () => {
    renderLogin();
    fireEvent.press(screen.getByText('Register'));
    expect(screen.getByText('Male')).toBeTruthy();
    expect(screen.getByText('Female')).toBeTruthy();
    expect(screen.getByText('Other')).toBeTruthy();
  });

  it('shows error when submitting without gender', async () => {
    const { api } = require('../../api/client');
    renderLogin();
    fireEvent.press(screen.getByText('Register'));
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'a@b.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'pw');
    fireEvent.press(screen.getByText('Create Account'));
    await waitFor(() => {
      expect(screen.getByText('Please select gender')).toBeTruthy();
    });
    expect(api.register).not.toHaveBeenCalled();
  });
});

describe('LoginScreen — login submit', () => {
  it('calls login with email and password', async () => {
    const { api } = require('../../api/client');
    api.login.mockResolvedValueOnce({ token: 'tok', user: { id: 1 } });
    renderLogin();
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'user@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret');
    fireEvent.press(screen.getAllByText('Sign In')[1]);
    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith('user@test.com', 'secret');
    });
  });

  it('shows error message on failed login', async () => {
    const { api } = require('../../api/client');
    api.login.mockRejectedValueOnce({ errors: ['Invalid email or password'] });
    renderLogin();
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'bad@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'wrong');
    fireEvent.press(screen.getAllByText('Sign In')[1]);
    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeTruthy();
    });
  });

  it('trims whitespace from email', async () => {
    const { api } = require('../../api/client');
    api.login.mockResolvedValueOnce({ token: 'tok', user: { id: 1 } });
    renderLogin();
    fireEvent.changeText(screen.getByPlaceholderText('Email'), '  user@test.com  ');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'pw');
    fireEvent.press(screen.getAllByText('Sign In')[1]);
    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith('user@test.com', 'pw');
    });
  });
});
