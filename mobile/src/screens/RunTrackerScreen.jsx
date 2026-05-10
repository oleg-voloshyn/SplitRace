import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from '../api/client'
import LeafletMap from '../components/LeafletMap'

const LOCATION_TASK = 'splitrace-location-task'
const POINTS_KEY    = 'splitrace_run_points'
const MIN_DISTANCE_M = 30  // below this we treat the activity as "not moving"

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
  // idle | acquiring | recording | paused | saving | saved | error
  const [status, setStatus]     = useState('idle')
  const [points, setPoints]     = useState([])
  const [duration, setDuration] = useState(0)
  const [error, setError]       = useState(null)

  const startTime      = useRef(null)  // first START timestamp (used for started_at)
  const segmentStart   = useRef(null)  // when current active recording segment began
  const accumulatedMs  = useRef(0)     // total active time across pauses
  const timerRef       = useRef(null)

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

  function startTimer() {
    timerRef.current = setInterval(() => {
      const totalMs = accumulatedMs.current + (Date.now() - segmentStart.current)
      setDuration(Math.floor(totalMs / 1000))
    }, 1000)
  }

  async function startLocationUpdates() {
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
  }

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
    setDuration(0)

    await startLocationUpdates()

    startTime.current     = Date.now()
    segmentStart.current  = Date.now()
    accumulatedMs.current = 0
    startTimer()
    setStatus('recording')
  }

  async function pauseRun() {
    clearInterval(timerRef.current)
    await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {})
    accumulatedMs.current += Date.now() - segmentStart.current
    setDuration(Math.floor(accumulatedMs.current / 1000))

    // Pull final batch of points that the background task wrote
    try {
      const stored = await AsyncStorage.getItem(POINTS_KEY)
      if (stored) setPoints(JSON.parse(stored))
    } catch {}

    setStatus('paused')
  }

  async function resumeRun() {
    segmentStart.current = Date.now()
    await startLocationUpdates()
    startTimer()
    setStatus('recording')
  }

  async function finishRun() {
    const stored = await AsyncStorage.getItem(POINTS_KEY)
    const pts = stored ? JSON.parse(stored) : points
    const distance = calcDistance(pts)

    if (pts.length < 2 || distance < MIN_DISTANCE_M) {
      Alert.alert(
        'Not moving yet?',
        'SplitRace needs a longer activity to save and analyze. Please continue or start over.',
        [
          { text: 'Discard', style: 'destructive', onPress: discardRun },
          { text: 'Resume',  onPress: resumeRun },
        ],
        { cancelable: false }
      )
      return
    }

    setStatus('saving')
    const elapsed = Math.floor(accumulatedMs.current / 1000)

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

  async function discardRun() {
    await AsyncStorage.removeItem(POINTS_KEY)
    accumulatedMs.current = 0
    setPoints([])
    setDuration(0)
    setError(null)
    setStatus('idle')
  }

  function reset() {
    setStatus('idle')
    setPoints([])
    setDuration(0)
    accumulatedMs.current = 0
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

  // ── RECORDING / PAUSED ───────────────────────────────────────────────────────
  const distKm   = calcDistance(points) / 1000
  const pace     = duration > 0 && distKm > 0.01 ? fmtTime(Math.round(duration / distKm)) : '--:--'
  const isPaused = status === 'paused'

  return (
    <View style={s.screen}>
      {/* Header bar — yellow when paused */}
      <View style={[s.statsBar, isPaused && s.statsBarPaused]}>
        {isPaused ? (
          <Text style={s.pausedLabel}>PAUSED</Text>
        ) : (
          <View style={s.recDot} />
        )}
        <Stat label="Time"     value={fmtTime(duration)} dark={isPaused} />
        <Stat label="Distance" value={`${distKm.toFixed(2)} km`} dark={isPaused} />
        <Stat label="Pace/km"  value={pace} dark={isPaused} />
      </View>

      {/* Live map */}
      <View style={s.mapWrap}>
        {points.length > 0 ? (
          <LeafletMap points={points} follow={!isPaused} />
        ) : (
          <View style={[StyleSheet.absoluteFill, s.noMap]}>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Waiting for GPS...</Text>
          </View>
        )}
      </View>

      {/* Bottom controls */}
      <View style={s.footer}>
        {isPaused ? (
          <View style={s.pausedRow}>
            <TouchableOpacity style={s.pillBtn('#e53935')} onPress={resumeRun}>
              <Text style={s.pillIcon}>▶</Text>
              <Text style={s.pillLabel}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.pillBtn('#1a1a2e')} onPress={finishRun}>
              <Text style={s.pillIcon}>■</Text>
              <Text style={s.pillLabel}>Finish</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.roundBtn('#e53935')} onPress={pauseRun}>
            <Text style={s.btnLabel}>STOP</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

function Stat({ label, value, dark }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: dark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</Text>
      <Text style={{ color: dark ? '#1a1a2e' : '#fff', fontSize: 20, fontWeight: '700' }}>{value}</Text>
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
  screen:        { flex: 1, backgroundColor: '#1a1a2e' },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#1a1a2e' },
  statsBarPaused:{ backgroundColor: '#ffc107' },
  recDot:        { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e53935' },
  pausedLabel:   { color: '#1a1a2e', fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  mapWrap:       { flex: 1, position: 'relative' },
  noMap:         { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  footer:        { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16, backgroundColor: '#1a1a2e' },
  gpsDot:        { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2196f3' },
  roundBtn:      (bg) => ({ backgroundColor: bg, width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' }),
  btnLabel:      { color: '#fff', fontWeight: '700', fontSize: 15 },
  pausedRow:     { flexDirection: 'row', gap: 12, width: '100%' },
  pillBtn:       (bg) => ({ flex: 1, backgroundColor: bg, height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }),
  pillIcon:      { color: '#fff', fontSize: 14 },
  pillLabel:     { color: '#fff', fontWeight: '700', fontSize: 16 },
})
