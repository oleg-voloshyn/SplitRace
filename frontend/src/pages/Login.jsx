import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Login() {
  const { t } = useTranslation();
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const returnTo = location.state?.from || '/tournaments';
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const initialAccountType = searchParams.get('type') === 'club' ? 'club' : 'user';
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    gender: '',
    account_type: initialAccountType,
    club_name: ''
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form);
      }
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err.errors?.join(', ') || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{ maxWidth: '400px', margin: '4rem auto', padding: '2rem', border: '1px solid #ddd', borderRadius: '8px' }}
    >
      <h2>{t(`auth.${mode}`)}</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {mode === 'register' && (
          <>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {['user', 'club'].map((type) => (
                <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <input
                    type="radio"
                    name="account_type"
                    value={type}
                    checked={form.account_type === type}
                    onChange={() => setForm({ ...form, account_type: type })}
                  />
                  {t(`auth.account_${type}`)}
                </label>
              ))}
            </div>
            {form.account_type === 'club' && (
              <input
                placeholder={t('auth.clubName')}
                value={form.club_name}
                onChange={(e) => setForm({ ...form, club_name: e.target.value })}
                required
                style={inputStyle}
              />
            )}
            <input
              placeholder={t('auth.firstName')}
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder={t('auth.lastName')}
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              style={inputStyle}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#555' }}>{t('auth.gender')} *</span>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                {['male', 'female'].map((g) => (
                  <label key={g} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="gender"
                      value={g}
                      checked={form.gender === g}
                      onChange={() => setForm({ ...form, gender: g })}
                      required
                    />
                    {t(`auth.gender_${g}`)}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
        <input
          type="email"
          placeholder={t('auth.email')}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder={t('auth.password')}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          style={inputStyle}
        />
        <button type="submit" disabled={loading} style={btnStyle}>
          {loading ? '...' : t(`auth.${mode}`)}
        </button>
      </form>

      <div style={{ marginTop: '1rem', textAlign: 'center' }}>
        <p style={{ color: '#666', marginBottom: '0.5rem' }}>{t('auth.orContinueWith')}</p>
        <a
          href="/auth/google_oauth2"
          style={{ ...btnStyle, display: 'inline-block', background: '#4285f4', textDecoration: 'none', color: '#fff' }}
        >
          Google
        </a>{' '}
        <a
          href="/auth/apple"
          style={{ ...btnStyle, display: 'inline-block', background: '#000', textDecoration: 'none', color: '#fff' }}
        >
          Apple
        </a>{' '}
        <a
          href="/auth/strava"
          style={{ ...btnStyle, display: 'inline-block', background: '#fc4c02', textDecoration: 'none', color: '#fff' }}
        >
          Strava
        </a>
      </div>

      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}{' '}
        <button
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          style={{ background: 'none', border: 'none', color: '#4285f4', cursor: 'pointer' }}
        >
          {mode === 'login' ? t('auth.register') : t('auth.login')}
        </button>
      </p>
    </div>
  );
}

const inputStyle = { padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '1rem' };
const btnStyle = {
  padding: '0.6rem 1.2rem',
  background: '#1a1a2e',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '1rem'
};

export default Login;
