import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/client'

export default function Profile() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [form, setForm]         = useState({ first_name: user?.first_name || '', last_name: user?.last_name || '', units: user?.units || 'km' })
  const [saved, setSaved]       = useState(false)
  const [activities, setActivities] = useState(null)

  useEffect(() => {
    api.activities().then(setActivities).catch(() => setActivities([]))
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    await api.updateMe(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ maxWidth: '480px' }}>
      <h2>{t('profile.title')}</h2>
      <p style={{ color: '#888', marginBottom: '1rem' }}>{user?.email}</p>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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

      {/* ── Recent runs ───────────────────────────────────────────── */}
      <h3 style={{ marginTop: '2rem', marginBottom: '0.75rem', fontSize: '1rem', fontWeight: '600' }}>
        Recent runs
      </h3>

      {activities === null && <p style={{ color: '#888', fontSize: '0.9rem' }}>Loading...</p>}
      {activities?.length === 0 && <p style={{ color: '#888', fontSize: '0.9rem' }}>No runs yet.</p>}
      {activities?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {activities.map(a => (
            <div key={a.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>
                  {fmtDate(a.started_at)}
                </span>
                {a.segment_efforts_count > 0 && (
                  <span style={{ fontSize: '0.75rem', background: '#fff3cd', color: '#856404', borderRadius: '4px', padding: '0.15rem 0.5rem' }}>
                    {a.segment_efforts_count} segment{a.segment_efforts_count !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.35rem', color: '#555', fontSize: '0.85rem' }}>
                <span>{fmtDist(a.distance_meters)}</span>
                <span>{fmtTime(a.elapsed_time_seconds)}</span>
                {a.distance_meters > 0 && a.elapsed_time_seconds > 0 && (
                  <span>{fmtPace(a.elapsed_time_seconds, a.distance_meters)} /km</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtDist(m) {
  if (!m) return '0.00 km'
  return `${(m / 1000).toFixed(2)} km`
}
function fmtTime(s) {
  if (!s) return '0:00'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}
function fmtPace(secs, meters) {
  const secsPerKm = (secs / meters) * 1000
  const m = Math.floor(secsPerKm / 60), s = Math.round(secsPerKm % 60)
  return `${m}:${pad(s)}`
}
const pad = n => String(n).padStart(2, '0')

const inputStyle = { padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '1rem' }
const cardStyle  = { background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '8px', padding: '0.75rem 1rem' }
