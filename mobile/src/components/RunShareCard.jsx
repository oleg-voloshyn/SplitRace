import { ChevronRight, Footprints, MapPin, Zap } from 'lucide-react-native';
import { Image, Text, View } from 'react-native';

const ACCENT = '#e53935';

function RunShareCard({ activity, forwardRef }) {
  const segmentCount = activity.segment_efforts_count || activity.segment_efforts?.length || 0;
  const segments = activity.segment_efforts || [];
  const hasSegments = segmentCount > 0;

  return (
    <View
      ref={forwardRef}
      collapsable={false}
      className="w-[360px] bg-[#0d1124] rounded-3xl p-6 overflow-hidden"
    >
      {/* Decorative circles */}
      <View
        className="absolute -top-[60px] -right-[60px] w-[180px] h-[180px] rounded-full bg-brand-red"
        style={{ opacity: 0.08 }}
      />
      <View
        className="absolute -bottom-[40px] -left-[40px] w-[140px] h-[140px] rounded-full bg-blue-500"
        style={{ opacity: 0.07 }}
      />
      <View
        className="absolute top-[80px] -left-[20px] w-[80px] h-[80px] rounded-full bg-brand-red"
        style={{ opacity: 0.05 }}
      />

      {/* Header */}
      <View className="flex-row items-center gap-3 mb-4">
        <View className="w-10 h-10 rounded-xl bg-[#151a30] overflow-hidden items-center justify-center">
          <Image source={require('../../assets/icon.png')} className="w-9 h-9 rounded-lg" />
        </View>
        <View>
          <Text className="text-white text-[15px] font-black tracking-[2px]">SPLITRACE</Text>
          <Text className="text-white/45 text-[10px] tracking-[0.5px] mt-px">Run • Compete • Improve</Text>
        </View>
        <View className="ml-auto w-10 h-10 rounded-full bg-brand-red items-center justify-center">
          <Footprints size={20} color="#fff" strokeWidth={2.4} />
        </View>
      </View>

      <View className="h-px bg-white/10 mb-5" />

      {/* Main stats */}
      <View className="flex-row items-center bg-[#151a30] rounded-2xl p-4 mb-4">
        <StatBlock value={fmtDist(activity.distance_meters)} label="ДИСТАНЦІЯ" accent />
        <View className="w-px h-9 bg-white/10" />
        <StatBlock value={fmtTime(activity.elapsed_time_seconds)} label="ЧАС" />
        <View className="w-px h-9 bg-white/10" />
        <StatBlock value={fmtPace(activity.elapsed_time_seconds, activity.distance_meters)} label="ТЕМП /км" />
      </View>

      {/* Segments */}
      <View className="bg-[#151a30] rounded-2xl p-3.5 mb-4">
        <View className="flex-row items-center gap-2 mb-2.5">
          {hasSegments ? <Zap size={16} color="#facc15" fill="#facc15" /> : <MapPin size={16} color="#fff" />}
          <Text className="text-white text-[13px] font-extrabold">
            {hasSegments ? `${segmentCount} сегмент${segmentCount > 1 ? 'и' : ''} пройдено` : 'Сегменти не пройдені'}
          </Text>
        </View>
        {hasSegments &&
          segments.slice(0, 3).map((effort, i) => (
            <View key={effort.id ?? i} className="flex-row items-center gap-1.5 py-1">
              <ChevronRight size={12} color={ACCENT} strokeWidth={2.4} />
              <Text className="text-white/75 text-xs flex-1" numberOfLines={1}>
                {effort.segment?.name}
              </Text>
              <Text className="text-brand-red text-[13px] font-extrabold">{effort.formatted_time}</Text>
            </View>
          ))}
        {segments.length > 3 && <Text className="text-white/45 text-[11px] mt-1">+{segments.length - 3} ще...</Text>}
      </View>

      {/* Footer */}
      <View className="flex-row items-center justify-center gap-2">
        <Text className="text-white/45 text-[11px]">splitrace.app</Text>
        <View className="w-[3px] h-[3px] rounded-full bg-brand-red" />
        <Text className="text-white/45 text-[11px]">Час пробіжки — {new Date().toLocaleDateString('uk-UA')}</Text>
      </View>
    </View>
  );
}

function StatBlock({ value, label, accent }) {
  return (
    <View className="flex-1 items-center">
      <Text className={`text-[22px] font-black tracking-tight ${accent ? 'text-brand-red' : 'text-white'}`}>
        {value}
      </Text>
      <Text className="text-white/45 text-[9px] font-bold uppercase tracking-wider mt-1">{label}</Text>
    </View>
  );
}

function fmtTime(secs) {
  if (!secs) {
    return '--:--';
  }
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
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

export { RunShareCard };
