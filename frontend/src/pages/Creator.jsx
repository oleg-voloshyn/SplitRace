import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

const initialSegment = {
  name: '',
  description: '',
  city: '',
  country: '',
  start_lat: '50.45',
  start_lng: '30.52',
  end_lat: '50.46',
  end_lng: '30.53'
};

const initialTournament = {
  name: '',
  description: '',
  city: '',
  country: '',
  total_segments_count: 2,
  rated_segments_count: 1
};

function Creator() {
  const { t } = useTranslation();
  const [segments, setSegments] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [segmentForm, setSegmentForm] = useState(initialSegment);
  const [tournamentForm, setTournamentForm] = useState(initialTournament);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  const segmentOptions = useMemo(() => segments.filter((segment) => segment.id), [segments]);

  useEffect(() => {
    refreshCreatorData();
  }, []);

  async function refreshCreatorData() {
    setLoading(true);
    try {
      const [mySegments, myTournaments] = await Promise.all([api.mySegments(), api.myTournaments()]);
      setSegments(mySegments);
      setTournaments(myTournaments);
    } finally {
      setLoading(false);
    }
  }

  async function createSegment(event) {
    event.preventDefault();
    setMessage(null);
    try {
      await api.createSegment(segmentForm);
      setSegmentForm(initialSegment);
      setMessage(t('creator.segmentCreated'));
      await refreshCreatorData();
    } catch (error) {
      setMessage(error?.errors?.join(', ') || t('creator.failed'));
    }
  }

  async function createTournament(event) {
    event.preventDefault();
    setMessage(null);
    try {
      await api.createTournament(tournamentForm);
      setTournamentForm(initialTournament);
      setMessage(t('creator.tournamentCreated'));
      await refreshCreatorData();
    } catch (error) {
      setMessage(error?.errors?.join(', ') || t('creator.failed'));
    }
  }

  async function addSegment(tournament, event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(null);
    try {
      await api.addTournamentSegment(tournament.slug, {
        segment_id: formData.get('segment_id'),
        order_number: formData.get('order_number'),
        is_rated: formData.get('is_rated') ? '1' : '0'
      });
      setMessage(t('creator.segmentAdded'));
      await refreshCreatorData();
    } catch (error) {
      setMessage(error?.errors?.join(', ') || error?.error || t('creator.failed'));
    }
  }

  async function submitForReview(tournament) {
    setMessage(null);
    try {
      await api.submitTournamentForReview(tournament.slug);
      setMessage(t('creator.submitted'));
      await refreshCreatorData();
    } catch (error) {
      setMessage(error?.error || error?.errors?.join(', ') || t('creator.failed'));
    }
  }

  return (
    <div>
      <h2>{t('creator.title')}</h2>
      {message && (
        <p className="sr-card" style={{ marginBottom: '1rem' }}>
          {message}
        </p>
      )}

      <div className="sr-creator-grid">
        <form className="sr-card sr-creator-form" onSubmit={createSegment}>
          <h3>{t('creator.newSegment')}</h3>
          <input
            required
            placeholder={t('creator.segmentName')}
            value={segmentForm.name}
            onChange={setSegment('name')}
          />
          <textarea
            placeholder={t('creator.description')}
            value={segmentForm.description}
            onChange={setSegment('description')}
          />
          <input placeholder={t('creator.city')} value={segmentForm.city} onChange={setSegment('city')} />
          <input placeholder={t('creator.country')} value={segmentForm.country} onChange={setSegment('country')} />
          <div className="sr-creator-two">
            <input required placeholder="Start lat" value={segmentForm.start_lat} onChange={setSegment('start_lat')} />
            <input required placeholder="Start lng" value={segmentForm.start_lng} onChange={setSegment('start_lng')} />
            <input required placeholder="End lat" value={segmentForm.end_lat} onChange={setSegment('end_lat')} />
            <input required placeholder="End lng" value={segmentForm.end_lng} onChange={setSegment('end_lng')} />
          </div>
          <button type="submit">{t('creator.createSegment')}</button>
        </form>

        <form className="sr-card sr-creator-form" onSubmit={createTournament}>
          <h3>{t('creator.newTournament')}</h3>
          <input
            required
            placeholder={t('creator.tournamentName')}
            value={tournamentForm.name}
            onChange={setTournament('name')}
          />
          <textarea
            placeholder={t('creator.description')}
            value={tournamentForm.description}
            onChange={setTournament('description')}
          />
          <input placeholder={t('creator.city')} value={tournamentForm.city} onChange={setTournament('city')} />
          <input
            placeholder={t('creator.country')}
            value={tournamentForm.country}
            onChange={setTournament('country')}
          />
          <div className="sr-creator-two">
            <input
              min="2"
              type="number"
              value={tournamentForm.total_segments_count}
              onChange={setTournament('total_segments_count')}
            />
            <input
              min="1"
              type="number"
              value={tournamentForm.rated_segments_count}
              onChange={setTournament('rated_segments_count')}
            />
          </div>
          <button type="submit">{t('creator.createTournament')}</button>
        </form>
      </div>

      <h3 style={{ marginTop: '1.5rem' }}>{t('creator.myTournaments')}</h3>
      {loading && <p>{t('common.loading')}</p>}
      {!loading && tournaments.length === 0 && <p className="sr-card">{t('creator.noTournaments')}</p>}
      <div className="sr-creator-list">
        {tournaments.map((tournament) => (
          <div key={tournament.id} className="sr-card">
            <div className="sr-creator-card-head">
              <div>
                <h3>{tournament.name}</h3>
                <p style={{ color: '#777' }}>{t(`creator.status_${tournament.status}`)}</p>
              </div>
              <button
                type="button"
                disabled={tournament.status !== 'draft' && tournament.status !== 'rejected'}
                onClick={() => submitForReview(tournament)}
              >
                {t('creator.submitReview')}
              </button>
            </div>
            {tournament.review_note && (
              <p style={{ color: '#a33', marginBottom: '0.75rem' }}>{tournament.review_note}</p>
            )}
            <p style={{ marginBottom: '0.75rem', color: '#555' }}>
              {tournament.segments?.length || 0}/{tournament.total_segments_count} {t('creator.segments')}
            </p>
            <form className="sr-creator-add-row" onSubmit={(event) => addSegment(tournament, event)}>
              <select name="segment_id" required>
                <option value="">{t('creator.selectSegment')}</option>
                {segmentOptions
                  .filter((segment) => !tournament.segments?.some((entry) => entry.segment.id === segment.id))
                  .map((segment) => (
                    <option key={segment.id} value={segment.id}>
                      {segment.name}
                    </option>
                  ))}
              </select>
              <input name="order_number" type="number" min="1" defaultValue={(tournament.segments?.length || 0) + 1} />
              <label>
                <input name="is_rated" type="checkbox" defaultChecked /> {t('creator.rated')}
              </label>
              <button type="submit" disabled={tournament.status === 'active' || tournament.status === 'completed'}>
                {t('creator.add')}
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );

  function setSegment(key) {
    return (event) => setSegmentForm((current) => ({ ...current, [key]: event.target.value }));
  }

  function setTournament(key) {
    return (event) => setTournamentForm((current) => ({ ...current, [key]: event.target.value }));
  }
}

export default Creator;
