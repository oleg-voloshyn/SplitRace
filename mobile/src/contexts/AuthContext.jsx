import { createContext, useContext, useEffect, useState } from 'react';
import { api, tokenStore } from '../api/client';

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => tokenStore.delete())
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { token, user } = await api.login(email, password);
    await tokenStore.set(token);
    setUser(user);
  }

  async function register(params) {
    const { token, user } = await api.register(params);
    await tokenStore.set(token);
    setUser(user);
  }

  async function logout() {
    await tokenStore.delete();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>{children}</AuthContext.Provider>
  );
}

const useAuth = () => useContext(AuthContext);

export { AuthProvider, useAuth };
