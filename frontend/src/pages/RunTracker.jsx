import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import MapView from '../components/MapView'

export default function RunTracker() {
  const { t } = useTranslation()
  const [status, setStatus]   = useState('idle') // idle | recording | saved | error
  const [points, setPoints]   = useState([])
  const [duration, setDuration] = useState(0)
  const [error, setError]     = useState(null)
  const watchId = useRef(null)
  const startTime = useRef(null)
  const timerRef = useRef(null)

  function startRun() {
    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      return
    }
    setPoints([])
    setDuration(0)
    setStatus('recording')
    startTime.current = Date.now()

    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime.current) / 1000))
    }, 1000)

    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        const pt = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          ts:  Math.floor(pos.timestamp / 1000),
          accuracy: pos.coords.accuracy,
        }
        setPoints(prev => [...prev, pt])
      },
      err => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    )
  }

  async function stopRun() {
    clearInterval(timerRef.current)
    navigator.geolocation.clearWatch(watchId.current)

    if (points.length < 2) {
      setStatus('idle')
      return
    }

    const elapsed = Math.floor((Date.now() - startTime.current) / 1000)
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
    } catch (err) {
      setError('Failed to save run')
      setStatus('error')
    }
  }

  useEffect(() => () => {
    clearInterval(timerRef.current)
    if (watchId.current) navigator.geolocation.clearWatch(watchId.current)
  }, [])

  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <h2>{t('run.title')}</h2>

      {status === 'idle' && (
        <button onClick={startRun} style={bigBtnStyle('#4caf50')}>
          {t('run.start')}
        </button>
      )}

      {status === 'recording' && (
        <>
          <p style={{ color: '#e53935', fontWeight: 'bold', fontSize: '1.1rem' }}>● {t('run.recording')}</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', margin: '1.5rem 0' }}>
            <Metric label={t('run.duration')} value={formatTime(duration)} />
            <Metric label={t('run.distance')} value={`${(calcDistance(points) / 1000).toFixed(2)} km`} />
            <Metric label="GPS Points"        value={points.length} />
          </div>
          {points.length === 0 && <p style={{ color: '#888' }}>{t('run.gpsWaiting')}</p>}
          {points.length > 0 && (
            <div style={{ margin: '1rem 0' }}>
              <MapView gpsTrack={points} height="300px" />
            </div>
          )}
          <button onClick={stopRun} style={bigBtnStyle('#e53935')}>
            {t('run.stop')}
          </button>
        </>
      )}

      {status === 'saved' && (
        <div>
          <p style={{ color: '#4caf50', fontSize: '1.2rem' }}>✓ {t('run.saved')}</p>
          <button onClick={() => setStatus('idle')} style={bigBtnStyle('#1a1a2e')}>
            {t('run.start')} again
          </button>
        </div>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '0.8rem', color: '#888' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{value}</div>
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

const bigBtnStyle = (bg) => ({
  background: bg, color: '#fff', border: 'none', borderRadius: '50%',
  width: '120px', height: '120px', fontSize: '1.1rem', cursor: 'pointer',
  fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
})
