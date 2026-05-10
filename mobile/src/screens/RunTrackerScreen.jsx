import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, AppState } from 'react-native'
import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from '../api/client'

const LOCATION_TASK = 'splitrace-location-task'
const POINTS_KEY    = 'splitrace_run_points'

// Background task — runs even when screen is locked
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return
  const pts = data.locations.map(loc => ({
    lat:      loc.coords.latitude,
    lng:      loc.coords.longitude,
    ts:       Math.floor(loc.timestamp / 1000),
    accuracy: loc.coords.accuracy,
  }))
  try {
    const existing = await AsyncStorage.getItem(POINTS_KEY)
    const arr = existing ? JSON.parse(existing) : []
    await AsyncStorage.setItem(POINTS_KEY, JSON.stringify([...arr, ...pts]))
  } catch {}
})

export default function RunTrackerScreen() {
  const [status, setStatus]     = useState('idle')   // idle | acquiring | recording | saving | saved | error
  const [points, setPoints]     = useState([])
  const [duration, setDuration] = useState(0)
  const [error, setError]       = useState(null)
  const startTime = useRef(null)
  const timerRef  = useRef(null)

  // Poll AsyncStorage for new GPS points while recording
  useEffect(() => {
    if (status !== 'recording') return
    const interval = setInterval(async () => {
      try {
        const stored = await AsyncStorage.getItem(POINTS_KEY)
        if (stored) setPoints(JSON.parse(stored))
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [status])

  // Cleanup on unmount
  useEffect(() => () => {
    clearInterval(timerRef.current)
    Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {})
  }, [])

  async function startRun() {
    setError(null)
    setStatus('acquiring')

    const { status: fg } = await Location.requestForegroundPermissionsAsync()
    if (fg !== 'granted') { setError('Location permission denied'); setStatus('error'); return }

    const { status: bg } = await Location.requestBackgroundPermissionsAsync()
    if (bg !== 'granted') {
      Alert.alert(
        'Background location needed',
        'To record your run when the screen is off, please allow "Allow all the time" in location settings.',
        [{ text: 'OK' }]
      )
    }

    await AsyncStorage.removeItem(POINTS_KEY)
    setPoints([])

    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy:            Location.Accuracy.BestForNavigation,
      timeInterval:        3000,
      distanceInterval:    5,
      foregroundService: {
        notificationTitle: 'SplitRace — Recording run',
        notificationBody:  'Your route is being tracked.',
        notificationColor: '#e53935',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    })

    startTime.current = Date.now()
    timerRef.current  = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime.current) / 1000))
    }, 1000)
    setStatus('recording')
  }

  async function stopRun() {
    clearInterval(timerRef.current)
    await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {})
    setStatus('saving')

    const stored = await AsyncStorage.getItem(POINTS_KEY)
    const pts = stored ? JSON.parse(stored) : points

    if (pts.length < 2) { setStatus('idle'); return }

    const elapsed  = Math.floor((Date.now() - startTime.current) / 1000)
    const distance = calcDistance(pts)

    try {
      await api.saveActivity({
        started_at:           new Date(startTime.current).toISOString(),
        finished_at:          new Date().toISOString(),
        elapsed_time_seconds: elapsed,
        distance_meters:      Math.round(distance),
        source:               'mobile_android',
        gps_points:           pts,
      })
      await AsyncStorage.removeItem(POINTS_KEY)
      setStatus('saved')
    } catch (e) {
      setError(e?.errors?.join(', ') || 'Failed to save run')
      setStatus('error')
    }
  }

  function reset() {
    setStatus('idle')
    setPoints([])
    setDuration(0)
    setError(null)
  }

  // ── IDLE / ERROR ─────────────────────────────────────────────────────────────
  if (status === 'idle' || status === 'error') return (
    <View style={[s.center, { backgroundColor: '#1a1a2e' }]}>
      <Text style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 32, fontSize: 15 }}>Ready to run</Text>
      <TouchableOpacity style={s.roundBtn('#4caf50')} onPress={startRun}>
        <Text style={s.btnLabel}>START</Text>
      </TouchableOpacity>
      {error && <Text style={{ color: '#e53935', marginTop: 20, textAlign: 'center', paddingHorizontal: 24 }}>{error}</Text>}
    </View>
  )

  // ── ACQUIRING ────────────────────────────────────────────────────────────────
  if (status === 'acquiring') return (
    <View style={[s.center, { backgroundColor: '#1a1a2e' }]}>
      <View style={s.gpsDot} />
      <Text style={{ color: '#fff', fontSize: 16, marginTop: 24, marginBottom: 8 }}>Getting GPS signal...</Text>
      <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 40 }}>Go outside for a better signal</Text>
      <TouchableOpacity style={[s.roundBtn('#555'), { width: 70, height: 70 }]} onPress={reset}>
        <Text style={[s.btnLabel, { fontSize: 13 }]}>Cancel</Text>
      </TouchableOpacity>
    </View>
  )

  // ── SAVING ───────────────────────────────────────────────────────────────────
  if (status === 'saving') return (
    <View style={[s.center, { backgroundColor: '#1a1a2e' }]}>
      <Text style={{ color: '#fff', fontSize: 16 }}>Saving run...</Text>
    </View>
  )

  // ── SAVED ────────────────────────────────────────────────────────────────────
  if (status === 'saved') return (
    <View style={[s.center, { backgroundColor: '#1a1a2e' }]}>
      <Text style={{ fontSize: 48, marginBottom: 8 }}>✓</Text>
      <Text style={{ color: '#4caf50', fontSize: 20, marginBottom: 8 }}>Run saved!</Text>
      <Text style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 40 }}>
        {fmtTime(duration)} · {(calcDistance(points) / 1000).toFixed(2)} km
      </Text>
      <TouchableOpacity style={s.roundBtn('#1a1a2e')} onPress={reset}>
        <Text style={s.btnLabel}>NEW RUN</Text>
      </TouchableOpacity>
    </View>
  )

  // ── RECORDING ────────────────────────────────────────────────────────────────
  const distKm = calcDistance(points) / 1000
  const pace   = duration > 0 && distKm > 0.01 ? fmtTime(Math.round(duration / distKm)) : '--:--'

  return (
    <View style={s.screen}>
      {/* Stats bar */}
      <View style={s.statsBar}>
        <View style={s.recDot} />
        <Stat label="Time"     value={fmtTime(duration)} />
        <Stat label="Distance" value={`${distKm.toFixed(2)} km`} />
        <Stat label="Pace/km"  value={pace} />
      </View>

      {/* Map placeholder — Google Maps API key needed for real map */}
      <View style={s.mapWrap}>
        <View style={[StyleSheet.absoluteFill, s.noMap]}>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            {points.length > 0 ? `${points.length} points recorded` : 'Waiting for GPS...'}
          </Text>
        </View>
      </View>

      {/* Stop button */}
      <View style={s.footer}>
        <TouchableOpacity style={s.roundBtn('#e53935')} onPress={stopRun}>
          <Text style={s.btnLabel}>STOP</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function Stat({ label, value }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</Text>
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>{value}</Text>
    </View>
  )
}

function fmtTime(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  const pad = n => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

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

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: '#1a1a2e' },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#1a1a2e' },
  recDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e53935' },
  mapWrap:  { flex: 1, position: 'relative' },
  noMap:    { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  footer:   { alignItems: 'center', paddingVertical: 20, backgroundColor: '#1a1a2e' },
  gpsDot:   { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2196f3' },
  roundBtn: (bg) => ({ backgroundColor: bg, width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' }),
  btnLabel: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
