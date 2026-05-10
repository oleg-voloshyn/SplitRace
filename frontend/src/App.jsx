import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Tournaments from './pages/Tournaments'
import Tournament from './pages/Tournament'
import Profile from './pages/Profile'
import AuthCallback from './pages/AuthCallback'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <main className="sr-page-wrap">
        <Routes>
          <Route path="/login"             element={<Login />} />
          <Route path="/oauth/callback"    element={<AuthCallback />} />
          <Route path="/tournaments"       element={<ProtectedRoute><Tournaments /></ProtectedRoute>} />
          <Route path="/tournaments/:slug" element={<ProtectedRoute><Tournament /></ProtectedRoute>} />
          <Route path="/profile"           element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/"                  element={<Navigate to="/tournaments" replace />} />
          <Route path="*"                  element={<Navigate to="/tournaments" replace />} />
        </Routes>
      </main>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
