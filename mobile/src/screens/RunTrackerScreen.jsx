import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Sharing from 'expo-sharing';
import * as TaskManager from 'expo-task-manager';
import { Check, Play, Square } from 'lucide-react-native';
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

  const startTime = useRef(null);
  const segmentStart = useRef(null);
  const accumulatedMs = useRef(0);
  const timerRef = useRef(null);
  const shareCardRef = useRef(null);

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

  if (status === 'idle' || status === 'error') {
    return (
      <View className="flex-1 items-center justify-center bg-brand-navy">
        <Text className="text-white/50 mb-8 text-[15px]">{t('run.ready')}</Text>
        <TouchableOpacity
          className="w-[90px] h-[90px] rounded-full items-center justify-center bg-green-500"
          onPress={startRun}
        >
          <Text className="text-white font-bold text-[15px]">{t('run.start')}</Text>
        </TouchableOpacity>
        {error && <Text className="text-brand-red mt-5 text-center px-6">{error}</Text>}
      </View>
    );
  }

  if (status === 'acquiring') {
    return (
      <View className="flex-1 items-center justify-center bg-brand-navy">
        <View className="w-9 h-9 rounded-full bg-blue-500" />
        <Text className="text-white text-base mt-6 mb-2">{t('run.gettingGps')}</Text>
        <Text className="text-white/45 text-[13px] mb-10">{t('run.goOutside')}</Text>
        <TouchableOpacity
          className="w-[70px] h-[70px] rounded-full items-center justify-center bg-gray-600"
          onPress={reset}
        >
          <Text className="text-white font-bold text-[13px]">{t('run.cancel')}</Text>
        </TouchableOpacity>
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
      segment_efforts_count: 0
    };
    const segmentCount = activity.segment_efforts_count || activity.segment_efforts?.length || 0;
    const hasSegments = segmentCount > 0;
    const cardFormat = RUN_SHARE_FORMATS[shareFormat] || RUN_SHARE_FORMATS.story;

    return (
      <ScrollView className="flex-1 bg-brand-navy" contentContainerClassName="p-5 pb-9 items-center">
        <Check size={48} color="#4caf50" strokeWidth={3} />
        <Text className="text-green-500 text-xl font-extrabold mb-4 mt-2">{t('run.runSaved')}</Text>

        <ViewShot
          ref={shareCardRef}
          options={{ format: 'png', quality: 1 }}
          style={{
            width: cardFormat.width,
            height: cardFormat.height,
            marginBottom: 20,
            borderRadius: 24,
            overflow: 'hidden'
          }}
        >
          <RunShareCard activity={activity} format={shareFormat} />
        </ViewShot>

        <View className="w-full bg-white rounded-2xl p-4 shadow-lg">
          <Text className="text-brand-red text-[13px] font-extrabold mb-3.5 uppercase">
            {hasSegments ? t('run.segmentUnlocked') : t('run.noSegmentUnlocked')}
          </Text>
          <View className="flex-row gap-2">
            <SummaryStat label={t('run.distance')} value={fmtDist(activity.distance_meters)} />
            <SummaryStat label={t('run.time')} value={fmtTime(activity.elapsed_time_seconds || duration)} />
            <SummaryStat
              label={t('run.pace')}
              value={fmtPace(activity.elapsed_time_seconds, activity.distance_meters)}
            />
          </View>
          <View className="mt-4 border-t border-gray-200 pt-3.5">
            <Text className="text-brand-navy text-base font-extrabold mb-2.5">
              {t('run.segmentsCompleted', { count: segmentCount })}
            </Text>
            {hasSegments ? (
              activity.segment_efforts.map((effort) => (
                <View key={effort.id} className="flex-row justify-between gap-3 py-2 border-b border-gray-100">
                  <Text className="text-gray-800 text-sm font-semibold flex-1">{effort.segment?.name}</Text>
                  <Text className="text-brand-red text-sm font-extrabold">{effort.formatted_time}</Text>
                </View>
              ))
            ) : (
              <Text className="text-gray-600 leading-5">{t('run.noSegmentsCompleted')}</Text>
            )}
          </View>
        </View>
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

export default RunTrackerScreen;
