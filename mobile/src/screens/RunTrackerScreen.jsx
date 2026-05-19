import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Sharing from 'expo-sharing';
import * as TaskManager from 'expo-task-manager';
import { ArrowRight, Check, Play, Square, Trophy } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { api } from '../api/client';
import LeafletMap from '../components/LeafletMap';
import { RUN_SHARE_FORMATS, RunShareCard } from '../components/RunShareCard';
import ShareFormatButtons from '../components/ShareFormatButtons';
import { buildShareText, calcDistance, fmtDist, fmtPace, fmtTime } from '../utils/runUtils';

const LOCATION_TASK = 'splitrace-location-task';
const POINTS_KEY = 'splitrace_run_points';
const MIN_DISTANCE_M = 30;
const GPS_MAX_ACCURACY_M = 100;
const CONFIRMATION_PREVIEW_SCALE = 0.56;

const styles = StyleSheet.create({
  hiddenShareCard: {
    position: 'absolute',
    left: -10000,
    top: 0
  },
  sharePreviewFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  scaledSharePreview: {
    alignItems: 'center',
    justifyContent: 'center'
  }
});

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
  const [status, setStatus] = useState('idle');
  const [points, setPoints] = useState([]);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);
  const [savedActivity, setSavedActivity] = useState(null);
  const [shareFormat, setShareFormat] = useState('story');
  const [savedView, setSavedView] = useState('confirmation');
  const [previewPoint, setPreviewPoint] = useState(null);
  const [gpsReady, setGpsReady] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('checking');

  const startTime = useRef(null);
  const segmentStart = useRef(null);
  const accumulatedMs = useRef(0);
  const timerRef = useRef(null);
  const shareCardRef = useRef(null);

  useEffect(() => {
    if (status !== 'idle') {
      return;
    }

    let cancelled = false;
    let subscription;

    async function warmUpGps() {
      setGpsStatus('checking');
      setGpsReady(false);

      const { status: fg } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) {
        return;
      }
      if (fg !== 'granted') {
        setError(t('run.permissionDenied'));
        setGpsStatus('denied');
        return;
      }

      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 120000,
        requiredAccuracy: GPS_MAX_ACCURACY_M
      }).catch(() => null);
      if (!cancelled && lastKnown) {
        setPreviewPoint(pointFromLocation(lastKnown));
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      }).catch(() => null);
      if (!cancelled && current) {
        acceptGpsPoint(current);
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 2
        },
        (location) => {
          if (!cancelled) {
            acceptGpsPoint(location);
          }
        }
      ).catch(() => null);
    }

    function acceptGpsPoint(location) {
      const point = pointFromLocation(location);
      setPreviewPoint(point);
      if (isUsableGpsPoint(point)) {
        setGpsReady(true);
        setGpsStatus('ready');
        setError(null);
      } else {
        setGpsStatus('weak');
      }
    }

    warmUpGps();

    return () => {
      cancelled = true;
      subscription?.remove?.();
    };
  }, [status, t]);

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
      timeInterval: 1000,
      distanceInterval: 2,
      foregroundService: {
        notificationTitle: 'SplitRace — Recording run',
        notificationBody: 'Your route is being tracked.',
        notificationColor: '#e53935'
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true
    });
  }

  async function getFreshGpsPoint() {
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== 'granted') {
      setError(t('run.permissionDenied'));
      setGpsStatus('denied');
      return null;
    }

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High
    }).catch(() => null);
    if (!current) {
      return null;
    }

    const point = pointFromLocation(current);
    setPreviewPoint(point);
    if (!isUsableGpsPoint(point)) {
      setGpsStatus('weak');
      return null;
    }

    setGpsReady(true);
    setGpsStatus('ready');
    return point;
  }

  async function startRun() {
    setError(null);

    const initialPoint = gpsReady && previewPoint ? previewPoint : await getFreshGpsPoint();
    if (!initialPoint) {
      setGpsStatus('checking');
      setError(t('run.waitingGps'));
      return;
    }

    setStatus('acquiring');

    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    if (bg !== 'granted') {
      Alert.alert(t('run.backgroundNeeded'), t('run.backgroundNeededMsg'), [{ text: t('common.ok') }]);
    }

    await AsyncStorage.removeItem(POINTS_KEY);
    await AsyncStorage.setItem(POINTS_KEY, JSON.stringify([initialPoint]));
    setPoints([initialPoint]);
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
      setSavedView('confirmation');
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
    setPoints(previewPoint ? [previewPoint] : []);
    setDuration(0);
    setError(null);
    setStatus('idle');
  }

  function reset() {
    setStatus('idle');
    setPoints(previewPoint ? [previewPoint] : []);
    setDuration(0);
    setSavedActivity(null);
    setSavedView('confirmation');
    accumulatedMs.current = 0;
    setError(null);
  }

  if (status === 'idle' || status === 'error' || status === 'acquiring') {
    const waitingForGps = status === 'acquiring' || !gpsReady;
    const message =
      status === 'acquiring'
        ? t('run.gettingGps')
        : gpsReady
          ? t('run.ready')
          : gpsStatus === 'denied'
            ? t('run.permissionDenied')
            : t('run.waitingGps');

    return (
      <View className="flex-1 bg-brand-navy">
        <View className="flex-1 relative">
          {previewPoint ? (
            <LeafletMap points={[previewPoint]} follow />
          ) : (
            <View style={StyleSheet.absoluteFill} className="items-center justify-center bg-neutral-900">
              <Text className="text-white/40 text-[13px]">{t('run.waitingGps')}</Text>
            </View>
          )}
        </View>

        <View className="items-center py-7 px-4 bg-brand-navy">
          <Text className="text-white/55 mb-2 text-[15px] text-center">{message}</Text>
          {waitingForGps && <Text className="text-white/35 text-[12px] mb-5 text-center">{t('run.goOutside')}</Text>}
          <TouchableOpacity
            className={`w-[90px] h-[90px] rounded-full items-center justify-center ${
              gpsReady && status !== 'acquiring' ? 'bg-green-500' : 'bg-gray-600'
            }`}
            onPress={startRun}
            disabled={!gpsReady || status === 'acquiring'}
          >
            <Text className="text-white font-bold text-[15px]">{status === 'acquiring' ? '...' : t('run.start')}</Text>
          </TouchableOpacity>
          {error && <Text className="text-brand-red mt-5 text-center px-6">{error}</Text>}
        </View>
      </View>
    );
  }

  if (status === 'saving') {
    return (
      <View className="flex-1 items-center justify-center bg-brand-navy">
        <Text className="text-white text-base">{t('run.saving')}</Text>
      </View>
    );
  }

  if (status === 'saved') {
    const activity = savedActivity || {
      elapsed_time_seconds: duration,
      distance_meters: calcDistance(points),
      segment_efforts: [],
      segment_efforts_count: 0,
      passed_segments: [],
      pending_rated_unlocks: [],
      new_personal_bests: []
    };
    const passedSegments = activity.passed_segments || [];
    const pendingUnlocks = activity.pending_rated_unlocks || [];
    const personalBests = activity.new_personal_bests || [];
    const passedCount = passedSegments.length;
    const hasPassed = passedCount > 0;
    const cardFormat = RUN_SHARE_FORMATS[shareFormat] || RUN_SHARE_FORMATS.story;

    if (savedView === 'confirmation') {
      return (
        <RunSavedConfirmation
          activity={activity}
          shareFormat={shareFormat}
          onViewSummary={() => setSavedView('summary')}
          t={t}
        />
      );
    }

    return (
      <View className="flex-1 bg-brand-navy">
        <View pointerEvents="none" style={styles.hiddenShareCard}>
          <ViewShot
            ref={shareCardRef}
            options={{ format: 'png', quality: 1 }}
            style={{
              width: cardFormat.width,
              height: cardFormat.height,
              borderRadius: 24,
              overflow: 'hidden'
            }}
          >
            <RunShareCard activity={activity} format={shareFormat} />
          </ViewShot>
        </View>
        <ScrollView className="flex-1" contentContainerClassName="p-5 pb-9 items-center">
          <RunSummaryPanel
            activity={activity}
            duration={duration}
            passedSegments={passedSegments}
            pendingUnlocks={pendingUnlocks}
            personalBests={personalBests}
            passedCount={passedCount}
            hasPassed={hasPassed}
            t={t}
          />
          <View className="w-full gap-2.5 mt-4">
            <ShareFormatButtons selected={shareFormat} onSelect={setShareFormat} />
            <TouchableOpacity
              className="bg-brand-red rounded-2xl p-4 items-center"
              onPress={() => shareActivityImage(shareCardRef, activity, t)}
            >
              <Text className="text-white font-extrabold text-base">{t('run.shareResult')}</Text>
            </TouchableOpacity>
            <TouchableOpacity className="border border-white/25 rounded-2xl p-4 items-center" onPress={reset}>
              <Text className="text-white font-bold text-[15px]">{t('run.newRun')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  const distKm = calcDistance(points) / 1000;
  const pace = duration > 0 && distKm > 0.01 ? fmtTime(Math.round(duration / distKm)) : '--:--';
  const isPaused = status === 'paused';

  return (
    <View className="flex-1 bg-brand-navy">
      <View
        className={`flex-row items-center justify-around py-3.5 px-4 ${isPaused ? 'bg-amber-400' : 'bg-brand-navy'}`}
      >
        {isPaused ? (
          <Text className="text-brand-navy font-extrabold text-[11px] tracking-widest">{t('run.paused')}</Text>
        ) : (
          <View className="w-2.5 h-2.5 rounded-full bg-brand-red" />
        )}
        <Stat label={t('run.time')} value={fmtTime(duration)} dark={isPaused} />
        <Stat label={t('run.distance')} value={`${distKm.toFixed(2)} km`} dark={isPaused} />
        <Stat label={t('run.pace')} value={pace} dark={isPaused} />
      </View>

      <View className="flex-1 relative">
        {points.length > 0 ? (
          <LeafletMap points={points} follow={!isPaused} />
        ) : (
          <View style={StyleSheet.absoluteFill} className="items-center justify-center bg-neutral-900">
            <Text className="text-white/40 text-[13px]">{t('run.waitingGps')}</Text>
          </View>
        )}
      </View>

      <View className="items-center py-5 px-4 bg-brand-navy">
        {isPaused ? (
          <View className="flex-row gap-3 w-full">
            <TouchableOpacity
              className="flex-1 h-14 rounded-full flex-row items-center justify-center gap-2 bg-brand-red"
              onPress={resumeRun}
            >
              <Play size={14} color="#fff" fill="#fff" />
              <Text className="text-white font-bold text-base">{t('run.resume')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 h-14 rounded-full flex-row items-center justify-center gap-2 bg-brand-navy border border-white/25"
              onPress={finishRun}
            >
              <Square size={14} color="#fff" fill="#fff" />
              <Text className="text-white font-bold text-base">{t('run.finish')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            className="w-[90px] h-[90px] rounded-full items-center justify-center bg-brand-red"
            onPress={pauseRun}
          >
            <Text className="text-white font-bold text-[15px]">{t('run.stop')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function RunSavedConfirmation({ activity, shareFormat, onViewSummary, t }) {
  const cardFormat = RUN_SHARE_FORMATS[shareFormat] || RUN_SHARE_FORMATS.story;
  const previewWidth = cardFormat.width * CONFIRMATION_PREVIEW_SCALE;
  const previewHeight = cardFormat.height * CONFIRMATION_PREVIEW_SCALE;

  return (
    <View className="flex-1 bg-brand-navy px-5 pt-7 pb-6">
      <View className="items-center">
        <Check size={52} color="#4caf50" strokeWidth={3} />
        <Text className="text-green-500 text-xl font-extrabold mt-2 text-center">{t('run.runSaved')}</Text>
        <Text className="text-white/45 text-[13px] leading-5 mt-2 text-center">{t('run.savedSummaryHint')}</Text>
      </View>

      <View className="flex-1 items-center justify-center py-5">
        <View
          className="rounded-3xl"
          style={[styles.sharePreviewFrame, { width: previewWidth, height: previewHeight }]}
        >
          <View
            style={[
              styles.scaledSharePreview,
              {
                width: cardFormat.width,
                height: cardFormat.height,
                transform: [{ scale: CONFIRMATION_PREVIEW_SCALE }]
              }
            ]}
          >
            <RunShareCard activity={activity} format={shareFormat} />
          </View>
        </View>
      </View>

      <TouchableOpacity
        className="bg-brand-red rounded-2xl p-4 flex-row items-center justify-center gap-2"
        onPress={onViewSummary}
      >
        <Text className="text-white font-extrabold text-base">{t('run.viewSummary')}</Text>
        <ArrowRight size={18} color="#fff" strokeWidth={2.8} />
      </TouchableOpacity>
    </View>
  );
}

function RunSummaryPanel({
  activity,
  duration,
  passedSegments,
  pendingUnlocks,
  personalBests,
  passedCount,
  hasPassed,
  t
}) {
  return (
    <View className="w-full bg-white rounded-2xl p-4 shadow-lg">
      <Text className="text-brand-red text-[13px] font-extrabold mb-3.5 uppercase">{t('run.noSegmentUnlocked')}</Text>
      <View className="flex-row gap-2">
        <SummaryStat label={t('run.distance')} value={fmtDist(activity.distance_meters)} />
        <SummaryStat label={t('run.time')} value={fmtTime(activity.elapsed_time_seconds || duration)} />
        <SummaryStat label={t('run.pace')} value={fmtPace(activity.elapsed_time_seconds, activity.distance_meters)} />
      </View>
      <View className="mt-4 border-t border-gray-200 pt-3.5">
        <Text className="text-brand-navy text-base font-extrabold mb-2.5">
          {t('run.segmentsCompleted', { count: passedCount })}
          {hasPassed ? ':' : ''}
        </Text>
        {hasPassed ? (
          passedSegments.map((seg) => (
            <View key={seg.id} className="flex-row gap-3 py-2 border-b border-gray-100">
              <Text className="text-gray-400 text-sm">•</Text>
              <Text className="text-gray-800 text-sm font-semibold flex-1">{seg.name}</Text>
            </View>
          ))
        ) : (
          <Text className="text-gray-600 leading-5">{t('run.noSegmentsCompleted')}</Text>
        )}
        {personalBests.length > 0 && (
          <View className="mt-3 pt-3 border-t border-gray-100">
            {personalBests.map((pb) => (
              <View key={pb.segment_id} className="flex-row items-center gap-2 py-1.5">
                <Trophy size={16} color="#d97706" strokeWidth={2.5} />
                <Text className="text-amber-700 text-[13px] leading-[18px] flex-1 font-semibold">
                  {t('run.newPersonalBest', {
                    segment: pb.segment_name,
                    time: pb.formatted_time,
                    previous: pb.previous_best_formatted
                  })}
                </Text>
              </View>
            ))}
          </View>
        )}
        {pendingUnlocks.length > 0 && (
          <View className="mt-3 pt-3 border-t border-gray-100">
            {pendingUnlocks.map((p) => (
              <Text key={`${p.tournament_name}-${p.position}`} className="text-amber-800 text-[13px] leading-[18px]">
                {t('run.pendingRatedUnlock', { position: p.position })}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function Stat({ label, value, dark }) {
  return (
    <View className="items-center">
      <Text className={`text-[10px] uppercase tracking-wider ${dark ? 'text-black/55' : 'text-white/55'}`}>
        {label}
      </Text>
      <Text className={`text-xl font-bold ${dark ? 'text-brand-navy' : 'text-white'}`}>{value}</Text>
    </View>
  );
}

function SummaryStat({ label, value }) {
  return (
    <View className="flex-1 bg-gray-50 rounded-xl p-2.5">
      <Text className="text-gray-500 text-[10px] uppercase font-bold mb-1">{label}</Text>
      <Text className="text-brand-navy text-base font-extrabold">{value}</Text>
    </View>
  );
}

async function shareActivityImage(cardRef, activity, t) {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable || !cardRef.current) {
      shareActivityText(activity, t);
      return;
    }
    const uri = await cardRef.current.capture();
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('run.shareResult') });
  } catch {
    shareActivityText(activity, t);
  }
}

function shareActivityText(activity, t) {
  Share.share({ message: buildShareText(activity, t) }).catch(() => {});
}

function pointFromLocation(location) {
  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    ts: Math.floor((location.timestamp || Date.now()) / 1000),
    accuracy: location.coords.accuracy
  };
}

function isUsableGpsPoint(point) {
  return Boolean(point) && (point.accuracy == null || point.accuracy <= GPS_MAX_ACCURACY_M);
}

export default RunTrackerScreen;
