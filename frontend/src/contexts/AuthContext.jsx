import { createContext, useContext, useState, useEffect } from 'react'
import { api, setToken, clearToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('splitrace_token')
    if (token) {
      api.me()
        .then(setUser)
        .catch(() => clearToken())
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  async function login(email, password) {
    const data = await api.login({ email, password })
    setToken(data.token)
    setUser(data.user)
    return data
  }

  async function register(params) {
    const data = await api.register(params)
    setToken(data.token)
    setUser(data.user)
    return data
  }

  function loginWithToken(token) {
    setToken(token)
    return api.me().then(setUser)
  }

  function logout() {
    clearToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
