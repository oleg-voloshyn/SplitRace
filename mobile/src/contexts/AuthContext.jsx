import { createContext, useContext, useEffect, useState } from 'react';
import { api, tokenStore } from '../api/client';
import { registerForPushNotificationsAsync, unregisterPushNotificationsAsync } from '../services/pushNotifications';

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then((user) => {
        setUser(user);
        registerForPushNotificationsAsync().catch(() => {});
      })
      .catch(() => tokenStore.delete())
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { token, user } = await api.login(email, password);
    await tokenStore.set(token);
    setUser(user);
    registerForPushNotificationsAsync().catch(() => {});
  }

  async function loginWithGoogle(idToken) {
    const { token, user } = await api.googleLogin(idToken);
    await tokenStore.set(token);
    setUser(user);
    registerForPushNotificationsAsync().catch(() => {});
  }

  async function loginWithApple(identityToken, firstName, lastName) {
    const { token, user } = await api.appleLogin(identityToken, firstName, lastName);
    await tokenStore.set(token);
    setUser(user);
    registerForPushNotificationsAsync().catch(() => {});
  }

  async function register(params) {
    const { token, user } = await api.register(params);
    await tokenStore.set(token);
    setUser(user);
    registerForPushNotificationsAsync().catch(() => {});
  }

  async function logout() {
    await unregisterPushNotificationsAsync().catch(() => {});
    await tokenStore.delete();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, loginWithApple, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

const useAuth = () => useContext(AuthContext);

export { AuthProvider, useAuth };
