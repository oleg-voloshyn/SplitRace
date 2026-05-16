import { Text, TouchableOpacity, View } from 'react-native';
import { RUN_SHARE_FORMATS } from './RunShareCard';

function ShareFormatButtons({ selected, onSelect, onShare, compact = false }) {
  return (
    <View className={`flex-row gap-2 ${compact ? 'mt-2.5' : 'mt-1 mb-3'}`}>
      {Object.values(RUN_SHARE_FORMATS).map((format) => {
        const active = selected === format.key;
        return (
          <TouchableOpacity
            key={format.key}
            className={`rounded-xl border px-3 py-2 ${active ? 'border-brand-red bg-red-50' : 'border-gray-200 bg-white'}`}
            onPress={() => (onShare ? onShare(format.key) : onSelect(format.key))}
          >
            <Text className={`text-xs font-extrabold ${active ? 'text-brand-red' : 'text-brand-navy'}`}>
              {format.label}
            </Text>
            <Text className={`text-[10px] ${active ? 'text-brand-red' : 'text-gray-500'}`}>{format.ratio}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default ShareFormatButtons;
