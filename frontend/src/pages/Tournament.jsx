import { useEffect, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { SegmentShare } from '../components/EntityShare';
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
    return <div className="sr-alert sr-alert-error">{error}</div>;
  }
  if (!tournament) {
    return <p>{t('tournaments.notFound')}</p>;
  }
  const visibleSegments = segmentsForDisplay(tournament.segments || []);
  const showSegmentOrder = visibleSegments.some((ts) => ts.order_number != null);

  return (
    <div>
      <h2>{tournament.name}</h2>
      <RichDescription html={tournament.description} className="sr-rich-description-spaced" />
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

      {visibleSegments.length > 0 && (
        <>
          <div className="sr-card sr-tournament-map-card">
            <MapView segments={visibleSegments.map((ts) => ts.segment)} height="440px" />
          </div>

          <div className="sr-card sr-spaced-card">
            <h3>{t('tournaments.segmentsHeader')}</h3>
            <div className="sr-public-segment-list">
              {visibleSegments.map((ts) => (
                <div key={ts.segment.id} className="sr-public-segment-card">
                  <div className="sr-public-segment-main">
                    {showSegmentOrder && <span className="sr-seg-num">#{ts.order_number}</span>}
                    <div>
                      <strong className="sr-seg-name">{ts.segment.name}</strong>
                      <span className="sr-seg-loc">
                        {[ts.segment.city, ts.segment.country].filter(Boolean).join(', ') || '—'}
                      </span>
                    </div>
                    <span className="sr-seg-dist">
                      {ts.segment.distance_meters ? `${(ts.segment.distance_meters / 1000).toFixed(2)} km` : '—'}
                    </span>
                  </div>
                  <SegmentShare segment={ts.segment} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="sr-tournament-detail">
        <div>
          {tournament.feed?.length > 0 && (
            <div className="sr-card sr-spaced-card">
              <h3>{t('tournaments.feed')}</h3>
              <TournamentFeed events={tournament.feed} />
            </div>
          )}
        </div>

        <div>
          <div className="sr-card">
            <h3>{t('tournaments.leaderboard')}</h3>
            {leaderboard.length === 0 ? (
              <p className="sr-muted">{t('tournaments.noResults')}</p>
            ) : (
              <table className="sr-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('tournaments.runner')}</th>
                    <th className="sr-text-right">{t('tournaments.score')}</th>
                    <th className="sr-text-right">{t('tournaments.seg')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, i) => (
                    <tr key={entry.user.id}>
                      <td className="sr-muted-cell">{i + 1}</td>
                      <td>{entry.user.full_name}</td>
                      <td className="sr-text-right sr-strong-cell">{entry.score?.toFixed(1) ?? '—'}</td>
                      <td className="sr-text-right sr-muted-cell">{entry.completed_segments}</td>
                      <td className="sr-text-right">
                        {entry.user.id !== user?.id && (
                          <button
                            onClick={() => setReportTarget({ user_id: entry.user.id, full_name: entry.user.full_name })}
                            title={t('report.tooltip')}
                            className="sr-icon-btn"
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
            {event.body && <p className="sr-feed-body">{event.body}</p>}
            <small className="sr-feed-date">{new Date(event.created_at).toLocaleString()}</small>
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
    <div onClick={onClose} className="sr-modal-backdrop">
      <div onClick={(e) => e.stopPropagation()} className="sr-modal-card">
        {success ? (
          <div className="sr-modal-success">
            <div>✓</div>
            <p>{t('report.submitted')}</p>
            <p>{t('report.reviewNote')}</p>
          </div>
        ) : (
          <>
            <h3>{t('report.title')}</h3>
            <p className="sr-modal-subtitle">{t('report.subtitle', { name: target.full_name })}</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('report.placeholder')}
              rows={5}
              className="sr-input sr-textarea"
            />
            {error && <p className="sr-form-error">{error}</p>}
            <div className="sr-modal-actions">
              <button onClick={onClose} disabled={submitting} className="sr-btn sr-btn-ghost">
                {t('report.cancel')}
              </button>
              <button onClick={submit} disabled={submitting} className="sr-btn sr-btn-danger">
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

function segmentsForDisplay(segments) {
  const copy = [...segments];
  if (copy.every((ts) => ts.order_number != null)) {
    return copy.sort((a, b) => a.order_number - b.order_number);
  }

  return copy.sort((a, b) => (a.segment?.name || '').localeCompare(b.segment?.name || ''));
}

export default Tournament;
