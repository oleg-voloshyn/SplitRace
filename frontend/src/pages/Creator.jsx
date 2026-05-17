import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  totalSegments: '4',
  ratedSegments: '2'
};

const TOURNAMENT_STEPS = 5;

function Creator() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname.replace(/\/$/, '');
  const isSegmentNew = path === '/creator/segments/new';
  const isTournamentNew = path === '/creator/tournaments/new';
  const isHub = !isSegmentNew && !isTournamentNew;
  const routeMessage = location.state?.creatorMessage;
  const [segmentDefaults, setSegmentDefaults] = useState(defaultSegment);
  const [segmentForm, setSegmentForm] = useState(defaultSegment);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState(null);
  const [message, setMessage] = useState(null);

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
      navigate('/creator', { state: { creatorMessage: t('creator.segmentCreated') } });
    } catch (error) {
      setMessage(error?.errors?.join(', ') || t('creator.failed'));
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
      {(message || routeMessage) && (
        <p className="sr-alert sr-alert-success sr-spaced-card">{message || routeMessage}</p>
      )}

      {isHub && (
        <div className="sr-creator-actions sr-creator-actions-only">
          <Link to="/creator/segments/new" className="sr-flow-card">
            <span className="sr-flow-card-media">
              <SegmentCardIcon />
            </span>
            <span className="sr-flow-card-body">
              <span className="sr-flow-card-badge">{t('creator.segments')}</span>
              <span className="sr-flow-card-title">{t('creator.newSegment')}</span>
              <span className="sr-flow-card-cta" aria-hidden="true">
                {t('creator.createSegment')} →
              </span>
            </span>
          </Link>
          <Link to="/creator/tournaments/new" className="sr-flow-card">
            <span className="sr-flow-card-media">
              <TournamentCardIcon />
            </span>
            <span className="sr-flow-card-body">
              <span className="sr-flow-card-badge">{t('nav.tournaments')}</span>
              <span className="sr-flow-card-title">{t('creator.newTournament')}</span>
              <span className="sr-flow-card-cta" aria-hidden="true">
                {t('creator.createTournament')} →
              </span>
            </span>
          </Link>
        </div>
      )}

      {isSegmentNew && (
        <>
          <CreatorBreadcrumbs current={t('creator.newSegment')} />
          <div className="sr-page-heading">
            <h2>{t('creator.newSegment')}</h2>
            <Link to="/creator" className="sr-btn sr-btn-ghost">
              {t('profile.cancel')}
            </Link>
          </div>

          <form className="sr-card sr-creator-form sr-creator-form-wide" onSubmit={createSegment}>
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
        </>
      )}

      {isTournamentNew && (
        <>
          <CreatorBreadcrumbs current={t('creator.newTournament')} />
          <div className="sr-page-heading">
            <h2>{t('creator.newTournament')}</h2>
            <Link to="/creator" className="sr-btn sr-btn-ghost">
              {t('profile.cancel')}
            </Link>
          </div>

          <TournamentWizard
            onCreated={() => navigate('/creator', { state: { creatorMessage: t('creator.tournamentCreated') } })}
            onError={(error) => setMessage(error ? error?.errors?.join(', ') || t('creator.failed') : null)}
          />
        </>
      )}
    </div>
  );

  function setSegment(key) {
    return (event) => setSegmentForm((current) => ({ ...current, [key]: event.target.value }));
  }
}

