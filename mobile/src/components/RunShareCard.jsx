import { Image, StyleSheet, Text, View } from 'react-native';

const ACCENT = '#e53935';
const NAVY = '#0d1124';
const NAVY2 = '#151a30';
const WHITE = '#ffffff';
const DIM = 'rgba(255,255,255,0.45)';

function RunShareCard({ activity, forwardRef }) {
  const segmentCount = activity.segment_efforts_count || activity.segment_efforts?.length || 0;
  const segments = activity.segment_efforts || [];
  const hasSegments = segmentCount > 0;

  return (
    <View ref={forwardRef} style={s.card} collapsable={false}>
      {/* Decorative circles */}
      <View style={s.decor1} />
      <View style={s.decor2} />
      <View style={s.decor3} />

      {/* Header */}
      <View style={s.header}>
        <View style={s.logoWrap}>
          <Image source={require('../../assets/icon.png')} style={s.logoIcon} />
        </View>
        <View>
          <Text style={s.appName}>SPLITRACE</Text>
          <Text style={s.tagline}>Run • Compete • Improve</Text>
        </View>
        <View style={s.runBadge}>
          <Text style={s.runBadgeText}>🏃</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={s.divider} />

      {/* Main stats */}
      <View style={s.statsRow}>
        <StatBlock value={fmtDist(activity.distance_meters)} label="ДИСТАНЦІЯ" accent />
        <View style={s.statSep} />
        <StatBlock value={fmtTime(activity.elapsed_time_seconds)} label="ЧАС" />
        <View style={s.statSep} />
        <StatBlock value={fmtPace(activity.elapsed_time_seconds, activity.distance_meters)} label="ТЕМП /км" />
      </View>

      {/* Segments */}
      <View style={s.segmentBox}>
        <View style={s.segmentHeader}>
          <Text style={s.segmentIcon}>{hasSegments ? '⚡' : '📍'}</Text>
          <Text style={s.segmentTitle}>
            {hasSegments ? `${segmentCount} сегмент${segmentCount > 1 ? 'и' : ''} пройдено` : 'Сегменти не пройдені'}
          </Text>
        </View>
        {hasSegments &&
          segments.slice(0, 3).map((effort, i) => (
            <View key={effort.id ?? i} style={s.segmentRow}>
              <Text style={s.segmentDot}>▸</Text>
              <Text style={s.segmentName} numberOfLines={1}>
                {effort.segment?.name}
              </Text>
              <Text style={s.segmentTime}>{effort.formatted_time}</Text>
            </View>
          ))}
        {segments.length > 3 && <Text style={s.moreSegments}>+{segments.length - 3} ще...</Text>}
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <Text style={s.footerText}>splitrace.app</Text>
        <View style={s.footerDot} />
        <Text style={s.footerText}>Час пробіжки — {new Date().toLocaleDateString('uk-UA')}</Text>
      </View>
    </View>
  );
}

function StatBlock({ value, label, accent }) {
  return (
    <View style={s.statBlock}>
      <Text style={[s.statValue, accent && { color: ACCENT }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function fmtTime(secs) {
  if (!secs) {
    return '--:--';
  }
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

const s = StyleSheet.create({
  card: {
    width: 360,
    backgroundColor: NAVY,
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden'
  },
  decor1: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: ACCENT,
    opacity: 0.08
  },
  decor2: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#2196f3',
    opacity: 0.07
  },
  decor3: {
    position: 'absolute',
    top: 80,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ACCENT,
    opacity: 0.05
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16
  },
  logoWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: NAVY2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoIcon: { width: 36, height: 36, borderRadius: 8 },
  appName: { color: WHITE, fontSize: 15, fontWeight: '900', letterSpacing: 2 },
  tagline: { color: DIM, fontSize: 10, letterSpacing: 0.5, marginTop: 1 },
  runBadge: {
    marginLeft: 'auto',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center'
  },
  runBadgeText: { fontSize: 20 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 20 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NAVY2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16
  },
  statBlock: { flex: 1, alignItems: 'center' },
  statValue: { color: WHITE, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: {
    color: DIM,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 3
  },
  statSep: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.1)' },
  segmentBox: {
    backgroundColor: NAVY2,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16
  },
  segmentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  segmentIcon: { fontSize: 16 },
  segmentTitle: { color: WHITE, fontSize: 13, fontWeight: '800' },
  segmentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  segmentDot: { color: ACCENT, fontSize: 12 },
  segmentName: { color: 'rgba(255,255,255,0.75)', fontSize: 12, flex: 1 },
  segmentTime: { color: ACCENT, fontSize: 13, fontWeight: '800' },
  moreSegments: { color: DIM, fontSize: 11, marginTop: 4 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  footerText: { color: DIM, fontSize: 11 },
  footerDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: ACCENT }
});

export { RunShareCard };
