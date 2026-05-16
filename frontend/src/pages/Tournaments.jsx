import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

function Tournaments() {
  const { t } = useTranslation();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .tournaments()
      .then(setTournaments)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p>{t('common.loading')}</p>;
  }

  return (
    <div>
      <h2>{t('tournaments.title')}</h2>
      {tournaments.length === 0 && <p className="sr-muted">{t('tournaments.noTournaments')}</p>}
      <div className="sr-grid-tournaments">
        {tournaments.map((tn) => (
          <TournamentCard
            key={tn.id}
            tournament={tn}
            onUpdate={(u) => setTournaments((prev) => prev.map((x) => (x.id === u.id ? u : x)))}
          />
        ))}
      </div>
    </div>
  );
}

function TournamentCard({ tournament, onUpdate }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const canParticipate = tournament.can_participate !== false;

  async function handleJoin(e) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      await api.joinTournament(tournament.slug);
      onUpdate({ ...tournament, is_participating: true, participants_count: tournament.participants_count + 1 });
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  return (
    <Link to={`/tournaments/${tournament.slug}`} className="sr-card sr-card-clickable sr-tournament-card">
      <div className="sr-card-head">
        <h3>{tournament.name}</h3>
        <span className={`sr-status-badge sr-status-${tournament.status}`}>{tournament.status}</span>
      </div>

      {(tournament.city || tournament.country) && (
        <p className="sr-muted">
          {tournament.city && `${tournament.city}, `}
          {tournament.country}
        </p>
      )}

      <div className="sr-meta-row">
        <span>{t('tournaments.participants', { count: tournament.participants_count })}</span>
        <span>{t('tournaments.segments', { count: tournament.total_segments_count })}</span>
      </div>

      <div className="sr-card-footer">
        {tournament.status === 'active' && canParticipate && !tournament.is_participating && (
          <button onClick={handleJoin} disabled={loading} className="sr-btn sr-btn-primary sr-btn-block">
            {t('tournaments.join')}
          </button>
        )}
        {tournament.is_participating && <span className="sr-success-text">✓ {t('tournaments.joined')}</span>}
      </div>
    </Link>
  );
}

export default Tournaments;
