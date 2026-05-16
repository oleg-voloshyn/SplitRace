import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import logoWordmark from '../assets/logo-wordmark.png';
import { useAuth } from '../contexts/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';

function Navbar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      return;
    }

    api
      .notifications()
      .then((data) => setUnreadCount(data.unread_count || 0))
      .catch(() => setUnreadCount(0));
  }, [user]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <>
      {/* ── top bar ───────────────────────────────────────────────── */}
      <nav className="sr-topbar">
        <Link to="/" className="sr-brand" aria-label="SplitRace">
          <img src={logoWordmark} alt="SplitRace" className="sr-logo-image" />
        </Link>

        {user && (
          <>
            {/* desktop links */}
            <div className="sr-desktop-links">
              <NavLink to="/tournaments" className={({ isActive }) => (isActive ? 'sr-link active' : 'sr-link')}>
                {t('nav.tournaments')}
              </NavLink>
              <NavLink to="/profile" className={({ isActive }) => (isActive ? 'sr-link active' : 'sr-link')}>
                {t('nav.profile')}
              </NavLink>
              <NavLink to="/creator" className={({ isActive }) => (isActive ? 'sr-link active' : 'sr-link')}>
                {t('nav.creator')}
              </NavLink>
              <NavLink
                to="/notifications"
                className={({ isActive }) => (isActive ? 'sr-bell active' : 'sr-bell')}
                aria-label={t('nav.notifications')}
              >
                <span>🔔</span>
                {unreadCount > 0 && <span className="sr-bell-badge">{unreadCount}</span>}
              </NavLink>
              <LanguageSwitcher />
              <button onClick={handleLogout} className="sr-logout">
                {t('nav.logout')}
              </button>
            </div>
            {/* mobile: language + logout in top bar */}
            <div className="sr-mobile-actions">
              <LanguageSwitcher />
              <button onClick={handleLogout} className="sr-mobile-logout">
                {t('nav.logout')}
              </button>
            </div>
          </>
        )}
        {!user && (
          <Link to="/login" className="sr-link sr-login-link">
            {t('nav.login')}
          </Link>
        )}
      </nav>

      {/* ── mobile bottom tabs (only when logged in) ──────────────── */}
      {user && (
        <nav className="sr-bottomnav">
          <NavLink to="/tournaments" className={({ isActive }) => (isActive ? 'sr-tab active' : 'sr-tab')}>
            <span className="sr-tab-icon">🏆</span>
            <span className="sr-tab-label">{t('nav.tournaments')}</span>
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => (isActive ? 'sr-tab active' : 'sr-tab')}>
            <span className="sr-tab-icon">👤</span>
            <span className="sr-tab-label">{t('nav.profile')}</span>
          </NavLink>
          <NavLink to="/creator" className={({ isActive }) => (isActive ? 'sr-tab active' : 'sr-tab')}>
            <span className="sr-tab-icon">＋</span>
            <span className="sr-tab-label">{t('nav.creator')}</span>
          </NavLink>
          <NavLink to="/notifications" className={({ isActive }) => (isActive ? 'sr-tab active' : 'sr-tab')}>
            <span className="sr-tab-icon sr-tab-bell">
              🔔
              {unreadCount > 0 && <span className="sr-tab-badge">{unreadCount}</span>}
            </span>
            <span className="sr-tab-label">{t('nav.notifications')}</span>
          </NavLink>
        </nav>
      )}
    </>
  );
}

export default Navbar;
