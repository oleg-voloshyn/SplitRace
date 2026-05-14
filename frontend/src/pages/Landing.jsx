import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import LanguageSwitcher from '../components/LanguageSwitcher';

// Latest Android APK — update on each EAS build
const ANDROID_APK_URL = 'https://expo.dev/artifacts/eas/sK8v3JbKbgsxPmHnzHX5tL.apk';

function Landing() {
  const { t } = useTranslation();

  return (
    <div className="sr-landing">
      {/* Header */}
      <header className="sr-landing-header">
        <div className="sr-landing-brand">SplitRace</div>
        <div className="sr-landing-actions">
          <LanguageSwitcher />
          <Link to="/login" className="sr-landing-signin">
            {t('landing.signIn')}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="sr-hero">
        <h1 className="sr-hero-title">{t('landing.heroTitle')}</h1>
        <p className="sr-hero-subtitle">{t('landing.heroSubtitle')}</p>
        <div className="sr-hero-buttons">
          <Link to="/login" className="sr-hero-cta">
            {t('landing.getStarted')} →
          </Link>
          <a href={ANDROID_APK_URL} className="sr-hero-cta-alt" target="_blank" rel="noopener noreferrer">
            <span style={{ fontSize: '1.1rem' }}>⬇</span> {t('landing.downloadAndroid')}
          </a>
        </div>
        <p className="sr-hero-note">{t('landing.heroNote')}</p>
      </section>

      {/* Features */}
      <section className="sr-features">
        <Feature icon="🏆" title={t('landing.f1Title')} text={t('landing.f1Text')} />
        <Feature icon="📍" title={t('landing.f2Title')} text={t('landing.f2Text')} />
        <Feature icon="▶" title={t('landing.f3Title')} text={t('landing.f3Text')} />
      </section>

      {/* How it works */}
      <section className="sr-how">
        <h2 className="sr-section-title">{t('landing.howTitle')}</h2>
        <div className="sr-steps">
          <Step n="1" title={t('landing.step1Title')} text={t('landing.step1Text')} />
          <Step n="2" title={t('landing.step2Title')} text={t('landing.step2Text')} />
          <Step n="3" title={t('landing.step3Title')} text={t('landing.step3Text')} />
        </div>
      </section>

      {/* Final CTA */}
      <section className="sr-cta-final">
        <h2 className="sr-section-title">{t('landing.ctaTitle')}</h2>
        <Link to="/login" className="sr-hero-cta">
          {t('landing.getStarted')} →
        </Link>
      </section>

      <footer className="sr-landing-footer">
        <span>© {new Date().getFullYear()} SplitRace</span>
      </footer>
    </div>
  );
}

function Feature({ icon, title, text }) {
  return (
    <div className="sr-feature">
      <div className="sr-feature-icon">{icon}</div>
      <h3 className="sr-feature-title">{title}</h3>
      <p className="sr-feature-text">{text}</p>
    </div>
  );
}

function Step({ n, title, text }) {
  return (
    <div className="sr-step">
      <div className="sr-step-num">{n}</div>
      <div>
        <h3 className="sr-step-title">{title}</h3>
        <p className="sr-step-text">{text}</p>
      </div>
    </div>
  );
}

export default Landing;
