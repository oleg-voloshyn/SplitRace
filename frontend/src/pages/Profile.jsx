import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/client'

export default function Profile() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const [form, setForm]   = useState({ first_name: user?.first_name || '', last_name: user?.last_name || '', units: user?.units || 'km' })
  const [saved, setSaved] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    await api.updateMe(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ maxWidth: '400px' }}>
      <h2>{t('profile.title')}</h2>
      <p style={{ color: '#888' }}>{user?.email}</p>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
        <input placeholder="First Name" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} style={inputStyle} />
        <input placeholder="Last Name"  value={form.last_name}  onChange={e => setForm({ ...form, last_name:  e.target.value })} style={inputStyle} />
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {t('profile.units')}:
          <select value={form.units} onChange={e => setForm({ ...form, units: e.target.value })} style={inputStyle}>
            <option value="km">{t('profile.km')}</option>
            <option value="miles">{t('profile.miles')}</option>
          </select>
        </label>
        <button type="submit" style={{ background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.6rem', cursor: 'pointer' }}>
          {saved ? '✓ Saved!' : t('profile.save')}
        </button>
      </form>
    </div>
  )
}

const inputStyle = { padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '1rem' }
