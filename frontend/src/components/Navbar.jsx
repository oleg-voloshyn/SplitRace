import { useTranslation } from 'react-i18next';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';

function Navbar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <>
      {/* ── top bar ───────────────────────────────────────────────── */}
      <nav className="sr-topbar">
        <Link to="/" className="sr-brand">
          SplitRace
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
          <Link to="/login" className="sr-link" style={{ marginLeft: 'auto' }}>
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
        </nav>
      )}
    </>
  );
}

export default Navbar;
