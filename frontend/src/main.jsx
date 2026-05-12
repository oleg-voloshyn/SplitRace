import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import uk from './locales/uk.json'
import de from './locales/de.json'
import fr from './locales/fr.json'
import es from './locales/es.json'
import it from './locales/it.json'
import './index.css'
import App from './App.jsx'

const SUPPORTED  = ['en', 'uk', 'de', 'fr', 'es', 'it']
const savedLang  = localStorage.getItem('splitrace_lang')
const browserLng = (navigator.language || 'en').split('-')[0]
const initialLng = SUPPORTED.includes(savedLang)
  ? savedLang
  : (SUPPORTED.includes(browserLng) ? browserLng : 'en')

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    uk: { translation: uk },
    de: { translation: de },
    fr: { translation: fr },
    es: { translation: es },
    it: { translation: it },
  },
  lng:          initialLng,
  fallbackLng:  'en',
  interpolation:{ escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('splitrace_lang', lng)
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
