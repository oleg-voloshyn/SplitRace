import { useEffect, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import MapView from '../components/MapView';
import RichDescription from '../components/RichDescription';
import TournamentShare from '../components/TournamentShare';
import { useAuth } from '../contexts/AuthContext';

function Tournament() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [{ tournament, leaderboard, loading, error }, dispatchLoad] = useReducer(loadReducer, initialLoadState);
  const [reportTarget, setReportTarget] = useState(null); // {user_id, full_name}

  useEffect(() => {
    let cancelled = false;
    dispatchLoad({ type: 'loading' });

    api
      .tournament(slug)
      .then(async (tournament) => {
        const leaderboard = await api.leaderboard(slug).catch(() => []);
        if (!cancelled) {
          dispatchLoad({ type: 'loaded', tournament, leaderboard: leaderboard || [] });
        }
      })
      .catch((e) => {
        const msg = e?.errors?.filter(Boolean).join(', ') || `Failed to load tournament (HTTP ${e?.status || '?'})`;
        if (!cancelled) {
          dispatchLoad({ type: 'error', error: msg });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return <p>{t('common.loading')}</p>;
  }
  if (error) {
    return (
      <div style={{ padding: '1rem', background: '#fee', border: '1px solid #f99', borderRadius: 6, color: '#c33' }}>
        {error}
      </div>
    );
  }
  if (!tournament) {
    return <p>{t('tournaments.notFound')}</p>;
  }

  return (
    <div>
      <h2>{tournament.name}</h2>
      <RichDescription html={tournament.description} style={{ marginBottom: '1rem' }} />
      <TournamentShare tournament={tournament} />

      <div className="sr-stats-row">
        <Stat label={t('tournaments.status')} value={t(`tournaments.${tournament.status}`)} />
        <Stat label={t('tournaments.participantsLabel')} value={tournament.participants_count} />
        <Stat label={t('tournaments.segmentsHeader')} value={tournament.total_segments_count} />
        {tournament.starts_at && (
          <Stat label={t('tournaments.starts')} value={new Date(tournament.starts_at).toLocaleDateString()} />
        )}
        {tournament.ends_at && (
          <Stat label={t('tournaments.ends')} value={new Date(tournament.ends_at).toLocaleDateString()} />
        )}
      </div>

      {tournament.segments?.length > 0 && (
        <>
          <div className="sr-card sr-tournament-map-card">
            <MapView segments={tournament.segments.map((ts) => ts.segment)} height="440px" />
          </div>

          <div className="sr-card" style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>{t('tournaments.segmentsHeader')}</h3>
            <table className="sr-segment-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('tournaments.segmentName')}</th>
                  <th>{t('tournaments.distance')}</th>
                  <th>{t('tournaments.location')}</th>
                </tr>
              </thead>
              <tbody>
                {[...tournament.segments]
                  .sort((a, b) => a.order_number - b.order_number)
                  .map((ts) => (
                    <tr key={ts.segment.id}>
                      <td className="sr-seg-num">#{ts.order_number}</td>
                      <td className="sr-seg-name">{ts.segment.name}</td>
                      <td className="sr-seg-dist">
                        {ts.segment.distance_meters ? `${(ts.segment.distance_meters / 1000).toFixed(2)} km` : '—'}
                      </td>
                      <td className="sr-seg-loc">
                        {[ts.segment.city, ts.segment.country].filter(Boolean).join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="sr-tournament-detail">
        <div>
          {tournament.feed?.length > 0 && (
            <div className="sr-card" style={{ marginBottom: '1rem' }}>
              <h3>{t('tournaments.feed')}</h3>
              <TournamentFeed events={tournament.feed} />
            </div>
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
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                        {entry.score?.toFixed(1) ?? '—'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#888' }}>{entry.completed_segments}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {entry.user.id !== user?.id && (
                          <button
                            onClick={() => setReportTarget({ user_id: entry.user.id, full_name: entry.user.full_name })}
                            title={t('report.tooltip')}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#999',
                              fontSize: '0.85rem',
                              padding: '0.2rem 0.4rem'
                            }}
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
        <ReportModal target={reportTarget} tournamentSlug={slug} onClose={() => setReportTarget(null)} />
      )}
    </div>
  );
}

function TournamentFeed({ events }) {
  return (
    <div className="sr-feed-list">
      {events.map((event) => (
        <div key={event.id} className="sr-feed-item">
          <div className="sr-feed-dot" />
          <div>
            <strong>{event.title}</strong>
            {event.body && <p style={{ color: '#666', marginTop: '0.2rem' }}>{event.body}</p>}
            <small style={{ color: '#888' }}>{new Date(event.created_at).toLocaleString()}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

const initialLoadState = {
  tournament: null,
  leaderboard: [],
  loading: true,
  error: null
};

function loadReducer(state, action) {
  switch (action.type) {
    case 'loading':
      return { ...state, loading: true, error: null };
    case 'loaded':
      return { tournament: action.tournament, leaderboard: action.leaderboard, loading: false, error: null };
    case 'error':
      return { ...state, loading: false, error: action.error };
    default:
      return state;
  }
}

function ReportModal({ target, tournamentSlug, onClose }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  async function submit() {
    if (reason.trim().length < 10) {
      setError(t('report.tooShort'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.reportCheating({ reported_user_id: target.user_id, tournament_slug: tournamentSlug, reason });
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (e) {
      setError(e?.errors?.join(', ') || t('report.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 10, padding: '1.5rem', maxWidth: 480, width: '100%' }}
      >
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
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('report.placeholder')}
              rows={5}
              style={{
                width: '100%',
                padding: '0.6rem',
                border: '1px solid #ccc',
                borderRadius: 6,
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                resize: 'vertical'
              }}
            />
            {error && <p style={{ color: '#e53935', fontSize: '0.85rem', marginTop: '0.5rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                disabled={submitting}
                style={{
                  background: 'none',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  padding: '0.5rem 1rem',
                  cursor: 'pointer'
                }}
              >
                {t('report.cancel')}
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                style={{
                  background: '#e53935',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                {submitting ? t('report.submitting') : t('report.submit')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="sr-stat-pill">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

const thStyle = { padding: '0.5rem', textAlign: 'left', fontWeight: '600', fontSize: '0.85rem' };
const tdStyle = { padding: '0.5rem', fontSize: '0.9rem' };

export default Tournament;
