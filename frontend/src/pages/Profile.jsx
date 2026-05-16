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
  const isClub = user?.account_type === 'club';

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
      const updated = await api.updateMe(profilePayload(form, isClub));
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

  const fullName = isClub
    ? user?.club_name || user?.email || '—'
    : [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || '—';

  return (
    <div>
      <h2>{t('profile.title')}</h2>

      <div className="sr-profile-grid">
        <div className="sr-card">
          <div className="sr-profile-head">
            <img src={user?.avatar_url} alt="" width="72" height="72" className="sr-avatar" />
            <div>
              <h3>{fullName}</h3>
              <p>{user?.email}</p>
            </div>
          </div>

          {!isClub && !user?.gender && (
            <div className="sr-alert sr-alert-warning sr-spaced-card">⚠ {t('profile.genderWarning')}</div>
          )}

          {!editing ? (
            <div>
              {isClub ? (
                <ProfileRow label={t('auth.clubName')} value={user?.club_name || '—'} />
              ) : (
                <>
                  <ProfileRow label={t('auth.firstName')} value={user?.first_name || '—'} />
                  <ProfileRow label={t('auth.lastName')} value={user?.last_name || '—'} />
                  <ProfileRow label={t('auth.gender')} value={user?.gender ? t(`auth.gender_${user.gender}`) : '—'} />
                </>
              )}
              <ProfileRow
                label={t('profile.units')}
                value={user?.units === 'miles' ? t('profile.miles') : t('profile.km')}
              />
              <ProfileRow label={t('profile.country')} value={user?.country || '—'} />
              <ProfileRow label={t('profile.city')} value={user?.city || '—'} />

              <button type="button" onClick={startEdit} className="sr-btn sr-btn-primary sr-btn-block">
                {saved ? `✓ ${t('profile.saved')}` : t('profile.editInfo')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSave} className="sr-form">
              {isClub ? (
                <input
                  placeholder={t('auth.clubName')}
                  value={form.club_name}
                  onChange={(e) => setForm({ ...form, club_name: e.target.value })}
                  className="sr-input"
                />
              ) : (
                <>
                  <input
                    placeholder={t('auth.firstName')}
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="sr-input"
                  />
                  <input
                    placeholder={t('auth.lastName')}
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="sr-input"
                  />

                  <div className="sr-form-field">
                    <span className="sr-label">{t('auth.gender')}</span>
                    <div className="sr-radio-row">
                      {['male', 'female', 'other'].map((g) => (
                        <label key={g} className="sr-radio-label">
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
                </>
              )}

              <label className="sr-form-field">
                <span className="sr-label">{t('profile.units')}:</span>
                <select
                  value={form.units}
                  onChange={(e) => setForm({ ...form, units: e.target.value })}
                  className="sr-input"
                >
                  <option value="km">{t('profile.km')}</option>
                  <option value="miles">{t('profile.miles')}</option>
                </select>
              </label>

              <input
                placeholder={t('profile.country')}
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="sr-input"
              />
              <input
                placeholder={t('profile.city')}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="sr-input"
              />

              {saveError && <p className="sr-form-error">{saveError}</p>}

              <div className="sr-inline-actions">
                <button type="button" onClick={() => setEditing(false)} className="sr-btn sr-btn-ghost sr-btn-block">
                  {t('profile.cancel')}
                </button>
                <button type="submit" disabled={saving} className="sr-btn sr-btn-primary sr-btn-block">
                  {saving ? t('profile.saving') : t('profile.save')}
                </button>
              </div>
            </form>
          )}
        </div>

        <div>
          <h3>{t('profile.recentRuns')}</h3>

          {activities === null && <p className="sr-muted">{t('profile.loading')}</p>}
          {activities?.length === 0 && <p className="sr-muted">{t('profile.noRuns')}</p>}
          {activities?.length > 0 && (
            <div className="sr-card-stack">
              {activities.map((a) => (
                <div key={a.id} className="sr-card sr-run-card">
                  <div className="sr-run-card-head">
                    <span>{fmtDate(a.started_at)}</span>
                    {a.segment_efforts_count > 0 && (
                      <span className="sr-pill sr-pill-warning">
                        {a.segment_efforts_count} segment{a.segment_efforts_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="sr-meta-row sr-run-meta">
                    <span>{fmtDist(a.distance_meters)}</span>
                    <span>{fmtTime(a.elapsed_time_seconds)}</span>
                    {a.distance_meters > 0 && a.elapsed_time_seconds > 0 && (
                      <span>{fmtPace(a.elapsed_time_seconds, a.distance_meters)} /km</span>
                    )}
                  </div>
                  <ActivitySegmentSummary activity={a} t={t} />
                  <button type="button" onClick={() => shareActivity(a, t)} className="sr-btn sr-btn-danger sr-btn-sm">
                    {t('run.shareResult')}
                  </button>

                  {a.gps_points?.length > 1 && (
                    <button
                      onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                      className="sr-btn sr-btn-ghost sr-btn-sm sr-route-toggle"
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

function ActivitySegmentSummary({ activity, t }) {
  const efforts = activity.segment_efforts || [];
  const count = activity.segment_efforts_count || efforts.length || 0;

  return (
    <div className="sr-activity-segments">
      <strong>{t('run.segmentsCompleted', { count })}</strong>
      {efforts.length > 0 ? (
        <div className="sr-activity-segment-list">
          {efforts.map((effort) => (
            <div key={effort.id}>
              <span>{effort.segment?.name}</span>
              <span>{effort.formatted_time}</span>
            </div>
          ))}
        </div>
      ) : (
        <span className="sr-muted">{t('run.noSegmentsCompleted')}</span>
      )}
    </div>
  );
}

async function shareActivity(activity, t) {
  const text = buildActivityShareText(activity, t);
  if (navigator.share) {
    await navigator.share({ text }).catch(() => {});
    return;
  }

  await navigator.clipboard?.writeText(text).catch(() => {});
}

function buildActivityShareText(activity, t) {
  const segmentCount = activity.segment_efforts_count || activity.segment_efforts?.length || 0;
  const segments = activity.segment_efforts || [];
  const segmentLines = segments.length
    ? segments.map((effort) => `• ${effort.segment?.name} — ${effort.formatted_time}`).join('\n')
    : t('run.noSegmentsCompleted');

  return [
    t('run.shareTitle'),
    `${t('run.distance')}: ${fmtDist(activity.distance_meters)}`,
    `${t('run.time')}: ${fmtTime(activity.elapsed_time_seconds)}`,
    `${t('run.pace')}: ${fmtPace(activity.elapsed_time_seconds, activity.distance_meters)} /km`,
    `${t('run.segmentsCompleted', { count: segmentCount })}`,
    segmentLines,
    'SplitRace'
  ].join('\n');
}

function profileFormFromUser(user) {
  return {
    club_name: user?.club_name || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    units: user?.units || 'km',
    gender: user?.gender || '',
    country: user?.country || '',
    city: user?.city || ''
  };
}

function profilePayload(form, isClub) {
  if (isClub) {
    return {
      club_name: form.club_name,
      units: form.units,
      country: form.country,
      city: form.city
    };
  }

  return form;
}

function ProfileRow({ label, value }) {
  return (
    <div className="sr-profile-row">
      <span>{label}</span>
      <strong>{value}</strong>
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
    <div className="sr-route-map">
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

export default Profile;
