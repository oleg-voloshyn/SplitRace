import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { api } from '../api/client';

const DEFAULT_CENTER = [50.45, 30.52];
const MAX_SEGMENT_POINTS = 100;

const defaultSegment = {
  name: '',
  description: '',
  city: '',
  country: '',
  points: []
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
  const [activeForm, setActiveForm] = useState(null);
  const [segments, setSegments] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [segmentDefaults, setSegmentDefaults] = useState(defaultSegment);
  const [segmentForm, setSegmentForm] = useState(defaultSegment);
  const [tournamentForm, setTournamentForm] = useState(initialTournament);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  const [expandedAdd, setExpandedAdd] = useState(null);
  const segmentOptions = useMemo(() => segments.filter((segment) => segment.id), [segments]);

  useEffect(() => {
    refreshCreatorData();
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const current = [coords.latitude, coords.longitude];
        setMapCenter(current);
        setUserLocation(current);
        reverseGeocode(coords.latitude, coords.longitude).then((location) => {
          if (!location.city && !location.country) {
            return;
          }

          setSegmentDefaults((defaults) => ({ ...defaults, ...location }));
          setSegmentForm((form) =>
            form.city || form.country ? form : { ...form, city: location.city, country: location.country }
          );
        });
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
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

    if (segmentForm.points.length < 2) {
      setMessage(t('creator.routeRequired'));
      return;
    }

    try {
      await api.createSegment(segmentForm);
      setSegmentForm(segmentDefaults);
      setActiveForm(null);
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
      setActiveForm(null);
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
      return true;
    } catch (error) {
      setMessage(error?.errors?.join(', ') || error?.error || t('creator.failed'));
      return false;
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

  function addRoutePoint(point) {
    setSegmentForm((current) => {
      if (current.points.length >= MAX_SEGMENT_POINTS) {
        return current;
      }

      const next = { ...current, points: [...current.points, point] };
      if (current.points.length === 0) {
        reverseGeocode(point.lat, point.lng).then((location) => {
          setSegmentForm((form) => ({ ...form, ...location }));
        });
      }
      return next;
    });
  }

  function undoRoutePoint() {
    setSegmentForm((current) => ({ ...current, points: current.points.slice(0, -1) }));
  }

  function clearRoute() {
    setSegmentForm((current) => ({ ...current, points: [] }));
  }

  return (
    <div>
      <div className="sr-page-heading">
        <h2>{t('creator.title')}</h2>
        <div className="sr-creator-actions">
          <button type="button" onClick={() => setActiveForm(activeForm === 'segment' ? null : 'segment')}>
            {t('creator.newSegment')}
          </button>
          <button type="button" onClick={() => setActiveForm(activeForm === 'tournament' ? null : 'tournament')}>
            {t('creator.newTournament')}
          </button>
        </div>
      </div>

      {message && (
        <p className="sr-card" style={{ marginBottom: '1rem' }}>
          {message}
        </p>
      )}

      {activeForm === 'segment' && (
        <form className="sr-card sr-creator-form sr-creator-form-wide" onSubmit={createSegment}>
          <div className="sr-creator-card-head">
            <h3>{t('creator.newSegment')}</h3>
            <button type="button" className="sr-creator-ghost-btn" onClick={() => setActiveForm(null)}>
              {t('profile.cancel')}
            </button>
          </div>
          <input
            required
            maxLength={120}
            placeholder={t('creator.segmentName')}
            value={segmentForm.name}
            onChange={setSegment('name')}
          />
          <RichTextEditor
            value={segmentForm.description}
            onChange={(description) => setSegmentForm((current) => ({ ...current, description }))}
            placeholder={t('creator.description')}
          />
          <p className="sr-creator-map-hint">{t('creator.mapHint')}</p>
          <SegmentRouteMap
            center={mapCenter}
            userLocation={userLocation}
            points={segmentForm.points}
            onAddPoint={addRoutePoint}
            onRemoveLast={undoRoutePoint}
          />
          <div className="sr-creator-route-meta">
            <span>
              {t('creator.routePoints')}: <strong>{segmentForm.points.length}</strong>
            </span>
            <span>
              {t('creator.distance')}: <strong>{formatDistance(routeDistance(segmentForm.points))}</strong>
            </span>
            <span>
              {t('creator.detectedLocation')}:{' '}
              <strong>{[segmentForm.city, segmentForm.country].filter(Boolean).join(', ') || '-'}</strong>
            </span>
          </div>
          <div className="sr-creator-route-actions">
            <button type="button" onClick={undoRoutePoint} disabled={segmentForm.points.length === 0}>
              {t('creator.undoPoint')}
            </button>
            <button type="button" onClick={clearRoute} disabled={segmentForm.points.length === 0}>
              {t('creator.clearRoute')}
            </button>
          </div>
          <button type="submit">{t('creator.createSegment')}</button>
        </form>
      )}

      {activeForm === 'tournament' && (
        <form className="sr-card sr-creator-form sr-creator-form-wide" onSubmit={createTournament}>
          <div className="sr-creator-card-head">
            <h3>{t('creator.newTournament')}</h3>
            <button type="button" className="sr-creator-ghost-btn" onClick={() => setActiveForm(null)}>
              {t('profile.cancel')}
            </button>
          </div>
          <input
            required
            maxLength={120}
            placeholder={t('creator.tournamentName')}
            value={tournamentForm.name}
            onChange={setTournament('name')}
          />
          <RichTextEditor
            value={tournamentForm.description}
            onChange={(description) => setTournamentForm((current) => ({ ...current, description }))}
            placeholder={t('creator.description')}
          />
          <input
            maxLength={120}
            placeholder={t('creator.city')}
            value={tournamentForm.city}
            onChange={setTournament('city')}
          />
          <input
            maxLength={120}
            placeholder={t('creator.country')}
            value={tournamentForm.country}
            onChange={setTournament('country')}
          />
          <div className="sr-creator-two">
            <input
              min="2"
              max="100"
              type="number"
              value={tournamentForm.total_segments_count}
              onChange={setTournament('total_segments_count')}
            />
            <input
              min="1"
              max="99"
              type="number"
              value={tournamentForm.rated_segments_count}
              onChange={setTournament('rated_segments_count')}
            />
          </div>
          <button type="submit">{t('creator.createTournament')}</button>
        </form>
      )}

      <h3 style={{ marginTop: '1.5rem' }}>{t('creator.myTournaments')}</h3>
      {loading && <p>{t('common.loading')}</p>}
      {!loading && tournaments.length === 0 && <p className="sr-card">{t('creator.noTournaments')}</p>}
      <div className="sr-creator-list">
        {tournaments.map((tournament) => {
          const isEditable = tournament.status === 'draft' || tournament.status === 'rejected';
          const sortedSegments = [...(tournament.segments || [])].sort((a, b) => a.order_number - b.order_number);
          const available = segmentOptions.filter((s) => !tournament.segments?.some((e) => e.segment.id === s.id));
          return (
            <div key={tournament.id} className="sr-card">
              <div className="sr-creator-card-head">
                <div>
                  <h3 style={{ marginBottom: '0.4rem' }}>{tournament.name}</h3>
                  <span className={`sr-status-badge sr-status-${tournament.status}`}>
                    {t(`creator.status_${tournament.status}`)}
                  </span>
                </div>
                {isEditable && (
                  <button type="button" onClick={() => submitForReview(tournament)}>
                    {t('creator.submitReview')}
                  </button>
                )}
              </div>

              {tournament.review_note && <p className="sr-creator-review-note">{tournament.review_note}</p>}

              <p className="sr-creator-seg-count">
                {sortedSegments.length} / {tournament.total_segments_count} {t('creator.segments')}
              </p>

              {sortedSegments.length > 0 ? (
                <div className="sr-creator-segment-list">
                  {sortedSegments.map((ts) => (
                    <div key={ts.segment.id} className="sr-creator-segment-item">
                      <span className="sr-creator-seg-num">#{ts.order_number}</span>
                      <span className="sr-creator-seg-name">{ts.segment.name}</span>
                      {ts.is_rated && <span className="sr-creator-rated">★ {t('creator.rated')}</span>}
                      {ts.segment.distance_meters != null && (
                        <span className="sr-creator-seg-dist">{(ts.segment.distance_meters / 1000).toFixed(2)} km</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                  {t('creator.noSegmentsAdded')}
                </p>
              )}

              {isEditable && (
                <>
                  <button
                    type="button"
                    className="sr-creator-ghost-btn sr-creator-add-toggle"
                    onClick={() => setExpandedAdd(expandedAdd === tournament.id ? null : tournament.id)}
                  >
                    {expandedAdd === tournament.id ? t('creator.cancelAdd') : t('creator.addSegmentBtn')}
                  </button>
                  {expandedAdd === tournament.id && (
                    <form
                      className="sr-creator-add-row"
                      style={{ marginTop: '0.6rem' }}
                      onSubmit={async (event) => {
                        const ok = await addSegment(tournament, event);
                        if (ok) {
                          setExpandedAdd(null);
                        }
                      }}
                    >
                      <select name="segment_id" required>
                        <option value="">{t('creator.selectSegment')}</option>
                        {available.map((segment) => (
                          <option key={segment.id} value={segment.id}>
                            {segment.name}
                          </option>
                        ))}
                      </select>
                      <input name="order_number" type="number" min="1" defaultValue={sortedSegments.length + 1} />
                      <label>
                        <input name="is_rated" type="checkbox" defaultChecked /> {t('creator.rated')}
                      </label>
                      <button type="submit">{t('creator.add')}</button>
                    </form>
                  )}
                </>
              )}
            </div>
          );
        })}
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

function SegmentRouteMap({ center, userLocation, points, onAddPoint, onRemoveLast }) {
  const positions = points.map((point) => [point.lat, point.lng]);

  return (
    <div className="sr-creator-map">
      <MapContainer center={center} zoom={15} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapCenter center={center} shouldRecenter={points.length === 0} />
        <MapClickHandler onAddPoint={onAddPoint} />
        {userLocation && (
          <CircleMarker center={userLocation} radius={7} color="#1976d2" fillColor="#1976d2" fillOpacity={0.85} />
        )}
        {positions.length > 1 && <Polyline positions={positions} color="#e53935" weight={4} opacity={0.85} />}
        {points.map((point, index) => {
          const isFirst = index === 0;
          const isLast = index === points.length - 1;
          const color = isFirst ? '#4caf50' : isLast ? '#e53935' : '#1976d2';
          return (
            <CircleMarker
              key={`${point.lat}-${point.lng}-${index}`}
              center={[point.lat, point.lng]}
              radius={isFirst || isLast ? 9 : 5}
              color={color}
              fillColor={color}
              fillOpacity={0.9}
              eventHandlers={isLast ? { click: onRemoveLast } : undefined}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}

function MapClickHandler({ onAddPoint }) {
  useMapEvents({
    click(event) {
      onAddPoint({ lat: event.latlng.lat, lng: event.latlng.lng });
    }
  });
  return null;
}

function MapCenter({ center, shouldRecenter }) {
  const map = useMap();
  useEffect(() => {
    if (shouldRecenter) {
      map.setView(center, 15);
    }
  }, [center, map, shouldRecenter]);
  return null;
}

function RichTextEditor({ value, onChange, placeholder }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  function runCommand(command, commandValue = null) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(sanitizeRichText(editorRef.current?.innerHTML || ''));
  }

  function addLink() {
    const href = window.prompt('https://');
    if (!href || !safeHref(href)) {
      return;
    }
    runCommand('createLink', href);
  }

  function handleInput() {
    onChange(sanitizeRichText(editorRef.current?.innerHTML || ''));
  }

  function handlePaste(event) {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain').slice(0, 5000);
    document.execCommand('insertText', false, text);
    handleInput();
  }

  return (
    <div className="sr-rich-editor">
      <div className="sr-rich-toolbar" aria-label="Description formatting">
        <button type="button" onClick={() => runCommand('bold')}>
          B
        </button>
        <button type="button" onClick={() => runCommand('italic')}>
          I
        </button>
        <button type="button" onClick={() => runCommand('insertUnorderedList')}>
          {'\u2022'}
        </button>
        <button type="button" onClick={() => runCommand('insertOrderedList')}>
          1.
        </button>
        <button type="button" onClick={addLink}>
          Link
        </button>
      </div>
      <div
        ref={editorRef}
        className="sr-rich-editor-input"
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={handleInput}
        onPaste={handlePaste}
        onBlur={handleInput}
      />
    </div>
  );
}

async function reverseGeocode(latitude, longitude) {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', latitude);
    url.searchParams.set('lon', longitude);
    url.searchParams.set('accept-language', 'en');

    const response = await fetch(url.toString());
    if (!response.ok) {
      return {};
    }

    const data = await response.json();
    const address = data?.address || {};
    return {
      city: address.city || address.town || address.village || address.municipality || address.county || '',
      country: (address.country_code || '').toUpperCase() || address.country || ''
    };
  } catch {
    return {};
  }
}

function sanitizeRichText(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  cleanNode(template.content);
  return template.innerHTML;
}

function cleanNode(node) {
  const allowedTags = new Set([
    'A',
    'B',
    'BLOCKQUOTE',
    'BR',
    'CODE',
    'DIV',
    'EM',
    'H1',
    'H2',
    'H3',
    'H4',
    'I',
    'LI',
    'OL',
    'P',
    'PRE',
    'S',
    'STRONG',
    'U',
    'UL'
  ]);
  [...node.childNodes].forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      return;
    }

    if (child.nodeType !== Node.ELEMENT_NODE || !allowedTags.has(child.tagName)) {
      cleanNode(child);
      child.replaceWith(...child.childNodes);
      return;
    }

    [...child.attributes].forEach((attribute) => {
      const allowed = child.tagName === 'A' && ['href', 'title'].includes(attribute.name);
      if (!allowed || (attribute.name === 'href' && !safeHref(attribute.value))) {
        child.removeAttribute(attribute.name);
      }
    });
    cleanNode(child);
  });
}

function safeHref(href) {
  try {
    const url = new URL(href, window.location.origin);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function routeDistance(points) {
  if (points.length < 2) {
    return 0;
  }
  return points.slice(1).reduce((total, point, index) => total + haversine(points[index], point), 0);
}

function haversine(a, b) {
  const radius = 6_371_000;
  const rad = Math.PI / 180;
  const dlat = (b.lat - a.lat) * rad;
  const dlng = (b.lng - a.lng) * rad;
  const x = Math.sin(dlat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2;
  return radius * 2 * Math.asin(Math.sqrt(x));
}

function formatDistance(meters) {
  return meters ? `${(meters / 1000).toFixed(2)} km` : '-';
}

export default Creator;
