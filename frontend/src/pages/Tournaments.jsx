import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'

export default function Tournaments() {
  const { t } = useTranslation()
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.tournaments()
      .then(setTournaments)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p>{t('common.loading')}</p>

  return (
    <div>
      <h2>{t('tournaments.title')}</h2>
      {tournaments.length === 0 && <p style={{ color: '#888' }}>{t('tournaments.noTournaments')}</p>}
      <div className="sr-grid-tournaments">
        {tournaments.map(tn => (
          <TournamentCard
            key={tn.id}
            tournament={tn}
            onUpdate={u => setTournaments(prev => prev.map(x => x.id === u.id ? u : x))}
          />
        ))}
      </div>
    </div>
  )
}

function TournamentCard({ tournament, onUpdate }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  async function handleJoin(e) {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    try {
      await api.joinTournament(tournament.slug)
      onUpdate({ ...tournament, is_participating: true, participants_count: tournament.participants_count + 1 })
    } catch { /* ignore */ }
    setLoading(false)
  }

  const statusColor = tournament.status === 'active' ? '#4caf50' : tournament.status === 'completed' ? '#9e9e9e' : '#ff9800'

  return (
    <Link
      to={`/tournaments/${tournament.slug}`}
      className="sr-card sr-card-clickable"
      style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textDecoration: 'none', color: 'inherit' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, flex: 1 }}>{tournament.name}</h3>
        <span style={{ background: statusColor, color: '#fff', padding: '0.15rem 0.55rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {tournament.status}
        </span>
      </div>

      {(tournament.city || tournament.country) && (
        <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>
          {tournament.city && `${tournament.city}, `}{tournament.country}
        </p>
      )}

      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#888' }}>
        <span>{t('tournaments.participants', { count: tournament.participants_count })}</span>
        <span>{t('tournaments.segments', { count: tournament.total_segments_count })}</span>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
        {tournament.status === 'active' && !tournament.is_participating && (
          <button
            onClick={handleJoin}
            disabled={loading}
            style={{ background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 4, padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.85rem', width: '100%' }}
          >
            {t('tournaments.join')}
          </button>
        )}
        {tournament.is_participating && (
          <span style={{ color: '#4caf50', fontWeight: 600, fontSize: '0.85rem' }}>✓ {t('tournaments.joined')}</span>
        )}
      </div>
    </Link>
  )
}
