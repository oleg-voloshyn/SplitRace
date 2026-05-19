import { Text, View } from 'react-native';

function StepProgress({ current, total, t }) {
  return (
    <View className="bg-white px-4 pt-3 pb-3 border-b border-gray-200">
      <Text className="text-xs text-gray-500 mb-2">{t('creator.wizardStep', { current, total })}</Text>
      <View className="flex-row gap-1.5">
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
          <View key={n} className={`flex-1 h-1 rounded-full ${n <= current ? 'bg-brand-red' : 'bg-gray-200'}`} />
        ))}
      </View>
    </View>
  );
}

export default StepProgress;
