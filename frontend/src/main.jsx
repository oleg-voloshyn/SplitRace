import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import de from './locales/de.json'
import fr from './locales/fr.json'
import es from './locales/es.json'
import it from './locales/it.json'
import './index.css'
import App from './App.jsx'

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, de: { translation: de }, fr: { translation: fr }, es: { translation: es }, it: { translation: it } },
  lng: navigator.language.split('-')[0] || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
