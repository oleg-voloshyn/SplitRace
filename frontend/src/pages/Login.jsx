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
  const isRegister = mode === 'register';
  const isClubRegistration = isRegister && form.account_type === 'club';

  function updateAccountType(accountType) {
    setForm((current) => ({
      ...current,
      account_type: accountType,
      club_name: accountType === 'club' ? current.club_name : '',
      first_name: accountType === 'user' ? current.first_name : '',
      last_name: accountType === 'user' ? current.last_name : '',
      gender: accountType === 'user' ? current.gender : ''
    }));
  }

  function registrationPayload() {
    if (form.account_type === 'club') {
      return {
        account_type: 'club',
        club_name: form.club_name.trim(),
        email: form.email.trim(),
        password: form.password
      };
    }

    return {
      account_type: 'user',
      first_name: form.first_name,
      last_name: form.last_name,
      gender: form.gender,
      email: form.email.trim(),
      password: form.password
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(registrationPayload());
      }
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err.errors?.join(', ') || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sr-card sr-auth-card">
      <h2>{t(`auth.${mode}`)}</h2>
      {error && <p className="sr-alert sr-alert-error">{error}</p>}
      <form onSubmit={handleSubmit} className="sr-form">
        {isRegister && (
          <>
            <div className="sr-radio-row">
              {['user', 'club'].map((type) => (
                <label key={type} className="sr-radio-label">
                  <input
                    type="radio"
                    name="account_type"
                    value={type}
                    checked={form.account_type === type}
                    onChange={() => updateAccountType(type)}
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
                className="sr-input"
              />
            )}
            {form.account_type === 'user' && (
              <>
                <input
                  placeholder={t('auth.firstName')}
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  className="sr-input"
                />
                <input
                  placeholder={t('auth.lastName')}
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  className="sr-input"
                />
                <div className="sr-form-field">
                  <span className="sr-label">{t('auth.gender')} *</span>
                  <div className="sr-radio-row">
                    {['male', 'female', 'other'].map((g) => (
                      <label key={g} className="sr-radio-label">
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
          </>
        )}
        <input
          type="email"
          placeholder={t('auth.email')}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          className="sr-input"
        />
        <input
          type="password"
          placeholder={t('auth.password')}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          className="sr-input"
        />
        <button type="submit" disabled={loading} className="sr-btn sr-btn-primary sr-btn-block">
          {loading ? '...' : t(`auth.${mode}`)}
        </button>
      </form>

      {!isClubRegistration && (
        <div className="sr-oauth-block">
          <div className="sr-divider">
            <span />
            <span>{t('auth.orContinueWith')}</span>
            <span />
          </div>
          <div className="sr-provider-grid">
            <a href="/auth/google_oauth2" className="sr-provider-btn sr-provider-google">
              Google
            </a>
            <a href="/auth/apple" className="sr-provider-btn sr-provider-apple">
              Apple
            </a>
          </div>
        </div>
      )}

      <p className="sr-auth-switch">
        {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}{' '}
        <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? t('auth.register') : t('auth.login')}
        </button>
      </p>
    </div>
  );
}

export default Login;
