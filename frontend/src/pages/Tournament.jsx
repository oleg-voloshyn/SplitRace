import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import MapView from '../components/MapView'

export default function Tournament() {
  const { slug } = useParams()
  const { t } = useTranslation()
  const { user } = useAuth()
  const [tournament, setTournament] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [reportTarget, setReportTarget] = useState(null) // {user_id, full_name}

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

  if (loading) return <p>{t('common.loading')}</p>
  if (error)   return <div style={{ padding: '1rem', background: '#fee', border: '1px solid #f99', borderRadius: 6, color: '#c33' }}>{error}</div>
  if (!tournament) return <p>{t('tournaments.notFound')}</p>

  return (
    <div>
      <h2>{tournament.name}</h2>
      {tournament.description && <p style={{ color: '#666', marginBottom: '1rem' }}>{tournament.description}</p>}

      <div className="sr-stats-row">
        <Stat label={t('tournaments.status')}       value={t(`tournaments.${tournament.status}`)} />
        <Stat label={t('tournaments.participantsLabel')} value={tournament.participants_count} />
        <Stat label={t('tournaments.segmentsHeader')} value={tournament.total_segments_count} />
        {tournament.starts_at && <Stat label={t('tournaments.starts')} value={new Date(tournament.starts_at).toLocaleDateString()} />}
        {tournament.ends_at   && <Stat label={t('tournaments.ends')}   value={new Date(tournament.ends_at).toLocaleDateString()} />}
      </div>

      <div className="sr-tournament-detail">
        <div>
          {tournament.segments?.length > 0 && (
            <>
              <div className="sr-card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1rem' }}>
                <MapView segments={tournament.segments.map(ts => ts.segment)} height="420px" />
              </div>
              <div className="sr-card">
                <h3>{t('tournaments.segmentsHeader')}</h3>
                {tournament.segments.map(ts => (
                  <div key={ts.segment.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong style={{ color: '#888', minWidth: 24 }}>#{ts.order_number}</strong>
                    <span style={{ flex: 1 }}>{ts.segment.name}</span>
                    {ts.segment.distance_meters && (
                      <span style={{ color: '#888', fontSize: '0.85rem' }}>{(ts.segment.distance_meters / 1000).toFixed(2)} km</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <div className="sr-card">
            <h3>{t('tournaments.leaderboard')}</h3>
            {leaderboard.length === 0 ? (
              <p style={{ color: '#888' }}>{t('tournaments.noResults')}</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e9ecef' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>{t('tournaments.runner')}</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>{t('tournaments.score')}</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>{t('tournaments.seg')}</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, i) => (
                    <tr key={entry.user.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ ...tdStyle, color: '#888', fontWeight: 600 }}>{i + 1}</td>
                      <td style={tdStyle}>{entry.user.full_name}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{entry.score?.toFixed(1) ?? '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#888' }}>{entry.completed_segments}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {entry.user.id !== user?.id && (
                          <button
                            onClick={() => setReportTarget({ user_id: entry.user.id, full_name: entry.user.full_name })}
                            title={t('report.tooltip')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: '0.85rem', padding: '0.2rem 0.4rem' }}
                          >
                            ⚐
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {reportTarget && (
        <ReportModal
          target={reportTarget}
          tournamentSlug={slug}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  )
}

function ReportModal({ target, tournamentSlug, onClose }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  async function submit() {
    if (reason.trim().length < 10) { setError(t('report.tooShort')); return }
    setSubmitting(true)
    setError(null)
    try {
      await api.reportCheating({ reported_user_id: target.user_id, tournament_slug: tournamentSlug, reason })
      setSuccess(true)
      setTimeout(onClose, 1500)
    } catch (e) {
      setError(e?.errors?.join(', ') || t('report.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, padding: '1.5rem', maxWidth: 480, width: '100%' }}>
        {success ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✓</div>
            <p style={{ color: '#4caf50', fontWeight: 600 }}>{t('report.submitted')}</p>
            <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.5rem' }}>{t('report.reviewNote')}</p>
          </div>
        ) : (
          <>
            <h3 style={{ margin: '0 0 0.5rem' }}>{t('report.title')}</h3>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
              {t('report.subtitle', { name: target.full_name })}
            </p>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={t('report.placeholder')}
              rows={5}
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: 6, fontFamily: 'inherit', fontSize: '0.9rem', resize: 'vertical' }}
            />
            {error && <p style={{ color: '#e53935', fontSize: '0.85rem', marginTop: '0.5rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={onClose} disabled={submitting} style={{ background: 'none', border: '1px solid #ccc', borderRadius: 4, padding: '0.5rem 1rem', cursor: 'pointer' }}>{t('report.cancel')}</button>
              <button onClick={submit} disabled={submitting} style={{ background: '#e53935', color: '#fff', border: 'none', borderRadius: 4, padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 600 }}>
                {submitting ? t('report.submitting') : t('report.submit')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="sr-stat-pill">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
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
