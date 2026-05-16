import { Flag, MapPin, Trophy } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { RUN_SHARE_FORMATS } from './RunShareCard';

function EntityShareCard({ entity, kind = 'tournament', format = 'story', url, stats = [] }) {
  const cardFormat = RUN_SHARE_FORMATS[format] || RUN_SHARE_FORMATS.story;
  const isStory = cardFormat.key === 'story';
  const Icon = kind === 'segment' ? MapPin : Trophy;

  return (
    <View
      collapsable={false}
      className="bg-[#0d1124] rounded-3xl overflow-hidden"
      style={{ width: cardFormat.width, height: cardFormat.height, padding: isStory ? 28 : 24 }}
    >
      <View className="absolute -top-[70px] -right-[60px] w-[190px] h-[190px] rounded-full bg-brand-red opacity-10" />
      <View className="absolute -bottom-[60px] -left-[60px] w-[170px] h-[170px] rounded-full bg-blue-500 opacity-10" />

      <View className={`flex-row items-center gap-3 ${isStory ? 'mb-14' : 'mb-8'}`}>
        <View className="w-11 h-11 rounded-xl bg-[#151a30] items-center justify-center">
          <Flag size={22} color="#e53935" />
        </View>
        <View>
          <Text className="text-white text-[16px] font-black tracking-[2px]">SPLITRACE</Text>
          <Text className="text-white/45 text-[10px] mt-px">Run • Compete • Improve</Text>
        </View>
      </View>

      <View className={`${isStory ? 'h-[190px] mb-12' : 'h-[118px] mb-7'} items-center justify-center`}>
        <View className="absolute w-[230px] h-[90px] border-b-[18px] border-brand-red rounded-full opacity-90" />
        <View className="w-[78px] h-[78px] rounded-full bg-brand-red items-center justify-center">
          <Icon size={34} color="#fff" strokeWidth={2.4} />
        </View>
      </View>

      <Text className="text-brand-red text-[12px] font-black uppercase tracking-[2px] mb-3">
        {kind === 'segment' ? 'Segment' : 'Tournament'}
      </Text>
      <Text
        className={`${isStory ? 'text-[34px] leading-[39px]' : 'text-[28px] leading-[33px]'} text-white font-black`}
      >
        {entity.name}
      </Text>
      <Text className="text-white/55 text-[13px] mt-3" numberOfLines={2}>
        {[entity.city, entity.country].filter(Boolean).join(', ') ||
          (kind === 'segment' ? 'SplitRace segment' : 'SplitRace tournament')}
      </Text>

      <View className={`${isStory ? 'mt-auto' : 'mt-8'} bg-[#151a30] rounded-2xl p-4`}>
        <View className="flex-row gap-2">
          {stats.slice(0, 3).map((stat, index) => (
            <View key={`${stat.label}-${index}`} className="flex-1">
              <Text className={`${index === 0 ? 'text-brand-red' : 'text-white'} text-[20px] font-black`}>
                {stat.value}
              </Text>
              <Text className="text-white/45 text-[9px] font-bold uppercase mt-1">{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text className="text-white/45 text-[11px] text-center mt-5" numberOfLines={1}>
        {url.replace(/^https?:\/\//, '')}
      </Text>
    </View>
  );
}

export default EntityShareCard;
