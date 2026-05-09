import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'

export default function Navbar() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <nav style={{ background: '#1a1a2e', color: '#fff', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
      <Link to="/" style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.2rem', textDecoration: 'none' }}>
        SplitRace
      </Link>
      {user && (
        <>
          <Link to="/tournaments" style={{ color: '#ccc', textDecoration: 'none' }}>{t('nav.tournaments')}</Link>
          <Link to="/run"         style={{ color: '#ccc', textDecoration: 'none' }}>{t('nav.run')}</Link>
          <Link to="/profile"     style={{ color: '#ccc', textDecoration: 'none', marginLeft: 'auto' }}>{t('nav.profile')}</Link>
          <button onClick={handleLogout} style={{ background: 'transparent', color: '#ccc', border: '1px solid #666', borderRadius: '4px', padding: '0.25rem 0.75rem', cursor: 'pointer' }}>
            {t('nav.logout')}
          </button>
        </>
      )}
      {!user && (
        <Link to="/login" style={{ color: '#ccc', textDecoration: 'none', marginLeft: 'auto' }}>{t('nav.login')}</Link>
      )}
    </nav>
  )
}
