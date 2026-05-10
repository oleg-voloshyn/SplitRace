import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import MapView from '../components/MapView'

export default function Tournament() {
  const { slug } = useParams()
  const { t } = useTranslation()
  const [tournament, setTournament] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.tournament(slug)
      .then(t => {
        setTournament(t)
        return api.leaderboard(slug).catch(() => [])
      })
      .then(lb => setLeaderboard(lb || []))
      .catch(e => {
        const msg = e?.errors?.filter(Boolean).join(', ') || `Failed to load tournament (HTTP ${e?.status || '?'})`
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <p>Loading...</p>
  if (error)   return <div style={{ padding: '1rem', background: '#fee', border: '1px solid #f99', borderRadius: 6, color: '#c33' }}>{error}</div>
  if (!tournament) return <p>Tournament not found</p>

  return (
    <div>
      <h2>{tournament.name}</h2>
      {tournament.description && <p style={{ color: '#666' }}>{tournament.description}</p>}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <Stat label="Status"       value={tournament.status} />
        <Stat label="Participants" value={tournament.participants_count} />
        <Stat label="Segments"     value={tournament.total_segments_count} />
        {tournament.starts_at && <Stat label="Starts" value={new Date(tournament.starts_at).toLocaleDateString()} />}
        {tournament.ends_at   && <Stat label="Ends"   value={new Date(tournament.ends_at).toLocaleDateString()} />}
      </div>

      {tournament.segments?.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <MapView segments={tournament.segments.map(ts => ts.segment)} height="350px" />
          <h3 style={{ marginTop: '1rem' }}>Segments</h3>
          {tournament.segments.map(ts => (
            <div key={ts.segment.id} style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
              <strong>#{ts.order_number}</strong> {ts.segment.name}
              {ts.segment.distance_meters && <span style={{ color: '#888', marginLeft: '0.5rem' }}>({(ts.segment.distance_meters / 1000).toFixed(2)} km)</span>}
              {ts.is_rated && <span style={{ background: '#ff9800', color: '#fff', fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: '0.5rem' }}>Rated</span>}
            </div>
          ))}
        </section>
      )}

      <section>
        <h3>{t('tournaments.leaderboard')}</h3>
        {leaderboard.length === 0 ? (
          <p style={{ color: '#888' }}>No results yet</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Runner</th>
                <th style={thStyle}>Score</th>
                <th style={thStyle}>Segments</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, i) => (
                <tr key={entry.user.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={tdStyle}>{i + 1}</td>
                  <td style={tdStyle}>{entry.user.full_name}</td>
                  <td style={tdStyle}>{entry.score?.toFixed(1) ?? '—'}</td>
                  <td style={tdStyle}>{entry.completed_segments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ background: '#f5f5f5', padding: '0.5rem 1rem', borderRadius: '6px', textAlign: 'center' }}>
      <div style={{ fontSize: '0.75rem', color: '#888' }}>{label}</div>
      <div style={{ fontWeight: 'bold' }}>{value}</div>
    </div>
  )
}

function formatTime(secs) {
  if (!secs) return '—'
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}
const pad = n => String(n).padStart(2, '0')
const thStyle = { padding: '0.5rem', textAlign: 'left', fontWeight: '600', fontSize: '0.85rem' }
const tdStyle = { padding: '0.5rem', fontSize: '0.9rem' }
