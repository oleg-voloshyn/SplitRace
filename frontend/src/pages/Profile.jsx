import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const SHARE_FORMATS = {
  story: { label: 'Story', ratio: '9:16', width: 1080, height: 1920, maxSegments: 6 },
  post: { label: 'Post', ratio: '4:5', width: 1080, height: 1350, maxSegments: 5 },
  square: { label: 'Square', ratio: '1:1', width: 1080, height: 1080, maxSegments: 4 }
};

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
                  <div className="sr-share-format-row" aria-label={t('run.shareResult')}>
                    {Object.entries(SHARE_FORMATS).map(([format, config]) => (
                      <button
                        key={format}
                        type="button"
                        onClick={() => shareActivity(a, t, format)}
                        className="sr-share-format-btn"
                      >
                        <strong>{config.label}</strong>
                        <span>{config.ratio}</span>
                      </button>
                    ))}
                  </div>

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

async function shareActivity(activity, t, format = 'story') {
  const text = buildActivityShareText(activity, t);
  const blob = await createActivityShareBlob(activity, t, format).catch(() => null);

  if (blob) {
    const file = new File([blob], `splitrace-run-${format}.png`, { type: 'image/png' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text, title: t('run.shareTitle') }).catch(() => {});
      return;
    }

    downloadBlob(file);
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

async function createActivityShareBlob(activity, t, formatKey) {
  const format = SHARE_FORMATS[formatKey] || SHARE_FORMATS.story;
  const canvas = document.createElement('canvas');
  canvas.width = format.width;
  canvas.height = format.height;
  const ctx = canvas.getContext('2d');
  const scale = format.width / 1080;
  const pad = 80 * scale;
  const segmentCount = activity.segment_efforts_count || activity.segment_efforts?.length || 0;
  const segments = activity.segment_efforts || [];

  const gradient = ctx.createLinearGradient(0, 0, format.width, format.height);
  gradient.addColorStop(0, '#0d1124');
  gradient.addColorStop(0.62, '#151a30');
  gradient.addColorStop(1, '#080b18');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, format.width, format.height);

  drawCircle(ctx, format.width - 100 * scale, 120 * scale, 250 * scale, 'rgba(229, 57, 53, 0.13)');
  drawCircle(ctx, 60 * scale, format.height - 120 * scale, 260 * scale, 'rgba(59, 130, 246, 0.1)');

  ctx.fillStyle = '#ffffff';
  ctx.font = `${36 * scale}px Inter, system-ui, sans-serif`;
  ctx.letterSpacing = `${4 * scale}px`;
  ctx.fillText('SPLITRACE', pad, pad + 20 * scale);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = 'rgba(255,255,255,0.48)';
  ctx.font = `${24 * scale}px Inter, system-ui, sans-serif`;
  ctx.fillText('Run • Compete • Improve', pad, pad + 62 * scale);

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(pad, pad + 105 * scale, format.width - pad * 2, 2 * scale);

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `700 ${28 * scale}px Inter, system-ui, sans-serif`;
  ctx.fillText(t('run.shareTitle'), pad, pad + 180 * scale);
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${formatKey === 'square' ? 58 : 76 * scale}px Inter, system-ui, sans-serif`;
  wrapCanvasText(
    ctx,
    segmentCount ? 'Segment unlocked' : 'Run complete',
    pad,
    pad + 270 * scale,
    format.width - pad * 2,
    84 * scale
  );

  const statsY = formatKey === 'story' ? 590 * scale : 390 * scale;
  drawRoundRect(ctx, pad, statsY, format.width - pad * 2, 210 * scale, 34 * scale, '#151a30');
  drawStat(
    ctx,
    t('run.distance'),
    fmtDist(activity.distance_meters),
    pad + 58 * scale,
    statsY + 82 * scale,
    scale,
    true
  );
  drawStat(ctx, t('run.time'), fmtTime(activity.elapsed_time_seconds), pad + 380 * scale, statsY + 82 * scale, scale);
  drawStat(
    ctx,
    t('run.pace'),
    `${fmtPace(activity.elapsed_time_seconds, activity.distance_meters)} /km`,
    pad + 685 * scale,
    statsY + 82 * scale,
    scale
  );

  const listY = statsY + 270 * scale;
  drawRoundRect(
    ctx,
    pad,
    listY,
    format.width - pad * 2,
    Math.min(500 * scale, format.height - listY - 190 * scale),
    34 * scale,
    '#151a30'
  );
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${34 * scale}px Inter, system-ui, sans-serif`;
  ctx.fillText(t('run.segmentsCompleted', { count: segmentCount }), pad + 38 * scale, listY + 68 * scale);

  if (segments.length) {
    ctx.font = `700 ${26 * scale}px Inter, system-ui, sans-serif`;
    segments.slice(0, format.maxSegments).forEach((effort, index) => {
      const y = listY + 130 * scale + index * 58 * scale;
      ctx.fillStyle = '#e53935';
      ctx.fillText('›', pad + 42 * scale, y);
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      truncateCanvasText(ctx, effort.segment?.name || 'Segment', pad + 76 * scale, y, 560 * scale);
      ctx.fillStyle = '#ff6b66';
      ctx.fillText(effort.formatted_time || '', format.width - pad - 180 * scale, y);
    });
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.68)';
    ctx.font = `${28 * scale}px Inter, system-ui, sans-serif`;
    wrapCanvasText(
      ctx,
      t('run.noSegmentsCompleted'),
      pad + 38 * scale,
      listY + 130 * scale,
      format.width - pad * 2 - 76 * scale,
      38 * scale
    );
  }

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `700 ${24 * scale}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('splitrace.app', format.width / 2, format.height - 80 * scale);
  ctx.textAlign = 'left';

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 1));
}

function drawStat(ctx, label, value, x, y, scale, accent = false) {
  ctx.fillStyle = accent ? '#ff4b45' : '#ffffff';
  ctx.font = `900 ${42 * scale}px Inter, system-ui, sans-serif`;
  ctx.fillText(value, x, y);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `800 ${18 * scale}px Inter, system-ui, sans-serif`;
  ctx.fillText(label.toUpperCase(), x, y + 46 * scale);
}

function drawCircle(ctx, x, y, radius, color) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawRoundRect(ctx, x, y, width, height, radius, color) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(' ');
  let line = '';
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = word;
    } else {
      line = test;
    }
  });
  if (line) {
    ctx.fillText(line, x, y);
  }
}

function truncateCanvasText(ctx, text, x, y, maxWidth) {
  let output = String(text);
  while (ctx.measureText(output).width > maxWidth && output.length > 4) {
    output = `${output.slice(0, -4)}...`;
  }
  ctx.fillText(output, x, y);
}

function downloadBlob(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
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
