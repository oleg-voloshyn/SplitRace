import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthCallback from './pages/AuthCallback';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Tournament from './pages/Tournament';
import Tournaments from './pages/Tournaments';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }
  return user ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return null;
  }
  return user ? <Navigate to="/tournaments" replace /> : <Landing />;
}

function AppRoutes() {
  const { pathname } = useLocation();
  const isLanding = pathname === '/';

  return (
    <>
      {!isLanding && <Navbar />}
      {isLanding ? (
        <Routes>
          <Route path="/" element={<RootRoute />} />
        </Routes>
      ) : (
        <main className="sr-page-wrap">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/oauth/callback" element={<AuthCallback />} />
            <Route
              path="/tournaments"
              element={
                <ProtectedRoute>
                  <Tournaments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tournaments/:slug"
              element={
                <ProtectedRoute>
                  <Tournament />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      )}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
