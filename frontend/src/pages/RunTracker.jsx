import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import LiveMap from '../components/LiveMap'

export default function RunTracker() {
  const { t } = useTranslation()
  const [status, setStatus]     = useState('idle')
  const [points, setPoints]     = useState([])
  const [duration, setDuration] = useState(0)
  const [error, setError]       = useState(null)
  const watchId   = useRef(null)
  const startTime = useRef(null)
  const timerRef  = useRef(null)

  function startRun() {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return }
    setPoints([])
    setDuration(0)
    setError(null)
    setStatus('recording')
    startTime.current = Date.now()

    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime.current) / 1000))
    }, 1000)

    watchId.current = navigator.geolocation.watchPosition(
      pos => setPoints(prev => [...prev, {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        ts:  Math.floor(pos.timestamp / 1000),
        accuracy: pos.coords.accuracy,
      }]),
      err => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    )
  }

  async function stopRun() {
    clearInterval(timerRef.current)
    navigator.geolocation.clearWatch(watchId.current)

    if (points.length < 2) { setStatus('idle'); return }

    const elapsed  = Math.floor((Date.now() - startTime.current) / 1000)
    const distance = calcDistance(points)

    try {
      await api.saveActivity({
        started_at:           new Date(startTime.current).toISOString(),
        finished_at:          new Date().toISOString(),
        elapsed_time_seconds: elapsed,
        distance_meters:      Math.round(distance),
        source:               'web_pwa',
        gps_points:           points,
      })
      setStatus('saved')
    } catch {
      setError('Failed to save run')
      setStatus('error')
    }
  }

  useEffect(() => () => {
    clearInterval(timerRef.current)
    if (watchId.current) navigator.geolocation.clearWatch(watchId.current)
  }, [])

  // ── IDLE ──────────────────────────────────────────────────────────────────
  if (status === 'idle' || status === 'error') return (
    <div style={styles.centerPage}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.1rem', color: '#888', marginBottom: '2rem' }}>
          {t('run.title')}
        </div>
        <button onClick={startRun} style={styles.roundBtn('#4caf50')}>
          {t('run.start')}
        </button>
        {error && <p style={{ color: '#e53935', marginTop: '1.5rem', fontSize: '0.9rem' }}>{error}</p>}
      </div>
    </div>
  )

  // ── SAVED ─────────────────────────────────────────────────────────────────
  if (status === 'saved') return (
    <div style={styles.centerPage}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
        <p style={{ color: '#4caf50', fontSize: '1.2rem', marginBottom: '2rem' }}>
          {t('run.saved')}
        </p>
        <div style={{ color: '#555', marginBottom: '0.5rem' }}>
          {formatTime(duration)} · {(calcDistance(points) / 1000).toFixed(2)} km
        </div>
        <button onClick={() => setStatus('idle')} style={styles.roundBtn('#1a1a2e')}>
          {t('run.start')}
        </button>
      </div>
    </div>
  )

  // ── RECORDING ─────────────────────────────────────────────────────────────
  const distKm = calcDistance(points) / 1000
  const pace   = duration > 0 && distKm > 0.01
    ? formatTime(Math.round(duration / distKm))
    : '--:--'

  return (
    <div style={styles.runScreen}>
      {/* top stats bar */}
      <div style={styles.statsBar}>
        <div style={styles.dot} />
        <Stat label={t('run.duration')} value={formatTime(duration)} />
        <Stat label={t('run.distance')} value={`${distKm.toFixed(2)} km`} />
        <Stat label="Pace /km"          value={pace} />
      </div>

      {/* map fills remaining space */}
      <div style={styles.mapWrap}>
        {points.length === 0
          ? <div style={styles.gpsWait}>{t('run.gpsWaiting')}</div>
          : <LiveMap points={points} />
        }
      </div>

      {/* stop button always pinned at bottom */}
      <div style={styles.footer}>
        <button onClick={stopRun} style={styles.roundBtn('#e53935')}>
          {t('run.stop')}
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff' }}>{value}</div>
    </div>
  )
}

function formatTime(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}
const pad = n => String(n).padStart(2, '0')

function calcDistance(pts) {
  if (pts.length < 2) return 0
  return pts.slice(1).reduce((total, pt, i) => total + haversine(pts[i], pt), 0)
}

function haversine(a, b) {
  const R = 6371000, rad = Math.PI / 180
  const dlat = (b.lat - a.lat) * rad, dlng = (b.lng - a.lng) * rad
  const x = Math.sin(dlat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(x))
}

const styles = {
  centerPage: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flex: 1, padding: '2rem',
  },
  runScreen: {
    display: 'flex', flexDirection: 'column',
    flex: 1,
    background: '#1a1a2e',
  },
  statsBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-around',
    padding: '0.75rem 1rem',
    background: '#1a1a2e',
    flexShrink: 0,
  },
  dot: {
    width: 10, height: 10, borderRadius: '50%',
    background: '#e53935',
    boxShadow: '0 0 0 3px rgba(229,57,53,0.3)',
    animation: 'pulse 1.5s infinite',
    flexShrink: 0,
  },
  mapWrap: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  gpsWait: {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#888', fontSize: '0.95rem',
    background: '#111',
  },
  footer: {
    flexShrink: 0,
    display: 'flex', justifyContent: 'center',
    padding: '1rem',
    background: '#1a1a2e',
  },
  roundBtn: (bg) => ({
    background: bg, color: '#fff', border: 'none', borderRadius: '50%',
    width: '90px', height: '90px', fontSize: '1rem', cursor: 'pointer',
    fontWeight: '700', boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
  }),
}
