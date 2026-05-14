import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import uk from './locales/uk.json';

const SUPPORTED_LANGS = [
  { code: 'en', label: 'English' },
  { code: 'uk', label: 'Українська' }
];

const STORAGE_KEY = 'splitrace_lang';

function detectInitial() {
  // Default to device language; we'll override with stored value async.
  const device = Localization.getLocales()?.[0]?.languageCode || 'en';
  return SUPPORTED_LANGS.some((l) => l.code === device) ? device : 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    uk: { translation: uk }
  },
  lng: detectInitial(),
  fallbackLng: 'en',
  compatibilityJSON: 'v4',
  interpolation: { escapeValue: false }
});

// Load saved language asynchronously
AsyncStorage.getItem(STORAGE_KEY)
  .then((saved) => {
    if (saved && SUPPORTED_LANGS.some((l) => l.code === saved) && saved !== i18n.language) {
      i18n.changeLanguage(saved);
    }
  })
  .catch(() => {
    // Language persistence is best effort.
  });

i18n.on('languageChanged', (lng) => {
  AsyncStorage.setItem(STORAGE_KEY, lng).catch(() => {
    // Language persistence is best effort.
  });
});

export { SUPPORTED_LANGS };
export default i18n;
