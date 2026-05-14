import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

function Profile() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => profileFormFromUser(user));
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
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
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.updateMe(form);
      setUser(updated);
      setForm(profileFormFromUser(updated));
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setSaveError(error?.errors?.join(', ') || t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    setForm(profileFormFromUser(user));
    setSaveError(null);
    setEditing(true);
  }

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || '—';

  return (
    <div>
      <h2>{t('profile.title')}</h2>

      <div className="sr-profile-grid">
        <div className="sr-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <img
              src={user?.avatar_url}
              alt=""
              width="72"
              height="72"
              style={{ borderRadius: '50%', background: '#f0f0f0', objectFit: 'cover', flex: '0 0 auto' }}
            />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{fullName}</h3>
              <p style={{ color: '#888', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>{user?.email}</p>
            </div>
          </div>

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

          {!editing ? (
            <div>
              <ProfileRow label={t('auth.firstName')} value={user?.first_name || '—'} />
              <ProfileRow label={t('auth.lastName')} value={user?.last_name || '—'} />
              <ProfileRow label={t('auth.gender')} value={user?.gender ? t(`auth.gender_${user.gender}`) : '—'} />
              <ProfileRow
                label={t('profile.units')}
                value={user?.units === 'miles' ? t('profile.miles') : t('profile.km')}
              />
              <ProfileRow label={t('profile.country')} value={user?.country || '—'} />
              <ProfileRow label={t('profile.city')} value={user?.city || '—'} />

              <button type="button" onClick={startEdit} style={primaryButtonStyle}>
                {saved ? `✓ ${t('profile.saved')}` : t('profile.editInfo')}
              </button>
            </div>
          ) : (
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

              <input
                placeholder={t('profile.country')}
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                style={inputStyle}
              />
              <input
                placeholder={t('profile.city')}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                style={inputStyle}
              />

              {saveError && <p style={{ color: '#c62828', margin: 0, fontSize: '0.85rem' }}>{saveError}</p>}

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={() => setEditing(false)} style={secondaryButtonStyle}>
                  {t('profile.cancel')}
                </button>
                <button type="submit" disabled={saving} style={primaryButtonStyle}>
                  {saving ? t('profile.saving') : t('profile.save')}
                </button>
              </div>
            </form>
          )}
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

function profileFormFromUser(user) {
  return {
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    units: user?.units || 'km',
    gender: user?.gender || '',
    country: user?.country || '',
    city: user?.city || ''
  };
}

function ProfileRow({ label, value }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '1rem',
        padding: '0.65rem 0',
        borderBottom: '1px solid #f0f0f0'
      }}
    >
      <span style={{ color: '#777', fontSize: '0.9rem' }}>{label}</span>
      <strong style={{ textAlign: 'right', fontSize: '0.95rem' }}>{value}</strong>
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
const primaryButtonStyle = {
  background: '#1a1a2e',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '0.6rem',
  cursor: 'pointer',
  fontWeight: 600,
  width: '100%'
};
const secondaryButtonStyle = {
  background: '#fff',
  color: '#1a1a2e',
  border: '1px solid #1a1a2e',
  borderRadius: '4px',
  padding: '0.6rem',
  cursor: 'pointer',
  fontWeight: 600,
  width: '100%'
};

export default Profile;
