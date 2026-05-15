import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import LoginScreen from '../../screens/LoginScreen';

const mockLogin = jest.fn();
const mockLoginWithGoogle = jest.fn();
const mockRegister = jest.fn();
const mockPromptGoogleAsync = jest.fn();
let mockGoogleResponse = null;

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    loginWithGoogle: mockLoginWithGoogle,
    register: mockRegister
  })
}));

jest.mock('expo-auth-session/providers/google', () => ({
  useIdTokenAuthRequest: () => [{}, mockGoogleResponse, mockPromptGoogleAsync]
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      googleOAuth: {
        expoClientId: 'expo-google-client'
      }
    }
  }
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn()
}));

function renderLogin() {
  return render(<LoginScreen />);
}

beforeEach(() => {
  mockLogin.mockReset();
  mockLoginWithGoogle.mockReset();
  mockRegister.mockReset();
  mockPromptGoogleAsync.mockReset();
  mockGoogleResponse = null;
});

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

  it('shows Google sign-in for runners', () => {
    renderLogin();
    expect(screen.getByText('Continue with Google')).toBeTruthy();
  });

  it('starts Google auth prompt', async () => {
    mockPromptGoogleAsync.mockResolvedValueOnce({ type: 'cancel' });
    renderLogin();
    fireEvent.press(screen.getByText('Continue with Google'));

    await waitFor(() => {
      expect(mockPromptGoogleAsync).toHaveBeenCalled();
    });
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
    renderLogin();
    fireEvent.press(screen.getByText('Register'));
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'a@b.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'pw');
    fireEvent.press(screen.getByText('Create Account'));
    await waitFor(() => {
      expect(screen.getByText('Please select gender')).toBeTruthy();
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('hides runner-only fields for club registration', () => {
    renderLogin();
    fireEvent.press(screen.getByText('Register'));
    fireEvent.press(screen.getByText('Running club'));

    expect(screen.getByPlaceholderText('Club name')).toBeTruthy();
    expect(screen.queryByPlaceholderText('First name')).toBeNull();
    expect(screen.queryByPlaceholderText('Last name')).toBeNull();
    expect(screen.queryByText('Gender')).toBeNull();
    expect(screen.queryByText('Male')).toBeNull();
    expect(screen.queryByText('Female')).toBeNull();
    expect(screen.queryByText('Other')).toBeNull();
    expect(screen.queryByText('Continue with Google')).toBeNull();
  });

  it('registers a club without gender or runner profile fields', async () => {
    mockRegister.mockResolvedValueOnce({ token: 'tok', user: { id: 1, account_type: 'club' } });
    renderLogin();
    fireEvent.press(screen.getByText('Register'));
    fireEvent.press(screen.getByText('Running club'));
    fireEvent.changeText(screen.getByPlaceholderText('Club name'), 'Mobile Club');
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'club@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret');
    fireEvent.press(screen.getByText('Create Account'));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        account_type: 'club',
        club_name: 'Mobile Club',
        email: 'club@test.com',
        password: 'secret'
      });
    });
  });
});

describe('LoginScreen — login submit', () => {
  it('calls login with email and password', async () => {
    mockLogin.mockResolvedValueOnce({ token: 'tok', user: { id: 1 } });
    renderLogin();
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'user@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret');
    fireEvent.press(screen.getAllByText('Sign In')[1]);
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@test.com', 'secret');
    });
  });

  it('shows error message on failed login', async () => {
    mockLogin.mockRejectedValueOnce({ errors: ['Invalid email or password'] });
    renderLogin();
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'bad@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'wrong');
    fireEvent.press(screen.getAllByText('Sign In')[1]);
    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeTruthy();
    });
  });

  it('trims whitespace from email', async () => {
    mockLogin.mockResolvedValueOnce({ token: 'tok', user: { id: 1 } });
    renderLogin();
    fireEvent.changeText(screen.getByPlaceholderText('Email'), '  user@test.com  ');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'pw');
    fireEvent.press(screen.getAllByText('Sign In')[1]);
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@test.com', 'pw');
    });
  });
});
