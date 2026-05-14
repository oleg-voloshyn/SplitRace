import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

function Profile() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    units: user?.units || 'km',
    gender: user?.gender || ''
  });
  const [saved, setSaved] = useState(false);
  const [activities, setActivities] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api
      .activities()
      .then(setActivities)
      .catch(() => setActivities([]));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    await api.updateMe(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <h2>{t('profile.title')}</h2>

      <div className="sr-profile-grid">
        <div className="sr-card">
          <p style={{ color: '#888', marginBottom: '0.75rem', fontSize: '0.9rem' }}>{user?.email}</p>

          {!user?.gender && (
            <div
              style={{
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '6px',
                padding: '0.6rem 0.9rem',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                color: '#856404'
              }}
            >
              ⚠ {t('profile.genderWarning')}
            </div>
          )}

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <input
              placeholder={t('auth.firstName')}
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder={t('auth.lastName')}
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              style={inputStyle}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#555' }}>{t('auth.gender')}</span>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                {['male', 'female'].map((g) => (
                  <label key={g} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="gender"
                      value={g}
                      checked={form.gender === g}
                      onChange={() => setForm({ ...form, gender: g })}
                    />
                    {t(`auth.gender_${g}`)}
                  </label>
                ))}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {t('profile.units')}:
              <select
                value={form.units}
                onChange={(e) => setForm({ ...form, units: e.target.value })}
                style={inputStyle}
              >
                <option value="km">{t('profile.km')}</option>
                <option value="miles">{t('profile.miles')}</option>
              </select>
            </label>
            <button
              type="submit"
              style={{
                background: '#1a1a2e',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '0.6rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {saved ? `✓ ${t('profile.saved')}` : t('profile.save')}
            </button>
          </form>
        </div>

        <div>
          <h3 style={{ marginBottom: '0.75rem' }}>{t('profile.recentRuns')}</h3>

          {activities === null && <p style={{ color: '#888', fontSize: '0.9rem' }}>{t('profile.loading')}</p>}
          {activities?.length === 0 && <p style={{ color: '#888', fontSize: '0.9rem' }}>{t('profile.noRuns')}</p>}
          {activities?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {activities.map((a) => (
                <div key={a.id} className="sr-card" style={{ padding: '0.85rem 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>{fmtDate(a.started_at)}</span>
                    {a.segment_efforts_count > 0 && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          background: '#fff3cd',
                          color: '#856404',
                          borderRadius: '4px',
                          padding: '0.15rem 0.5rem'
                        }}
                      >
                        {a.segment_efforts_count} segment{a.segment_efforts_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div
                    style={{ display: 'flex', gap: '1.5rem', marginTop: '0.4rem', color: '#555', fontSize: '0.88rem' }}
                  >
                    <span>{fmtDist(a.distance_meters)}</span>
                    <span>{fmtTime(a.elapsed_time_seconds)}</span>
                    {a.distance_meters > 0 && a.elapsed_time_seconds > 0 && (
                      <span>{fmtPace(a.elapsed_time_seconds, a.distance_meters)} /km</span>
                    )}
                  </div>

                  {a.gps_points?.length > 1 && (
                    <button
                      onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                      style={{
                        marginTop: '0.5rem',
                        background: 'none',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        padding: '0.25rem 0.7rem',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        color: '#555'
                      }}
                    >
                      {expanded === a.id ? t('profile.hideRoute') : t('profile.showRoute')}
                    </button>
                  )}

                  {expanded === a.id && <ActivityRouteMap points={a.gps_points} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(
        points.map((p) => [p.lat, p.lng]),
        { padding: [12, 12] }
      );
    }
  }, [map, points]);
  return null;
}

function ActivityRouteMap({ points }) {
  if (!points?.length) {
    return null;
  }
  const positions = points.map((p) => [p.lat, p.lng]);
  const first = positions[0];
  const last = positions[positions.length - 1];

  return (
    <div
      style={{ position: 'relative', height: '200px', borderRadius: '6px', overflow: 'hidden', marginTop: '0.6rem' }}
    >
      <MapContainer
        center={first}
        zoom={14}
        style={{ position: 'absolute', inset: 0 }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Polyline positions={positions} color="#e53935" weight={3} opacity={0.85} />
        <CircleMarker center={first} radius={6} color="#4caf50" fillColor="#4caf50" fillOpacity={1} weight={2} />
        <CircleMarker center={last} radius={6} color="#e53935" fillColor="#e53935" fillOpacity={1} weight={2} />
        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) {
    return '—';
  }
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
function fmtDist(m) {
  if (!m) {
    return '0.00 km';
  }
  return `${(m / 1000).toFixed(2)} km`;
}
function fmtTime(s) {
  if (!s) {
    return '0:00';
  }
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
function fmtPace(secs, meters) {
  const secsPerKm = (secs / meters) * 1000;
  const m = Math.floor(secsPerKm / 60),
    s = Math.round(secsPerKm % 60);
  return `${m}:${pad(s)}`;
}
const pad = (n) => String(n).padStart(2, '0');

const inputStyle = { padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '1rem' };

export default Profile;
