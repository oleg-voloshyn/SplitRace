import { useTranslation } from 'react-i18next'

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'uk', label: 'УК' },
  { code: 'de', label: 'DE' },
  { code: 'fr', label: 'FR' },
  { code: 'es', label: 'ES' },
  { code: 'it', label: 'IT' },
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const current = i18n.language?.split('-')[0] || 'en'

  return (
    <select
      value={current}
      onChange={e => i18n.changeLanguage(e.target.value)}
      className="sr-lang-switch"
      aria-label="Language"
    >
      {LANGS.map(l => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </select>
  )
}