function TournamentWizard({ onCreated, onError }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialTournament);
  const [segments, setSegments] = useState(null);
  const [selectedSegments, setSelectedSegments] = useState({});
  const [query, setQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const totalTarget = Number(form.totalSegments) || 0;
  const ratedTarget = Number(form.ratedSegments) || 0;
  const selectedEntries = useMemo(
    () => Object.entries(selectedSegments).sort(([, a], [, b]) => a.order - b.order),
    [selectedSegments]
  );
  const selectedCount = selectedEntries.length;
  const ratedSelected = selectedEntries.filter(([, meta]) => meta.rated).length;
  const selectedIds = useMemo(() => new Set(selectedEntries.map(([id]) => String(id))), [selectedEntries]);
  const selectedSegmentList = useMemo(() => {
    if (!segments) {
      return [];
    }

    return selectedEntries
      .map(([id, meta]) => {
        const segment = segments.find((item) => String(item.id) === String(id));
        return segment ? { segment, meta } : null;
      })
      .filter(Boolean);
  }, [segments, selectedEntries]);
  const availableSegments = useMemo(() => {
    if (!segments) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    return segments.filter((segment) => {
      if (selectedIds.has(String(segment.id))) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [segment.name, segment.city, segment.country]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [query, segments, selectedIds]);

  useEffect(() => {
    if (step !== TOURNAMENT_STEPS || segments !== null) {
      return;
    }

    api
      .mySegments()
      .then(setSegments)
      .catch(() => setSegments([]));
  }, [segments, step]);

  function setField(key) {
    return (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  }

  function setDescription(description) {
    setForm((current) => ({ ...current, description }));
  }

  function addSegment(segment) {
    setSelectedSegments((current) => {
      if (current[segment.id]) {
        return current;
      }

      const nextOrder = Math.max(-1, ...Object.values(current).map((meta) => meta.order)) + 1;
      return { ...current, [segment.id]: { order: nextOrder, rated: false } };
    });
  }

  function removeSegment(segment) {
    setSelectedSegments((current) => {
      const next = { ...current };
      delete next[segment.id];
      return next;
    });
  }

  function toggleRated(segment) {
    setSelectedSegments((current) => {
      const entry = current[segment.id];
      if (!entry) {
        return current;
      }

      return { ...current, [segment.id]: { ...entry, rated: !entry.rated } };
    });
  }

  function canGoNext() {
    if (step === 1) {
      return form.name.trim().length > 0;
    }

    if (step === 2) {
      return true;
    }

    if (step === 3) {
      return form.country.trim().length > 0;
    }

    if (step === 4) {
      return (
        Number.isInteger(totalTarget) &&
        totalTarget > 1 &&
        Number.isInteger(ratedTarget) &&
        ratedTarget > 0 &&
        ratedTarget < totalTarget
      );
    }

    return false;
  }

  function canSubmit() {
    return selectedCount === totalTarget && ratedSelected === ratedTarget;
  }

  async function submit(event) {
    event.preventDefault();
    onError(null);

    if (!canSubmit()) {
      return;
    }

    setSubmitting(true);
    try {
      const tournament = await api.createTournament({
        name: form.name.trim(),
        description: form.description.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
        total_segments_count: String(totalTarget),
        rated_segments_count: String(ratedTarget)
      });

      for (const [index, [segmentId, meta]] of selectedEntries.entries()) {
        await api.addTournamentSegment(tournament.slug, {
          segment_id: segmentId,
          order_number: String(index + 1),
          is_rated: meta.rated ? '1' : '0'
        });
      }

      onCreated();
    } catch (error) {
      onError(error);
    } finally {
      setSubmitting(false);
    }
  }

  function nextStep() {
    if (canGoNext()) {
      setStep((current) => Math.min(TOURNAMENT_STEPS, current + 1));
    }
  }

  return (
    <form className="sr-card sr-creator-form sr-creator-form-wide sr-tournament-wizard" onSubmit={submit}>
      <div className="sr-wizard-progress">
        <span>{t('creator.wizardStep', { current: step, total: TOURNAMENT_STEPS })}</span>
        <div className="sr-wizard-bars" aria-hidden="true">
          {Array.from({ length: TOURNAMENT_STEPS }, (_, index) => (
            <span key={index} className={index < step ? 'active' : ''} />
          ))}
        </div>
      </div>

      {step === 1 && (
        <section className="sr-wizard-step">
          <h3>{t('creator.tournamentName')}</h3>
          <p>{t('creator.tournamentNameHelp')}</p>
          <input
            autoFocus
            required
            maxLength={120}
            placeholder={t('creator.tournamentNamePlaceholder')}
            value={form.name}
            onChange={setField('name')}
          />
        </section>
      )}

      {step === 2 && (
        <section className="sr-wizard-step">
          <h3>{t('creator.description')}</h3>
          <p>{t('creator.descriptionHelp')}</p>
          <RichTextEditor value={form.description} onChange={setDescription} placeholder={t('creator.description')} />
        </section>
      )}

      {step === 3 && (
        <section className="sr-wizard-step">
          <h3>
            {t('creator.country')} & {t('creator.city')}
          </h3>
          <p>{t('creator.locationHelp')}</p>
          <div className="sr-creator-two">
            <label>
              <span>{t('creator.country')}</span>
              <input
                required
                maxLength={120}
                placeholder={t('creator.country')}
                value={form.country}
                onChange={setField('country')}
              />
            </label>
            <label>
              <span>{t('creator.city')}</span>
              <input maxLength={120} placeholder={t('creator.city')} value={form.city} onChange={setField('city')} />
            </label>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="sr-wizard-step">
          <h3>{t('creator.tournamentSegments')}</h3>
          <p>{t('creator.segmentsCountHelp')}</p>
          <div className="sr-creator-two">
            <label>
              <span>{t('creator.totalSegments')}</span>
              <input min="2" max="100" type="number" value={form.totalSegments} onChange={setField('totalSegments')} />
              <small>{t('creator.totalSegmentsHelp')}</small>
            </label>
            <label>
              <span>{t('creator.ratedSegments')}</span>
              <input min="1" max="99" type="number" value={form.ratedSegments} onChange={setField('ratedSegments')} />
              <small>{t('creator.ratedSegmentsHelp')}</small>
            </label>
          </div>
        </section>
      )}

      {step === 5 && (
        <section className="sr-wizard-step">
          <h3>{t('creator.pickSegments')}</h3>
          <p>{t('creator.pickSegmentsHint')}</p>
          <div className="sr-wizard-counts">
            <span>{t('creator.selectedSegmentsProgress', { selected: selectedCount, total: totalTarget })}</span>
            <span>{t('creator.ratedSegmentsProgress', { rated: ratedSelected, total: ratedTarget })}</span>
          </div>

          {selectedSegmentList.length > 0 && (
            <div className="sr-wizard-selected">
              <h4>{t('creator.selectedSegments')}</h4>
              <div className="sr-wizard-segment-list">
                {selectedSegmentList.map(({ segment, meta }, index) => (
                  <SegmentPickRow
                    key={segment.id}
                    segment={segment}
                    meta={meta}
                    orderNumber={index + 1}
                    selected
                    onSelect={() => removeSegment(segment)}
                    onToggleRated={() => toggleRated(segment)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="sr-wizard-search">
            <input
              type="search"
              placeholder={t('creator.searchSegments')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Link to="/creator/segments/new" className="sr-btn sr-btn-ghost">
              {t('creator.createNewSegment')}
            </Link>
          </div>

          {segments === null ? (
            <p className="sr-wizard-empty">{t('common.loading')}</p>
          ) : availableSegments.length === 0 ? (
            <p className="sr-wizard-empty">
              {segments.length === 0 ? t('creator.noSegmentsYet') : t('creator.noMatchingSegments')}
            </p>
          ) : (
            <div className="sr-wizard-segment-list">
              {availableSegments.map((segment) => (
                <SegmentPickRow
                  key={segment.id}
                  segment={segment}
                  onSelect={() => addSegment(segment)}
                  disabled={selectedCount >= totalTarget}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <div className="sr-wizard-actions">
        <button
          type="button"
          className="sr-creator-ghost-btn"
          disabled={step === 1 || submitting}
          onClick={() => setStep((current) => Math.max(1, current - 1))}
        >
          ← {t('creator.back')}
        </button>
        {step === TOURNAMENT_STEPS ? (
          <button type="submit" disabled={!canSubmit() || submitting}>
            {submitting ? t('common.loading') : t('creator.createTournament')}
          </button>
        ) : (
          <button type="button" disabled={!canGoNext()} onClick={nextStep}>
            {t('creator.next')} →
          </button>
        )}
      </div>
    </form>
  );
}

function SegmentPickRow({ segment, meta, orderNumber, selected = false, disabled = false, onSelect, onToggleRated }) {
  const { t } = useTranslation();

  return (
    <div className={selected ? 'sr-wizard-segment-row selected' : 'sr-wizard-segment-row'}>
      <button type="button" disabled={disabled} onClick={onSelect}>
        {selected ? '×' : '+'}
      </button>
      <div className="sr-wizard-segment-main">
        <strong>{segment.name}</strong>
        <span>
          {formatDistance(segment.distance_meters)}
          {[segment.city, segment.country].filter(Boolean).length > 0
            ? ` · ${[segment.city, segment.country].filter(Boolean).join(', ')}`
            : ''}
        </span>
      </div>
      {selected && (
        <>
          <span className="sr-wizard-order">#{orderNumber}</span>
          <label className="sr-wizard-rated-toggle">
            <input type="checkbox" checked={Boolean(meta?.rated)} onChange={onToggleRated} />
            <span>{t('creator.rated')}</span>
          </label>
        </>
      )}
    </div>
  );
}

function CreatorBreadcrumbs({ current }) {
  const { t } = useTranslation();

  return (
    <nav className="sr-breadcrumbs" aria-label="Breadcrumb">
      <Link to="/creator">{t('nav.creator')}</Link>
      <span aria-hidden="true">/</span>
      <span>{current}</span>
    </nav>
  );
}

function SegmentCardIcon() {
  return (
    <svg className="sr-creator-action-icon" viewBox="0 0 120 84" aria-hidden="true" focusable="false">
      <path className="sr-creator-action-route-shadow" d="M18 62 C34 66, 48 52, 62 52 S82 68, 101 48" />
      <path className="sr-creator-action-route" d="M17 56 C34 62, 49 43, 62 45 S81 63, 101 41" />
      <circle className="sr-creator-action-node" cx="17" cy="56" r="7" />
      <circle className="sr-creator-action-node sr-creator-action-node-end" cx="101" cy="41" r="7" />
      <path
        className="sr-creator-action-pin"
        d="M75 13c-10 0-18 8-18 18 0 14 18 33 18 33s18-19 18-33c0-10-8-18-18-18z"
      />
      <circle className="sr-creator-action-pin-hole" cx="75" cy="31" r="6" />
    </svg>
  );
}

function TournamentCardIcon() {
  return (
    <svg className="sr-creator-action-icon" viewBox="0 0 120 84" aria-hidden="true" focusable="false">
      <path className="sr-creator-action-cup" d="M47 17h26v11c0 16-7 26-13 26s-13-10-13-26V17z" />
      <path className="sr-creator-action-handle" d="M47 24H33c0 16 8 23 19 24" />
      <path className="sr-creator-action-handle" d="M73 24h14c0 16-8 23-19 24" />
      <path className="sr-creator-action-stem" d="M60 54v12" />
      <path className="sr-creator-action-base" d="M43 70h34" />
      <path className="sr-creator-action-podium" d="M18 71h20V55h18v16h20V45h20v26" />
      <circle className="sr-creator-action-spark" cx="31" cy="29" r="3" />
      <circle className="sr-creator-action-spark" cx="91" cy="19" r="3" />
    </svg>
  );
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
