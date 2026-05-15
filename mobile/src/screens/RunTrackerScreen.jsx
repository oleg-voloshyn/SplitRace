import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../api/client';
import LeafletMap from '../components/LeafletMap';

const LOCATION_TASK = 'splitrace-location-task';
const POINTS_KEY = 'splitrace_run_points';
const MIN_DISTANCE_M = 30; // below this we treat the activity as "not moving"

// Background task — runs even when screen is locked
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) {
    return;
  }
  const pts = data.locations.map((loc) => ({
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    ts: Math.floor(loc.timestamp / 1000),
    accuracy: loc.coords.accuracy
  }));
  try {
    const existing = await AsyncStorage.getItem(POINTS_KEY);
    const arr = existing ? JSON.parse(existing) : [];
    await AsyncStorage.setItem(POINTS_KEY, JSON.stringify([...arr, ...pts]));
  } catch {
    // Background point persistence is best effort.
  }
});

function RunTrackerScreen() {
  const { t } = useTranslation();
  // idle | acquiring | recording | paused | saving | saved | error
  const [status, setStatus] = useState('idle');
  const [points, setPoints] = useState([]);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);
  const [savedActivity, setSavedActivity] = useState(null);

  const startTime = useRef(null); // first START timestamp (used for started_at)
  const segmentStart = useRef(null); // when current active recording segment began
  const accumulatedMs = useRef(0); // total active time across pauses
  const timerRef = useRef(null);

  // Poll AsyncStorage for new GPS points while recording
  useEffect(() => {
    if (status !== 'recording') {
      return;
    }
    const interval = setInterval(async () => {
      try {
        const stored = await AsyncStorage.getItem(POINTS_KEY);
        if (stored) {
          setPoints(JSON.parse(stored));
        }
      } catch {
        // Background point sync is best effort.
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [status]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      clearInterval(timerRef.current);
      Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {
        // Stopping updates can fail if the task is already stopped.
      });
    },
    []
  );

  function startTimer() {
    timerRef.current = setInterval(() => {
      const totalMs = accumulatedMs.current + (Date.now() - segmentStart.current);
      setDuration(Math.floor(totalMs / 1000));
    }, 1000);
  }

  async function startLocationUpdates() {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 3000,
      distanceInterval: 5,
      foregroundService: {
        notificationTitle: 'SplitRace — Recording run',
        notificationBody: 'Your route is being tracked.',
        notificationColor: '#e53935'
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true
    });
  }

  async function startRun() {
    setError(null);
    setStatus('acquiring');

    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== 'granted') {
      setError(t('run.permissionDenied'));
      setStatus('error');
      return;
    }

    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    if (bg !== 'granted') {
      Alert.alert(t('run.backgroundNeeded'), t('run.backgroundNeededMsg'), [{ text: t('common.ok') }]);
    }

    await AsyncStorage.removeItem(POINTS_KEY);
    setPoints([]);
    setDuration(0);

    await startLocationUpdates();

    startTime.current = Date.now();
    segmentStart.current = Date.now();
    accumulatedMs.current = 0;
    startTimer();
    setStatus('recording');
  }

  async function pauseRun() {
    clearInterval(timerRef.current);
    await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {
      // Stopping updates can fail if the task is already stopped.
    });
    accumulatedMs.current += Date.now() - segmentStart.current;
    setDuration(Math.floor(accumulatedMs.current / 1000));

    // Pull final batch of points that the background task wrote
    try {
      const stored = await AsyncStorage.getItem(POINTS_KEY);
      if (stored) {
        setPoints(JSON.parse(stored));
      }
    } catch {
      // Pulling final background points is best effort.
    }

    setStatus('paused');
  }

  async function resumeRun() {
    segmentStart.current = Date.now();
    await startLocationUpdates();
    startTimer();
    setStatus('recording');
  }

  async function finishRun() {
    const stored = await AsyncStorage.getItem(POINTS_KEY);
    const pts = stored ? JSON.parse(stored) : points;
    const distance = calcDistance(pts);

    if (pts.length < 2 || distance < MIN_DISTANCE_M) {
      Alert.alert(
        t('run.notMoving'),
        t('run.notMovingMsg'),
        [
          { text: t('run.discard'), style: 'destructive', onPress: discardRun },
          { text: t('run.resume'), onPress: resumeRun }
        ],
        { cancelable: false }
      );
      return;
    }

    setStatus('saving');
    const elapsed = Math.floor(accumulatedMs.current / 1000);

    try {
      const activity = await api.saveActivity({
        started_at: new Date(startTime.current).toISOString(),
        finished_at: new Date().toISOString(),
        elapsed_time_seconds: elapsed,
        distance_meters: Math.round(distance),
        source: Platform.OS === 'ios' ? 'mobile_ios' : 'mobile_android',
        gps_points: pts
      });
      await AsyncStorage.removeItem(POINTS_KEY);
      setSavedActivity(activity);
      setPoints(pts);
      setDuration(activity.elapsed_time_seconds || elapsed);
      setStatus('saved');
    } catch (e) {
      setError(e?.errors?.join(', ') || t('run.saveFailed'));
      setStatus('error');
    }
  }

  async function discardRun() {
    await AsyncStorage.removeItem(POINTS_KEY);
    accumulatedMs.current = 0;
    setPoints([]);
    setDuration(0);
    setError(null);
    setStatus('idle');
  }

  function reset() {
    setStatus('idle');
    setPoints([]);
    setDuration(0);
    setSavedActivity(null);
    accumulatedMs.current = 0;
    setError(null);
  }

  // ── IDLE / ERROR ─────────────────────────────────────────────────────────────
  if (status === 'idle' || status === 'error') {
    return (
      <View style={[s.center, { backgroundColor: '#1a1a2e' }]}>
        <Text style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 32, fontSize: 15 }}>{t('run.ready')}</Text>
        <TouchableOpacity style={s.roundBtn('#4caf50')} onPress={startRun}>
          <Text style={s.btnLabel}>{t('run.start')}</Text>
        </TouchableOpacity>
        {error && (
          <Text style={{ color: '#e53935', marginTop: 20, textAlign: 'center', paddingHorizontal: 24 }}>{error}</Text>
        )}
      </View>
    );
  }

  // ── ACQUIRING ────────────────────────────────────────────────────────────────
  if (status === 'acquiring') {
    return (
      <View style={[s.center, { backgroundColor: '#1a1a2e' }]}>
        <View style={s.gpsDot} />
        <Text style={{ color: '#fff', fontSize: 16, marginTop: 24, marginBottom: 8 }}>{t('run.gettingGps')}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 40 }}>{t('run.goOutside')}</Text>
        <TouchableOpacity style={[s.roundBtn('#555'), { width: 70, height: 70 }]} onPress={reset}>
          <Text style={[s.btnLabel, { fontSize: 13 }]}>{t('run.cancel')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── SAVING ───────────────────────────────────────────────────────────────────
  if (status === 'saving') {
    return (
      <View style={[s.center, { backgroundColor: '#1a1a2e' }]}>
        <Text style={{ color: '#fff', fontSize: 16 }}>{t('run.saving')}</Text>
      </View>
    );
  }

  // ── SAVED ────────────────────────────────────────────────────────────────────
  if (status === 'saved') {
    const activity = savedActivity || {
      elapsed_time_seconds: duration,
      distance_meters: calcDistance(points),
      segment_efforts: [],
      segment_efforts_count: 0
    };
    const segmentCount = activity.segment_efforts_count || activity.segment_efforts?.length || 0;
    const hasSegments = segmentCount > 0;

    return (
      <ScrollView style={s.savedScreen} contentContainerStyle={s.savedContent}>
        <Text style={s.savedCheck}>✓</Text>
        <Text style={s.savedTitle}>{t('run.runSaved')}</Text>
        <View style={s.summaryCard}>
          <Text style={s.summaryKicker}>{hasSegments ? t('run.segmentUnlocked') : t('run.noSegmentUnlocked')}</Text>
          <View style={s.summaryStats}>
            <SummaryStat label={t('run.distance')} value={fmtDist(activity.distance_meters)} />
            <SummaryStat label={t('run.time')} value={fmtTime(activity.elapsed_time_seconds || duration)} />
            <SummaryStat
              label={t('run.pace')}
              value={fmtPace(activity.elapsed_time_seconds, activity.distance_meters)}
            />
          </View>
          <View style={s.segmentSummary}>
            <Text style={s.segmentCount}>{t('run.segmentsCompleted', { count: segmentCount })}</Text>
            {hasSegments ? (
              activity.segment_efforts.map((effort) => (
                <View key={effort.id} style={s.segmentRow}>
                  <Text style={s.segmentName}>{effort.segment?.name}</Text>
                  <Text style={s.segmentTime}>{effort.formatted_time}</Text>
                </View>
              ))
            ) : (
              <Text style={s.noSegmentsText}>{t('run.noSegmentsCompleted')}</Text>
            )}
          </View>
        </View>
        <View style={s.savedActions}>
          <TouchableOpacity style={s.shareBtn} onPress={() => shareActivity(activity, t)}>
            <Text style={s.shareBtnText}>{t('run.shareResult')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.newRunBtn} onPress={reset}>
            <Text style={s.newRunBtnText}>{t('run.newRun')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ── RECORDING / PAUSED ───────────────────────────────────────────────────────
  const distKm = calcDistance(points) / 1000;
  const pace = duration > 0 && distKm > 0.01 ? fmtTime(Math.round(duration / distKm)) : '--:--';
  const isPaused = status === 'paused';

  return (
    <View style={s.screen}>
      {/* Header bar — yellow when paused */}
      <View style={[s.statsBar, isPaused && s.statsBarPaused]}>
        {isPaused ? <Text style={s.pausedLabel}>{t('run.paused')}</Text> : <View style={s.recDot} />}
        <Stat label={t('run.time')} value={fmtTime(duration)} dark={isPaused} />
        <Stat label={t('run.distance')} value={`${distKm.toFixed(2)} km`} dark={isPaused} />
        <Stat label={t('run.pace')} value={pace} dark={isPaused} />
      </View>

      {/* Live map */}
      <View style={s.mapWrap}>
        {points.length > 0 ? (
          <LeafletMap points={points} follow={!isPaused} />
        ) : (
          <View style={[StyleSheet.absoluteFill, s.noMap]}>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{t('run.waitingGps')}</Text>
          </View>
        )}
      </View>

      {/* Bottom controls */}
      <View style={s.footer}>
        {isPaused ? (
          <View style={s.pausedRow}>
            <TouchableOpacity style={s.pillBtn('#e53935')} onPress={resumeRun}>
              <Text style={s.pillIcon}>▶</Text>
              <Text style={s.pillLabel}>{t('run.resume')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.pillBtn('#1a1a2e')} onPress={finishRun}>
              <Text style={s.pillIcon}>■</Text>
              <Text style={s.pillLabel}>{t('run.finish')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.roundBtn('#e53935')} onPress={pauseRun}>
            <Text style={s.btnLabel}>{t('run.stop')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function Stat({ label, value, dark }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text
        style={{
          color: dark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.8
        }}
      >
        {label}
      </Text>
      <Text style={{ color: dark ? '#1a1a2e' : '#fff', fontSize: 20, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

function SummaryStat({ label, value }) {
  return (
    <View style={s.summaryStat}>
      <Text style={s.summaryStatLabel}>{label}</Text>
      <Text style={s.summaryStatValue}>{value}</Text>
    </View>
  );
}

function shareActivity(activity, t) {
  Share.share({ message: buildActivityShareText(activity, t) }).catch(() => {
    // Native share can be cancelled or unavailable.
  });
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

function fmtTime(secs) {
  const h = Math.floor(secs / 3600),
    m = Math.floor((secs % 3600) / 60),
    s = secs % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function fmtDist(meters) {
  return `${((meters || 0) / 1000).toFixed(2)} km`;
}

function fmtPace(secs, meters) {
  if (!secs || !meters) {
    return '--:--';
  }

  return fmtTime(Math.round(secs / (meters / 1000)));
}

function calcDistance(pts) {
  if (pts.length < 2) {
    return 0;
  }
  return pts.slice(1).reduce((total, pt, i) => total + haversine(pts[i], pt), 0);
}

function haversine(a, b) {
  const R = 6371000,
    rad = Math.PI / 180;
  const dlat = (b.lat - a.lat) * rad,
    dlng = (b.lng - a.lng) * rad;
  const x = Math.sin(dlat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1a1a2e' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a2e'
  },
  statsBarPaused: { backgroundColor: '#ffc107' },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e53935' },
  pausedLabel: { color: '#1a1a2e', fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  mapWrap: { flex: 1, position: 'relative' },
  noMap: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  footer: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16, backgroundColor: '#1a1a2e' },
  gpsDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2196f3' },
  roundBtn: (bg) => ({
    backgroundColor: bg,
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center'
  }),
  btnLabel: { color: '#fff', fontWeight: '700', fontSize: 15 },
  pausedRow: { flexDirection: 'row', gap: 12, width: '100%' },
  pillBtn: (bg) => ({
    flex: 1,
    backgroundColor: bg,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  }),
  pillIcon: { color: '#fff', fontSize: 14 },
  pillLabel: { color: '#fff', fontWeight: '700', fontSize: 16 },
  savedScreen: { flex: 1, backgroundColor: '#1a1a2e' },
  savedContent: { padding: 20, paddingBottom: 36, alignItems: 'center' },
  savedCheck: { fontSize: 48, marginBottom: 8, color: '#4caf50' },
  savedTitle: { color: '#4caf50', fontSize: 20, fontWeight: '800', marginBottom: 18 },
  summaryCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 4
  },
  summaryKicker: { color: '#e53935', fontSize: 13, fontWeight: '800', marginBottom: 14, textTransform: 'uppercase' },
  summaryStats: { flexDirection: 'row', gap: 8 },
  summaryStat: { flex: 1, backgroundColor: '#f7f7f9', borderRadius: 12, padding: 10 },
  summaryStatLabel: { color: '#777', fontSize: 10, textTransform: 'uppercase', fontWeight: '700', marginBottom: 4 },
  summaryStatValue: { color: '#1a1a2e', fontSize: 16, fontWeight: '800' },
  segmentSummary: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 14 },
  segmentCount: { color: '#1a1a2e', fontSize: 16, fontWeight: '800', marginBottom: 10 },
  segmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  segmentName: { color: '#333', fontSize: 14, fontWeight: '600', flex: 1 },
  segmentTime: { color: '#e53935', fontSize: 14, fontWeight: '800' },
  noSegmentsText: { color: '#777', lineHeight: 20 },
  savedActions: { width: '100%', gap: 10, marginTop: 18 },
  shareBtn: { backgroundColor: '#e53935', borderRadius: 14, padding: 15, alignItems: 'center' },
  shareBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  newRunBtn: {
    borderColor: 'rgba(255,255,255,0.24)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 15,
    alignItems: 'center'
  },
  newRunBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 }
});

export default RunTrackerScreen;
