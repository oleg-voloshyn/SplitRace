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
      <span className="sr-tournament-card-media" aria-hidden="true">
        <TournamentCardIllustration />
      </span>

      <div className="sr-tournament-card-body">
        <span className={`sr-status-badge sr-status-${tournament.status}`}>{tournament.status}</span>
        <h3 className="sr-tournament-card-title">{tournament.name}</h3>

        {(tournament.city || tournament.country) && (
          <span className="sr-tournament-card-location">
            {tournament.city && `${tournament.city}, `}
            {tournament.country}
          </span>
        )}

        <span className="sr-tournament-card-meta">
          <span>{t('tournaments.participants', { count: tournament.participants_count })}</span>
          <span>{t('tournaments.segments', { count: tournament.total_segments_count })}</span>
        </span>

        <span className="sr-tournament-card-footer">
          {tournament.status === 'active' && canParticipate && !tournament.is_participating && (
            <button onClick={handleJoin} disabled={loading} className="sr-btn sr-btn-primary sr-btn-block">
              {t('tournaments.join')}
            </button>
          )}
          {tournament.is_participating && <span className="sr-success-text">✓ {t('tournaments.joined')}</span>}
        </span>
      </div>
    </Link>
  );
}

function TournamentCardIllustration() {
  return (
    <svg className="sr-tournament-card-illustration" viewBox="0 0 260 140" aria-hidden="true" focusable="false">
      <path className="sr-tournament-card-route-shadow" d="M22 108 C62 92, 70 43, 112 59 S159 119, 208 74" />
      <path className="sr-tournament-card-route" d="M22 103 C61 88, 72 38, 113 54 S158 112, 209 68" />
      <circle className="sr-tournament-card-node" cx="22" cy="103" r="10" />
      <circle className="sr-tournament-card-node sr-tournament-card-node-end" cx="209" cy="68" r="10" />
      <path className="sr-tournament-card-cup" d="M126 22h44v18c0 28-12 45-22 45s-22-17-22-45V22z" />
      <path className="sr-tournament-card-handle" d="M126 34h-22c0 24 12 36 31 38" />
      <path className="sr-tournament-card-handle" d="M170 34h22c0 24-12 36-31 38" />
      <path className="sr-tournament-card-stem" d="M148 84v20" />
      <path className="sr-tournament-card-base" d="M120 110h56" />
      <circle className="sr-tournament-card-spark" cx="78" cy="32" r="5" />
      <circle className="sr-tournament-card-spark" cx="219" cy="32" r="4" />
    </svg>
  );
}

export default Tournaments;
