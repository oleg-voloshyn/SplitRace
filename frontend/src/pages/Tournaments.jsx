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

  if (loading) return <p>Loading...</p>

  return (
    <div>
      <h2>{t('tournaments.title')}</h2>
      {tournaments.length === 0 && <p>{t('tournaments.noTournaments')}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {tournaments.map(t => (
          <TournamentCard key={t.id} tournament={t} onUpdate={updated => setTournaments(prev => prev.map(x => x.id === updated.id ? updated : x))} />
        ))}
      </div>
    </div>
  )
}

function TournamentCard({ tournament, onUpdate }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  async function handleJoin() {
    setLoading(true)
    try {
      await api.joinTournament(tournament.slug)
      onUpdate({ ...tournament, is_participating: true, participants_count: tournament.participants_count + 1 })
    } catch { /* ignore */ }
    setLoading(false)
  }

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: '0 0 0.25rem' }}>
            <Link to={`/tournaments/${tournament.slug}`} style={{ color: '#1a1a2e', textDecoration: 'none' }}>{tournament.name}</Link>
          </h3>
          <p style={{ color: '#666', margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
            {tournament.city && `${tournament.city}, `}{tournament.country}
          </p>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: '#888' }}>
            <span>{t('tournaments.participants', { count: tournament.participants_count })}</span>
            <span>{t('tournaments.segments', { count: tournament.total_segments_count })}</span>
            <span style={{ background: tournament.status === 'active' ? '#4caf50' : '#9e9e9e', color: '#fff', padding: '0.1rem 0.5rem', borderRadius: '4px' }}>
              {t(`tournaments.${tournament.status}`)}
            </span>
          </div>
        </div>
        {tournament.status === 'active' && !tournament.is_participating && (
          <button onClick={handleJoin} disabled={loading} style={{ background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer' }}>
            {t('tournaments.join')}
          </button>
        )}
        {tournament.is_participating && (
          <span style={{ color: '#4caf50', fontWeight: 'bold' }}>✓ Joined</span>
        )}
      </div>
    </div>
  )
}
