/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, setToken, clearToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('splitrace_token')))

  useEffect(() => {
    const token = localStorage.getItem('splitrace_token')
    if (!token) return

    api.me()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await api.login({ email, password })
    setToken(data.token)
    setUser(data.user)
    return data
  }, [])

  const register = useCallback(async (params) => {
    const data = await api.register(params)
    setToken(data.token)
    setUser(data.user)
    return data
  }, [])

  const loginWithToken = useCallback((token) => {
    setToken(token)
    return api.me().then(setUser)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, loginWithToken, logout }),
    [user, loading, login, register, loginWithToken, logout],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
