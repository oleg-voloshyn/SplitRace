import { useEffect, useReducer } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { SegmentShare } from '../components/EntityShare';
import MapView from '../components/MapView';
import RichDescription from '../components/RichDescription';

const initialState = {
  segment: null,
  loading: true,
  error: null
};

function Segment() {
  const { id } = useParams();
  const [{ segment, loading, error }, dispatch] = useReducer(loadReducer, initialState);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'loading' });

    api
      .segment(id)
      .then((segment) => {
        if (!cancelled) {
          dispatch({ type: 'loaded', segment });
        }
      })
      .catch((e) => {
        if (!cancelled) {
          dispatch({ type: 'error', error: e?.errors?.filter(Boolean).join(', ') || 'Failed to load segment' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return <p>Loading...</p>;
  }

  if (error) {
    return <div className="sr-alert sr-alert-error">{error}</div>;
  }

  if (!segment) {
    return <p>Segment not found</p>;
  }

  return (
    <div>
      <h2>{segment.name}</h2>
      <RichDescription html={segment.description} className="sr-rich-description-spaced" />
      <SegmentShare segment={segment} />

      <div className="sr-stats-row">
        <Stat
          label="Distance"
          value={segment.distance_meters ? `${(segment.distance_meters / 1000).toFixed(2)} km` : '-'}
        />
        <Stat label="Location" value={[segment.city, segment.country].filter(Boolean).join(', ') || '-'} />
      </div>

      {segment.polyline?.length > 1 && (
        <div className="sr-card sr-tournament-map-card">
          <MapView segments={[segment]} height="440px" />
        </div>
      )}

      {segment.best_effort && (
        <div className="sr-card sr-spaced-card">
          <h3>Best effort</h3>
          <p className="sr-muted">{segment.best_effort.formatted_time}</p>
        </div>
      )}
    </div>
  );
}

function loadReducer(state, action) {
  switch (action.type) {
    case 'loading':
      return { ...state, loading: true, error: null };
    case 'loaded':
      return { segment: action.segment, loading: false, error: null };
    case 'error':
      return { ...state, loading: false, error: action.error };
    default:
      return state;
  }
}

function Stat({ label, value }) {
  return (
    <div className="sr-stat-pill">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

export default Segment;
